import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real settings-tab methods against the host's row-reuse contract.
const source = fs.readFileSync("main.ts", "utf8");
const tabSource = source.slice(source.indexOf("class DifySyncSettingTab"), source.indexOf("class HelpModal"));
const compiled = ts.transpileModule(tabSource, { compilerOptions: { target: ts.ScriptTarget.ES2018 } }).outputText;

function createDocument() {
	// A separate VM gives each document its own Node/DocumentFragment constructors.
	return vm.runInNewContext(`(() => {
		class Node {
			constructor(cls = '', text = '') {
				this.classes = new Set(cls.split(' ').filter(Boolean));
				this.children = [];
				this.text = text;
				this.attributes = {};
			}
			get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
			addClass(cls) { this.classes.add(cls); }
			removeClass(cls) { this.classes.delete(cls); }
			empty() { for (const child of this.children) child.parent = null; this.children = []; this.text = ''; }
			remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
			createDiv(options = {}) {
				if (typeof options === 'string') options = { cls: options };
				const child = new Node(options.cls, options.text);
				child.doc = this.doc;
				child.parent = this;
				child.attributes = options.attr || {};
				this.children.push(child);
				return child;
			}
			createEl(tag, options) { return this.createDiv(options); }
			createSpan(options) { return this.createDiv(options); }
		}
		class DocumentFragment extends Node { toString() { return '[object DocumentFragment]'; } }
		const doc = { Node, DocumentFragment, createDocumentFragment: () => new DocumentFragment() };
		doc.createElement = () => { const el = new Node(); el.doc = doc; return el; };
		return doc;
	})()`);
}

const mainDocument = createDocument();
class PluginSettingTab {
	constructor() { this.containerEl = mainDocument.createElement(); }
	update() { this.refreshCount = (this.refreshCount || 0) + 1; }
}
const context = vm.createContext({ PluginSettingTab });
vm.runInContext(`${compiled}; globalThis.Tab = DifySyncSettingTab;`, context);

function makeTab() {
	const plugin = { settings: { language: "zh-CN", difyApiKey: "fixture-key" }, t: key => key };
	const tab = new context.Tab({}, plugin);
	// The regression concerns ownership of the entire page, independently of its sections.
	for (const method of ["renderTopbar", "renderSyncSummary", "renderConnectionSection", "renderMappingSection", "renderSyncSettingsSection", "scheduleScrollbarHostMarking"]) {
		tab[method] = () => {};
	}
	return tab;
}

function makeRow(doc = mainDocument) {
	const settingEl = doc.createElement();
	settingEl.addClass("setting-item");
	const infoEl = settingEl.createDiv("setting-item-info");
	const nameEl = infoEl.createDiv("setting-item-name");
	const controlEl = settingEl.createDiv("setting-item-control");
	return {
		settingEl, nameEl, controlEl,
		setName(value) {
			assert.equal(typeof value, "string", "Labels passed to the Obsidian API must be strings in every window");
			this.name = value;
			nameEl.empty();
			nameEl.text = value;
		},
		clear() { controlEl.empty(); },
	};
}

function countPages(el) {
	return Number(el.classes.has("app")) + el.children.reduce((count, child) => count + countPages(child), 0);
}

const tab = makeTab();
const beforeSettings = JSON.stringify(tab.plugin.settings);
const row = makeRow();
let cleanup;
for (let refresh = 0; refresh < 12; refresh++) {
	cleanup?.();
	row.clear(); // Obsidian reuses settingEl and only clears controlEl.
	cleanup = tab.getSettingDefinitions()[0].render(row);
	assert.equal(countPages(row.settingEl), 1, "Refreshing must leave exactly one settings page");
	assert.equal(countPages(row.controlEl), 1, "The host must own the page through controlEl");
}
cleanup();
assert.equal(countPages(row.settingEl), 0, "Closing the settings row must release its page");
assert.equal(JSON.stringify(tab.plugin.settings), beforeSettings, "Rendering must preserve saved configuration");
console.log("ok - declarative row reuse keeps one page across twelve refreshes and cleans up on close");

const render = tab.getSettingDefinitions()[0].render;
render(row);
const finalCleanup = render(row); // Also tolerate a host calling render again without clearing first.
assert.equal(countPages(row.settingEl), 1);
finalCleanup();
tab.refreshSettingsView();
assert.equal(tab.refreshCount, 1, "Declarative actions must refresh through the host update API");
console.log("ok - direct rerenders remain idempotent and declarative refresh uses the host API");

const legacyTab = makeTab();
for (let refresh = 0; refresh < 12; refresh++) {
	legacyTab.display();
	assert.equal(countPages(legacyTab.containerEl), 1);
}
legacyTab.refreshSettingsView();
assert.equal(countPages(legacyTab.containerEl), 1);
assert.equal(legacyTab.refreshCount, undefined);
console.log("ok - legacy display and refresh continue to replace the previous page");

const popupDocument = createDocument();
assert.equal(popupDocument.createDocumentFragment() instanceof mainDocument.DocumentFragment, false);
for (const doc of [mainDocument, popupDocument]) {
	const field = makeRow(doc);
	tab.setSettingName(field, "API Key", { required: true });
	assert.equal(field.nameEl.textContent, "API Key*");
	assert.equal(field.nameEl.children[1].attributes["aria-label"], "Required");
	assert.ok(field.nameEl.children.every(child => child.doc === doc), "Label nodes must belong to the target window");
	tab.setSettingName(field, "自动同步");
	assert.equal(field.nameEl.textContent, "自动同步", "Renaming must remove the previous required marker");
	assert.equal(field.nameEl.children.length, 1);
}
console.log("ok - labels and required markers render correctly in main and foreign-window DOM realms");
