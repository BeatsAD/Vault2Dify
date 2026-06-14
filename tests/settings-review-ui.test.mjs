import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync("main.ts", "utf8");
const stylesSource = fs.readFileSync("styles.css", "utf8");
const syncTestVaultSource = fs.readFileSync("scripts/sync-test-vault.mjs", "utf8");
const testVaultRoot = process.env.VAULT2DIFY_TEST_VAULT
	? path.resolve(process.env.VAULT2DIFY_TEST_VAULT)
	: path.resolve("..", "obsidian-dify-sync-test-vault");
const testVaultPluginRoot = path.join(testVaultRoot, ".obsidian", "plugins", "vault-to-dify");

function readTestVaultFile(relativePath) {
	const filePath = path.join(testVaultRoot, relativePath);
	try {
		return fs.readFileSync(filePath, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") {
			throw new Error(
				`Missing external Obsidian test vault file: ${filePath}. ` +
				"Run `npm run install:test-vault` before `npm test`, or set VAULT2DIFY_TEST_VAULT to another prepared vault.",
			);
		}
		throw error;
	}
}

const testVaultStylesSource = readTestVaultFile(path.join(".obsidian", "plugins", "vault-to-dify", "styles.css"));

function test(name, fn) {
	try {
		fn();
		console.log(`ok - ${name}`);
	} catch (error) {
		console.error(`not ok - ${name}`);
		throw error;
	}
}

function sourceContainsAll(source, tokens) {
	for (const token of tokens) {
		assert.ok(source.includes(token), `Expected source to include ${token}`);
	}
}

function countOccurrences(source, token) {
	return source.split(token).length - 1;
}

function getCssBlock(source, selector) {
	const start = source.indexOf(selector);
	assert.notEqual(start, -1, `Expected CSS selector ${selector}`);
	const end = source.indexOf("\n}", start);
	assert.notEqual(end, -1, `Expected CSS block for ${selector}`);
	return source.slice(start, end + 2);
}

test("settings tab renders restored review layout with native Obsidian setting controls", () => {
	const settingsTabBlock = mainSource.slice(
		mainSource.indexOf("class DifySyncSettingTab"),
		mainSource.indexOf("class ConfirmModal"),
	);

	sourceContainsAll(settingsTabBlock, [
		"section-card",
		"setting-row",
			"native-setting-row",
			"createEl('h1'",
			"keyInput.id = 'dify-api-key';",
			"toggle.setAttr('aria-controls', 'dify-api-key');",
			"private createNativeSetting(container: HTMLElement, ...layoutClasses: string[]): Setting",
			"new Setting(container).setClass('native-setting-row')",
			"setting.settingEl.addClass(className)",
			"this.createNativeSetting(card, 'setting-row')",
			"this.createNativeSetting(card, 'setting-row', 'switch-row')",
			"this.createNativeSetting(container, 'advanced-field')",
			"new ButtonComponent(actions)",
			"addText((text)",
			"addDropdown((dropdown)",
			"addToggle((toggle)",
			"addExtraButton((button)",
		"status-line",
		"statusLine.setAttr('aria-label'",
		"connection-action-buttons",
		"settingsReviewConnectionTitle",
		"settingsReviewMappingTitle",
		"settingsReviewSyncTitle",
		"mapping-table",
		"switch-row",
		"diagnostic-fold",
		"optionOn",
		"optionOff",
		]);
		sourceContainsAll(settingsTabBlock, [
			"this.plugin.t('debounceOption8')",
			"this.plugin.t('debounceOption15')",
			"this.plugin.t('debounceOption30')",
			"this.plugin.t('fullScanOption30')",
			"this.plugin.t('fullScanOption60')",
			"this.plugin.t('fullScanOptionOff')",
			"this.plugin.t('concurrencyOption2')",
			"this.plugin.t('concurrencyOption4')",
		]);

	for (const legacyAdvancedKey of ["endpointModeName", "apiPathStyleName", "timeoutName", "retriesName"]) {
		assert.equal(settingsTabBlock.includes(legacyAdvancedKey), false, `${legacyAdvancedKey} should not render in the restored main settings page`);
		}
		assert.equal(settingsTabBlock.includes("[1, '1 个文件']"), false, "Concurrent upload options should match the restored prototype values");
		for (const hardcodedOption of ["8 秒", "15 秒", "30 秒", "每 30 分钟", "每 60 分钟", "2 个文件", "4 个文件"]) {
			assert.equal(settingsTabBlock.includes(hardcodedOption), false, `Sync dropdown option should be localized instead of hardcoded as ${hardcodedOption}`);
		}
		sourceContainsAll(mainSource, [
			"debounceOption8: '8 秒'",
			"debounceOption8: '8 seconds'",
			"fullScanOption30: '每 30 分钟'",
			"fullScanOption30: 'Every 30 minutes'",
			"fullScanOptionOff: '关闭'",
			"fullScanOptionOff: 'Off'",
			"concurrencyOption2: '2 个文件'",
			"concurrencyOption2: '2 files'",
		]);
		assert.doesNotMatch(settingsTabBlock, /\.setClass\('[^']+\s+[^']+'\)/, "Native Setting classes must be added one class at a time");
		assert.ok(
			settingsTabBlock.indexOf("this.renderConnectionSection(content);") < settingsTabBlock.indexOf("this.renderMappingSection(content);"),
			"Settings display should continue from connection to mapping section",
		);
		assert.ok(
			settingsTabBlock.indexOf("this.renderMappingSection(content);") < settingsTabBlock.indexOf("this.renderSyncSettingsSection(content);"),
			"Settings display should continue from mapping to sync section",
		);
	});

test("settings modal content hides scrollbars without disabling scroll", () => {
	sourceContainsAll(mainSource, [
		"this.scheduleScrollbarHostMarking(containerEl);",
		"hide(): void",
		"this.scrollbarMarkToken++;",
		"this.clearScrollbarHosts();",
		"private scheduleScrollbarHostMarking(containerEl: HTMLElement)",
		"const token = ++this.scrollbarMarkToken;",
		"window.requestAnimationFrame(() => {",
		"token === this.scrollbarMarkToken && containerEl.isConnected",
		"private markScrollbarHosts(containerEl: HTMLElement)",
		"const outerHosts = this.findScrollableAncestors(containerEl);",
		"private isVerticalScrollHost(element: HTMLElement)",
		"['auto', 'scroll', 'overlay'].includes(overflowY)",
		"containerEl.addEventListener('wheel', onWheel, { passive: false });",
		"private handleSettingsWheel(event: WheelEvent, containerEl: HTMLElement, primaryHost: HTMLElement)",
		"primaryHost.scrollTop += event.deltaY;",
		"event.preventDefault();",
		"'dify-sync-outer-scroll-host'",
		"'dify-sync-inner-scroll-host'",
		"private clearScrollbarHosts()",
	]);
	sourceContainsAll(stylesSource, [
		".dify-sync-outer-scroll-host",
		"overflow-y: hidden !important;",
		"scrollbar-width: none !important;",
		"-ms-overflow-style: none !important;",
		".dify-sync-inner-scroll-host",
		"overscroll-behavior: contain;",
		".dify-sync-outer-scroll-host::-webkit-scrollbar",
		"width: 0 !important;",
		"height: 0 !important;",
		"display: none !important;",
	]);
	assert.equal(
		mainSource.includes("this.addScrollbarHost(document.body);"),
		false,
		"Scrollbar handling should not hide scrollbars globally on document.body",
	);
});

test("test vault loads Vault2Dify from the active plugin id directory", () => {
	const enabledPlugins = JSON.parse(readTestVaultFile(path.join(".obsidian", "community-plugins.json")));
	const testVaultManifest = JSON.parse(readTestVaultFile(path.join(".obsidian", "plugins", "vault-to-dify", "manifest.json")));

	assert.ok(enabledPlugins.includes("vault-to-dify"), "Test vault should enable the Vault2Dify plugin");
	assert.equal(testVaultManifest.id, "vault-to-dify");
	assert.equal(testVaultManifest.name, "Vault2Dify");
	assert.equal(path.basename(testVaultPluginRoot), "vault-to-dify");
});

test("test vault sync defaults to the single external Obsidian vault copy", () => {
	sourceContainsAll(syncTestVaultSource, [
		"path.resolve(\"..\", \"obsidian-dify-sync-test-vault\")",
		"VAULT2DIFY_TEST_VAULT",
		"const pluginId = \"vault-to-dify\";",
		"fs.copyFileSync(file, path.join(pluginDir, file));",
		"community-plugins.json",
		"enabledPlugins.push(pluginId);",
	]);
	assert.equal(
		syncTestVaultSource.includes("path.resolve(\"test-vault\")"),
		false,
		"The repository-local test-vault should not be a default sync target",
	);
});

