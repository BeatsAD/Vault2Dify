import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

// Stub host APIs only. JSON frontmatter is valid YAML; native acceptance uses
// Obsidian's actual YAML parser with ordinary property syntax.
await build({
	stdin: { contents: 'export { default } from "./main"; export * from "./src/sync/MetadataSync"; export { DifyApiClient } from "./src/api/DifyApiClient";', resolveDir: process.cwd(), loader: 'ts' },
	bundle: true, platform: 'node', format: 'esm', outfile: 'tests/.tmp-metadata-sync.mjs', logLevel: 'silent',
	plugins: [{ name: 'obsidian-host', setup(build) {
		build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'host' }));
		build.onLoad({ filter: /.*/, namespace: 'host' }, () => ({ contents: `
			export class Plugin {} export class PluginSettingTab {} export class Modal {}
			export class App {} export class TAbstractFile {} export class TFile {} export class TFolder {}
			export class ButtonComponent {} export class ExtraButtonComponent {} export class Menu {}
			export class Notice {} export class Setting {} export class ToggleComponent {}
			export const setIcon = () => {};
			export const requestUrl = options => globalThis.__metadataRequest(options);
			export const getFrontMatterInfo = content => { const match = content.match(/^---\\r?\\n([\\s\\S]*?)\\r?\\n---(?:\\r?\\n|$)/); return { exists: !!match, frontmatter: match?.[1] || '' }; };
			export const parseYaml = text => JSON.parse(text);
		`, loader: 'js' }));
	} }],
});
const { default: Plugin, prepareMetadata, DifyApiClient } = await import(pathToFileURL(`${process.cwd()}/tests/.tmp-metadata-sync.mjs`).href);
globalThis.window = globalThis;
const content = properties => `---\n${JSON.stringify(properties)}\n---\nBody`;
const stats = () => ({ synced: 0, skipped: 0, failed: 0, total: 0, syncedFiles: [], failedFiles: [] });
const response = (status, json) => ({ status, text: JSON.stringify(json) });
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`ok - ${name}`); }

function fixture(properties = { author: 'me' }, enabled = true) {
	const plugin = new Plugin();
	plugin.settings = plugin.normalizeSettings({ language: 'en', difyApiKey: 'test-key', difyApiUrl: 'http://dify.example', maxRetries: 0, metadataSyncEnabled: enabled, mappings: [{ id: 'map', enabled: true, folder: 'Work', datasetIds: ['kb-1'] }] });
	plugin.client = new DifyApiClient(plugin);
	plugin.showSyncProgress = () => {};
	plugin.savePluginData = async () => {};
	let text = content(properties);
	const file = { path: 'Work/Note.md', name: 'Note.md', stat: { mtime: 100 } };
	plugin.app = { vault: { cachedRead: async () => text } };
	const key = plugin.getRecordKey('kb-1', file.path);
	plugin.syncRecords.set(key, { filePath: file.path, datasetId: 'kb-1', documentId: 'doc-1', remoteName: file.path, hash: plugin.hashContent(text), lastModified: 100, lastSyncedAt: '2026-10-18T00:00:00Z' });
	const requests = [];
	const fields = [];
	const remote = { remoteOnly: 'keep' };
	let mutate = () => {};
	globalThis.__metadataRequest = async options => {
		requests.push(options);
		const override = await mutate(options);
		if (override) return override;
		if (options.url.endsWith('/documents/metadata')) {
			const operation = JSON.parse(options.body).operation_data[0];
			assert.equal(operation.partial_update, true);
			for (const field of operation.metadata_list) remote[field.name] = field.value;
			return response(200, { result: 'success' });
		}
		if (options.url.endsWith('/metadata')) {
			if (options.method === 'GET') return response(200, { doc_metadata: fields });
			const field = { id: `field-${fields.length}`, ...JSON.parse(options.body) };
			fields.push(field);
			return response(201, field);
		}
		if (options.url.includes('create')) return response(200, { document: { id: 'new-doc' } });
		return response(200, { document: { id: 'doc-1' } });
	};
	const indexes = new Map([['kb-1', { byId: new Map([['doc-1', { id: 'doc-1' }]]), byName: new Map() }]]);
	return { plugin, file, key, fields, remote, requests, indexes,
		setContent(value) { text = value; },
		setHandler(handler) { mutate = handler; },
		async plan() { return plugin.buildSyncPlan([file], stats()); },
		async run(tasks) { const result = stats(); await plugin.processTasks(tasks || await this.plan(), indexes, result); return result; },
	};
}

