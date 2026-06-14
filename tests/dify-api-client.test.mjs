import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";

const outfile = "tests/.tmp-dify-api-client.mjs";

await build({
	entryPoints: ["src/api/DifyApiClient.ts"],
	bundle: true,
	platform: "node",
	format: "esm",
	outfile,
	logLevel: "silent",
	plugins: [{
		name: "obsidian-stub",
		setup(build) {
			build.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "obsidian-stub" }));
			build.onLoad({ filter: /.*/, namespace: "obsidian-stub" }, () => ({
				contents: "export const requestUrl = (...args) => globalThis.__difyRequestUrl(...args);",
				loader: "js",
			}));
		},
	}],
});

const api = await import(pathToFileURL(`${process.cwd()}/${outfile}`).href);
globalThis.window = globalThis;

async function test(name, fn) {
	try {
		await fn();
		console.log(`ok - ${name}`);
	} catch (error) {
		console.error(`not ok - ${name}`);
		throw error;
	}
}

function createClient(settings) {
	return new api.DifyApiClient({
		settings: {
			difyApiKey: "key",
			difyApiUrl: "",
			lanApiUrl: "",
			publicApiUrl: "",
			endpointMode: "primary",
			apiPathStyle: "auto",
			requestTimeoutSeconds: 30,
			maxRetries: 0,
			...settings,
		},
		debug() {},
	});
}

await test("classifies rate limits, unexpected responses, and common network failures", async () => {
	assert.equal(api.classifyConnectionApiError(new api.DifyApiError("HTTP 429: too many", 429)), "rate_limited");
	assert.equal(
		api.classifyConnectionApiError(new api.DifyApiError("Current address did not return a Dify knowledge base API response (received an HTML page).")),
		"unexpected_response",
	);
	assert.equal(api.classifyConnectionApiError(new api.DifyApiError("connect ENOTFOUND dify.local")), "network");
	assert.equal(api.classifyConnectionApiError(new api.DifyApiError("read ECONNRESET")), "network");
});

await test("probeConnection ignores legacy alternate URLs and reports the primary address failure", async () => {
	globalThis.__difyRequestUrl = async ({ url }) => {
		if (url.startsWith("http://lan.example")) {
			throw new Error("legacy LAN URL should not be requested");
		}
		return { status: 401, text: JSON.stringify({ message: "bad key" }) };
	};

	const client = createClient({
		endpointMode: "auto",
		lanApiUrl: "http://lan.example",
		difyApiUrl: "http://primary.example",
	});
	const probe = await client.probeConnection();

	assert.equal(probe.status, "failed");
	assert.equal(probe.candidates.length, 1);
	assert.equal(probe.reason, "auth_failed");
	assert.equal(probe.statusCode, 401);
	assert.equal(probe.error, "HTTP 401: bad key");
	const finalCandidate = probe.candidates[probe.candidates.length - 1];
	assert.equal(finalCandidate.reason, probe.reason);
	assert.equal(finalCandidate.statusCode, probe.statusCode);
	assert.equal(finalCandidate.error, probe.error);
});

await test("probeConnection classifies HTML dataset responses as unexpected_response", async () => {
	globalThis.__difyRequestUrl = async () => ({
		status: 200,
		text: "<!doctype html><html><title>NAS</title></html>",
	});

	const client = createClient({ difyApiUrl: "http://nas.example" });
	const probe = await client.probeConnection();

	assert.equal(probe.status, "failed");
	assert.equal(probe.reason, "unexpected_response");
	assert.equal(probe.statusCode, undefined);
	assert.match(probe.error, /did not return a Dify knowledge base API response/);
});