test("fresh install defaults keep connection empty and require explicit auto sync opt-in", () => {
	const defaultSettingsBlock = mainSource.slice(
		mainSource.indexOf("const DEFAULT_SETTINGS"),
		mainSource.indexOf("const STRINGS"),
	);

	sourceContainsAll(defaultSettingsBlock, [
		"initialSetupCompleted: false",
		"language: 'en'",
		"difyApiUrl: ''",
		"autoSyncEnabled: false",
		"eventSyncEnabled: true",
		"syncOnStartup: true",
		"periodicFullScanEnabled: true",
	]);
	assert.equal(
		defaultSettingsBlock.includes("difyApiUrl: 'http://localhost:5000'"),
		false,
		"Fresh installs should not prefill localhost as the saved Dify service URL",
	);
});

test("first-install placeholders are localized and do not replace language selection", () => {
	sourceContainsAll(mainSource, [
		"selectPlaceholder: '请选择'",
		"selectPlaceholder: 'Please select'",
		"urlPlaceholder: '请输入 Dify 服务地址'",
		"urlPlaceholder: 'Enter your Dify service URL'",
		"const languageButton = new ExtraButtonComponent(actions)",
		"language.setAttr('aria-label', this.plugin.t('languageName'));",
		"private openLanguageMenu(anchorEl: HTMLElement)",
	]);
	assert.match(
		mainSource,
		/private openLanguageMenu\(anchorEl: HTMLElement\)[\s\S]*value: 'zh-CN'[\s\S]*value: 'en'[\s\S]*setChecked\(this\.plugin\.settings\.language === option\.value\)/,
		"Language menu should preserve the saved/default language with an Obsidian checked menu item",
	);
});

test("testing connection completes setup and automatically loads knowledge bases", () => {
	const settingsTabBlock = mainSource.slice(
		mainSource.indexOf("class DifySyncSettingTab"),
		mainSource.indexOf("class ConfirmModal"),
	);

	sourceContainsAll(settingsTabBlock, [
		"testButton.buttonEl.setAttr('data-action', 'test-connection');",
		"await this.plugin.testConnection();",
	]);
	sourceContainsAll(mainSource, [
		"const datasets = await this.refreshKnowledgeBases(false);",
			"this.settings.initialSetupCompleted = true;",
			"connectionOk: '连接成功，已获取 {count} 个知识库。当前使用地址：{url}'",
			"connectionOk: 'Connected and loaded {count} knowledge bases via {url}'",
			"refresh.buttonEl.setAttr('data-action', 'refresh-modal-datasets');",
			"refresh.setAttr('data-action', 'refresh-pending-mapping');",
		]);
	const removedSaveAction = "save" + "-connection-config";
	const removedRefreshAction = "refresh" + "-datasets";
	const removedSaveKey = "save" + "ConnectionConfig";
	const removedSaveNoticeKey = "connection" + "ConfigSaved";
	const removedFetchKey = "fetch" + "Datasets";
	assert.equal(settingsTabBlock.includes(`data-action': '${removedSaveAction}'`), false, "Connection section should not render a save config button");
	assert.equal(settingsTabBlock.includes(`data-action': '${removedRefreshAction}'`), false, "Connection section should not render a primary dataset fetch button");
	assert.equal(mainSource.includes(removedSaveKey), false, "Save config i18n should be removed");
	assert.equal(mainSource.includes(removedSaveNoticeKey), false, "Save config notice i18n should be removed");
	assert.equal(mainSource.includes(removedFetchKey), false, "Primary fetch datasets label should be removed");
});

test("settings topbar renders compact icon actions with a native language menu", () => {
	const topbarBlock = mainSource.slice(
		mainSource.indexOf("private renderTopbar"),
		mainSource.indexOf("private renderSyncSummary"),
	);

	sourceContainsAll(topbarBlock, [
		"const languageButton = new ExtraButtonComponent(actions)",
		".setIcon('languages')",
		".setTooltip(this.plugin.t('languageName'))",
		"const language = languageButton.extraSettingsEl;",
		"languageButton.onClick(() => this.openLanguageMenu(language));",
		"language.addClass('language-button');",
		"language.setAttr('data-action', 'open-language-menu');",
		"const help = new ExtraButtonComponent(actions)",
		".setIcon('help-circle')",
		"help.addClass('help-button');",
		"help.setAttr('data-action', 'open-help');",
		"new HelpModal(this.app, this.plugin).open()",
		"cls: 'github-link'",
	]);
	assert.equal(topbarBlock.includes("const languageSelect = new DropdownComponent(actions)"), false, "Topbar language switcher should no longer render as a select");
	assert.equal(topbarBlock.includes("language-select"), false, "Topbar should not keep the old language select class");
	assert.ok(
		topbarBlock.indexOf("const languageButton = new ExtraButtonComponent(actions)") < topbarBlock.indexOf("const help = new ExtraButtonComponent(actions)"),
		"Language button should render before the help button",
	);
	assert.ok(
		topbarBlock.indexOf("help.addClass('help-button');") < topbarBlock.indexOf("cls: 'github-link'"),
		"Help button should render before the GitHub link",
	);
	assert.match(
		topbarBlock,
		/new ExtraButtonComponent\(actions\)[\s\S]*\.setIcon\('help-circle'\)[\s\S]*\.setTooltip\(this\.plugin\.t\('openHelp'\)\)/,
		"Help control should be an Obsidian native icon button with localized tooltip",
	);
	sourceContainsAll(stylesSource, [
		".dify-sync-settings .top-actions {",
		"flex-wrap: nowrap;",
		"gap: 6px;",
		".dify-sync-settings .github-link,",
		".dify-sync-settings .language-button,",
		".dify-sync-settings .help-button {",
		"width: 2rem;",
		"height: 2rem;",
		"min-height: 2rem;",
	]);
	assert.equal(stylesSource.includes(".dify-sync-settings .top-actions .language-select"), false, "Topbar should not reserve select width after switching to an icon menu");
});

test("topbar language icon opens an Obsidian native checked menu", () => {
	const languageMenuBlock = mainSource.slice(
		mainSource.indexOf("private openLanguageMenu"),
		mainSource.indexOf("private renderSyncSummary"),
	);

	sourceContainsAll(languageMenuBlock, [
		"const menu = new Menu();",
		"{ value: 'zh-CN', label: this.plugin.t('languageChinese') }",
		"{ value: 'en', label: this.plugin.t('languageEnglish') }",
		"menu.addItem((item) => {",
		".setChecked(this.plugin.settings.language === option.value)",
		"this.plugin.settings.language = option.value;",
		"await this.plugin.savePluginData();",
		"this.plugin.updateStatusBar(this.plugin.t('ready'));",
		"this.display();",
		"menu.showAtPosition({",
	]);
});

test("settings topbar renders localized plugin subtitle below the title", () => {
	const topbarBlock = mainSource.slice(
		mainSource.indexOf("private renderTopbar"),
		mainSource.indexOf("private renderSyncSummary"),
	);

	sourceContainsAll(mainSource, [
		"settingsSubtitle: '将 Obsidian 笔记库同步到 Dify 知识库'",
		"settingsSubtitle: 'Sync your Obsidian Vault to Dify Knowledge Base'",
	]);
	sourceContainsAll(topbarBlock, [
		"titleLine.createEl('h1', { text: this.plugin.t('settingsTitle'), cls: 'heading-text' });",
		"titleLine.createEl('p', { text: this.plugin.t('settingsSubtitle'), cls: 'settings-subtitle' });",
	]);
	assert.ok(
		topbarBlock.indexOf("this.plugin.t('settingsTitle')") < topbarBlock.indexOf("this.plugin.t('settingsSubtitle')"),
		"Subtitle should render directly after the plugin title",
	);
	sourceContainsAll(stylesSource, [
		".dify-sync-settings .title-line",
		"flex-direction: column;",
		"align-items: flex-start;",
		".dify-sync-settings .settings-subtitle",
		"color: var(--text-muted);",
		"overflow-wrap: anywhere;",
		".dify-sync-settings .title-line > .heading-text,",
		".dify-sync-settings .title-line > .settings-subtitle",
		"align-self: flex-start;",
		"margin-left: 0 !important;",
		"text-align: left;",
	]);
});