await test('old settings default off and only explicit true enables metadata', () => {
	const plugin = new Plugin();
	assert.equal(plugin.normalizeSettings({}).metadataSyncEnabled, false);
	assert.equal(plugin.normalizeSettings({ metadataSyncEnabled: 'false' }).metadataSyncEnabled, false);
	assert.equal(plugin.normalizeSettings({ metadataSyncEnabled: true }).metadataSyncEnabled, true);
});

await test('all properties normalize to supported types with stable fingerprints', () => {
	const values = { text: 'hello', count: 2, enabled: false, tags: ['a', 'b'], options: { z: 2, a: 1 }, date: '2026-10-18', empty: '', absent: null };
	const meta = prepareMetadata(content(values), 0);
	assert.deepEqual(meta.errors, []);
	const byName = Object.fromEntries(meta.values.map(value => [value.name, value]));
	assert.equal(byName.count.type, 'number');
	assert.equal(byName.enabled.value, 'false');
	assert.equal(byName.tags.value, '["a","b"]');
	assert.equal(byName.options.value, '{"a":1,"z":2}');
	assert.equal(byName.date.type, 'time');
	assert.equal(byName.date.value, Date.parse('2026-10-18') / 1000);
	assert.equal(meta.values.length, 6);
	assert.equal(prepareMetadata(content({ ...values, options: { a: 1, z: 2 } }), 0).fingerprint, meta.fingerprint);
});

await test('disabled and property-free notes cause no metadata requests', async () => {
	const f = fixture({ author: 'me' }, false);
	f.setContent(content({ author: 'new' }));
	await f.run();
	assert.equal(f.requests.length, 1);
	assert.ok(f.requests[0].url.endsWith('/update-by-text'));
	const empty = fixture({});
	assert.equal((await empty.plan()).length, 0);
	assert.equal(empty.requests.length, 0);
});

await test('unchanged content backfills every property, creates fields and preserves remote-only values', async () => {
	const f = fixture({ author: 'me', priority: 2 });
	const result = await f.run();
	assert.equal(result.synced, 1);
	assert.equal(f.requests.filter(item => item.url.includes('update-by-text')).length, 0);
	assert.equal(f.fields.length, 2);
	assert.deepEqual(f.remote, { remoteOnly: 'keep', author: 'me', priority: 2 });
	assert.equal(f.plugin.syncRecords.get(f.key).documentId, 'doc-1');
	assert.equal((await f.plan()).length, 0);
	f.plugin.settings.metadataSyncGeneration++;
	assert.equal((await f.plan()).length, 1);
});

await test('metadata failure keeps content success and retries metadata only', async () => {
	const f = fixture();
	f.setContent(content({ author: 'updated' }));
	f.setHandler(options => options.url.endsWith('/documents/metadata') ? response(500, { message: 'Injected failure' }) : undefined);
	assert.equal((await f.run()).failed, 1);
	const record = f.plugin.syncRecords.get(f.key);
	assert.equal(record.hash, f.plugin.hashContent(content({ author: 'updated' })));
	assert.equal(record.documentId, 'doc-1');
	assert.equal(record.lastError, undefined);
	assert.match(record.metadataError, /Content synced; metadata sync failed/);
	const start = f.requests.length;
	f.setHandler(() => {});
	assert.equal((await f.run()).synced, 1);
	assert.ok(f.requests.slice(start).every(item => !item.url.includes('update-by-text') && !item.url.includes('create-by-text')));
	assert.equal(f.plugin.syncRecords.get(f.key).metadataError, undefined);
});

await test('first creation persists returned ID before metadata failure', async () => {
	const f = fixture();
	f.plugin.syncRecords.clear();
	let savedId;
	f.plugin.savePluginData = async () => { savedId = f.plugin.syncRecords.get(f.key)?.documentId; };
	f.setHandler(options => {
		if (options.url.endsWith('/documents/metadata')) {
			assert.equal(savedId, 'new-doc');
			return response(500, { message: 'Metadata unavailable' });
		}
	});
	assert.equal((await f.run()).failed, 1);
	assert.equal(f.plugin.syncRecords.get(f.key).documentId, 'new-doc');
});

await test('parallel notes share field lookup and creation within the dataset', async () => {
	const f = fixture();
	const [first] = await f.plan();
	const other = { ...first, file: { ...f.file, path: 'Work/Other.md' }, remoteName: 'Work/Other.md', recordKey: 'kb-1::Work/Other.md' };
	f.plugin.settings.maxConcurrent = 2;
	const result = await f.run([first, other]);
	assert.equal(result.synced, 2);
	assert.equal(f.requests.filter(item => item.url.endsWith('/metadata') && item.method === 'GET').length, 1);
	assert.equal(f.requests.filter(item => item.url.endsWith('/kb-1/metadata') && item.method === 'POST').length, 1);
});

