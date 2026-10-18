import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";

// Run the real plugin sync methods and API client; stub only the Obsidian host.
const outfile = "tests/.tmp-sync-reliability.mjs";
await build({
	stdin: {
		contents: 'export { default } from "./main"; export { DifyApiClient } from "./src/api/DifyApiClient";',
		resolveDir: process.cwd(), loader: "ts",
	},
	bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent",
	plugins: [{
		name: "obsidian-stub",
		setup(build) {
			build.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "obsidian-stub" }));
			build.onLoad({ filter: /.*/, namespace: "obsidian-stub" }, () => ({
				contents: `
					export class Plugin {} export class PluginSettingTab {} export class Modal {}
					export class App {} export class TAbstractFile {} export class TFile {} export class TFolder {}
					export class ButtonComponent {} export class ExtraButtonComponent {} export class Menu {}
					export class Notice {} export class Setting {} export class ToggleComponent {}
					export const setIcon = () => {};
					export const getFrontMatterInfo = () => ({ exists: false });
					export const parseYaml = () => ({});
					export const requestUrl = options => globalThis.__syncRequest(options);
				`, loader: "js",
			}));
		},
	}],
});
const { default: Plugin, DifyApiClient } = await import(pathToFileURL(`${process.cwd()}/${outfile}`).href);
globalThis.window = globalThis;

const original = {
	filePath: "Work/Note.md", datasetId: "kb-1", documentId: "doc-1", remoteName: "Work/Note.md",
	hash: "previous-hash", lastModified: 100, lastSyncedAt: "2026-10-08T00:00:00.000Z", lastBatch: "batch-1",
};
const response = (status, json) => ({ status, text: JSON.stringify(json) });
const stats = () => ({ synced: 0, skipped: 0, failed: 0, total: 1, syncedFiles: [], failedFiles: [] });

function fixture(record = original, documents = [{ id: "doc-1", name: "Work/Note.md" }]) {
	const plugin = new Plugin();
	plugin.settings = {
		language: "en", difyApiKey: "fixture-key", difyApiUrl: "http://dify.example", apiPathStyle: "auto",
		maxRetries: 0, maxConcurrent: 1, requestTimeoutSeconds: 5, pollIndexStatus: false,
		mappings: [{ enabled: true, folder: "Work", datasetIds: ["kb-1"] }], connectionHealth: { status: "unknown" },
	};
	plugin.client = new DifyApiClient(plugin);
	plugin.showSyncProgress = () => {};
	plugin.savePluginData = async () => {};
	const file = { path: "Work/Note.md", name: "Note.md", stat: { mtime: 200 } };
	const content = "---\nowner: me\n---\nUpdated body";
	plugin.app = { vault: { cachedRead: async () => content } };
	const key = plugin.getRecordKey("kb-1", file.path);
	if (record) plugin.syncRecords.set(key, { ...record });
	const index = {
		byId: new Map(documents.map(doc => [doc.id, doc])),
		byName: new Map(documents.map(doc => [doc.name, doc])),
	};
	return { plugin, file, index, task: {
		file, content, hash: plugin.hashContent(content), datasetId: "kb-1", remoteName: file.path, recordKey: key,
	} };
}

async function run(f, handler) {
	const requests = [];
	globalThis.__syncRequest = async options => {
		requests.push(options);
		return handler(options);
	};
	const result = stats();
	await f.plugin.processTasks([f.task], new Map([["kb-1", f.index]]), result);
	return { requests, result, record: f.plugin.syncRecords.get(f.task.recordKey) };
}

async function test(name, fn) {
	await fn();
	console.log(`ok - ${name}`);
}

await test("normal updates keep the ID and send no metadata request", async () => {
	const f = fixture();
	const { requests, result, record } = await run(f, () => response(200, { document: { id: "doc-1" } }));
	assert.equal(result.synced, 1);
	assert.equal(record.documentId, "doc-1");
	assert.equal(record.hash, f.task.hash);
	assert.equal(requests.length, 1);
	assert.match(requests[0].url, /\/doc-1\/update-by-text$/);
	assert.deepEqual(JSON.parse(requests[0].body), {
		name: f.task.remoteName, text: f.task.content, process_rule: { mode: "automatic" },
	});
});