test("help modal renders localized usage and troubleshooting content in a fixed scrollable dialog", () => {
	const helpModalBlock = mainSource.slice(
		mainSource.indexOf("class HelpModal"),
		mainSource.indexOf("class ConfirmModal"),
	);

	sourceContainsAll(mainSource, [
		"openHelp: '打开帮助文档'",
		"helpModalTitle: 'Vault2Dify 帮助'",
		"helpQuickStartTitle: '快速开始'",
		"helpApiUrlTitle: '地址如何填写'",
		"helpApiKeyTitle: 'API Key 要求'",
		"helpMappingTitle: '路径映射'",
		"helpSyncModesTitle: '同步方式'",
		"helpSyncRulesTitle: '同步规则'",
		"helpTroubleshootingTitle: '连接失败排查'",
		"helpCommonErrorsTitle: '常见错误提示'",
		"helpDatasetsTitle: '获取不到知识库'",
		"helpFilesNotSyncingTitle: '文件没有同步'",
		"helpSlowSyncTitle: '同步很慢'",
		"helpDuplicateDocsTitle: '出现重复文档'",
		"helpDebugTitle: '调试日志'",
		"helpPrivacyTitle: '隐私与安全'",
		"Dify API Key：必填项，用于访问你的 Dify 知识库",
		"Dify 服务地址：必填项，是插件连接 Dify 的主地址",
		"示例：http://tailnet-device.example.test:5000",
		"Dify API Key: required. It authorizes access to your Dify knowledge base.",
		"Dify service URL: required. This is the main address the plugin uses to connect to Dify.",
		"Example: http://tailnet-device.example.test:5000",
		"当前接口路径不兼容：请确认插件已升级到最新构建",
		"请求超时：请确认当前设备能访问 Dify 服务地址；检查 Dify 服务负载、端口、防火墙、Tailscale 和反向代理",
		"The current API path is incompatible: confirm the plugin is on the latest build",
		"The request timed out: confirm this device can reach the Dify service URL; check Dify service load, ports, firewall, Tailscale, and reverse proxy",
	]);
	for (const staleHelpCopy of [
		"增大请求超时",
		"Increase request timeout",
		"关闭检查索引状态",
		"Turn off indexing status checks",
		"请将“Dify 文档接口路径”设为自动兼容后重试",
		"Set the Dify document API path to auto compatibility",
		"局域网 / 公网地址",
		"LAN / public endpoint",
		"helpApiUrlExamples",
		"helpApiUrlMistakes",
		"NAS / Docker / 局域网服务器",
		"NAS / Docker / LAN server",
		"Dify 服务地址输入框已做兼容处理",
		"The Dify service URL field is normalized automatically",
	]) {
		assert.equal(mainSource.includes(staleHelpCopy), false, `Help copy should not reference hidden controls: ${staleHelpCopy}`);
	}
	sourceContainsAll(helpModalBlock, [
		"this.modalEl.addClass('help-modal-shell')",
		"contentEl.addClass('help-modal')",
		"cls: 'help-modal-body'",
		"role: 'document'",
		"this.plugin.t('helpModalTitle')",
		"private getHelpSections(): HelpSection[]",
		"private renderHelpSection",
		"private renderHelpErrorList",
		"private splitHelpLines",
	]);
	assert.equal(helpModalBlock.includes("help-close-button"), false, "Help modal should rely on Obsidian's native close button");
	assert.equal(helpModalBlock.includes("close-help"), false, "Help modal should not render a duplicate close button");
	sourceContainsAll(stylesSource, [
		".dify-sync-settings .help-button",
		".modal.dify-sync-modal-shell.help-modal-shell",
		"height: min(720px, calc(100vh - 56px));",
		".dify-sync-modal.help-modal",
		"grid-template-rows: auto minmax(0, 1fr);",
		".modal.dify-sync-modal-shell.help-modal-shell .modal-close-button",
		"right: 18px;",
		".dify-sync-modal.help-modal .modal-head",
		"padding: 18px 64px 18px 18px;",
		".dify-sync-modal.help-modal .modal-title-line",
		"align-self: center;",
		".dify-sync-modal .help-modal-body",
		"overflow-y: auto;",
		".dify-sync-modal .help-section",
		".dify-sync-modal .help-error-list",
		".dify-sync-modal .help-error-item",
	]);
	assert.equal(stylesSource.includes(".dify-sync-modal.help-modal .help-close-button"), false, "Help modal close button styles should not exist");
});

test("connection initial labels, placeholders, status dot, and summary metrics are locked", () => {
	sourceContainsAll(mainSource, [
		"this.getConnectionStatusToneClass()",
		"statusLine.createSpan({ cls: `status-dot ${this.getConnectionStatusToneClass()}` });",
	]);
	sourceContainsAll(mainSource, [
		".setName(this.createSettingName(this.plugin.t('apiKeyName'), { required: true }))",
		".setName(this.createSettingName(this.plugin.t('apiUrlName'), { required: true }))",
		"required.className = 'required-marker';",
	]);
	assert.equal(mainSource.includes("}, 'lan-url', this.plugin.t('settingsReviewLanUrlPlaceholder'), { optional: true });"), false, "LAN URL field should not render in connection settings");
	assert.equal(mainSource.includes("}, 'public-url', this.plugin.t('settingsReviewPublicUrlPlaceholder'), { optional: true });"), false, "Public URL field should not render in connection settings");
	assert.equal(mainSource.includes("cls: 'advanced-connection'"), false, "Connection settings should not render alternate URL containers");
	assert.equal(mainSource.includes("optional-marker"), false, "Optional connection fields should not render visible optional labels");
	assert.equal(
		mainSource.includes("statusLine.createSpan({ text: this.getActiveUrlLabel() });"),
		false,
		"Connection status line should not render the saved or active URL after the status text",
	);
	sourceContainsAll(stylesSource, [
		".dify-sync-settings .required-marker",
		"color: var(--text-error);",
		".dify-sync-settings .native-setting-row.setting-row",
		"background: transparent;",
		"box-shadow: none;",
		".dify-sync-settings .native-setting-row .setting-item-description",
		"display: none;",
		".dify-sync-settings .setting-item-control:has(.secret-toggle) input",
		"padding-inline-end: 3rem;",
		"display: inline-flex;",
		"align-items: center;",
		"justify-content: center;",
		"top: 50%;",
		"right: 8px;",
		"height: 28px !important;",
		"min-height: 28px !important;",
		"max-height: 28px !important;",
		"padding: 0 !important;",
		"line-height: 1;",
		"transform: translateY(-50%);",
		".dify-sync-settings .secret-toggle .svg-icon",
		"transform: translateY(-1px);",
		".dify-sync-settings .status-dot.is-muted",
		".dify-sync-settings .status-dot.is-success",
		".dify-sync-settings .status-dot.is-error",
	]);
});

test("connection failures use localized short copy, unified notices, and red error dots", () => {
	const settingsTabBlock = mainSource.slice(
		mainSource.indexOf("class DifySyncSettingTab"),
		mainSource.indexOf("class ConfirmModal"),
	);

	sourceContainsAll(mainSource, [
		"connectionErrorMissingConfig: '请先填写 Dify API Key 和 Dify 服务地址。'",
		"connectionErrorRateLimited: 'Dify 返回请求过多，请降低并发上传数或稍后重试。'",
		"connectionErrorUnexpectedResponse: '当前地址返回的不是 Dify 知识库 API，请检查地址和端口是否指向 Dify 服务。'",
		"connectionErrorMissingConfig: 'Enter a Dify API key and service URL first.'",
		"connectionErrorNotFound: 'The Dify knowledge base API was not found. Check the Dify service URL, port, and reverse proxy forwarding.'",
		"connectionErrorRateLimited: 'Dify returned too many requests. Lower upload concurrency or try again later.'",
		"connectionErrorUnexpectedResponse: 'The current address did not return the Dify knowledge base API. Check that the URL and port point to Dify.'",
		"getConnectionFailureMessage(reason: ConnectionErrorReason = 'unknown')",
		"showConnectionError(error?: unknown)",
		"notice.noticeEl?.addClass('dify-sync-error-notice')",
		"throw new DifyApiError(",
		"probe.statusCode",
		"probe.reason || 'unknown'",
		"const failed = getFinalFailedCandidate(probe);",
		"error: probe.status === 'failed' ? this.getConnectionFailureMessage(reason || 'unknown') : probe.error,",
	]);
	sourceContainsAll(settingsTabBlock, [
		"try {",
		"await this.plugin.testConnection();",
		"} finally {",
		"testButton.setButtonText(this.plugin.t('testConnection'));",
	]);
	sourceContainsAll(stylesSource, [
		".notice.dify-sync-error-notice::before",
		"background: var(--text-error);",
	]);
	assert.equal(mainSource.includes("function describeConnectionError"), false, "Connection UI should not format user-facing errors from raw English messages");
	assert.equal(mainSource.includes("Current address did not return"), false, "User-facing connection copy should not include raw API diagnostics");
});

