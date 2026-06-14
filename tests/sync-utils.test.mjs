import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";

const outfile = "tests/.tmp-sync-utils.mjs";

await build({
	entryPoints: ["src/sync-utils.ts"],
	bundle: true,
	platform: "node",
	format: "esm",
	outfile,
	logLevel: "silent",
});

const utils = await import(pathToFileURL(`${process.cwd()}/${outfile}`).href);

function test(name, fn) {
	try {
		fn();
		console.log(`ok - ${name}`);
	} catch (error) {
		console.error(`not ok - ${name}`);
		throw error;
	}
}

test("sanitizeBaseUrl trims spaces, trailing slashes, and known Dify API paths", () => {
	assert.equal(utils.sanitizeBaseUrl(" https://dify.example.com/v1/ "), "https://dify.example.com");
	assert.equal(utils.sanitizeBaseUrl("https://dify.example.com/v1/datasets"), "https://dify.example.com");
	assert.equal(utils.sanitizeBaseUrl("http://dify-host.example.test:5000///"), "http://dify-host.example.test:5000");
});

test("sanitizeBaseUrl adds http when the scheme is omitted", () => {
	assert.equal(utils.sanitizeBaseUrl("dify-host.example.test:5000"), "http://dify-host.example.test:5000");
	assert.equal(utils.sanitizeBaseUrl(""), "");
});

test("normalizeFolderPath removes surrounding spaces and slashes", () => {
	assert.equal(utils.normalizeFolderPath(" /Work/ProjectA/ "), "Work/ProjectA");
	assert.equal(utils.normalizeFolderPath(""), "");
});

test("pathMatchesFolder treats the empty folder as the whole vault", () => {
	assert.equal(utils.pathMatchesFolder("Work/ProjectA/Note.md", ""), true);
});

test("pathMatchesFolder matches the exact folder and descendants only", () => {
	assert.equal(utils.pathMatchesFolder("Work/ProjectA", "Work/ProjectA"), true);
	assert.equal(utils.pathMatchesFolder("Work/ProjectA/Note.md", "Work/ProjectA"), true);
	assert.equal(utils.pathMatchesFolder("Work/ProjectArchive/Note.md", "Work/ProjectA"), false);
});

test("pathMatchesFolder supports single Markdown note mappings", () => {
	assert.equal(utils.pathMatchesFolder("Work/Note.md", "Work/Note.md"), true);
	assert.equal(utils.pathMatchesFolder("Work/Other.md", "Work/Note.md"), false);
	assert.equal(utils.pathMatchesFolder("Work/Note.md/Child.md", "Work/Note.md"), false);
});

test("splitIds supports English and Chinese separators and removes duplicates", () => {
	assert.deepEqual(utils.splitIds(" kb1,kb2，kb1\nkb3；kb4;kb2 "), ["kb1", "kb2", "kb3", "kb4"]);
});

test("clampNumber keeps values within range and falls back for invalid input", () => {
	assert.equal(utils.clampNumber(10, 1, 20, 5), 10);
	assert.equal(utils.clampNumber(0, 1, 20, 5), 1);
	assert.equal(utils.clampNumber(25, 1, 20, 5), 20);
	assert.equal(utils.clampNumber(Number.NaN, 1, 20, 5), 5);
});

test("getRecordKey combines dataset id and file path without losing slashes", () => {
	assert.equal(utils.getRecordKey("dataset-1", "Work/ProjectA/Note.md"), "dataset-1::Work/ProjectA/Note.md");
});

test("migrateRenamedSyncRecords preserves old remote name so Dify can be renamed", () => {
	const records = new Map([
		[utils.getRecordKey("dataset-1", "Work/Old.md"), {
			filePath: "Work/Old.md",
			datasetId: "dataset-1",
			documentId: "doc-1",
			remoteName: "Work/Old.md",
			hash: "hash-1",
			lastModified: 100,
			lastSyncedAt: "2026-06-07T03:00:00.000Z",
		}],
	]);

	const changed = utils.migrateRenamedSyncRecords(records, "Work/Old.md", "Work/New.md", (path) => path);

	assert.equal(changed, true);
	assert.equal(records.has(utils.getRecordKey("dataset-1", "Work/Old.md")), false);
	assert.deepEqual(records.get(utils.getRecordKey("dataset-1", "Work/New.md")), {
		filePath: "Work/New.md",
		datasetId: "dataset-1",
		documentId: "doc-1",
		remoteName: "Work/Old.md",
		hash: "hash-1",
		lastModified: 100,
		lastSyncedAt: "2026-06-07T03:00:00.000Z",
		deletedLocal: false,
	});
});