await test("404 never recreates a document that still exists or cannot be confirmed absent", async () => {
	for (const check of [
		response(200, { data: [{ id: "doc-1" }], has_more: false }),
		response(404, { message: "List route missing" }),
		response(403, { message: "Forbidden" }),
		response(500, { message: "Unavailable" }),
		response(200, { data: [] }),
	]) {
		const f = fixture();
		const { requests, result, record } = await run(f, options => options.method === "GET"
			? check : response(404, { message: "Update route missing" }));
		assert.equal(result.failed, 1);
		assert.ok(record.lastError);
		assert.equal(record.documentId, "doc-1");
		assert.equal(record.hash, original.hash);
		assert.equal(record.lastSyncedAt, original.lastSyncedAt);
		assert.equal(record.lastBatch, original.lastBatch);
		assert.equal(requests.filter(request => request.url.includes("create")).length, 0);
	}
});

await test("confirmed deletion recreates with a returned new ID and rejects missing IDs", async () => {
	for (const created of [{ document: { id: "doc-new" }, batch: "batch-new" }, {}, { document: { id: "" } }]) {
		const f = fixture();
		const { requests, result, record } = await run(f, options => {
			if (options.method === "GET") return response(200, { data: [], has_more: false });
			if (options.url.includes("create")) return response(200, created);
			return response(404, { message: "Document deleted" });
		});
		assert.equal(requests.filter(request => request.url.includes("create")).length, 1);
		if (created.document?.id) {
			assert.equal(result.synced, 1);
			assert.equal(record.documentId, "doc-new");
			assert.equal(record.lastBatch, "batch-new");
		} else {
			assert.equal(result.failed, 1);
			assert.equal(record.documentId, "doc-1");
			assert.equal(record.hash, original.hash);
		}
	}
});

await test("failed updates retry unchanged content and preserve the association across rename", async () => {
	const f = fixture();
	// Even a historical failed record with the current hash must be retried.
	f.plugin.syncRecords.get(f.task.recordKey).hash = f.task.hash;
	const failed = await run(f, () => response(500, { message: "Try later" }));
	assert.equal(failed.result.failed, 1);
	assert.equal(failed.record.lastModified, original.lastModified);
	let planStats = stats();
	assert.equal((await f.plugin.buildSyncPlan([f.file], planStats)).length, 1);
	assert.equal(planStats.skipped, 0);
	await f.plugin.migrateRenamedRecords(f.file.path, "Work/Renamed.md");
	f.file.path = "Work/Renamed.md";
	[f.task] = await f.plugin.buildSyncPlan([f.file], stats());
	// A stale index and same-name competitor must not displace the known ID.
	f.index = { byId: new Map(), byName: new Map([[f.file.path, { id: "other-id" }]]) };
	const retried = await run(f, () => response(200, {}));
	assert.match(retried.requests[0].url, /\/doc-1\/update-by-text$/);
	assert.equal(retried.result.synced, 1);
	assert.equal(retried.record.documentId, "doc-1");
	assert.equal(retried.record.remoteName, "Work/Renamed.md");
	assert.equal(retried.record.lastError, undefined);
	planStats = stats();
	assert.equal((await f.plugin.buildSyncPlan([f.file], planStats)).length, 0);
	assert.equal(planStats.skipped, 1);
});

await test("first creation requires an ID and leaves failed content unsynced", async () => {
	for (const created of [{ data: { id: "doc-new" } }, {}]) {
		const f = fixture(undefined, []);
		f.plugin.syncRecords.clear();
		const { requests, result, record } = await run(f, () => response(200, created));
		assert.equal(requests.length, 1);
		assert.match(requests[0].url, /\/document\/create-by-text$/);
		if (created.data) {
			assert.equal(result.synced, 1);
			assert.equal(record.documentId, "doc-new");
		} else {
			assert.equal(result.failed, 1);
			assert.equal(record.hash, "");
			assert.equal(record.lastSyncedAt, "");
			assert.equal((await f.plugin.buildSyncPlan([f.file], stats())).length, 1);
		}
	}
});

await test("a name-matched document keeps its newly discovered ID after update failure", async () => {
	const f = fixture();
	f.plugin.syncRecords.clear();
	const failed = await run(f, () => response(500, { message: "Try later" }));
	assert.equal(failed.record.documentId, "doc-1");
	assert.equal(failed.record.hash, "");
	assert.equal(failed.record.lastSyncedAt, "");
	assert.ok(failed.record.lastError);
});