test("main mapping table renders centered empty state with four-row viewport and pagination", () => {
	sourceContainsAll(mainSource, [
		"noMappings: '暂无映射，请新增映射，开启自动同步'",
		"noMappings: 'No mappings yet. Add a mapping to enable automatic sync.'",
		"private readonly mainMappingPageSize = 4;",
		"main-mapping-empty",
		"main-mapping-pagination",
		"this.renderMainMappingPagination(card, this.plugin.settings.mappings.length)",
		"this.plugin.t('mappingPageInfoEmpty')",
	]);
	sourceContainsAll(stylesSource, [
		".dify-sync-settings .main-mapping-table",
		".dify-sync-modal .pending-mapping-table",
		"--dify-shared-mapping-row-height: 54px;",
		"--dify-main-mapping-row-height: 54px;",
		"height: calc(var(--dify-shared-mapping-row-height) * 5);",
		"background: transparent;",
		"overflow-x: auto;",
		"overflow-y: hidden;",
		"height: var(--dify-shared-mapping-row-height);",
		".dify-sync-settings .main-mapping-empty",
		"box-sizing: border-box;",
		"height: calc(var(--dify-main-mapping-row-height) * 4);",
		"min-height: calc(var(--dify-main-mapping-row-height) * 4);",
		"place-items: center;",
		"color: var(--dify-prototype-muted);",
		".dify-sync-settings .main-mapping-pagination",
		"--dify-mapping-pagination-gap: 8px;",
		"padding: var(--dify-mapping-pagination-gap) var(--dify-mapping-pagination-gap) var(--dify-mapping-pagination-gap) 0;",
	]);
});

test("sync diagnostics render first-run defaults without endpoint or record-count rows", () => {
	const diagnosticsBlock = mainSource.slice(
		mainSource.indexOf("private renderSyncSettingsSection"),
		mainSource.indexOf("private renderRecentSyncResult"),
	);
	const recentSyncBlock = mainSource.slice(
		mainSource.indexOf("private renderRecentSyncResult"),
		mainSource.indexOf("private createReviewSection"),
	);

	sourceContainsAll(mainSource, [
		"lastSyncInitial: '上次同步时间：--/—/—'",
		"lastSyncInitial: 'Last sync time: --/--/--'",
		"recentSyncInitial: '最近同步：0 任务，耗时 0ms'",
		"recentSyncInitial: 'Recent sync: 0 tasks, elapsed 0ms'",
	]);
	assert.equal(diagnosticsBlock.includes("activeEndpoint"), false, "Sync diagnostics should not render current endpoint rows");
	assert.equal(diagnosticsBlock.includes("recordsCount"), false, "Sync diagnostics should not render sync record count rows");
	assert.equal(recentSyncBlock.includes("recentSyncAddress"), false, "Recent sync diagnostics should not render endpoint address rows");
});

test("mapping modal implements restored builder, pending mappings, and delete preview", () => {
	const modalBlock = mainSource.slice(
		mainSource.indexOf("class ConfirmModal"),
		mainSource.length,
	);

	sourceContainsAll(modalBlock, [
		"mapping-builder",
		"dropdown-trigger",
		"modal-folder",
		"modal-dataset",
		"folder-search",
		"folder-tree",
		"dify-sync-obsidian-folder-tree",
		"nav-folder",
		"nav-folder-title",
		"nav-folder-children",
		"nav-folder-title-content",
		"nav-folder-collapse-indicator dify-sync-folder-toggle",
		"nav-file",
		"nav-file-title",
		"nav-file-title-content",
		"renderFileNode",
		"'chevron-right'",
		"applyFolderSearch",
		"handleFolderTreeKeydown",
		"dataset-option",
		"data-dataset-id",
		"setIcon(trigger.createSpan({ cls: 'dropdown-caret'",
		"setIcon(this.datasetTriggerEl.createSpan({ cls: 'dropdown-caret'",
		"'chevron-down'",
		"pending-mappings",
		"pendingMappingsTitle",
		"pending-bulk-actions",
		"bulk.setAttr('aria-label', this.plugin.t('bulkSet'));",
		"enableAll",
		"pauseAll",
		"chooseFolderFirst",
		"pendingEmptyDesc",
		"pendingAdded",
		"datasetsDropdownEmpty",
		"dataset-empty-state",
		"dataset-checkmark",
		"setIcon(checkmark, 'check')",
		"toggleClass('is-selected', checkbox.checked)",
		"cls: 'mapping-table pending-mapping-table'",
		"'data-role': 'pending-mapping-table', hidden: 'true'",
		"toggleClass('is-hidden', count === 0)",
		"toggleClass('is-hidden', count > 0)",
		"style.display = count === 0 ? 'none' : ''",
		"style.display = count > 0 ? 'none' : ''",
		"renderMappingRowCells(row, this.plugin, mapping, index, 'toggle-pending-status'",
		"addPendingMapping",
		"saveMapping",
		"refresh-pending-mapping",
		"close-delete-confirm",
		"delete-modal-title",
		"confirm-mapping",
	]);
	assert.equal(modalBlock.includes("cls: 'bulk-label'"), false, "Bulk actions should not render a visible group label");
	assert.equal(modalBlock.includes("'tree-row'"), false, "Mapping modal folder picker should not render custom tree-row buttons");
	assert.equal(modalBlock.includes("'tree-toggle'"), false, "Mapping modal folder picker should not render custom tree-toggle spans");
	assert.equal(modalBlock.includes("'tree-children'"), false, "Mapping modal folder picker should not render custom tree-children containers");
	assert.ok(modalBlock.includes("this.app.vault.getMarkdownFiles()"), "Mapping modal picker should render Markdown note choices");
	assert.ok(modalBlock.includes(".nav-folder, .nav-file"), "Mapping modal search should preserve ancestor folders for both folder and note matches");

	assert.equal(
		modalBlock.includes("text: '×', cls: 'icon', attr: { type: 'button', 'aria-label': this.plugin.t('cancel'), 'data-action': 'close-modal' }"),
		false,
		"Mapping modal should rely on Obsidian's native close button instead of rendering a duplicate title close button",
	);

	const renderDatasetChoicesBlock = modalBlock.slice(
		modalBlock.indexOf("private renderDatasetChoices()"),
		modalBlock.indexOf("private renderPendingMappings"),
	);
	assert.ok(
		renderDatasetChoicesBlock.includes("this.plugin.t('datasetsDropdownEmpty')"),
		"Dataset dropdown empty state should use the short action-oriented placeholder",
	);
	assert.equal(
		renderDatasetChoicesBlock.includes("this.plugin.t('datasetsEmpty')"),
		false,
		"Dataset dropdown should not render the long connection troubleshooting text",
	);

	const renderPendingRowsBlock = modalBlock.slice(
		modalBlock.indexOf("private renderPendingRows()"),
		modalBlock.indexOf("private updatePendingVisibility"),
	);
	assert.equal(
		renderPendingRowsBlock.includes("const tags = row.createDiv('tags')"),
		false,
		"Pending mapping rows should use the shared saved-row cell renderer instead of duplicating tag cells",
	);
	assert.equal(
		renderPendingRowsBlock.includes("const statusCell = row.createDiv()"),
		false,
		"Pending mapping rows should use the shared saved-row cell renderer instead of duplicating status cells",
	);

	const sharedRowRendererBlock = mainSource.slice(
		mainSource.indexOf("function renderMappingRowCells"),
		mainSource.indexOf("function createId"),
	);
	sourceContainsAll(sharedRowRendererBlock, [
		"row.dataset.folder = mapping.folder;",
		"row.dataset.dataset = mapping.datasetIds.map((id) => plugin.getDatasetName(id)).join(',');",
		"row.dataset.datasetId = mapping.datasetIds.join(',');",
		"row.createDiv({ text: String(index + 1), cls: 'mapping-index' });",
		"folderCell.createDiv({ text: mapping.folder || plugin.t('rootFolder'), cls: 'folder-name' });",
		"const tags = row.createDiv('tags');",
		"cls: 'tag dataset-name'",
		"const statusCell = row.createDiv();",
		"const statusControl = statusCell.createDiv('mapping-status-control');",
		"const toggle = new ToggleComponent(statusControl)",
		".setValue(mapping.enabled)",
		"toggle.toggleEl.setAttr('data-action', statusAction);",
		"cls: 'mapping-status-label'",
		"renderActions(row.createDiv('row-actions'));",
	]);
	assert.equal(sharedRowRendererBlock.includes("createEl('button'"), false, "Mapping status should use Obsidian ToggleComponent instead of a custom pill button");
	assert.equal(sharedRowRendererBlock.includes("mapping-switch"), false, "Mapping status should not render the old custom pill class");
	sourceContainsAll(mainSource, [
		"renderMappingRowCells(row, this.plugin, mapping, index, 'toggle-mapping-status'",
		"renderMappingRowCells(row, this.plugin, mapping, index, 'toggle-pending-status'",
	]);
});