test("recoverDeletedSyncRecordForCreatedFile reuses a recently deleted same-content document", () => {
	const records = new Map([
		[utils.getRecordKey("dataset-1", "Work/Old.md"), {
			filePath: "Work/Old.md",
			datasetId: "dataset-1",
			documentId: "doc-1",
			remoteName: "Work/Old.md",
			hash: "same-hash",
			lastModified: 100,
			lastSyncedAt: "2026-06-07T03:00:10.000Z",
			deletedLocal: true,
		}],
	]);

	const recovered = utils.recoverDeletedSyncRecordForCreatedFile(
		records,
		"dataset-1",
		"Work/New.md",
		"same-hash",
		(path) => path,
		new Date("2026-06-07T03:00:20.000Z"),
		30000,
	);

	assert.equal(recovered, true);
	assert.equal(records.has(utils.getRecordKey("dataset-1", "Work/Old.md")), false);
	assert.deepEqual(records.get(utils.getRecordKey("dataset-1", "Work/New.md")), {
		filePath: "Work/New.md",
		datasetId: "dataset-1",
		documentId: "doc-1",
		remoteName: "Work/Old.md",
		hash: "same-hash",
		lastModified: 100,
		lastSyncedAt: "2026-06-07T03:00:10.000Z",
		deletedLocal: false,
	});
});

test("getDatasetIdsForPathFromMappings returns enabled matching datasets only", () => {
	const mappings = [
		{ folder: "Work", datasetIds: ["kb-work"], enabled: true },
		{ folder: "Work/Archive", datasetIds: ["kb-archive"], enabled: false },
		{ folder: "Reading", datasetIds: ["kb-reading"], enabled: true },
	];

	assert.deepEqual(utils.getDatasetIdsForPathFromMappings("Work/Note.md", mappings), ["kb-work"]);
	assert.deepEqual(utils.getDatasetIdsForPathFromMappings("Reading/Book.md", mappings), ["kb-reading"]);
	assert.deepEqual(utils.getDatasetIdsForPathFromMappings("Inbox/Note.md", mappings), []);
});

test("getDatasetIdsForPathFromMappings supports exact note mappings", () => {
	const mappings = [
		{ folder: "Work/Note.md", datasetIds: ["kb-note"], enabled: true },
		{ folder: "Work", datasetIds: ["kb-work"], enabled: true },
	];

	assert.deepEqual(utils.getDatasetIdsForPathFromMappings("Work/Note.md", mappings), ["kb-note", "kb-work"]);
	assert.deepEqual(utils.getDatasetIdsForPathFromMappings("Work/Other.md", mappings), ["kb-work"]);
});

test("getDatasetIdsForPathFromMappings deduplicates datasets across matching mappings", () => {
	const mappings = [
		{ folder: "", datasetIds: ["kb-all", "kb-shared"], enabled: true },
		{ folder: "Work", datasetIds: ["kb-shared", "kb-work"], enabled: true },
	];

	assert.deepEqual(utils.getDatasetIdsForPathFromMappings("Work/Note.md", mappings), ["kb-all", "kb-shared", "kb-work"]);
});

test("removeMappingById only removes the local mapping entry", () => {
	const mappings = [
		{ id: "map-1", folder: "Work", datasetIds: ["kb-work"], enabled: true },
		{ id: "map-2", folder: "Reading", datasetIds: ["kb-reading"], enabled: true },
	];
	const removed = utils.removeMappingById(mappings, "map-1");

	assert.deepEqual(removed, [
		{ id: "map-2", folder: "Reading", datasetIds: ["kb-reading"], enabled: true },
	]);
	assert.equal(mappings.length, 2);
	assert.equal(typeof utils.deleteDocument, "undefined");
});

test("buildSettingsReviewSummary returns zero metrics and muted state before any sync", () => {
	const summary = utils.buildSettingsReviewSummary({
		connectionHealth: { status: "unknown" },
	});

	assert.deepEqual(summary.metrics, [
		{ key: "total", value: 0, tone: "accent" },
		{ key: "synced", value: 0, tone: "success" },
		{ key: "skipped", value: 0, tone: "warning" },
		{ key: "failed", value: 0, tone: "error" },
	]);
	assert.equal(summary.connectionTone, "muted");
	assert.equal(summary.hasRecentSync, false);
});

test("buildSettingsReviewSummary maps recent sync and connection health into review tones", () => {
	const summary = utils.buildSettingsReviewSummary({
		connectionHealth: { status: "connected" },
		recentSyncResult: {
			total: 7,
			synced: 4,
			skipped: 2,
			failed: 1,
		},
	});

	assert.deepEqual(summary.metrics, [
		{ key: "total", value: 7, tone: "accent" },
		{ key: "synced", value: 4, tone: "success" },
		{ key: "skipped", value: 2, tone: "warning" },
		{ key: "failed", value: 1, tone: "error" },
	]);
	assert.equal(summary.connectionTone, "success");
	assert.equal(summary.hasRecentSync, true);
});
