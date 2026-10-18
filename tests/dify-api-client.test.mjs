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

await test("text updates keep the existing body and hyphen/underscore route fallback", async () => {
	const requests = [];
	globalThis.__difyRequestUrl = async (options) => {
		requests.push(options);
		return options.url.endsWith("update-by-text")
			? { status: 404, text: "Unsupported route" }
			: { status: 200, text: JSON.stringify({ document: { id: "doc-1" } }) };
	};
	const client = createClient({ difyApiUrl: "http://dify.example" });
	await client.updateDocumentByText("kb/1", "doc-1", "Note.md", "---\nowner: me\n---\nText");
	assert.deepEqual(requests.map(request => new URL(request.url).pathname), [
		"/v1/datasets/kb%2F1/documents/doc-1/update-by-text",
		"/v1/datasets/kb%2F1/documents/doc-1/update_by_text",
	]);
	for (const request of requests) {
		assert.deepEqual(JSON.parse(request.body), {
			name: "Note.md", text: "---\nowner: me\n---\nText", process_rule: { mode: "automatic" },
		});
	}
});

await test("document existence checks traverse pages and reuse authentication", async () => {
	const requests = [];
	globalThis.__difyRequestUrl = async (options) => {
		requests.push(options);
		const page = Number(new URL(options.url).searchParams.get("page"));
		return { status: 200, text: JSON.stringify({
			data: [{ id: page === 1 ? "other" : "doc-1" }], has_more: page === 1,
		}) };
	};
	const client = createClient({ difyApiUrl: "http://dify.example" });
	assert.equal(await client.documentExists("kb/1", "doc-1"), true);
	assert.equal(requests.length, 2);
	assert.equal(requests[0].headers.Authorization, "Bearer key");
	assert.equal(requests[0].method, "GET");
	assert.match(requests[0].url, /datasets\/kb%2F1\/documents\?page=1&limit=100$/);
	assert.equal(await client.documentExists("kb/1", "missing"), false);
});

await test("document absence is never inferred from failed, malformed, or incomplete lists", async () => {
	const client = createClient({ difyApiUrl: "http://dify.example" });
	for (const response of [
		{ status: 404, text: "Unsupported route" },
		{ status: 401, text: "Unauthorized" },
		{ status: 500, text: "Unavailable" },
		{ status: 200, text: "<html>Login</html>" },
		{ status: 200, text: JSON.stringify({ data: [] }) },
		{ status: 200, text: JSON.stringify({ data: [{}], has_more: false }) },
		{ status: 200, text: JSON.stringify({ data: [], has_more: true }) },
	]) {
		globalThis.__difyRequestUrl = async () => response;
		await assert.rejects(() => client.documentExists("kb-1", "doc-1"));
	}
});