test("visible mapping tags use dataset names while ids stay in data attributes", () => {
	const settingsTabBlock = mainSource.slice(
		mainSource.indexOf("class DifySyncSettingTab"),
		mainSource.indexOf("class ConfirmModal"),
	);
	const modalBlock = mainSource.slice(
		mainSource.indexOf("class MappingEditorModal"),
		mainSource.length,
	);

	assert.ok(settingsTabBlock.includes("this.plugin.getDatasetName(id)"), "Main table should render dataset names");
	assert.ok(mainSource.includes("row.dataset.datasetId = mapping.datasetIds.join(',')"), "Mapping rows should retain dataset ids in data-dataset-id");
	assert.ok(modalBlock.includes("this.plugin.getDatasetName(id)"), "Pending rows and selection summary should render dataset names");
	assert.ok(modalBlock.includes("'data-dataset-id': dataset.id"), "Dataset options should retain ids in data-dataset-id");
});

test("legacy Obsidian setting UI classes are removed from source", () => {
	for (const token of ["LegacyDifySyncSettingTab", "LegacyMappingEditorModal", "FolderPickerModal"]) {
		assert.equal(mainSource.includes(token), false, `Expected source to remove ${token}`);
	}
});

test("styles include restored prototype selectors for cards, dropdowns, modal, and toast", () => {
	sourceContainsAll(stylesSource, [
		".section-card",
		".setting-row",
		".dropdown-trigger",
		".connection-action-buttons",
		".callout",
		".mapping-builder",
		".pending-mappings",
		".confirm-mapping",
		".dataset-empty-state",
		".dataset-option.is-selected",
		".dataset-checkmark",
		".dataset-option input[type=\"checkbox\"]:checked + .dataset-checkmark",
		"border-color: var(--interactive-accent);",
		"background: var(--interactive-accent);",
		"color: var(--accent-text);",
		".toast-region",
	]);
	assert.equal(
		stylesSource.includes(".dataset-option input[type=\"checkbox\"]:checked::after"),
		false,
		"Dataset checkbox should use the explicit check icon instead of input pseudo-elements",
	);
	for (const hardcodedPurple of ["rgba(139, 108, 239", "rgba(154, 123, 255", "#8b6cef", "#9a7bff"]) {
		assert.equal(
			stylesSource.includes(hardcodedPurple),
			false,
			`Dataset and control states should use Obsidian accent variables instead of hardcoded purple token ${hardcodedPurple}`,
		);
	}
});

test("delete mapping confirm modal has a single aligned close button and list preview", () => {
	const confirmModalBlock = mainSource.slice(
		mainSource.indexOf("class ConfirmModal"),
		mainSource.indexOf("class MappingEditorModal"),
	);

	sourceContainsAll(mainSource, [
		"deleteMappingTitle: '删除映射'",
		"deleteMappingTitle: 'Delete mapping'",
	]);
	assert.equal(mainSource.includes("deleteMappingTitle: '删除映射？'"), false, "Chinese delete mapping title should not include a question mark");
	assert.equal(mainSource.includes("deleteMappingTitle: 'Delete mapping?'"), false, "English delete mapping title should not include a question mark");
	assert.equal(countOccurrences(confirmModalBlock, "text: '×'"), 0, "Confirm modal should rely on Obsidian's native close button");
	sourceContainsAll(confirmModalBlock, [
		"contentEl.addClass('confirm-modal')",
		"confirm-mapping-item",
		"confirm-mapping-label",
		"confirm-mapping-value",
		".setWarning()",
		"data-role', 'delete-folder'",
		"data-role', 'delete-datasets'",
		"confirm.buttonEl.setAttr('data-action', 'confirm-delete');",
	]);
	assert.equal(confirmModalBlock.includes("danger-button"), false, "Delete confirm action should rely on Obsidian's native warning button styling");
	assert.equal(stylesSource.includes(".dify-sync-modal .danger-button"), false, "Confirm modal should not reintroduce a custom danger button color layer");
	sourceContainsAll(stylesSource, [
		".modal.dify-sync-modal-shell.confirm-modal-shell .modal-close-button",
		"top: 18px;",
		"right: 18px;",
		".dify-sync-modal.confirm-modal {",
		"padding: 0;",
		"overflow: hidden;",
		"overflow-x: hidden;",
		".dify-sync-modal.confirm-modal .modal-head",
		"padding: 18px 64px 18px 18px;",
		".dify-sync-modal.confirm-modal .modal-title-line h2",
		".dify-sync-modal.confirm-modal .confirm-mapping",
		"overflow-x: hidden;",
		".dify-sync-modal.confirm-modal .confirm-mapping-item",
		"grid-template-columns: minmax(0, 8.5rem) minmax(0, 1fr);",
		".dify-sync-modal.confirm-modal .confirm-mapping-value",
		"overflow-wrap: anywhere;",
		".dify-sync-modal.confirm-modal .modal-actions",
		"padding: 10px 18px 18px;",
	]);
	assert.match(
		stylesSource,
		/\.dify-sync-modal\.confirm-modal\s*\{[^}]*padding: 0;[^}]*overflow: hidden;/s,
		"Confirm modal content should remove native padding and hide horizontal overflow",
	);
	assert.match(
		stylesSource,
		/\.modal\.dify-sync-modal-shell\.confirm-modal-shell \.modal-close-button\s*\{[^}]*top: 18px;[^}]*right: 18px;/s,
		"Confirm modal native close button should align with the modal title row",
	);
	assert.match(
		stylesSource,
		/\.dify-sync-modal\.confirm-modal \.modal-head\s*\{[^}]*padding: 18px 64px 18px 18px;/s,
		"Confirm modal title row should reserve space for the native close button",
	);
});

test("only API key and Dify service URL retain native setting help text", () => {
	const settingsTabBlock = mainSource.slice(
		mainSource.indexOf("class DifySyncSettingTab"),
		mainSource.indexOf("class ConfirmModal"),
	);
	const confirmModalBlock = mainSource.slice(
		mainSource.indexOf("class ConfirmModal"),
		mainSource.indexOf("class MappingEditorModal"),
	);
	const mappingModalBlock = mainSource.slice(
		mainSource.indexOf("class MappingEditorModal"),
		mainSource.indexOf("function createEmptyConnectionHealth"),
	);

	sourceContainsAll(stylesSource, [
		"/* Topbar and heading reset: keep Obsidian theme heading styles from shifting the restored layout. */",
		".dify-sync-settings .title-line,",
		".dify-sync-settings .heading-line,",
		".dify-sync-settings .label-line,",
		"display: inline-flex;",
		"gap: 4px;",
		".dify-sync-settings .help-icon {",
		"min-width: 1.0625rem;",
		"min-height: 1.0625rem;",
		"line-height: 1;",
		"white-space: nowrap;",
		".dify-sync-settings .heading-text {",
		"width: fit-content;",
		"flex: 0 0 auto !important;",
		"margin: 0 !important;",
	]);

	assert.match(
		stylesSource,
		/\.dify-sync-settings \.title-line,\s*\.dify-sync-settings \.heading-line,\s*\.dify-sync-settings \.label-line,\s*\.dify-sync-modal \.modal-title-line,\s*\.dify-sync-modal \.label-line\s*\{[^}]*gap: 4px;/s,
		"Current settings title, heading, and label rows should use a 4px gap",
	);
	assert.match(
		getCssBlock(stylesSource, ".dify-sync-settings .title-line .heading-text {"),
		/all: unset;[\s\S]*padding: 0[\s\S]*text-indent: 0/,
		"Settings topbar heading should reset native/theme heading offsets instead of moving the title group",
	);
	assert.match(
		mainSource,
		/createEl\('h1', \{ text: this\.plugin\.t\('settingsTitle'\), cls: 'heading-text' \}\)/,
		"Settings title should have a dedicated compact heading text class",
	);
	assert.match(
		mainSource,
		/createEl\('h2', \{ text: title, cls: 'heading-text', attr: \{ id: titleId \} \}\)/,
		"Section headings should have a dedicated compact heading text class",
	);
	assert.equal(
		countOccurrences(settingsTabBlock, ".setTooltip(this.plugin.t('apiKeyDesc'))"),
		1,
		"API key should retain native Setting tooltip text",
	);
	assert.equal(
		countOccurrences(settingsTabBlock, ".setTooltip(this.plugin.t('apiUrlDesc'))"),
		1,
		"Dify service URL should retain native Setting tooltip text",
	);
	assert.equal(
		settingsTabBlock.includes(".setDesc(this.plugin.t('apiKeyDesc'))"),
		false,
		"API key description should stay in tooltip only, not render as a visible native Setting description",
	);
	assert.equal(
		settingsTabBlock.includes(".setDesc(this.plugin.t('apiUrlDesc'))"),
		false,
		"Dify service URL description should stay in tooltip only, not render as a visible native Setting description",
	);
	assert.equal(settingsTabBlock.includes("this.createHelpIcon(titleLine"), false, "Main settings titles should not render help icons");
	assert.equal(settingsTabBlock.includes("this.createHelpIcon(labelLine, this.plugin.t('autoSyncDesc'))"), false, "Auto sync switch should not render a help icon");
	assert.equal(confirmModalBlock.includes("createHelpIcon"), false, "Delete confirmation modal should not render help icons");
	assert.equal(mappingModalBlock.includes("createHelpIcon"), false, "Mapping editor modal should not render help icons");
	assert.equal(stylesSource.includes(".dify-sync-help-icon"), false, "Legacy help icon styles should be removed");
	assert.equal(stylesSource.includes(".dify-sync-modal .help-icon"), false, "Modal help icon styles should be removed");
	assert.equal(stylesSource.includes(".dify-sync-settings .title-line > .help-icon"), false, "Title help icon override should be removed");
});

