import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";

const outfile = "tests/.tmp-dify-dataset-response.mjs";

await build({
	entryPoints: ["src/api/DifyDatasetResponse.ts"],
	bundle: true,
	platform: "node",
	format: "esm",
	outfile,
	logLevel: "silent",
});

const response = await import(pathToFileURL(`${process.cwd()}/${outfile}`).href);

function test(name, fn) {
	try {
		fn();
		console.log(`ok - ${name}`);
	} catch (error) {
		console.error(`not ok - ${name}`);
		throw error;
	}
}

test("extracts knowledge bases from Dify data array responses", () => {
	assert.deepEqual(response.extractKnowledgeBasesFromResponse({
		data: [
			{ id: "kb-1", name: "产品知识库", description: "Product docs" },
			{ id: "kb-2" },
		],
		has_more: false,
	}), [
		{ id: "kb-1", name: "产品知识库", description: "Product docs" },
		{ id: "kb-2", name: "kb-2", description: undefined },
	]);
});

test("keeps a valid empty data array distinct from invalid response shapes", () => {
	assert.deepEqual(response.extractKnowledgeBasesFromResponse({ data: [], has_more: false }), []);
	const diagnostics = response.describeDifyResponse({ data: [], has_more: false });

	assert.equal(diagnostics.dataIsArray, true);
	assert.equal(diagnostics.dataLength, 0);
	assert.equal(diagnostics.looksLikeHtml, false);
});

test("extracts knowledge bases from top-level array responses", () => {
	assert.deepEqual(response.extractKnowledgeBasesFromResponse([
		{ id: "kb-array", name: "Array response" },
	]), [
		{ id: "kb-array", name: "Array response", description: undefined },
	]);
});

test("rejects unexpected JSON response shapes instead of treating them as empty", () => {
	assert.throws(
		() => response.extractKnowledgeBasesFromResponse({ result: { data: [{ id: "kb-hidden" }] } }),
		/did not return a Dify knowledge base API response.*top-level fields: result/,
	);
});

test("diagnoses HTML or NAS web pages as non-Dify API responses", () => {
	assert.throws(
		() => response.extractKnowledgeBasesFromResponse({}, "<!doctype html><html><title>NAS</title></html>"),
		/did not return a Dify knowledge base API response.*received an HTML page/,
	);
	const diagnostics = response.describeDifyResponse({}, "<html></html>");

	assert.equal(diagnostics.looksLikeHtml, true);
	assert.equal(diagnostics.topLevelType, "object");
	assert.deepEqual(diagnostics.topLevelKeys, []);
});