await test('existing field types are respected and incompatible fields report partial failure', async () => {
	const f = fixture({ good: 'yes', count: 'not a number' });
	f.fields.push({ id: 'n', name: 'count', type: 'number' });
	assert.equal((await f.run()).failed, 1);
	assert.equal(f.remote.good, 'yes');
	assert.equal(f.remote.count, undefined);
	assert.match(f.plugin.syncRecords.get(f.key).metadataError, /count: Expected a finite number/);
});

await test('invalid YAML and reserved fields fail metadata without blocking content', async () => {
	for (const text of ['---\n{ broken\n---\nNew body', content({ source: 'local', author: 'me' })]) {
		const f = fixture();
		f.setContent(text);
		assert.equal((await f.run()).failed, 1);
		assert.equal(f.plugin.syncRecords.get(f.key).hash, f.plugin.hashContent(text));
		assert.ok(f.plugin.syncRecords.get(f.key).metadataError);
		assert.ok(!f.fields.some(field => field.name === 'source'));
	}
});

await test('disabling during field discovery prevents subsequent metadata writes', async () => {
	const f = fixture();
	f.setHandler(options => { if (options.method === 'GET') f.plugin.settings.metadataSyncEnabled = false; });
	await f.run();
	assert.equal(f.requests.filter(item => item.method === 'POST').length, 0);
	assert.equal(f.plugin.syncRecords.get(f.key).metadataHash, undefined);
});

await test('removing or emptying properties retains remote metadata', async () => {
	const f = fixture({ author: 'me' });
	await f.run();
	f.setContent(content({ author: null }));
	await f.run();
	assert.equal(f.remote.author, 'me');
	assert.equal(f.remote.remoteOnly, 'keep');
});

await test('datasets keep separate field definitions when processing the same note', async () => {
	const f = fixture({ author: 'me' });
	f.plugin.settings.mappings[0].datasetIds.push('kb-2');
	f.indexes.set('kb-2', { byId: new Map(), byName: new Map() });
	f.setHandler(options => {
		if (options.url.endsWith('/kb-2/metadata') && options.method === 'GET') return response(200, { doc_metadata: [{ id: 'other-author', name: 'author', type: 'string' }] });
	});
	assert.equal((await f.run()).synced, 2);
	const operations = f.requests.filter(item => item.url.endsWith('/documents/metadata'));
	assert.equal(operations.length, 2);
	assert.equal(JSON.parse(operations.find(item => item.url.includes('/kb-2/')).body).operation_data[0].metadata_list[0].id, 'other-author');
});

await test('concurrent external field creation recovers by reading the existing field', async () => {
	const f = fixture();
	let raced = false;
	f.setHandler(options => {
		if (options.url.endsWith('/kb-1/metadata') && options.method === 'POST' && !raced) {
			raced = true;
			f.fields.push({ id: 'external-field', name: 'author', type: 'string' });
			return response(400, { message: 'Metadata name already exists.' });
		}
	});
	assert.equal((await f.run()).synced, 1);
	assert.equal(f.remote.author, 'me');
	assert.equal(f.fields.length, 1);
});

await test('rename keeps the ID and metadata fingerprint while updating the remote name', async () => {
	const f = fixture();
	await f.run();
	const metadataHash = f.plugin.syncRecords.get(f.key).metadataHash;
	const start = f.requests.length;
	const oldPath = f.file.path;
	f.file.path = 'Work/Renamed.md';
	await f.plugin.migrateRenamedRecords(oldPath, f.file.path);
	assert.equal((await f.run()).synced, 1);
	const record = f.plugin.syncRecords.get(f.plugin.getRecordKey('kb-1', f.file.path));
	assert.equal(record.documentId, 'doc-1');
	assert.equal(record.metadataHash, metadataHash);
	assert.equal(f.requests.slice(start).length, 1);
	assert.ok(f.requests.at(-1).url.endsWith('/doc-1/update-by-text'));
});

await test('malformed field responses and unavailable metadata APIs remain retryable without rewriting content', async () => {
	for (const reply of [response(200, { doc_metadata: [{}] }), response(404, { message: 'Metadata API unavailable' })]) {
		const f = fixture();
		f.setHandler(options => options.url.endsWith('/kb-1/metadata') ? reply : undefined);
		assert.equal((await f.run()).failed, 1);
		const record = f.plugin.syncRecords.get(f.key);
		assert.ok(record.metadataError);
		assert.equal(record.lastError, undefined);
		assert.equal(record.metadataHash, undefined);
		assert.equal((await f.plan()).length, 1);
		assert.ok(f.requests.every(item => item.method === 'GET'));
	}
});

console.log(`${passed} metadata sync regression groups passed`);