test("settings native controls are not overridden by broad custom control states", () => {
	const settingsTabBlock = mainSource.slice(
		mainSource.indexOf("class DifySyncSettingTab"),
		mainSource.indexOf("class ConfirmModal"),
	);

	sourceContainsAll(stylesSource, [
		".dify-sync-modal .dropdown-trigger:hover",
	]);
	sourceContainsAll(settingsTabBlock, [
		"this.createNativeSetting(card, 'setting-row')",
		"new Setting(container).setClass('native-setting-row')",
		".addText((text) =>",
		".addDropdown((dropdown) =>",
		".addToggle((toggle) =>",
		"new ButtonComponent(",
	]);

	assert.equal(settingsTabBlock.includes("private createSelectControl"), false, "Settings page should not define the old custom select helper");
	assert.equal(settingsTabBlock.includes("private closeOtherDropdowns"), false, "Settings page should not manage custom dropdown closing");
	assert.doesNotMatch(stylesSource, /\.dify-sync-settings\s+button:hover,/s, "Settings page should not globally override native button hover states");
	assert.doesNotMatch(stylesSource, /\.dify-sync-settings\s+\.section-head button:hover/s, "Section action buttons should keep native hover states");
	assert.doesNotMatch(stylesSource, /\.dify-sync-settings\s+\.mapping-table button:hover/s, "Mapping table buttons should keep native hover states");
	assert.doesNotMatch(stylesSource, /\.dify-sync-modal\s+button:hover/s, "Modal action buttons should keep native hover states");
	assert.doesNotMatch(stylesSource, /\.dify-sync-settings\s+input:hover,/s, "Settings page should not globally override native input hover states");
	assert.doesNotMatch(stylesSource, /\.dify-sync-settings\s+select:hover,/s, "Settings page should not globally override native select hover states");
	assert.doesNotMatch(stylesSource, /\.dify-sync-settings\s+\.dropdown-trigger/s, "Settings page should not style custom dropdown triggers");
	assert.doesNotMatch(stylesSource, /\.dify-sync-settings\s+\.select-option/s, "Settings page should not style custom dropdown options");
});

test("settings topbar does not render the version review layout pill", () => {
	const settingsTabBlock = mainSource.slice(
		mainSource.indexOf("class DifySyncSettingTab"),
		mainSource.indexOf("class ConfirmModal"),
	);

	assert.equal(mainSource.includes("versionPill"), false, "Settings copy should not define versionPill text");
	assert.equal(settingsTabBlock.includes("version-pill"), false, "Settings topbar should not render the version review layout pill");
	assert.equal(settingsTabBlock.includes("设置审查布局"), false, "Chinese review layout pill text should be removed");
	assert.equal(settingsTabBlock.includes("Settings review layout"), false, "English review layout pill text should be removed");
});

test("major settings headings align with the background cards", () => {
	sourceContainsAll(stylesSource, [
		".dify-sync-settings .title-line,",
		".dify-sync-settings .heading-line {",
		".dify-sync-settings .title-line .heading-text {",
		"all: unset;",
	]);

	assert.doesNotMatch(
		stylesSource,
		/--dify-topbar-title-align-offset:/s,
		"Topbar title alignment should not rely on a manual horizontal offset",
	);
	assert.doesNotMatch(
		stylesSource,
		/\.dify-sync-settings \.title-line\s*\{[^}]*transform:/s,
		"Topbar title group should stay naturally aligned with the settings content",
	);
	assert.doesNotMatch(
		stylesSource,
		/\.dify-sync-settings \.heading-line\s*\{[^}]*transform:/s,
		"Section headings should not be offset away from the card edge",
	);
	assert.doesNotMatch(
		stylesSource,
		/\.dify-sync-settings \.label-line\s*\{[^}]*transform:/s,
		"Field labels should not receive heading alignment offsets",
	);
});

test("test vault plugin styles keep natural topbar title alignment", () => {
	for (const source of [stylesSource, testVaultStylesSource]) {
		sourceContainsAll(source, [
			"/* Topbar and heading reset: keep Obsidian theme heading styles from shifting the restored layout. */",
			".dify-sync-settings .title-line {",
			"flex-direction: column;",
			".dify-sync-settings .title-line,",
			".dify-sync-settings .heading-line {",
			".dify-sync-settings .title-line .heading-text {",
			"all: unset;",
			"padding: 0",
			"text-indent: 0",
		]);
		assert.doesNotMatch(
			source,
			/--dify-topbar-title-align-offset:/s,
			"Topbar title offset token should not come back in source or test vault styles",
		);
		assert.doesNotMatch(
			source,
			/\.dify-sync-settings \.title-line\s*\{[^}]*transform:/s,
			"Topbar title group should not be shifted in source or test vault styles",
		);
		assert.doesNotMatch(
			source,
			/\.dify-sync-settings \.heading-line\s*\{[^}]*transform:/s,
			"Section headings should not be offset away from the card edge in source or test vault styles",
		);
		assert.doesNotMatch(
			source,
			/\.dify-sync-settings \.title-line\s*\{[^}]*padding-left:/s,
			"Topbar title group should not be pushed right as a whole",
		);
	}
});

test("settings body copy and buttons use consistent regular typography outside major headings", () => {
	sourceContainsAll(stylesSource, [
		"/* Typography override: normalize dense settings copy while heading rules opt back into heavier weights. */",
		"--dify-body-font-size: 0.875rem;",
		".dify-sync-settings :where(",
		".metric-label",
		".metric-value",
			".setting-label",
			".mapping-header",
			".mapping-row",
			"font-size: var(--dify-body-font-size)",
		"font-weight: 400",
		".dify-sync-settings .title-line .heading-text {",
		".dify-sync-settings .heading-line .heading-text",
	]);

	assert.match(
		stylesSource,
		/\.dify-sync-settings :where\([^}]+\.metric-label[^}]+\.metric-value[^}]+\.setting-label[^}]+\.mapping-header[^}]+\.mapping-row[^}]+\)\s*\{[^}]*font-size: var\(--dify-body-font-size\)[^}]*font-weight: 400/s,
		"Settings body text, table text, and metrics should share regular typography",
	);
	assert.match(
		stylesSource,
		/\.dify-sync-settings \.title-line \.heading-text\s*\{[^}]*font-size: 1\.45rem;[^}]*font-weight: 720;/s,
		"Top settings heading should keep the larger bold treatment",
	);
	assert.match(
		stylesSource,
		/\.dify-sync-settings \.section-head h2,\s*\.dify-sync-settings \.heading-line \.heading-text\s*\{[^}]*font-size: 1\.08rem;[^}]*font-weight: 700;/s,
		"Only the four major settings headings should keep the larger bold treatment",
	);
});

test("custom dropdowns are scoped to the mapping modal", () => {
	sourceContainsAll(stylesSource, [
		"/* Modal dropdown option override: menu rows stay flat, not framed like buttons. */",
		".dify-sync-modal .dropdown-caret",
		"display: inline-grid;",
		"place-items: center;",
		"flex: 0 0 14px;",
		"width: 14px;",
		"height: 14px;",
		"align-self: center;",
		".dify-sync-modal .select-option",
		"border-color: transparent !important;",
		"background: transparent !important;",
		"box-shadow: none !important;",
	]);

	assert.match(
		stylesSource,
		/\.dify-sync-modal \.dropdown-caret\s*\{[^}]*display: inline-grid;[^}]*place-items: center;[^}]*flex: 0 0 14px;[^}]*width: 14px;[^}]*height: 14px;[^}]*align-self: center;/s,
		"Modal dropdown carets should match the prototype's fixed 14px square",
	);
	assert.match(
		getCssBlock(stylesSource, ".dify-sync-modal .select-option {"),
		/border-color: transparent[\s\S]*background: transparent[\s\S]*box-shadow: none/,
		"Modal dropdown options should not render as framed buttons inside menus",
	);
	assert.doesNotMatch(stylesSource, /\.dify-sync-settings\s+\.dropdown-caret/s, "Settings page should not carry custom dropdown caret styles");
	assert.doesNotMatch(stylesSource, /\.dify-sync-settings\s+\.select-option/s, "Settings page should not carry custom dropdown option styles");
	assert.doesNotMatch(mainSource, /private closeOtherDropdowns\(currentMenu\?: HTMLElement\)/, "Settings selects should no longer define a custom close helper");
	assert.match(
		mainSource,
		/private closeSiblingDropdowns\(currentMenu\?: HTMLElement\)/,
		"Mapping modal dropdowns should define a helper to close sibling dropdowns",
	);
	assert.match(
		mainSource,
		/this\.closeSiblingDropdowns\(menu\);[\s\S]*trigger\.setAttr\('aria-expanded', 'true'\);[\s\S]*menu\.hidden = false;/,
		"Opening a modal dropdown should close its sibling menu first",
	);
});

test("mapping modal custom dropdowns close when clicking blank modal space", () => {
	sourceContainsAll(mainSource, [
		"this.contentEl.addEventListener('click', () => this.closeSiblingDropdowns());",
		"box.addEventListener('click', (event) => event.stopPropagation());",
	]);

	assert.doesNotMatch(mainSource, /private dropdownOutsideClickBound = false;/, "Settings tab should not bind custom dropdown outside-click state");
	assert.doesNotMatch(mainSource, /private bindDropdownOutsideClick\(containerEl: HTMLElement\)/, "Settings tab should not bind custom dropdown outside-click listeners");
	assert.doesNotMatch(mainSource, /containerEl\.addEventListener\('click', \(\) => this\.closeOtherDropdowns\(\)\);/, "Settings page should leave native dropdown closing to Obsidian");
	assert.match(
		mainSource,
		/private closeSiblingDropdowns\(currentMenu\?: HTMLElement\)/,
		"Modal dropdown close helper should support closing every open menu",
	);
	assert.match(
		mainSource,
		/this\.contentEl\.addEventListener\('click', \(\) => this\.closeSiblingDropdowns\(\)\);/,
		"Clicking blank modal space should close open dropdowns",
	);
});

test("mapping modal picker columns stay constrained within the dialog", () => {
	sourceContainsAll(stylesSource, [
		".dify-sync-modal .mapping-builder",
		".dify-sync-modal.mapping-modal",
		"grid-template-rows: auto auto auto;",
		"width: min(980px, calc(100vw - 64px));",
		"height: auto;",
		"max-height: calc(100vh - 56px);",
		"overflow: visible;",
		".modal.dify-sync-modal-shell.mapping-modal-shell",
		"border-radius: 10px;",
		"box-shadow: var(--shadow-l);",
		".modal.dify-sync-modal-shell.mapping-modal-shell .modal-close-button",
		"top: 18px;",
		"right: 18px;",
		".dify-sync-modal.mapping-modal .modal-head",
		"padding: 18px 64px 12px 18px;",
		"grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr);",
		"gap: 8px;",
		"width: 100%;",
		"justify-self: stretch;",
		".dify-sync-modal .dropdown-box",
		"max-width: 100%;",
		".dify-sync-modal.mapping-modal .dropdown-trigger",
		"padding: 7px 4px 7px 10px;",
		".dify-sync-modal.mapping-modal .dropdown-menu",
		"top: calc(100% + 6px);",
		"padding: 10px;",
		"box-shadow: var(--shadow-s);",
		".dify-sync-modal.mapping-modal #folder-dropdown-menu,",
		".dify-sync-modal.mapping-modal #dataset-dropdown-menu",
		"height: 440px;",
		".dify-sync-modal .dataset-select-row",
		"grid-template-columns: minmax(0, 1fr) auto;",
		"gap: 8px;",
		".dify-sync-modal.mapping-modal .dify-sync-obsidian-folder-tree",
		".dify-sync-modal.mapping-modal .dify-sync-obsidian-folder-tree .nav-folder-title",
		".dify-sync-modal.mapping-modal .dify-sync-obsidian-folder-tree .nav-folder-title-content",
		".dify-sync-modal.mapping-modal .dify-sync-obsidian-folder-tree .nav-folder-children",
		".dify-sync-modal.mapping-modal .dify-sync-obsidian-folder-tree .dify-sync-folder-toggle",
		".dify-sync-modal.mapping-modal .dify-sync-obsidian-folder-tree .nav-file",
		".dify-sync-modal.mapping-modal .dify-sync-obsidian-folder-tree .nav-file-title",
		".dify-sync-modal.mapping-modal .dify-sync-obsidian-folder-tree .nav-file-title-content",
		".dify-sync-modal.mapping-modal .dify-sync-obsidian-folder-tree .dify-sync-folder-count",
		"background: var(--background-modifier-hover);",
		".dify-sync-modal .dataset-option:hover,",
		".dify-sync-modal .dataset-option:focus-within",
		"border-color: var(--border-hover);",
		"background: color-mix(in srgb, var(--interactive-accent) 16%, transparent);",
		"box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--interactive-accent) 18%, transparent);",
		"background: color-mix(in srgb, var(--interactive-accent-hover) 22%, transparent);",
		"box-shadow: 0 0 0 2px color-mix(in srgb, var(--interactive-accent) 18%, transparent);",
		"font-size: 11px;",
		"line-height: 1.3;",
		".dify-sync-modal .mapping-table",
		"overflow-x: auto;",
		"overflow-y: hidden;",
		".dify-sync-settings .main-mapping-table,",
		".dify-sync-modal .pending-mapping-table",
		"--dify-shared-mapping-row-height: 54px;",
		"height: calc(var(--dify-shared-mapping-row-height) * 5);",
		".dify-sync-settings .main-mapping-table .mapping-header,",
		".dify-sync-settings .main-mapping-table .mapping-row,",
		".dify-sync-modal .pending-mapping-table .mapping-header,",
		".dify-sync-modal .pending-mapping-table .mapping-row",
		"height: var(--dify-shared-mapping-row-height);",
		"min-height: var(--dify-shared-mapping-row-height);",
		"--dify-pending-mapping-row-height: 54px;",
		"background: transparent;",
		".dify-sync-modal .pending-mappings > .pending-empty[hidden],",
		".dify-sync-modal .pending-mappings .mapping-table[hidden]",
		".dify-sync-modal .pending-mappings > .pending-empty.is-hidden,",
		".dify-sync-modal .pending-mappings .mapping-table.is-hidden",
		"display: none;",
		".dify-sync-settings .mapping-header,",
		".dify-sync-settings .mapping-row,",
		".dify-sync-modal .mapping-header,",
		".dify-sync-modal .mapping-row",
		"box-sizing: border-box;",
		"grid-template-columns: 3rem minmax(10rem, 1.1fr) minmax(13rem, 1.4fr) 7rem 5.5rem;",
		"min-width: 46rem;",
		".dify-sync-modal .pending-bulk-actions",
		"margin-inline-end: 0;",
		".dify-sync-modal .bulk-action",
		"min-height: 28px;",
		"padding: 3px 10px;",
		".dify-sync-settings .mapping-status-control,",
		".dify-sync-modal .mapping-status-control",
		".dify-sync-settings .mapping-status-label,",
		".dify-sync-modal .mapping-status-label",
		".dify-sync-settings .danger,",
		".dify-sync-modal .danger",
		"color: var(--text-error);",
		".dify-sync-modal .mapping-arrow-icon",
		"border: 1px solid var(--border);",
		"background: var(--background-modifier-hover);",
		"color: var(--text-muted);",
		".dify-sync-modal .modal-actions",
		"padding-inline: 18px;",
		"padding-bottom: 18px;",
		".dify-sync-modal .modal-body",
		"padding: 0 18px;",
		".dify-sync-modal .mapping-pagination",
		"--dify-mapping-pagination-gap: 8px;",
		"padding: var(--dify-mapping-pagination-gap) var(--dify-mapping-pagination-gap) var(--dify-mapping-pagination-gap) 0;",
	]);

	assert.match(
		stylesSource,
		/\.dify-sync-modal\.mapping-modal\s*\{[^}]*box-sizing: border-box;[^}]*grid-template-rows: auto auto auto;[^}]*width: min\(980px, calc\(100vw - 64px\)\);[^}]*height: auto;[^}]*max-height: calc\(100vh - 56px\);[^}]*overflow: visible;/s,
		"Mapping modal should restore the prototype's natural-height review dialog",
	);
	assert.match(
		stylesSource,
		/\.dify-sync-modal \.mapping-builder\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) 40px minmax\(0, 1fr\);[^}]*gap: 8px;[^}]*width: 100%;[^}]*justify-self: stretch;/s,
		"Mapping modal picker columns should keep a compact 40px arrow column",
	);
	assert.match(
		stylesSource,
		/\.modal\.dify-sync-modal-shell\.mapping-modal-shell \.modal-close-button\s*\{[^}]*top: 18px;[^}]*right: 18px;/s,
		"Mapping modal native close button should align with the modal title row",
	);
	assert.match(
		stylesSource,
		/\.dify-sync-modal\.mapping-modal \.modal-head\s*\{[^}]*padding: 18px 64px 12px 18px;/s,
		"Mapping modal title row should reserve space for the native close button",
	);
	assert.match(
		stylesSource,
		/\.dify-sync-modal \.dropdown-box\s*\{[^}]*width: 100%;[^}]*max-width: 100%;/s,
		"Folder and dataset dropdown boxes should not exceed their panel width",
	);
	assert.match(
		stylesSource,
		/\.dify-sync-settings \.main-mapping-table,\s*\.dify-sync-modal \.pending-mapping-table\s*\{[^}]*--dify-shared-mapping-row-height: 54px;[^}]*height: calc\(var\(--dify-shared-mapping-row-height\) \* 5\);[^}]*overflow-x: auto;[^}]*overflow-y: hidden;/s,
		"Mapping tables should keep horizontal overflow but hide redundant vertical scrollbars",
	);
	assert.match(
		stylesSource,
		/\.dify-sync-settings \.mapping-header,\s*\.dify-sync-settings \.mapping-row,\s*\.dify-sync-modal \.mapping-header,\s*\.dify-sync-modal \.mapping-row\s*\{[^}]*grid-template-columns: 3rem minmax\(10rem, 1\.1fr\) minmax\(13rem, 1\.4fr\) 7rem 5\.5rem;[^}]*min-width: 46rem;/s,
		"Mapping rows should reserve enough status-column width for English status labels",
	);
	assert.doesNotMatch(
		stylesSource,
		/\.dify-sync-modal \.pending-mappings \.mapping-header\s*\{[^}]*background: transparent;/s,
		"Pending mapping header should not override the shared saved-table header styling",
	);
	assert.doesNotMatch(
		stylesSource,
		/\.dify-sync-(?:settings|modal) \.mapping-switch/s,
		"Mapping status should not keep custom pill switch styling after moving to native toggles",
	);
	assert.doesNotMatch(
		stylesSource,
		/\.dify-sync-modal \.bulk-action\.is-enable\s*\{/,
		"Enable all should use the same neutral bulk button styling as Pause all",
	);
	assert.equal(mainSource.includes("addClass('is-enable')"), false, "Enable all should not add a dedicated status color class");
	assert.equal(mainSource.includes("addClass('is-pause')"), false, "Pause all should not add a dedicated status color class");
	assert.doesNotMatch(
		stylesSource,
		/\.dify-sync-modal \.mapping-arrow-icon\s*\{[^}]*var\(--dify-prototype-accent\)[^}]*18%/s,
		"Mapping arrow should use Obsidian neutral theme colors instead of accent fill",
	);
	assert.match(
		stylesSource,
		/\.dify-sync-modal \.modal-body\s*\{[^}]*gap: 0;[^}]*padding: 0 18px;[^}]*overflow: visible;/s,
		"Mapping modal body spacing should restore the prototype's 18px side padding",
	);
	assert.doesNotMatch(
		stylesSource,
		/\.dify-sync-modal \.tree-row/,
		"Mapping modal folder picker should not use the old card-like tree-row CSS",
	);
});

test("settings page renders only the plugin content inside Obsidian's native settings shell", () => {
	const settingsTabBlock = mainSource.slice(
		mainSource.indexOf("class DifySyncSettingTab"),
		mainSource.indexOf("class ConfirmModal"),
	);

	sourceContainsAll(settingsTabBlock, [
		"const appShell = containerEl.createDiv('app');",
		"const main = appShell.createEl('main', { cls: 'main' });",
		"const settings = main.createDiv('settings');",
	]);

	for (const duplicateShellToken of [
		"this.renderRail(appShell);",
		"this.renderSettingsNav(appShell);",
		"this.renderStatusBar(appShell);",
		"private renderRail(containerEl: HTMLElement)",
		"private renderSettingsNav(containerEl: HTMLElement)",
		"private renderStatusBar(containerEl: HTMLElement)",
		"rail-dot",
		"settings-nav",
		"nav-group",
		"statusbar",
	]) {
		assert.equal(
			settingsTabBlock.includes(duplicateShellToken),
			false,
			`Settings page should not render duplicate Obsidian shell token ${duplicateShellToken}`,
		);
	}
});

test("styles keep restored review tokens in a container-safe single-column shell", () => {
	sourceContainsAll(stylesSource, [
		".dify-sync-settings,\n.dify-sync-modal",
		"--bg: var(--background-primary);",
		"--rail: var(--background-secondary);",
		"--panel: var(--background-secondary);",
		"--dify-prototype-panel-2: var(--background-modifier-hover);",
		"--panel-2: var(--dify-prototype-panel-2);",
		"--field: var(--background-primary);",
		"--border: var(--background-modifier-border);",
		"--border-hover: var(--background-modifier-border-hover, var(--interactive-accent));",
		"--border-focus: var(--background-modifier-border-focus, var(--interactive-accent));",
		"--text: var(--text-normal);",
		"--dify-prototype-danger: var(--text-error);",
		"--faint: var(--text-faint);",
		"--accent: var(--interactive-accent);",
		"--accent-strong: var(--interactive-accent-hover);",
		"--accent-text: var(--text-on-accent, #ffffff);",
		"--success: var(--text-success);",
		"--danger: var(--dify-prototype-danger, #ff6b6b);",
		"--dify-mapping-modal-bg: var(--background-primary);",
		"--dify-mapping-panel-bg: var(--background-secondary);",
		"--dify-mapping-field-bg: var(--background-primary);",
		"--dify-mapping-row-bg: var(--background-secondary);",
		".dify-sync-settings .metric-value.accent",
		"color: var(--dify-prototype-accent, var(--interactive-accent));",
		".dify-sync-settings .metric-value.warning",
		"color: var(--text-warning, #f6c85f);",
		".dify-sync-settings .app",
		"grid-template-columns: minmax(0, 1fr);",
		"max-width: 100%;",
		"overflow-x: clip;",
		".dify-sync-settings .main",
		"padding: 24px clamp(16px, 4cqw, 32px) 56px;",
		".dify-sync-settings .settings",
		"max-width: 1120px;",
		"margin: 0 auto;",
		"@container (max-width: 720px)",
	]);

	assert.match(
		stylesSource,
		/\.dify-sync-settings \.app\s*\{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*width: 100%;[^}]*max-width: 100%;[^}]*min-width: 0;[^}]*overflow-x: clip;/s,
		"App shell should fit inside Obsidian's settings content without horizontal overflow",
	);

	for (const hardcodedDarkToken of ["#111216", "#15161b", "#1d1e24", "#202126", "#24252b", "#24252c", "#363944", "#e4e6eb", "#a7acb8"]) {
		assert.equal(
			stylesSource.includes(hardcodedDarkToken),
			false,
			`Settings styles should follow Obsidian theme variables instead of hardcoded dark token ${hardcodedDarkToken}`,
		);
	}
	assert.match(
		stylesSource,
		/@container \(max-width: 720px\)\s*\{[^}]*\.dify-sync-settings \.main\s*\{[^}]*padding: 20px 16px 64px;/s,
		"Settings page should respond to Obsidian's panel width instead of the window width",
	);

	for (const overflowingShellToken of [
		"grid-template-columns: 52px 248px minmax(820px, 1fr);",
		"min-height: 100vh;",
		".dify-sync-settings .rail",
		".dify-sync-settings .settings-nav",
		".dify-sync-settings .rail-dot",
		".dify-sync-settings .nav-item",
		".dify-sync-settings .statusbar",
		"@media (max-width: 920px)",
	]) {
		assert.equal(
			stylesSource.includes(overflowingShellToken),
			false,
			`Styles should not keep duplicate/overflowing shell token ${overflowingShellToken}`,
		);
	}
});
