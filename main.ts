import {
	App,
	ButtonComponent,
	DropdownComponent,
	ExtraButtonComponent,
	Menu,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	setIcon,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
	TextComponent,
	ToggleComponent,
} from 'obsidian';
import type {
	ConnectionErrorReason,
	ConnectionHealth,
	ConnectionProbeResult,
	DifyDocument,
	DifyMutationResponse,
	DifySyncSettings,
	DocumentIndex,
	FolderMapping,
	KnowledgeBaseInfo,
	Language,
	PluginDataShape,
	RecentSyncResult,
	SyncRecord,
	SyncSource,
	SyncStats,
	SyncTask,
} from './src/types';
import {
	getSyncRecordKey,
	migrateRenamedSyncRecords,
	recoverDeletedSyncRecordForCreatedFile,
} from './src/sync/SyncRecords';
import {
	classifyConnectionApiError,
	DifyApiClient,
	DifyApiError,
} from './src/api/DifyApiClient';
import {
	clampNumber,
	getDatasetIdsForPathFromMappings,
	normalizeFolderPath,
	parseJson,
	removeMappingById,
	sanitizeBaseUrl,
	splitIds,
	uniqueStrings,
} from './src/utils/path';
import {
	buildSettingsReviewSummary,
} from './src/sync-utils';

const DEFAULT_SETTINGS: DifySyncSettings = {
	schemaVersion: 2,
	initialSetupCompleted: false,
	language: 'en',
	difyApiKey: '',
	difyApiUrl: '',
	lanApiUrl: '',
	publicApiUrl: '',
	endpointMode: 'primary',
	apiPathStyle: 'auto',
	difyKnowledgeId: '',
	obsidianFolders: [],
	mappings: [],
	knowledgeBases: [],
	lastDatasetRefresh: '',
	autoSyncEnabled: false,
	eventSyncEnabled: true,
	syncOnStartup: true,
	periodicFullScanEnabled: true,
	syncInterval: 30,
	debounceSeconds: 8,
	requestTimeoutSeconds: 30,
	maxRetries: 2,
	maxConcurrent: 2,
	pollIndexStatus: false,
	debugLogging: false,
	lastSyncTime: '',
	connectionHealth: createEmptyConnectionHealth(),
	recentSyncResult: undefined,
};

const STRINGS: Record<Language, Record<string, string>> = {
	'zh-CN': {
		pluginName: 'Vault2Dify',
		ribbon: '同步到 Dify',
		commandManual: 'Vault2Dify: 同步到 Dify 知识库',
		commandToggleAuto: '开启/关闭自动同步',
		ready: '就绪',
		syncing: '正在同步...',
		syncQueued: '已有同步正在运行，本次变更已加入队列。',
		syncNotice: '正在同步到 Dify 知识库...',
		syncComplete: '同步完成：{synced} 个成功，{skipped} 个跳过，{failed} 个失败',
		syncNoChanges: '没有需要同步的变更。',
		syncFailed: '同步失败：{message}',
		syncFailedShort: '失败',
		validationApiKey: '请先配置 Dify API Key。',
		validationApiUrl: '请先配置 Dify 服务地址。',
		validationMapping: '请至少配置一条路径与知识库映射。',
		autoOn: '自动同步已开启',
		autoOff: '自动同步已关闭',
		settingsTitle: 'Vault2Dify',
		settingsSubtitle: '将 Obsidian 笔记库同步到 Dify 知识库',
		settingsHelp: '将 Obsidian 笔记库同步到 Dify 知识库。',
		openGithub: '打开 GitHub 开源项目',
		openHelp: '打开帮助文档',
		helpModalTitle: 'Vault2Dify 帮助',
		helpQuickStartTitle: '快速开始',
		helpQuickStartBody: 'Vault2Dify 会将 Obsidian 笔记库同步到你配置的 Dify 知识库。',
		helpQuickStartList: '填写 Dify API Key。\n填写 Dify 服务地址。\n点击测试连接，插件会自动获取知识库。\n新增路径映射。\n按需点击立即同步，或保持自动同步开启。',
		helpApiUrlTitle: '地址如何填写',
		helpApiUrlBody: 'Dify API Key：必填项，用于访问你的 Dify 知识库，请从 Dify 知识库 API 设置中复制。示例：dataset-vtpB1fgqv************\nDify 服务地址：必填项，是插件连接 Dify 的主地址，适用于 Dify 部署在云服务器、NAS、本地 Docker 等情况。示例：http://dify-host.example.test:5000 或 https://dify.example.com\n如果你的 Dify 知识库部署在 NAS，并希望在家中、公司或外出时都能访问，可以在 NAS 和笔记本上安装并配置 Tailscale，然后填写：http://tailnet-device.example.test:Dify 映射端口。示例：http://tailnet-device.example.test:5000',
		helpApiKeyTitle: 'API Key 要求',
		helpApiKeyBody: '请使用 Dify 知识库 API Key，并确认它具备访问知识库、查询知识库列表、创建文档、更新文档和查询文档列表权限。如果测试连接提示权限不足，请检查 API Key 是否来自正确的 Dify 实例、工作区和知识库。',
		helpMappingTitle: '路径映射',
		helpMappingBody: '路径映射用于指定哪些 Obsidian 笔记同步到哪些 Dify 知识库。选择具体目录时，会同步该目录及其子目录中的 Markdown 文件；选择单篇笔记时，只同步这一篇。每条映射可以单独启用或停用。',
		helpMappingList: '一个 Obsidian 目录或笔记同步到一个知识库。\n一个 Obsidian 目录或笔记同步到多个知识库。\n多个 Obsidian 路径同步到同一个知识库。\n选择整个仓库，同步全部 Markdown 文件。\n停用映射后，该映射不会参与手动同步、文件变更同步、启动后同步或定时全量校验。',
		helpSyncModesTitle: '同步方式',
		helpSyncModesList: '立即同步：手动扫描已启用映射范围内的 Markdown 文件并同步变更。\n文件变更后同步：监听新建、修改、重命名事件，等待防抖时间结束后同步。\n启动后同步：Obsidian 启动并完成加载后自动检查一次变更。\n定时全量校验：按固定间隔扫描所有映射范围内的 Markdown 文件，作为事件同步的兜底。',
		helpSyncRecommendedTitle: '日常建议',
		helpSyncRecommendedList: '自动同步：开启。\n启动后同步：开启。\n定时全量校验：开启。\n同步间隔：30 分钟。\n变更后同步：8 到 15 秒。\n并发上传：NAS / Docker / 小型自托管建议 1 到 2。',
		helpSyncRulesTitle: '同步规则',
		helpSyncRulesBody: '插件只同步 .md 文件，不会上传图片、PDF、附件或其他非 Markdown 文件。本地删除笔记时，插件不会自动删除 Dify 远端文档。删除路径映射也只会删除本地配置，不会删除 Obsidian 文件或 Dify 远端文档。',
		helpSyncRulesList: '根据路径映射找到目标知识库。\n对文件内容计算哈希。\n内容未变化时跳过。\n优先更新已有 Dify 文档。\n找不到已有文档时创建新文档。\n使用 Obsidian 文件路径作为 Dify 文档名，避免同名文件互相覆盖。',
		helpTroubleshootingTitle: '连接失败排查',
		helpTroubleshootingList: '确认 API Key 已填写完整，没有多余空格或换行。\n确认 Dify 服务地址是运行 Obsidian 的当前设备可以访问的地址。\n在浏览器访问 你的地址 + /v1/datasets。\n如果返回 JSON，说明地址大概率正确。\n如果返回 HTML，通常说明地址或端口指向了网页服务。\n如果返回 404，检查 Dify 服务地址、端口或反向代理是否转发 /v1。\n如果返回 401，说明可能已访问到 Dify API，但插件里仍需要正确 API Key。\n如果返回 403，检查 Key 权限和工作区。\n如果打不开，检查 IP、域名、端口、防火墙、Docker 映射、Tailscale 和反向代理。',
		helpCommonErrorsTitle: '常见错误提示',
		helpCommonErrorsList: '请先填写 Dify API Key 和 Dify 服务地址：连接信息不完整。请填写 API Key 和 Dify 服务地址。\nAPI Key 无效，请检查密钥是否正确：Dify 返回 401。请重新复制 API Key，确认没有多余空格或换行。\nAPI Key 没有知识库访问权限：Dify 返回 403。请检查 Key 所属工作区和知识库权限。\n未找到 Dify 知识库 API：Dify 返回 404。请确认 Dify 服务地址、端口和反向代理转发正确。\n当前接口路径不兼容：请确认插件已升级到最新构建，重新点击测试连接后再同步；仍失败时开启调试日志并反馈 Dify 版本和错误信息。\n当前地址返回的不是 Dify 知识库 API：地址可能指向 NAS 管理页、Dify 前端页面、登录页或其他网页服务。请检查端口和反向代理。\n请求超时：请确认当前设备能访问 Dify 服务地址；检查 Dify 服务负载、端口、防火墙、Tailscale 和反向代理；同步大量文件时先将并发上传降到 1 或 2，或分批同步。\n网络连接失败：请检查地址、端口、防火墙、Docker 映射、NAS 网络、Tailscale 或反向代理。\nDify 返回请求过多：可能触发限流。请降低并发上传数，稍后重试，或分批同步大目录。\nDify 服务异常：Dify 返回 5xx。请检查 Dify 容器、服务日志或反向代理 upstream 配置。',
		helpDatasetsTitle: '获取不到知识库',
		helpDatasetsList: 'API Key 没有知识库权限。\nKey 属于错误的工作区。\n当前 Dify 实例没有可访问的知识库。\nDify 服务地址不是当前设备可访问的 Dify 服务。\n反向代理没有正确转发 /v1/datasets。\n返回的是网页、登录页或其他非 Dify API 响应。\n建议先点击测试连接；连接成功后插件会自动获取知识库。',
		helpFilesNotSyncingTitle: '文件没有同步',
		helpFilesNotSyncingList: '文件是否为 .md。\n文件路径是否命中已启用的路径映射。\n映射中是否选择了至少一个 Dify 知识库。\n自动同步是否开启。\n如果依赖事件触发，确认文件变更后同步是否开启。\n尝试点击立即同步，判断是事件触发问题还是连接 / 映射问题。',
		helpSlowSyncTitle: '同步很慢',
		helpSlowSyncList: '将并发上传数调为 1 或 2。\n避免一次同步过大的目录。\n对大知识库分目录、分批同步。\n如果连接也不稳定，先点击测试连接并按连接失败排查处理。',
		helpDuplicateDocsTitle: '出现重复文档',
		helpDuplicateDocsBody: '可能原因包括旧版同步记录缺失、Dify 远端文档名曾被手动修改、本地同步记录被重置或丢失、远端文档曾被手动删除后重新同步。',
		helpDuplicateDocsList: '先在 Dify 控制台确认重复文档。\n保留需要的文档，删除多余文档。\n回到插件设置页，点击重置同步记录。\n再执行一次立即同步，让插件重新建立记录。',
		helpDebugTitle: '调试日志',
		helpDebugBody: '遇到通用连接失败、浏览器访问正常但插件仍失败、NAS / Docker / 反向代理链路复杂，或需要反馈问题给开发者时，建议临时开启调试日志。反馈日志时不要公开 API Key、私有地址、笔记内容或其他敏感信息。',
		helpPrivacyTitle: '隐私与安全',
		helpPrivacyBody: '插件只读取当前 Obsidian 仓库中命中路径映射的 Markdown 文件，只会把需要同步的 Markdown 内容发送到你配置的 Dify 服务地址，不会把笔记内容发送给插件作者，也不会发送到除你配置的 Dify 服务以外的第三方服务。Dify API Key 保存在 Obsidian 插件本地数据中，请不要把包含插件配置的 .obsidian 目录提交到公开仓库。',
		navAria: 'Obsidian 设置导航',
		navAbout: '关于',
		navEditor: '编辑器',
		navFiles: '文件与链接',
		navAppearance: '外观',
		navHotkeys: '快捷键',
		navPlugins: '第三方插件',
		clearConnectionConfig: '清空配置',
		selectPlaceholder: '请选择',
		showApiKey: '显示 API Key',
		hideApiKey: '隐藏 API Key',
		healthConnection: '连接状态',
		healthActiveUrl: '当前地址',
		healthRecentSync: '最近同步',
		connectionUnknown: '尚未测试',
		connectionMissing: '待配置',
		connectionConnected: '已连接',
		connectionFailedState: '连接失败',
		recentSyncNone: '尚未同步',
		quickStepKey: '填写 Key',
		quickStepKeyDesc: 'Dify 知识库 API Key',
		quickStepTest: '测试连接',
		quickStepTestDesc: '自动识别可用地址并获取知识库',
		quickStepMapping: '新增映射',
		quickStepMappingDesc: '选择路径与知识库',
		sectionBasicConnection: '基础连接',
		settingsReviewConnectionTitle: '连接配置',
		settingsReviewMappingTitle: '路径映射',
		settingsReviewSyncTitle: '同步设置',
		pendingMappingsTitle: '新增的映射关系',
		bulkSet: '批量设置',
		enableAll: '全部启用',
		pauseAll: '全部暂停',
		chooseFolderFirst: '请先选择目录或笔记',
		pendingEmptyDesc: '请先选择左侧 Obsidian 目录或笔记，再选择右侧 Dify 知识库并点击新增。',
		pendingAdded: '映射关系已加入下方列表。',
		selectFolderPlaceholder: '请选择目录或笔记',
		datasetsDropdownEmpty: '请先获取 Dify 知识库',
		folderSearch: '搜索目录或笔记',
		addPendingMapping: '新增',
		saveMapping: '保存映射',
		syncAfterChange: '变更后同步',
		fullScanCheck: '全量校验',
		startupSyncShort: '启动后同步',
		concurrentUpload: '并发上传',
		debounceOption8: '8 秒',
		debounceOption15: '15 秒',
		debounceOption30: '30 秒',
		fullScanOption30: '每 30 分钟',
		fullScanOption60: '每 60 分钟',
		fullScanOptionOff: '关闭',
		concurrencyOption2: '2 个文件',
		concurrencyOption4: '4 个文件',
		optionOn: '开启',
		optionOff: '关闭',
		settingsReviewLanUrlName: '局域网地址',
		settingsReviewLanUrlPlaceholder: '请输入NAS局域网地址',
		settingsReviewPublicUrlName: '公网地址',
		settingsReviewPublicUrlPlaceholder: '请输入NAS公网地址',
		basicConnectionDesc: '首次配置只保留必要项；高级地址策略默认收起。',
		apiUrlName: 'Dify 服务地址',
		apiUrlDesc: '填写 Obsidian 当前设备可以直接访问的 Dify 服务地址；可以省略 http://，也可以粘贴带 /v1 或 /v1/datasets 的地址。',
		connectionNoteIdle: '填写 API Key 和 Dify 服务地址后，点击测试连接。',
		connectionNoteMissing: '请先填写 API Key 和 Dify 服务地址。',
		connectionNoteSuccess: '连接成功：获取到 {count} 个知识库。当前使用 {url}。',
		connectionNoteFailed: '连接失败：{message}',
		advancedConnectionSummary: '高级连接选项：局域网/公网备用地址、接口路径兼容、请求超时、失败重试',
		expand: '展开',
		collapse: '收起',
		advancedSync: '调整高级参数',
		syncCadenceName: '同步节奏',
		syncCadenceDesc: '变更后 {debounce} 秒同步；每 {interval} 分钟做一次全量校验。',
		syncCadenceEventOnly: '变更后 {debounce} 秒同步；定时全量校验已关闭。',
		syncCadenceIntervalOnly: '文件变更同步已关闭；每 {interval} 分钟做一次全量校验。',
		syncCadenceOff: '自动同步已关闭，仍可手动同步。',
		sectionDiagnostics: '同步诊断',
		diagnosticsDesc: '把长状态从状态栏移到诊断卡片，状态栏只保留短状态。',
		metricTotal: '最近任务',
		metricSynced: '成功',
		metricSkipped: '跳过',
		metricFailed: '失败',
		mappingIndex: '序号',
		mappingFolderColumn: 'Obsidian 路径',
		mappingDatasetColumn: 'Dify 知识库名称',
		mappingStatusColumn: '状态',
		mappingActionColumn: '操作',
		lastError: '最近错误：{message}',
		deleteMappingTitle: '删除映射',
		deleteMappingDesc: '只会删除同步配置，不会删除 Obsidian 文件或 Dify 远端文档。',
		deleteMappingConfirm: '删除映射',
		mappingSaved: '映射已保存。',
		sectionLanguage: '语言',
		languageName: '界面语言',
		languageDesc: '切换插件设置、提示和状态栏语言。',
		languageChinese: '中文',
		languageEnglish: 'English',
		sectionConnection: '连接配置',
		apiKeyName: 'Dify API Key',
		apiKeyDesc: '用于访问 Dify 知识库 API 的密钥。',
		apiKeyPlaceholder: '输入 Dify API Key',
		endpointModeName: '连接地址策略',
		endpointModeDesc: '可填写局域网、公网反向代理或云端地址；自动模式会按顺序尝试可用地址。',
		endpointPrimary: '主要地址',
		endpointLan: '局域网地址',
		endpointPublic: '公网地址',
		endpointAuto: '自动选择',
		primaryUrlName: '主要 API 地址',
		primaryUrlDesc: '可访问的 Dify 服务根地址，例如 http://dify-host.example.test:5000 或 https://dify.example.com。',
		lanUrlName: '局域网 API 地址',
		lanUrlDesc: '访问 NAS/Docker、本机 Docker 或局域网服务器上的 Dify 时使用。建议填写完整地址，例如 http://dify-host.example.test:5000。',
		publicUrlName: '公网 API 地址',
		publicUrlDesc: '通过反向代理、域名、公网端口或云端 Dify 访问时使用。应指向 Dify 服务，不是 NAS/服务器管理页。',
		nasUrlHint: '部署地址提示：适用于 NAS/Docker、本机 Docker、局域网服务器、公网反向代理和云端 Dify。不要填写容器内地址、api:5001 或运行 Dify 机器上的 localhost；请填写 Obsidian 设备能直接访问的 Dify 根地址。缺少 http:// 时插件会按 http:// 自动尝试。',
		urlPlaceholder: '请输入 Dify 服务地址',
		apiPathStyleName: 'Dify 文档接口路径',
		apiPathStyleDesc: '建议保持自动；插件会兼容新版 create-by-text 和旧版 create_by_text。',
		apiPathAuto: '自动兼容',
		apiPathHyphen: '新版连字符',
		apiPathUnderscore: '旧版下划线',
		timeoutName: '请求超时',
		timeoutDesc: '单个 Dify API 请求的超时时间，单位秒。',
		retriesName: '失败重试次数',
		retriesDesc: '网络波动或 5xx 错误时的重试次数。',
		testConnection: '测试连接',
		refreshDatasets: '刷新知识库',
		connectionOk: '连接成功，已获取 {count} 个知识库。当前使用地址：{url}',
		connectionFailed: '连接失败：{message}',
		connectionErrorMissingConfig: '请先填写 Dify API Key 和 Dify 服务地址。',
		connectionErrorAuthFailed: 'API Key 无效，请检查密钥是否正确。',
		connectionErrorPermissionDenied: 'API Key 没有知识库访问权限，请检查 Dify 权限配置。',
		connectionErrorNotFound: '未找到 Dify 知识库 API，请确认 Dify 服务地址、端口和反向代理转发正确。',
		connectionErrorPathMismatch: '当前接口路径不兼容，请确认插件已升级到最新构建，重新点击测试连接后再同步。',
		connectionErrorRateLimited: 'Dify 返回请求过多，请降低并发上传数或稍后重试。',
		connectionErrorServer: 'Dify 服务异常，请检查 Dify 容器、服务日志或反向代理。',
		connectionErrorTimeout: '请求超时，请确认当前设备能访问 Dify 服务地址，并检查 Dify 服务负载、端口、防火墙、Tailscale 和反向代理。',
		connectionErrorNetwork: '网络连接失败，请检查地址、端口、防火墙、Docker 映射或反向代理。',
		connectionErrorUnexpectedResponse: '当前地址返回的不是 Dify 知识库 API，请检查地址和端口是否指向 Dify 服务。',
		connectionErrorUnknown: '连接失败，请检查 Dify 配置后重试。',
		datasetsRefreshed: '已刷新 {count} 个知识库。',
		datasetsEmpty: '连接成功，但当前 Key 未返回可访问知识库。请检查 Key 所属工作区、知识库权限，或确认 Dify 服务地址指向正确的 Dify 实例。',
		sectionMapping: '路径与知识库映射',
		mappingDesc: '一个 Obsidian 目录或笔记可同步到多个 Dify 知识库，多个路径也可指向同一个知识库。',
		addMapping: '新增映射',
		edit: '编辑',
		delete: '删除',
		enabled: '启用',
		disabled: '停用',
		rootFolder: '整个仓库',
		noMappings: '暂无映射，请新增映射，开启自动同步',
		mappingPageInfoEmpty: '0-0 / 0',
		datasetMissing: '未选择知识库',
		datasetUnknown: '未知知识库',
		mappingModalTitle: '编辑路径映射',
		addMappingModalTitle: '新增映射',
		folderName: 'Obsidian 目录或笔记',
		folderDesc: '选择目录会同步其下所有 Markdown 笔记；选择单篇笔记只同步该笔记。',
		selectFolder: '选择目录',
		datasetName: 'Dify 知识库',
		datasetDesc: '可多选；如果列表为空，请先刷新知识库或手动输入 ID。',
		manualDatasetIds: '手动输入知识库 ID',
		manualDatasetIdsDesc: '多个 ID 可用逗号、空格或换行分隔。',
		save: '保存',
		cancel: '取消',
		selectFolderTitle: '选择 Obsidian 目录或笔记',
		choose: '选择',
		sectionAuto: '自动同步',
		autoSyncName: '启用自动同步',
		autoSyncDesc: '总开关；关闭后事件触发和定时全量同步都会暂停。',
		eventSyncName: '文件变更后自动同步',
		eventSyncDesc: '监听 Obsidian 的创建、修改、重命名事件，防抖后自动上传。',
		startupSyncName: '启动后同步',
		startupSyncDesc: 'Obsidian 启动并完成加载后自动检查变更。',
		periodicSyncName: '定时全量校验',
		periodicSyncDesc: '作为事件同步的兜底，适合 NAS/Docker、本机 Docker、局域网服务器、云端 Dify 或跨设备场景。',
		syncIntervalName: '同步间隔',
		syncIntervalDesc: '定时全量校验的间隔，单位分钟。',
		debounceName: '变更防抖',
		debounceDesc: '编辑停止后等待多少秒再同步，避免频繁上传半成品。',
		concurrencyName: '并发上传数',
		concurrencyDesc: '建议 NAS/Docker、本机 Docker 或小型自托管场景保持 1-2，避免 Dify 索引压力过大；云端 Dify 请结合限流情况调整。',
		pollIndexName: '检查索引状态',
		pollIndexDesc: '上传后短暂查询 Dify 索引状态；开启会稍慢但反馈更准确。',
		sectionActions: '操作与诊断',
		manualSync: '立即同步',
		manualSyncDesc: '立刻扫描映射范围内的 Markdown 文件并同步变更。',
		debugName: '调试日志',
		debugDesc: '在开发者控制台输出详细同步日志。',
		lastSync: '上次同步：{time}',
		noLastSync: '尚未完成同步。',
		lastSyncInitial: '上次同步时间：--/—/—',
		activeEndpoint: '当前使用地址：{url}',
		noActiveEndpoint: '当前使用地址：尚未连接成功。',
		recentSyncInitial: '最近同步：0 任务，耗时 0ms',
		recentSyncSummary: '最近同步：{source}，共 {total} 个任务，成功 {synced}，跳过 {skipped}，失败 {failed}，耗时 {elapsed}',
		recentSyncAddress: '最近同步地址：{url}',
		recentSyncError: '最近同步错误：{message}',
		recentSyncFailures: '最近失败文件：{items}',
		noRecentSync: '暂无最近同步详情。',
		recordsCount: '已记录 {count} 条文件-知识库同步状态。',
		resetRecords: '重置同步记录',
		resetRecordsDesc: '不删除 Dify 远端文档；下次同步会重新对照远端文档。',
		resetRecordsDone: '同步记录已重置。',
		hashMigrated: '已迁移旧版同步记录。',
		localDeleted: '已记录本地删除：{path}',
		progress: '{current}/{total} 正在处理 {name}',
		folderPickerEmpty: '当前仓库没有可映射的目录或 Markdown 笔记。',
	},
	en: {
		pluginName: 'Vault2Dify',
		ribbon: 'Sync to Dify',
		commandManual: 'Vault2Dify: Sync to Dify Knowledge Base',
		commandToggleAuto: 'Toggle auto sync',
		ready: 'Ready',
		syncing: 'Syncing...',
		syncQueued: 'A sync is already running. These changes were queued.',
		syncNotice: 'Syncing to Dify knowledge bases...',
		syncComplete: 'Sync complete: {synced} synced, {skipped} skipped, {failed} failed',
		syncNoChanges: 'No changes to sync.',
		syncFailed: 'Sync failed: {message}',
		syncFailedShort: 'Failed',
		validationApiKey: 'Configure your Dify API key first.',
		validationApiUrl: 'Configure your Dify service URL first.',
		validationMapping: 'Configure at least one path to knowledge base mapping.',
		autoOn: 'Auto sync enabled',
		autoOff: 'Auto sync disabled',
		settingsTitle: 'Vault2Dify',
		settingsSubtitle: 'Sync your Obsidian Vault to Dify Knowledge Base',
		settingsHelp: 'Sync your Obsidian Vault to Dify Knowledge Base.',
		openGithub: 'Open GitHub project',
		openHelp: 'Open help',
		helpModalTitle: 'Vault2Dify Help',
		helpQuickStartTitle: 'Quick start',
		helpQuickStartBody: 'Vault2Dify syncs your Obsidian Vault to your configured Dify Knowledge Base.',
		helpQuickStartList: 'Enter your Dify API key.\nEnter your Dify service URL.\nClick Test connection to automatically load knowledge bases.\nAdd a path mapping.\nRun Sync now when needed, or keep auto sync enabled.',
		helpApiUrlTitle: 'How to fill connection settings',
		helpApiUrlBody: 'Dify API Key: required. It authorizes access to your Dify knowledge base. Copy it from the Dify knowledge base API settings. Example: dataset-vtpB1fgqv************\nDify service URL: required. This is the main address the plugin uses to connect to Dify. It works for Dify on a cloud server, NAS, local Docker, or another reachable host. Examples: http://dify-host.example.test:5000 or https://dify.example.com\nIf your Dify knowledge base runs on NAS and you want access from home, work, or outside networks, install and configure Tailscale on both the NAS and your laptop. Then enter: http://tailnet-device.example.test:Dify mapped port. Example: http://tailnet-device.example.test:5000',
		helpApiKeyTitle: 'API key requirements',
		helpApiKeyBody: 'Use a Dify knowledge base API key with permission to access knowledge bases, list knowledge bases, create documents, update documents, and list documents. If the connection test reports insufficient permissions, check that the key belongs to the correct Dify instance, workspace, and knowledge base.',
		helpMappingTitle: 'Path mappings',
		helpMappingBody: 'Path mappings decide which Obsidian notes sync to which Dify knowledge bases. A folder syncs Markdown files in that folder and its subfolders; a note syncs only that note. Each mapping can be enabled or paused independently.',
		helpMappingList: 'Sync one Obsidian folder or note to one knowledge base.\nSync one Obsidian folder or note to multiple knowledge bases.\nSync multiple Obsidian paths to the same knowledge base.\nChoose the entire vault to sync all Markdown files.\nPaused mappings do not participate in manual sync, file-change sync, startup sync, or periodic full checks.',
		helpSyncModesTitle: 'Sync modes',
		helpSyncModesList: 'Sync now: manually scans mapped Markdown files and syncs changes.\nSync after file changes: listens for create, modify, and rename events, then syncs after the debounce period.\nSync after startup: checks changes once after Obsidian finishes loading.\nPeriodic full check: scans all mapped Markdown files at a fixed interval as a fallback for event sync.',
		helpSyncRecommendedTitle: 'Daily recommendations',
		helpSyncRecommendedList: 'Auto sync: on.\nStartup sync: on.\nPeriodic full check: on.\nSync interval: 30 minutes.\nSync after changes: 8 to 15 seconds.\nConcurrent uploads: 1 to 2 for NAS / Docker / smaller self-hosted deployments.',
		helpSyncRulesTitle: 'Sync rules',
		helpSyncRulesBody: 'The plugin only syncs .md files. It does not upload images, PDFs, attachments, or other non-Markdown files. Deleting a local note does not automatically delete the remote Dify document. Deleting a path mapping only removes local configuration and does not delete Obsidian files or remote Dify documents.',
		helpSyncRulesList: 'Find target knowledge bases from path mappings.\nHash file content.\nSkip unchanged content.\nPrefer updating existing Dify documents.\nCreate a document when no existing match is found.\nUse the Obsidian file path as the Dify document name to avoid same-name collisions.',
		helpTroubleshootingTitle: 'Connection troubleshooting',
		helpTroubleshootingList: 'Confirm the API key is complete and has no extra spaces or newlines.\nConfirm the Dify service URL is reachable from the device running Obsidian.\nOpen your URL + /v1/datasets in a browser.\nJSON usually means the address is probably correct.\nHTML usually means the address or port points to a web service.\n404 usually means the Dify service URL, port, or reverse proxy /v1 forwarding is wrong.\n401 can mean the request reached Dify API, but the plugin still needs a valid API key.\n403 means you should check key permissions and workspace.\nIf it cannot open, check IP, domain, port, firewall, Docker mapping, Tailscale, and reverse proxy.',
		helpCommonErrorsTitle: 'Common error messages',
		helpCommonErrorsList: 'Enter a Dify API key and service URL first: connection settings are incomplete.\nThe API key is invalid: Dify returned 401. Copy the key again and remove extra spaces or newlines.\nThe API key does not have knowledge base access: Dify returned 403. Check the key workspace and knowledge base permissions.\nThe Dify knowledge base API was not found: Dify returned 404. Check the Dify service URL, port, and reverse proxy forwarding.\nThe current API path is incompatible: confirm the plugin is on the latest build, retry Test connection, then sync; if it persists, enable debug logs and report the Dify version plus error details.\nThe current address did not return the Dify knowledge base API: it may point to a NAS admin page, Dify web page, login page, or another web service. Check the port and reverse proxy.\nThe request timed out: confirm this device can reach the Dify service URL; check Dify service load, ports, firewall, Tailscale, and reverse proxy; for large syncs, lower concurrent uploads to 1 or 2, or sync in batches.\nNetwork connection failed: check the URL, port, firewall, Docker mapping, NAS network, Tailscale, or reverse proxy.\nDify returned too many requests: lower upload concurrency, try later, or sync large folders in batches.\nDify returned a server error: check the Dify container, service logs, or reverse proxy upstream.',
		helpDatasetsTitle: 'Knowledge bases do not appear',
		helpDatasetsList: 'The API key lacks knowledge base permissions.\nThe key belongs to the wrong workspace.\nThe current Dify instance has no accessible knowledge bases.\nThe Dify service URL is not a Dify service reachable from this device.\nThe reverse proxy does not forward /v1/datasets correctly.\nThe response is a web page, login page, or other non-Dify API response.\nTest the connection first, then get knowledge bases.',
		helpFilesNotSyncingTitle: 'Files do not sync',
		helpFilesNotSyncingList: 'Confirm the file is .md.\nConfirm the file path matches an enabled path mapping.\nConfirm the mapping has at least one Dify knowledge base selected.\nConfirm auto sync is enabled.\nIf relying on events, confirm sync after file changes is enabled.\nTry Sync now to separate event-trigger issues from connection or mapping issues.',
		helpSlowSyncTitle: 'Sync is slow',
		helpSlowSyncList: 'Set concurrent uploads to 1 or 2.\nAvoid syncing very large folders all at once.\nSplit large knowledge bases by folder and sync in batches.\nIf the connection is also unstable, run Test connection and follow connection troubleshooting first.',
		helpDuplicateDocsTitle: 'Duplicate documents appear',
		helpDuplicateDocsBody: 'Possible causes include missing legacy sync records, manually changed Dify document names, reset or lost local sync records, or remote documents that were manually deleted and then synced again.',
		helpDuplicateDocsList: 'Confirm duplicate documents in the Dify console.\nKeep the documents you need and delete extras.\nReturn to plugin settings and click Reset sync records.\nRun Sync now again so the plugin rebuilds records.',
		helpDebugTitle: 'Debug logs',
		helpDebugBody: 'Temporarily enable debug logs when the error stays generic, browser access works but the plugin still fails, NAS / Docker / reverse proxy routing is complex, or you need to report an issue. Do not share API keys, private addresses, note content, or other sensitive information in logs.',
		helpPrivacyTitle: 'Privacy and safety',
		helpPrivacyBody: 'The plugin only reads Markdown files in the current Obsidian vault that match enabled path mappings. It only sends required Markdown content to your configured Dify service URL. It does not send note content to the plugin author or any third-party service other than your configured Dify service. The Dify API key is stored in Obsidian plugin local data; do not commit an .obsidian directory containing plugin settings to a public repository.',
		navAria: 'Obsidian settings navigation',
		navAbout: 'About',
		navEditor: 'Editor',
		navFiles: 'Files and links',
		navAppearance: 'Appearance',
		navHotkeys: 'Hotkeys',
		navPlugins: 'Third-party plugins',
		clearConnectionConfig: 'Clear config',
		selectPlaceholder: 'Please select',
		showApiKey: 'Show API key',
		hideApiKey: 'Hide API key',
		healthConnection: 'Connection',
		healthActiveUrl: 'Active URL',
		healthRecentSync: 'Recent sync',
		connectionUnknown: 'Not tested',
		connectionMissing: 'Needs setup',
		connectionConnected: 'Connected',
		connectionFailedState: 'Failed',
		recentSyncNone: 'No sync yet',
		quickStepKey: 'Enter key',
		quickStepKeyDesc: 'Dify knowledge API key',
		quickStepTest: 'Test connection',
		quickStepTestDesc: 'Find an endpoint and load bases',
		quickStepMapping: 'Add mapping',
		quickStepMappingDesc: 'Choose folder and bases',
		sectionBasicConnection: 'Basic connection',
		settingsReviewConnectionTitle: 'Connection',
		settingsReviewMappingTitle: 'Directory mapping',
		settingsReviewSyncTitle: 'Sync settings',
		pendingMappingsTitle: 'New mappings',
		bulkSet: 'Bulk set',
		enableAll: 'Enable all',
		pauseAll: 'Pause all',
		chooseFolderFirst: 'Select a folder or note first',
		pendingEmptyDesc: 'Select an Obsidian folder or note on the left, then choose Dify knowledge bases on the right and click Add.',
		pendingAdded: 'Mapping added to the list below.',
		selectFolderPlaceholder: 'Select a folder or note',
		datasetsDropdownEmpty: 'Load Dify knowledge bases first',
		folderSearch: 'Search folders or notes',
		addPendingMapping: 'Add',
		saveMapping: 'Save mapping',
		syncAfterChange: 'After changes',
		fullScanCheck: 'Full check',
		startupSyncShort: 'Startup sync',
		concurrentUpload: 'Concurrent uploads',
		debounceOption8: '8 seconds',
		debounceOption15: '15 seconds',
		debounceOption30: '30 seconds',
		fullScanOption30: 'Every 30 minutes',
		fullScanOption60: 'Every 60 minutes',
		fullScanOptionOff: 'Off',
		concurrencyOption2: '2 files',
		concurrencyOption4: '4 files',
		optionOn: 'On',
		optionOff: 'Off',
		settingsReviewLanUrlName: 'NAS LAN address',
		settingsReviewLanUrlPlaceholder: 'Enter NAS LAN address',
		settingsReviewPublicUrlName: 'NAS public address',
		settingsReviewPublicUrlPlaceholder: 'Enter NAS public address',
		basicConnectionDesc: 'First-time setup keeps only the essentials; advanced endpoint options are collapsed.',
		apiUrlName: 'Dify service URL',
		apiUrlDesc: 'Use the Dify service URL reachable from this Obsidian device. You may omit http:// or paste a URL ending in /v1 or /v1/datasets.',
		connectionNoteIdle: 'Enter an API key and Dify service URL, then test the connection.',
		connectionNoteMissing: 'Enter an API key and Dify service URL first.',
		connectionNoteSuccess: 'Connected: {count} knowledge bases via {url}.',
		connectionNoteFailed: 'Connection failed: {message}',
		advancedConnectionSummary: 'Advanced connection: LAN/public fallback URLs, API path compatibility, timeout, retries',
		expand: 'Expand',
		collapse: 'Collapse',
		advancedSync: 'Tune advanced options',
		syncCadenceName: 'Sync cadence',
		syncCadenceDesc: 'Sync {debounce}s after changes; run a full check every {interval} minutes.',
		syncCadenceEventOnly: 'Sync {debounce}s after changes; periodic full checks are off.',
		syncCadenceIntervalOnly: 'File change sync is off; run a full check every {interval} minutes.',
		syncCadenceOff: 'Auto sync is off. Manual sync still works.',
		sectionDiagnostics: 'Sync diagnostics',
		diagnosticsDesc: 'Long status lives in diagnostics. The status bar stays short.',
		metricTotal: 'Recent tasks',
		metricSynced: 'Synced',
		metricSkipped: 'Skipped',
		metricFailed: 'Failed',
		mappingIndex: '#',
		mappingFolderColumn: 'Obsidian path',
		mappingDatasetColumn: 'Dify knowledge bases',
		mappingStatusColumn: 'Status',
		mappingActionColumn: 'Actions',
		lastError: 'Recent error: {message}',
		deleteMappingTitle: 'Delete mapping',
		deleteMappingDesc: 'This only deletes the sync configuration. It will not delete Obsidian files or remote Dify documents.',
		deleteMappingConfirm: 'Delete mapping',
		mappingSaved: 'Mapping saved.',
		sectionLanguage: 'Language',
		languageName: 'Interface language',
		languageDesc: 'Switch settings, notices, and status bar language.',
		languageChinese: '中文',
		languageEnglish: 'English',
		sectionConnection: 'Connection',
		apiKeyName: 'Dify API Key',
		apiKeyDesc: 'API key used to access Dify knowledge base APIs.',
		apiKeyPlaceholder: 'Enter your Dify API key',
		endpointModeName: 'Endpoint strategy',
		endpointModeDesc: 'Fill LAN, public reverse proxy, or cloud URLs when needed. Auto mode tries available URLs in order.',
		endpointPrimary: 'Primary URL',
		endpointLan: 'LAN URL',
		endpointPublic: 'Public URL',
		endpointAuto: 'Auto',
		primaryUrlName: 'Primary API URL',
		primaryUrlDesc: 'Reachable Dify service root URL, for example http://dify-host.example.test:5000 or https://dify.example.com.',
		lanUrlName: 'LAN API URL',
		lanUrlDesc: 'Use this for Dify on NAS/Docker, local Docker, or a LAN server. Prefer a full URL such as http://dify-host.example.test:5000.',
		publicUrlName: 'Public API URL',
		publicUrlDesc: 'Use this for reverse proxy, domain, public port, or Dify Cloud access. It must point to Dify, not a NAS/server admin page.',
		nasUrlHint: 'Deployment URL tip: supports NAS/Docker, local Docker, LAN servers, public reverse proxies, and Dify Cloud. Do not use container-only addresses, api:5001, or localhost on the machine running Dify. Use the Dify root URL reachable from this Obsidian device. If http:// is missing, the plugin will try http:// automatically.',
		urlPlaceholder: 'Enter your Dify service URL',
		apiPathStyleName: 'Dify document API path',
		apiPathStyleDesc: 'Auto is recommended. The plugin supports new create-by-text and legacy create_by_text paths.',
		apiPathAuto: 'Auto compatible',
		apiPathHyphen: 'New hyphen path',
		apiPathUnderscore: 'Legacy underscore path',
		timeoutName: 'Request timeout',
		timeoutDesc: 'Timeout for one Dify API request, in seconds.',
		retriesName: 'Retry count',
		retriesDesc: 'Retries for network failures or 5xx responses.',
		testConnection: 'Test connection',
		refreshDatasets: 'Refresh knowledge bases',
		connectionOk: 'Connected and loaded {count} knowledge bases via {url}',
		connectionFailed: 'Connection failed: {message}',
		connectionErrorMissingConfig: 'Enter a Dify API key and service URL first.',
		connectionErrorAuthFailed: 'The API key is invalid. Check that it is correct.',
		connectionErrorPermissionDenied: 'The API key does not have knowledge base access. Check Dify permissions.',
		connectionErrorNotFound: 'The Dify knowledge base API was not found. Check the Dify service URL, port, and reverse proxy forwarding.',
		connectionErrorPathMismatch: 'The API path is incompatible. Confirm the plugin is on the latest build, retry Test connection, then sync.',
		connectionErrorRateLimited: 'Dify returned too many requests. Lower upload concurrency or try again later.',
		connectionErrorServer: 'Dify returned a server error. Check the Dify container, service logs, or reverse proxy.',
		connectionErrorTimeout: 'The request timed out. Confirm this device can reach the Dify service URL, and check Dify service load, ports, firewall, Tailscale, and reverse proxy.',
		connectionErrorNetwork: 'Network connection failed. Check the URL, port, firewall, Docker mapping, or reverse proxy.',
		connectionErrorUnexpectedResponse: 'The current address did not return the Dify knowledge base API. Check that the URL and port point to Dify.',
		connectionErrorUnknown: 'Connection failed. Check the Dify settings and try again.',
		datasetsRefreshed: 'Refreshed {count} knowledge bases.',
		datasetsEmpty: 'Connected, but this key returned no accessible knowledge bases. Check the key workspace, knowledge base permissions, or whether the Dify service URL points to the correct Dify instance.',
		sectionMapping: 'Path mappings',
		mappingDesc: 'One Obsidian folder or note can sync to multiple Dify knowledge bases, and many paths can share one knowledge base.',
		addMapping: 'Add mapping',
		edit: 'Edit',
		delete: 'Delete',
		enabled: 'Enabled',
		disabled: 'Disabled',
		rootFolder: 'Entire vault',
		noMappings: 'No mappings yet. Add a mapping to enable automatic sync.',
		mappingPageInfoEmpty: '0-0 / 0',
		datasetMissing: 'No knowledge base selected',
		datasetUnknown: 'Unknown knowledge base',
		mappingModalTitle: 'Edit path mapping',
		addMappingModalTitle: 'Add mapping',
		folderName: 'Obsidian folder or note',
		folderDesc: 'Choose a folder to sync all Markdown notes under it, or choose one note to sync only that note.',
		selectFolder: 'Select folder',
		datasetName: 'Dify knowledge bases',
		datasetDesc: 'Multiple selections are supported. If the list is empty, refresh knowledge bases or enter IDs manually.',
		manualDatasetIds: 'Manual knowledge base IDs',
		manualDatasetIdsDesc: 'Separate multiple IDs with commas, spaces, or new lines.',
		save: 'Save',
		cancel: 'Cancel',
		selectFolderTitle: 'Select Obsidian folder or note',
		choose: 'Choose',
		sectionAuto: 'Auto sync',
		autoSyncName: 'Enable auto sync',
		autoSyncDesc: 'Master switch. Event sync and periodic full scans pause when disabled.',
		eventSyncName: 'Sync after file changes',
		eventSyncDesc: 'Listen to Obsidian create, modify, and rename events, then upload after debounce.',
		startupSyncName: 'Sync after startup',
		startupSyncDesc: 'Check changes after Obsidian finishes loading.',
		periodicSyncName: 'Periodic full scan',
		periodicSyncDesc: 'Fallback for event sync, useful with NAS/Docker, local Docker, LAN servers, Dify Cloud, or multi-device workflows.',
		syncIntervalName: 'Sync interval',
		syncIntervalDesc: 'Periodic full scan interval, in minutes.',
		debounceName: 'Change debounce',
		debounceDesc: 'Wait this many seconds after edits stop before syncing.',
		concurrencyName: 'Concurrent uploads',
		concurrencyDesc: 'Keep this at 1-2 for NAS/Docker, local Docker, or smaller self-hosted deployments to avoid overloading Dify indexing. Adjust for Dify Cloud rate limits.',
		pollIndexName: 'Check indexing status',
		pollIndexDesc: 'Briefly query Dify indexing status after upload. This is slower but more informative.',
		sectionActions: 'Actions & diagnostics',
		manualSync: 'Sync now',
		manualSyncDesc: 'Scan mapped Markdown files and sync changes immediately.',
		debugName: 'Debug logs',
		debugDesc: 'Print detailed sync logs in the developer console.',
		lastSync: 'Last sync: {time}',
		noLastSync: 'No completed sync yet.',
		lastSyncInitial: 'Last sync time: --/--/--',
		activeEndpoint: 'Active endpoint: {url}',
		noActiveEndpoint: 'Active endpoint: no successful connection yet.',
		recentSyncInitial: 'Recent sync: 0 tasks, elapsed 0ms',
		recentSyncSummary: 'Recent sync: {source}, {total} tasks, {synced} synced, {skipped} skipped, {failed} failed, elapsed {elapsed}',
		recentSyncAddress: 'Recent sync endpoint: {url}',
		recentSyncError: 'Recent sync error: {message}',
		recentSyncFailures: 'Recent failed files: {items}',
		noRecentSync: 'No recent sync details yet.',
		recordsCount: '{count} file-to-knowledge-base sync records stored.',
		resetRecords: 'Reset sync records',
		resetRecordsDesc: 'Remote Dify documents are not deleted. The next sync will compare remote documents again.',
		resetRecordsDone: 'Sync records reset.',
		hashMigrated: 'Legacy sync records migrated.',
		localDeleted: 'Local deletion recorded: {path}',
		progress: '{current}/{total} processing {name}',
		folderPickerEmpty: 'There are no mappable folders or Markdown notes in this vault.',
	},
};

export default class DifySyncPlugin extends Plugin {
	settings!: DifySyncSettings;
	statusBarItem!: HTMLElement;
	syncRecords: Map<string, SyncRecord> = new Map();
	private readonly legacyHashFileName = 'historyContentHash';
	private client!: DifyApiClient;
	private syncProgressNotice: Notice | null = null;
	private queueTimer: number | null = null;
	private startupSyncTimer: number | null = null;
	private periodicIntervalId: number | null = null;
	private pendingPaths: Set<string> = new Set();
	private isSyncing = false;
	private settingTab!: DifySyncSettingTab;

	async onload() {
		await this.loadPluginData();
		this.client = new DifyApiClient(this);
		this.client.setActiveBaseUrl(this.settings.connectionHealth.lastSuccessfulBaseUrl);

		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar(this.t('ready'));

		const ribbonIconEl = this.addRibbonIcon('sync', this.t('ribbon'), async () => {
			await this.performSync('manual');
		});
		ribbonIconEl.addClass('dify-sync-ribbon-class');

		this.addCommand({
			id: 'dify-sync-manual',
			name: this.t('commandManual'),
			callback: async () => {
				await this.performSync('manual');
			},
		});

		this.addCommand({
			id: 'dify-sync-toggle-auto',
			name: this.t('commandToggleAuto'),
			callback: async () => {
				this.settings.autoSyncEnabled = !this.settings.autoSyncEnabled;
				await this.savePluginData();
				this.setupAutoSync();
				new Notice(this.settings.autoSyncEnabled ? this.t('autoOn') : this.t('autoOff'));
			},
		});

		this.settingTab = new DifySyncSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		this.app.workspace.onLayoutReady(async () => {
			await this.migrateLegacyHashStorage();
			this.registerVaultEvents();
			this.setupAutoSync();

			if (this.settings.autoSyncEnabled && this.settings.syncOnStartup) {
				this.startupSyncTimer = window.setTimeout(() => {
					this.startupSyncTimer = null;
					this.queueFullSync('startup');
				}, 5000);
			}
		});
	}

	onunload() {
		if (this.queueTimer !== null) {
			window.clearTimeout(this.queueTimer);
		}
		if (this.startupSyncTimer !== null) {
			window.clearTimeout(this.startupSyncTimer);
		}
		if (this.periodicIntervalId !== null) {
			window.clearInterval(this.periodicIntervalId);
		}
	}

	t(key: string, vars?: Record<string, string | number>): string {
		const dictionary = STRINGS[this.settings?.language || 'zh-CN'] || STRINGS['zh-CN'];
		let value = dictionary[key] || STRINGS['zh-CN'][key] || key;
		if (vars) {
			Object.entries(vars).forEach(([varKey, varValue]) => {
				value = value.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(varValue));
			});
		}
		return value;
	}

	debug(...args: unknown[]) {
		if (this.settings.debugLogging) {
			console.log('[Dify Sync]', ...args);
		}
	}

	getConnectionFailureMessage(reason: ConnectionErrorReason = 'unknown'): string {
		return this.t(getConnectionErrorMessageKey(reason));
	}

	showConnectionError(error?: unknown) {
		const reason = this.getConnectionFailureReason(error);
		const notice = new Notice(this.t('connectionFailed', {
			message: this.getConnectionFailureMessage(reason),
		}), 8000);
		notice.noticeEl?.addClass('dify-sync-error-notice');
	}

	getConnectionFailureReason(error?: unknown): ConnectionErrorReason {
		if (!this.hasCompleteConnectionSettings()) {
			return 'missing_config';
		}
		const anyError = error as any;
		if (isConnectionErrorReason(anyError?.reason)) {
			return anyError.reason;
		}
		if (error instanceof DifyApiError) {
			return classifyConnectionApiError(error);
		}
		if (this.settings.connectionHealth.status === 'failed' && this.settings.connectionHealth.reason) {
			return this.settings.connectionHealth.reason;
		}
		return 'unknown';
	}

	hasCompleteConnectionSettings(): boolean {
		return !!this.settings.difyApiKey.trim() && this.getConfiguredBaseUrls().length > 0;
	}

	async loadPluginData() {
		const raw = (await this.loadData()) as PluginDataShape | null;
		const rawSettings = raw?.settings ? raw.settings : raw || {};
		this.settings = this.normalizeSettings(rawSettings, !!raw);
		this.syncRecords = new Map(Object.entries(raw?.syncRecords || {}) as [string, SyncRecord][]);
		await this.savePluginData();
	}

	async savePluginData() {
		const syncRecords: Record<string, SyncRecord> = {};
		this.syncRecords.forEach((value, key) => {
			syncRecords[key] = value;
		});

		await this.saveData({
			schemaVersion: 2,
			settings: this.settings,
			syncRecords,
		});
	}

	normalizeSettings(rawSettings: any, hasPersistedPluginData = false): DifySyncSettings {
		const merged: DifySyncSettings = Object.assign({}, DEFAULT_SETTINGS, rawSettings || {});
		merged.schemaVersion = 2;
		merged.initialSetupCompleted = typeof rawSettings?.initialSetupCompleted === 'boolean'
			? rawSettings.initialSetupCompleted
			: hasPersistedPluginData;
		merged.language = merged.language === 'en' ? 'en' : 'zh-CN';
		merged.endpointMode = ['primary', 'lan', 'public', 'auto'].includes(merged.endpointMode) ? merged.endpointMode : 'primary';
		merged.apiPathStyle = ['auto', 'hyphen', 'underscore'].includes(merged.apiPathStyle) ? merged.apiPathStyle : 'auto';
		merged.syncInterval = clampNumber(merged.syncInterval, 5, 240, 30);
		merged.debounceSeconds = clampNumber(merged.debounceSeconds, 1, 120, 8);
		merged.requestTimeoutSeconds = clampNumber(merged.requestTimeoutSeconds, 5, 180, 30);
		merged.maxRetries = clampNumber(merged.maxRetries, 0, 5, 2);
		merged.maxConcurrent = clampNumber(merged.maxConcurrent, 1, 5, 2);
		merged.knowledgeBases = Array.isArray(merged.knowledgeBases) ? merged.knowledgeBases : [];
		merged.obsidianFolders = Array.isArray(merged.obsidianFolders) ? merged.obsidianFolders : [];
		merged.mappings = Array.isArray(merged.mappings) ? merged.mappings : [];
		merged.connectionHealth = normalizeConnectionHealth((merged as any).connectionHealth);

		if (merged.mappings.length === 0 && merged.difyKnowledgeId) {
			const folders = merged.obsidianFolders.length > 0 ? merged.obsidianFolders : [''];
			merged.mappings = folders.map((folder) => ({
				id: createId(),
				folder,
				datasetIds: [merged.difyKnowledgeId],
				enabled: true,
			}));
		}

		merged.mappings = merged.mappings.map((mapping) => ({
			id: mapping.id || createId(),
			folder: normalizeFolderPath(mapping.folder || ''),
			datasetIds: uniqueStrings((mapping.datasetIds || []).map((id) => id.trim()).filter(Boolean)),
			enabled: mapping.enabled !== false,
		}));

		return merged;
	}

	registerVaultEvents() {
		this.registerEvent(this.app.vault.on('create', (file) => {
			this.handleVaultChange(file, 'event');
		}));

		this.registerEvent(this.app.vault.on('modify', (file) => {
			this.handleVaultChange(file, 'event');
		}));

		this.registerEvent(this.app.vault.on('delete', async (file) => {
			if (file instanceof TFile && this.isMarkdownFile(file)) {
				await this.markLocalDeleted(file.path);
			}
		}));

		this.registerEvent(this.app.vault.on('rename', async (file, oldPath) => {
			if (file instanceof TFile && this.isMarkdownFile(file)) {
				await this.migrateRenamedRecords(oldPath, file.path);
				this.enqueueFile(file.path, 'event');
			}
		}));
	}

	setupAutoSync() {
		if (this.periodicIntervalId !== null) {
			window.clearInterval(this.periodicIntervalId);
			this.periodicIntervalId = null;
		}

		if (!this.settings.autoSyncEnabled || !this.settings.periodicFullScanEnabled) {
			return;
		}

		this.periodicIntervalId = window.setInterval(() => {
			this.queueFullSync('interval');
		}, this.settings.syncInterval * 60 * 1000);
		this.registerInterval(this.periodicIntervalId);
	}

	handleVaultChange(file: TAbstractFile, source: SyncSource) {
		if (!this.settings.autoSyncEnabled || !this.settings.eventSyncEnabled) {
			return;
		}
		if (file instanceof TFile && this.isMarkdownFile(file)) {
			this.enqueueFile(file.path, source);
		}
	}

	enqueueFile(path: string, source: SyncSource) {
		this.pendingPaths.add(path);
		this.scheduleQueueFlush(source);
	}

	queueFullSync(source: SyncSource) {
		if (!this.settings.autoSyncEnabled) {
			return;
		}
		this.scheduleQueueFlush(source, true);
	}

	scheduleQueueFlush(source: SyncSource, fullSync = false) {
		if (this.queueTimer !== null) {
			window.clearTimeout(this.queueTimer);
		}

		this.queueTimer = window.setTimeout(async () => {
			this.queueTimer = null;
			const paths = fullSync ? undefined : Array.from(this.pendingPaths);
			this.pendingPaths.clear();
			await this.performSync(source, paths);
		}, this.settings.debounceSeconds * 1000);
	}

	async performSync(source: SyncSource = 'manual', filePaths?: string[]) {
		if (!this.validateSettings(true)) {
			return;
		}

		if (this.isSyncing) {
			if (filePaths) {
				filePaths.forEach((path) => this.pendingPaths.add(path));
			}
			new Notice(this.t('syncQueued'));
			return;
		}

		this.isSyncing = true;
		this.showSyncNotice(this.t('syncNotice'));
		this.updateStatusBar(this.t('syncing'));

		const startedAt = new Date();
		const stats: SyncStats = {
			synced: 0,
			skipped: 0,
			failed: 0,
			total: 0,
			syncedFiles: [],
			failedFiles: [],
		};

		try {
			const files = this.getCandidateFiles(filePaths);
			const plan = await this.buildSyncPlan(files, stats);
			stats.total = plan.length + stats.skipped;

			if (plan.length === 0) {
				this.settings.lastSyncTime = new Date().toISOString();
				this.settings.recentSyncResult = this.createRecentSyncResult(source, startedAt, stats);
				this.markConnectionSuccessFromActive();
				await this.savePluginData();
				this.updateStatusBar(this.t('ready'));
				this.showSyncComplete(stats);
				return;
			}

			const documentIndexes = await this.loadDocumentIndexes(plan);
			await this.processTasks(plan, documentIndexes, stats);

			this.settings.lastSyncTime = new Date().toISOString();
			const partialFailure = stats.failed > 0
				? this.t('syncComplete', syncStatsVars(stats))
				: undefined;
			this.settings.recentSyncResult = this.createRecentSyncResult(source, startedAt, stats, partialFailure);
			if (stats.failed > 0 && stats.synced === 0) {
				this.markConnectionFailure(new DifyApiError(partialFailure || this.t('syncFailedShort')));
			} else {
				this.markConnectionSuccessFromActive();
			}
			await this.savePluginData();
			this.updateStatusBar(stats.failed > 0 ? this.t('syncFailedShort') : this.t('ready'), stats.failed > 0);
			this.showSyncComplete(stats);
		} catch (error) {
			const message = this.getConnectionFailureMessage(this.getConnectionFailureReason(error));
			this.settings.recentSyncResult = this.createRecentSyncResult(source, startedAt, stats, message);
			this.markConnectionFailure(error);
			await this.savePluginData();
			this.updateStatusBar(this.t('syncFailedShort'), true);
			this.showSyncError(this.t('syncFailed', { message }));
		} finally {
			this.isSyncing = false;

			if (this.pendingPaths.size > 0) {
				const paths = Array.from(this.pendingPaths);
				this.pendingPaths.clear();
				window.setTimeout(() => {
					this.performSync('event', paths);
				}, 1000);
			}
		}
	}

	private getCandidateFiles(filePaths?: string[]): TFile[] {
		if (!filePaths) {
			return this.app.vault.getMarkdownFiles();
		}

		const files: TFile[] = [];
		uniqueStrings(filePaths).forEach((path) => {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile && this.isMarkdownFile(file)) {
				files.push(file);
			}
		});
		return files;
	}

	private async buildSyncPlan(files: TFile[], stats: SyncStats): Promise<SyncTask[]> {
		const tasks: SyncTask[] = [];

		for (const file of files) {
			const datasetIds = this.getDatasetIdsForPath(file.path);
			if (datasetIds.length === 0) {
				continue;
			}

			const content = await this.app.vault.cachedRead(file);
			const hash = this.hashContent(content);
			const remoteName = this.makeRemoteName(file.path);

			for (const datasetId of datasetIds) {
				recoverDeletedSyncRecordForCreatedFile(
					this.syncRecords,
					datasetId,
					file.path,
					hash,
					(path) => this.makeRemoteName(path),
				);
				const recordKey = this.getRecordKey(datasetId, file.path);
				const record = this.syncRecords.get(recordKey);

				if (record && record.hash === hash && record.documentId && !record.deletedLocal && record.remoteName === remoteName) {
					stats.skipped++;
					continue;
				}

				tasks.push({
					file,
					content,
					hash,
					datasetId,
					remoteName,
					recordKey,
				});
			}
		}

		return tasks;
	}

	private async loadDocumentIndexes(tasks: SyncTask[]): Promise<Map<string, DocumentIndex>> {
		const datasetIds = uniqueStrings(tasks.map((task) => task.datasetId));
		const indexes = new Map<string, DocumentIndex>();

		for (const datasetId of datasetIds) {
			const documents = await this.client.listDocuments(datasetId);
			const index: DocumentIndex = { byId: new Map(), byName: new Map() };
			documents.forEach((document) => {
				index.byId.set(document.id, document);
				if (document.name) {
					index.byName.set(document.name, document);
				}
			});
			indexes.set(datasetId, index);
		}

		return indexes;
	}

	private async processTasks(tasks: SyncTask[], indexes: Map<string, DocumentIndex>, stats: SyncStats) {
		let cursor = 0;
		let completed = 0;
		const workerCount = Math.min(this.settings.maxConcurrent, tasks.length);

		const worker = async () => {
			while (cursor < tasks.length) {
				const task = tasks[cursor++];
				completed++;
				this.showSyncProgress(this.t('progress', {
					current: completed,
					total: tasks.length,
					name: task.file.name,
				}), completed, tasks.length);

				try {
					await this.syncTask(task, indexes.get(task.datasetId));
					stats.synced++;
					stats.syncedFiles.push(task.file.path);
				} catch (error) {
					stats.failed++;
					const message = this.getConnectionFailureMessage(this.getConnectionFailureReason(error));
					stats.failedFiles.push({
						filePath: task.file.path,
						datasetId: task.datasetId,
						message,
					});
					this.syncRecords.set(task.recordKey, {
						filePath: task.file.path,
						datasetId: task.datasetId,
						remoteName: task.remoteName,
						hash: task.hash,
						lastModified: task.file.stat.mtime,
						lastSyncedAt: new Date().toISOString(),
						lastError: message,
					});
					this.debug(`Failed to sync ${task.file.path} -> ${task.datasetId}`, message);
				}
			}
		};

		await Promise.all(Array.from({ length: workerCount }, worker));
	}

	private async syncTask(task: SyncTask, index?: DocumentIndex) {
		if (!index) {
			throw new Error(`Unable to load remote document index for dataset ${task.datasetId}`);
		}

		const oldRecord = this.syncRecords.get(task.recordKey);
		const existingById = oldRecord?.documentId ? index.byId.get(oldRecord.documentId) : undefined;
		const existingByName = index.byName.get(task.remoteName);
		const existingDocument = existingById || existingByName;
		let response: DifyMutationResponse;

		if (existingDocument?.id) {
			try {
				response = await this.client.updateDocumentByText(task.datasetId, existingDocument.id, task.remoteName, task.content);
			} catch (error) {
				const apiError = error instanceof DifyApiError ? error : new DifyApiError(getErrorMessage(error));
				if (apiError.status !== 404) {
					throw apiError;
				}
				response = await this.client.createDocumentByText(task.datasetId, task.remoteName, task.content);
			}
		} else {
			response = await this.client.createDocumentByText(task.datasetId, task.remoteName, task.content);
		}

		const document = response.document || response.data || existingDocument;
		const documentId = document?.id || existingDocument?.id || oldRecord?.documentId;

		if (!documentId) {
			throw new Error('Dify did not return a document id.');
		}

		if (this.settings.pollIndexStatus && response.batch) {
			await this.pollIndexStatus(task.datasetId, response.batch);
		}

		this.syncRecords.set(task.recordKey, {
			filePath: task.file.path,
			datasetId: task.datasetId,
			documentId,
			remoteName: task.remoteName,
			hash: task.hash,
			lastModified: task.file.stat.mtime,
			lastSyncedAt: new Date().toISOString(),
			lastBatch: response.batch,
		});

		index.byId.set(documentId, { id: documentId, name: task.remoteName });
		index.byName.set(task.remoteName, { id: documentId, name: task.remoteName });
	}

	private async pollIndexStatus(datasetId: string, batch: string) {
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				await sleep(1200);
				await this.client.getIndexingStatus(datasetId, batch);
				return;
			} catch (error) {
				this.debug('Indexing status check failed', getErrorMessage(error));
			}
		}
	}

	async refreshKnowledgeBases(showNotice = true): Promise<KnowledgeBaseInfo[]> {
		if (!this.hasCompleteConnectionSettings()) {
			this.markConnectionMissingConfig();
			await this.savePluginData();
			throw new DifyApiError(this.getConnectionFailureMessage('missing_config'), undefined, undefined, 'missing_config');
		}

		const probe = await this.client.probeConnection();
		this.applyConnectionProbe(probe);
		if (probe.status !== 'connected') {
			await this.savePluginData();
			throw new DifyApiError(
				probe.error || this.getConnectionFailureMessage(probe.reason),
				probe.statusCode,
				undefined,
				probe.reason || 'unknown',
			);
		}

		const datasets = probe.datasets;
		this.settings.knowledgeBases = datasets;
		this.settings.lastDatasetRefresh = probe.checkedAt;
		await this.savePluginData();

		if (showNotice) {
			new Notice(datasets.length > 0
				? this.t('datasetsRefreshed', { count: datasets.length })
				: this.t('datasetsEmpty'));
		}
		return datasets;
	}

	async testConnection() {
		try {
			const datasets = await this.refreshKnowledgeBases(false);
			this.settings.initialSetupCompleted = true;
			await this.savePluginData();
			new Notice(this.t('connectionOk', {
				count: datasets.length,
				url: this.settings.connectionHealth.activeBaseUrl || this.settings.connectionHealth.lastSuccessfulBaseUrl || sanitizeBaseUrl(this.settings.difyApiUrl),
			}));
			this.settingTab.display();
		} catch (error) {
			this.showConnectionError(error);
		}
	}

	applyConnectionProbe(probe: ConnectionProbeResult) {
		const failed = getFinalFailedCandidate(probe);
		const reason = probe.reason || failed?.reason;
		this.settings.connectionHealth = {
			status: probe.status,
			checkedAt: probe.checkedAt,
			activeBaseUrl: probe.activeBaseUrl,
			lastSuccessfulBaseUrl: probe.lastSuccessfulBaseUrl || this.settings.connectionHealth.lastSuccessfulBaseUrl,
			datasetCount: probe.datasetCount,
			latencyMs: probe.latencyMs,
			error: probe.status === 'failed' ? this.getConnectionFailureMessage(reason || 'unknown') : probe.error,
			reason,
			statusCode: probe.statusCode ?? failed?.statusCode,
		};
	}

	markConnectionSuccessFromActive() {
		const activeBaseUrl = this.client.getActiveBaseUrl();
		if (!activeBaseUrl) {
			return;
		}
		this.settings.connectionHealth = {
			...this.settings.connectionHealth,
			status: 'connected',
			checkedAt: new Date().toISOString(),
			activeBaseUrl,
			lastSuccessfulBaseUrl: activeBaseUrl,
			error: undefined,
			reason: undefined,
			statusCode: undefined,
		};
	}

	markConnectionFailure(error: unknown) {
		const apiError = error instanceof DifyApiError ? error : new DifyApiError(getErrorMessage(error));
		const reason = classifyConnectionApiError(apiError);
		this.settings.connectionHealth = {
			...this.settings.connectionHealth,
			status: 'failed',
			checkedAt: new Date().toISOString(),
			activeBaseUrl: '',
			error: this.getConnectionFailureMessage(reason),
			reason,
			statusCode: apiError.status,
		};
	}

	markConnectionMissingConfig() {
		this.client.clearActiveBaseUrl();
		this.settings.connectionHealth = {
			...this.settings.connectionHealth,
			status: 'missing_config',
			checkedAt: new Date().toISOString(),
			activeBaseUrl: '',
			error: this.getConnectionFailureMessage('missing_config'),
			reason: 'missing_config',
			statusCode: undefined,
		};
	}

	invalidateConnectionState() {
		this.client.clearActiveBaseUrl();
		this.settings.connectionHealth = {
			...this.settings.connectionHealth,
			status: this.settings.difyApiKey.trim() && this.getConfiguredBaseUrls().length > 0 ? 'unknown' : 'missing_config',
			checkedAt: '',
			activeBaseUrl: '',
			error: undefined,
			reason: undefined,
			statusCode: undefined,
		};
	}

	createRecentSyncResult(source: SyncSource, startedAt: Date, stats: SyncStats, error?: string): RecentSyncResult {
		const finishedAt = new Date();
		return {
			source,
			status: error ? 'failed' : 'success',
			startedAt: startedAt.toISOString(),
			finishedAt: finishedAt.toISOString(),
			elapsedMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
			activeBaseUrl: this.client.getActiveBaseUrl(),
			synced: stats.synced,
			skipped: stats.skipped,
			failed: stats.failed,
			total: stats.total,
			syncedFiles: stats.syncedFiles.slice(0, 20),
			failedFiles: stats.failedFiles.slice(0, 20),
			error,
		};
	}

	getDatasetIdsForPath(path: string): string[] {
		return getDatasetIdsForPathFromMappings(path, this.settings.mappings);
	}

	makeRemoteName(filePath: string): string {
		return filePath;
	}

	getRecordKey(datasetId: string, filePath: string): string {
		return getSyncRecordKey(datasetId, filePath);
	}

	hashContent(content: string): string {
		let hash = 2166136261;
		for (let i = 0; i < content.length; i++) {
			hash ^= content.charCodeAt(i);
			hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
		}
		return (hash >>> 0).toString(16);
	}

	async markLocalDeleted(path: string) {
		let changed = false;
		this.syncRecords.forEach((record, key) => {
			if (record.filePath === path) {
				this.syncRecords.set(key, {
					...record,
					deletedLocal: true,
					lastSyncedAt: new Date().toISOString(),
				});
				changed = true;
			}
		});

		if (changed) {
			await this.savePluginData();
			new Notice(this.t('localDeleted', { path }));
		}
	}

	async migrateRenamedRecords(oldPath: string, newPath: string) {
		const changed = migrateRenamedSyncRecords(this.syncRecords, oldPath, newPath, (filePath) => this.makeRemoteName(filePath));
		if (changed) {
			await this.savePluginData();
		}
	}

	async migrateLegacyHashStorage() {
		const hasAnyRecords = this.syncRecords.size > 0;
		if (hasAnyRecords || this.settings.mappings.length === 0) {
			return;
		}

		try {
			const hashFile = this.app.vault.getAbstractFileByPath(this.legacyHashFileName);
			if (!(hashFile instanceof TFile)) {
				return;
			}

			const content = await this.app.vault.read(hashFile);
			const legacy = parseJson(content);
			if (!legacy || typeof legacy !== 'object') {
				return;
			}

			Object.entries(legacy).forEach(([filePath, value]) => {
				const hashInfo = value as any;
				const datasetIds = this.getDatasetIdsForPath(filePath);
				datasetIds.forEach((datasetId) => {
					this.syncRecords.set(this.getRecordKey(datasetId, filePath), {
						filePath,
						datasetId,
						remoteName: this.makeRemoteName(filePath),
						hash: hashInfo.hash || '',
						lastModified: hashInfo.lastModified || 0,
						lastSyncedAt: new Date().toISOString(),
					});
				});
			});

			if (this.syncRecords.size > 0) {
				await this.savePluginData();
				new Notice(this.t('hashMigrated'));
			}
		} catch (error) {
			this.debug('Legacy hash migration failed', getErrorMessage(error));
		}
	}

	validateSettings(showNotice: boolean): boolean {
		return this.validateConnectionSettings(showNotice) && this.validateMappingSettings(showNotice);
	}

	validateConnectionSettings(showNotice: boolean): boolean {
		if (!this.hasCompleteConnectionSettings()) {
			if (showNotice) this.showConnectionError(new DifyApiError(this.getConnectionFailureMessage('missing_config'), undefined, undefined, 'missing_config'));
			return false;
		}
		return true;
	}

	validateMappingSettings(showNotice: boolean): boolean {
		const hasMapping = this.settings.mappings.some((mapping) => mapping.enabled && mapping.datasetIds.length > 0);
		if (!hasMapping) {
			if (showNotice) new Notice(this.t('validationMapping'));
			return false;
		}
		return true;
	}

	getConfiguredBaseUrls(): string[] {
		return uniqueStrings([sanitizeBaseUrl(this.settings.difyApiUrl)].filter(Boolean));
	}

	getActiveBaseUrl(): string {
		return this.client.getActiveBaseUrl();
	}

	isMarkdownFile(file: TFile): boolean {
		return file.extension.toLowerCase() === 'md';
	}

	updateStatusBar(message: string, isError = false) {
		(this.statusBarItem as any).setText(`Dify: ${message}`);
		(this.statusBarItem as any).toggleClass('dify-sync-error', isError);
		(this.statusBarItem as any).toggleClass('dify-sync-syncing', message === this.t('syncing'));
	}

	showSyncProgress(message: string, current: number, total: number) {
		const progress = total > 0 ? Math.round((current / total) * 100) : 0;
		const content = `${message}\n${this.createProgressBar(progress)} ${progress}% (${current}/${total})`;
		this.showPersistentNotice(content);
	}

	showSyncNotice(message: string) {
		this.showPersistentNotice(message);
	}

	showPersistentNotice(message: string) {
		if (!this.syncProgressNotice) {
			this.syncProgressNotice = new Notice(message, 0);
			this.syncProgressNotice.noticeEl?.addClass('dify-sync-progress');
			return;
		}

		const textElement = this.syncProgressNotice.noticeEl?.querySelector('.notice-text');
		if (textElement) {
			textElement.textContent = message;
		}
	}

	showSyncComplete(stats: SyncStats) {
		this.hideProgressNotice();
		const message = stats.total === 0
			? this.t('syncNoChanges')
			: this.t('syncComplete', syncStatsVars(stats));
		const notice = new Notice(message, 5000);
		notice.noticeEl?.addClass('dify-sync-complete');
	}

	showSyncError(message: string) {
		this.hideProgressNotice();
		const notice = new Notice(message, 8000);
		notice.noticeEl?.addClass('dify-sync-error-notice');
	}

	hideProgressNotice() {
		if (this.syncProgressNotice) {
			this.syncProgressNotice.hide();
			this.syncProgressNotice = null;
		}
	}

	createProgressBar(percentage: number): string {
		const barLength = 20;
		const filledLength = Math.round((percentage / 100) * barLength);
		return `[${'█'.repeat(filledLength)}${'░'.repeat(barLength - filledLength)}]`;
	}

	getDatasetLabel(datasetId: string): string {
		const dataset = this.settings.knowledgeBases.find((item) => item.id === datasetId);
		return dataset ? `${dataset.name} (${dataset.id})` : `${this.t('datasetUnknown')} (${datasetId})`;
	}

	getDatasetName(datasetId: string): string {
		const dataset = this.settings.knowledgeBases.find((item) => item.id === datasetId);
		return dataset?.name || datasetId;
	}
}

class DifySyncSettingTab extends PluginSettingTab {
	plugin: DifySyncPlugin;
	private mainMappingPage = 0;
	private readonly mainMappingPageSize = 4;
	private readonly outerScrollHostClass = 'dify-sync-outer-scroll-host';
	private readonly innerScrollHostClass = 'dify-sync-inner-scroll-host';
	private outerScrollHosts = new Set<HTMLElement>();
	private innerScrollHost?: HTMLElement;
	private wheelCleanup?: () => void;
	private scrollbarMarkToken = 0;

	constructor(app: App, plugin: DifySyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('dify-sync-settings');
		const appShell = containerEl.createDiv('app');
		const main = appShell.createEl('main', { cls: 'main' });
		const settings = main.createDiv('settings');
		this.renderTopbar(settings);
		this.renderSyncSummary(settings);
		const content = settings.createDiv('dify-sync-content');
		this.renderConnectionSection(content);
		this.renderMappingSection(content);
		this.renderSyncSettingsSection(content);
		appShell.createDiv({ cls: 'toast-region', attr: { 'aria-live': 'polite', 'aria-atomic': 'true' } });
		this.scheduleScrollbarHostMarking(containerEl);
	}

	hide(): void {
		this.scrollbarMarkToken++;
		this.clearScrollbarHosts();
		super.hide();
	}

	private scheduleScrollbarHostMarking(containerEl: HTMLElement) {
		const token = ++this.scrollbarMarkToken;
		this.clearScrollbarHosts();
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				if (token === this.scrollbarMarkToken && containerEl.isConnected) {
					this.markScrollbarHosts(containerEl);
				}
			});
		});
	}

	private markScrollbarHosts(containerEl: HTMLElement) {
		this.clearScrollbarHosts();
		const outerHosts = this.findScrollableAncestors(containerEl);
		if (outerHosts.length === 0) return;

		this.innerScrollHost = containerEl;
		containerEl.addClass(this.innerScrollHostClass);
		outerHosts.forEach((host) => this.addOuterScrollHost(host));
		const primaryHost = outerHosts[0];
		const onWheel = (event: WheelEvent) => this.handleSettingsWheel(event, containerEl, primaryHost);
		containerEl.addEventListener('wheel', onWheel, { passive: false });
		this.wheelCleanup = () => containerEl.removeEventListener('wheel', onWheel);
	}

	private findScrollableAncestors(containerEl: HTMLElement): HTMLElement[] {
		const scrollHosts: HTMLElement[] = [];
		let current: HTMLElement | null = containerEl.parentElement;
		while (current) {
			if (this.isVerticalScrollHost(current)) {
				scrollHosts.push(current);
			}
			current = current.parentElement;
		}
		return scrollHosts;
	}

	private isVerticalScrollHost(element: HTMLElement) {
		const overflowY = window.getComputedStyle(element).overflowY;
		const canScroll = element.scrollHeight > element.clientHeight + 1;
		return canScroll && ['auto', 'scroll', 'overlay'].includes(overflowY);
	}

	private addOuterScrollHost(host: HTMLElement) {
		host.addClass(this.outerScrollHostClass);
		this.outerScrollHosts.add(host);
	}

	private handleSettingsWheel(event: WheelEvent, containerEl: HTMLElement, primaryHost: HTMLElement) {
		if (event.defaultPrevented || event.deltaY === 0) return;
		if (this.targetCanScrollWithin(event.target, containerEl, event.deltaY)) return;

		const previousScrollTop = primaryHost.scrollTop;
		primaryHost.scrollTop += event.deltaY;
		if (primaryHost.scrollTop !== previousScrollTop) {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	private targetCanScrollWithin(target: EventTarget | null, boundary: HTMLElement, deltaY: number) {
		let current = target instanceof HTMLElement ? target : null;
		while (current && current !== boundary) {
			if (!this.outerScrollHosts.has(current) && this.elementCanScrollInDirection(current, deltaY)) {
				return true;
			}
			current = current.parentElement;
		}
		return false;
	}

	private elementCanScrollInDirection(element: HTMLElement, deltaY: number) {
		if (!this.isVerticalScrollHost(element)) return false;
		if (deltaY < 0) return element.scrollTop > 0;
		return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
	}

	private clearScrollbarHosts() {
		this.wheelCleanup?.();
		this.wheelCleanup = undefined;
		this.outerScrollHosts.forEach((host) => host.removeClass(this.outerScrollHostClass));
		this.outerScrollHosts.clear();
		this.innerScrollHost?.removeClass(this.innerScrollHostClass);
		this.innerScrollHost = undefined;
	}

	private renderTopbar(containerEl: HTMLElement) {
		const topbar = containerEl.createEl('header', { cls: 'topbar' });
		const titleLine = topbar.createDiv('title-line');
		titleLine.createEl('h1', { text: this.plugin.t('settingsTitle'), cls: 'heading-text' });
		titleLine.createEl('p', { text: this.plugin.t('settingsSubtitle'), cls: 'settings-subtitle' });
		const actions = topbar.createDiv('top-actions');
		const languageButton = new ExtraButtonComponent(actions)
			.setIcon('languages')
			.setTooltip(this.plugin.t('languageName'));
		const language = languageButton.extraSettingsEl;
		languageButton.onClick(() => this.openLanguageMenu(language));
		language.addClass('language-button');
		language.setAttr('aria-label', this.plugin.t('languageName'));
		language.setAttr('title', this.plugin.t('languageName'));
		language.setAttr('data-action', 'open-language-menu');
		const help = new ExtraButtonComponent(actions)
			.setIcon('help-circle')
			.setTooltip(this.plugin.t('openHelp'))
			.onClick(() => {
				new HelpModal(this.app, this.plugin).open();
			}).extraSettingsEl;
		help.addClass('help-button');
		help.setAttr('aria-label', this.plugin.t('openHelp'));
		help.setAttr('title', this.plugin.t('openHelp'));
		help.setAttr('data-action', 'open-help');
		const github = actions.createEl('a', { cls: 'github-link', href: 'https://github.com/BeatsAD/Vault2Dify' });
		github.setAttr('target', '_blank');
		github.setAttr('rel', 'noopener noreferrer');
		github.setAttr('aria-label', this.plugin.t('openGithub'));
		github.setAttr('title', 'GitHub');
		setIcon(github, 'github');
	}

	private openLanguageMenu(anchorEl: HTMLElement) {
		const menu = new Menu();
		const languages: Array<{ value: Language; label: string }> = [
			{ value: 'zh-CN', label: this.plugin.t('languageChinese') },
			{ value: 'en', label: this.plugin.t('languageEnglish') },
		];
		languages.forEach((option) => {
			menu.addItem((item) => {
				item
					.setTitle(option.label)
					.setChecked(this.plugin.settings.language === option.value)
					.onClick(async () => {
						if (this.plugin.settings.language === option.value) return;
						this.plugin.settings.language = option.value;
						await this.plugin.savePluginData();
						this.plugin.updateStatusBar(this.plugin.t('ready'));
						this.display();
					});
			});
		});
		const rect = anchorEl.getBoundingClientRect();
		menu.showAtPosition({
			x: rect.left,
			y: rect.bottom + 4,
			width: rect.width,
		});
	}

	private renderSyncSummary(containerEl: HTMLElement) {
		const summary = buildSettingsReviewSummary({
			connectionHealth: this.plugin.settings.connectionHealth,
			recentSyncResult: this.plugin.settings.recentSyncResult,
		});
		const labels: Record<string, string> = {
			total: this.plugin.t('metricTotal'),
			synced: this.plugin.t('metricSynced'),
			skipped: this.plugin.t('metricSkipped'),
			failed: this.plugin.t('metricFailed'),
		};
		const list = containerEl.createDiv('sync-summary');
		list.setAttr('aria-label', this.plugin.t('sectionDiagnostics'));
		summary.metrics.forEach((metric) => {
			const item = list.createDiv('metric');
			item.createDiv({ text: labels[metric.key], cls: 'metric-label' });
			item.createDiv({
				text: String(metric.value),
				cls: metric.tone === 'default' ? 'metric-value' : `metric-value ${metric.tone}`,
			});
		});
	}

	private renderConnectionSection(containerEl: HTMLElement) {
		const { card } = this.createReviewSection(containerEl, 'connection-title', this.plugin.t('settingsReviewConnectionTitle'));
		let keyInput: HTMLInputElement;
		this.createNativeSetting(card, 'setting-row')
			.setName(this.createSettingName(this.plugin.t('apiKeyName'), { required: true }))
			.setTooltip(this.plugin.t('apiKeyDesc'))
			.addText((text) => {
				keyInput = text
					.setPlaceholder(this.plugin.t('apiKeyPlaceholder'))
					.setValue(this.plugin.settings.difyApiKey)
					.onChange(async (value) => {
						this.plugin.settings.difyApiKey = value.trim();
						this.plugin.invalidateConnectionState();
						await this.plugin.savePluginData();
					}).inputEl;
				keyInput.id = 'dify-api-key';
				keyInput.type = 'password';
				keyInput.setAttr('aria-label', this.plugin.t('apiKeyName'));
			})
			.addExtraButton((button) => {
				const toggle = button
					.setIcon('eye')
					.setTooltip(this.plugin.t('showApiKey'))
					.onClick(() => {
						const shouldShow = keyInput.type === 'password';
						keyInput.type = shouldShow ? 'text' : 'password';
						button.setIcon(shouldShow ? 'eye-off' : 'eye');
						const label = this.plugin.t(shouldShow ? 'hideApiKey' : 'showApiKey');
						button.setTooltip(label);
						toggle.setAttr('aria-label', label);
						toggle.setAttr('title', label);
						toggle.setAttr('aria-pressed', String(shouldShow));
					}).extraSettingsEl;
				toggle.addClass('secret-toggle');
				toggle.setAttr('aria-label', this.plugin.t('showApiKey'));
				toggle.setAttr('title', this.plugin.t('showApiKey'));
				toggle.setAttr('aria-controls', 'dify-api-key');
				toggle.setAttr('aria-pressed', 'false');
				});

		this.createNativeSetting(card, 'setting-row')
			.setName(this.createSettingName(this.plugin.t('apiUrlName'), { required: true }))
			.setTooltip(this.plugin.t('apiUrlDesc'))
			.addText((text) => {
				const input = text
					.setPlaceholder(this.plugin.t('urlPlaceholder'))
					.setValue(this.plugin.settings.difyApiUrl)
					.onChange(async (value) => {
						this.plugin.settings.difyApiUrl = value.trim();
						this.plugin.invalidateConnectionState();
						await this.plugin.savePluginData();
					}).inputEl;
				input.setAttr('aria-label', this.plugin.t('apiUrlName'));
			});

		const actionRow = card.createDiv('dataset-refresh-row');
		const statusLine = actionRow.createDiv('status-line');
		statusLine.setAttr('aria-label', this.plugin.t('healthConnection'));
		statusLine.createSpan({ cls: `status-dot ${this.getConnectionStatusToneClass()}` });
		statusLine.createEl('strong', { text: this.getConnectionStatusLabel() });
		const actions = actionRow.createDiv('connection-action-buttons');
		const clearButton = new ButtonComponent(actions)
			.setButtonText(this.plugin.t('clearConnectionConfig'))
			.setClass('native-action-button')
			.onClick(async () => {
				this.plugin.settings.difyApiKey = '';
				this.plugin.settings.difyApiUrl = '';
				this.plugin.settings.lanApiUrl = '';
				this.plugin.settings.publicApiUrl = '';
				this.plugin.invalidateConnectionState();
				await this.plugin.savePluginData();
				this.display();
			});
		clearButton.buttonEl.setAttr('data-action', 'clear-connection-config');
		clearButton.buttonEl.setAttr('aria-label', this.plugin.t('clearConnectionConfig'));
		let testButton: ButtonComponent;
		testButton = new ButtonComponent(actions)
			.setButtonText(this.plugin.t('testConnection'))
			.setClass('native-action-button')
			.onClick(async () => {
				testButton.setDisabled(true);
				testButton.setButtonText(this.plugin.t('syncing'));
				try {
					await this.plugin.testConnection();
				} finally {
					testButton.setDisabled(false);
					testButton.setButtonText(this.plugin.t('testConnection'));
					this.display();
				}
			});
		testButton.buttonEl.setAttr('data-action', 'test-connection');
		testButton.buttonEl.setAttr('aria-label', this.plugin.t('testConnection'));
		const callout = actionRow.createDiv({ cls: 'callout', attr: { 'data-role': 'connection-result' } });
		callout.hidden = true;
		callout.createEl('strong', { text: this.getConnectionStatusLabel() });
		callout.createSpan({ text: this.getConnectionNote() });
	}

	private renderMappingSection(containerEl: HTMLElement) {
		const { card } = this.createReviewSection(containerEl, 'mapping-title', this.plugin.t('settingsReviewMappingTitle'), (head) => {
			const add = new ButtonComponent(head)
				.setButtonText(this.plugin.t('addMapping'))
				.setCta()
				.onClick(() => {
					new MappingEditorModal(this.app, this.plugin, undefined, async (mapping) => {
						this.plugin.settings.mappings.push(mapping);
						await this.plugin.savePluginData();
						new Notice(this.plugin.t('mappingSaved'));
						this.display();
					}).open();
				});
			add.buttonEl.setAttr('data-action', 'add-mapping');
			add.buttonEl.setAttr('aria-label', this.plugin.t('addMapping'));
		});
		const table = card.createDiv({ cls: 'mapping-table main-mapping-table', attr: { role: 'table', 'aria-label': this.plugin.t('sectionMapping') } });
		const header = table.createDiv({ cls: 'mapping-header', attr: { role: 'row' } });
		header.createDiv({ text: this.plugin.t('mappingIndex') });
		header.createDiv({ text: this.plugin.t('mappingFolderColumn') });
		header.createDiv({ text: this.plugin.t('mappingDatasetColumn') });
		header.createDiv({ text: this.plugin.t('mappingStatusColumn') });
		header.createDiv({ text: this.plugin.t('mappingActionColumn') });
		const mappings = this.plugin.settings.mappings;
		const maxPage = Math.max(0, Math.ceil(mappings.length / this.mainMappingPageSize) - 1);
		this.mainMappingPage = Math.min(this.mainMappingPage, maxPage);
		if (mappings.length === 0) {
			table.createDiv({ text: this.plugin.t('noMappings'), cls: 'main-mapping-empty' });
		}
		const pageStart = this.mainMappingPage * this.mainMappingPageSize;
		mappings.slice(pageStart, pageStart + this.mainMappingPageSize).forEach((mapping, index) => {
			this.renderMappingRow(table, mapping, pageStart + index);
		});
		this.renderMainMappingPagination(card, this.plugin.settings.mappings.length);
	}

	private renderMainMappingPagination(containerEl: HTMLElement, count: number) {
		const pagination = containerEl.createDiv({ cls: 'main-mapping-pagination mapping-pagination', attr: { 'data-role': 'main-mapping-pagination' } });
		const totalPages = Math.max(1, Math.ceil(count / this.mainMappingPageSize));
		const previousButton = new ButtonComponent(pagination).setButtonText('‹');
		const previous = previousButton.buttonEl;
		const start = count === 0 ? 0 : this.mainMappingPage * this.mainMappingPageSize + 1;
		const end = count === 0 ? 0 : Math.min(count, (this.mainMappingPage + 1) * this.mainMappingPageSize);
		pagination.createSpan({ text: count === 0 ? this.plugin.t('mappingPageInfoEmpty') : `${start}-${end} / ${count}`, attr: { 'data-role': 'main-mapping-page-info' } });
		const nextButton = new ButtonComponent(pagination).setButtonText('›');
		const next = nextButton.buttonEl;
		previousButton.setDisabled(count === 0 || this.mainMappingPage === 0);
		nextButton.setDisabled(count === 0 || this.mainMappingPage >= totalPages - 1);
		previousButton.onClick(() => {
			this.mainMappingPage = Math.max(0, this.mainMappingPage - 1);
			this.display();
		});
		nextButton.onClick(() => {
			this.mainMappingPage = Math.min(totalPages - 1, this.mainMappingPage + 1);
			this.display();
		});
	}

	private renderMappingRow(table: HTMLElement, mapping: FolderMapping, index: number) {
		const row = table.createDiv({ cls: 'mapping-row', attr: { role: 'row' } });
		renderMappingRowCells(row, this.plugin, mapping, index, 'toggle-mapping-status', async () => {
			mapping.enabled = !mapping.enabled;
			await this.plugin.savePluginData();
			this.display();
		}, (actions) => {
			const edit = new ExtraButtonComponent(actions)
				.setIcon('pencil')
				.setTooltip(this.plugin.t('edit'))
				.onClick(() => {
					new MappingEditorModal(this.app, this.plugin, mapping, async (updated) => {
						this.plugin.settings.mappings = this.plugin.settings.mappings.map((item) => item.id === updated.id ? updated : item);
						await this.plugin.savePluginData();
						this.display();
					}).open();
				}).extraSettingsEl;
			edit.addClass('icon');
			edit.setAttr('data-action', 'edit-mapping');
			edit.setAttr('aria-label', this.plugin.t('edit'));
			edit.setAttr('title', this.plugin.t('edit'));
			const remove = new ExtraButtonComponent(actions)
				.setIcon('trash-2')
				.setTooltip(this.plugin.t('delete'))
				.onClick(() => {
					new ConfirmModal(
						this.app,
						this.plugin.t('deleteMappingTitle'),
						this.plugin.t('deleteMappingDesc'),
						this.plugin.t('deleteMappingConfirm'),
						this.plugin.t('cancel'),
						async () => {
							this.plugin.settings.mappings = removeMappingById(this.plugin.settings.mappings, mapping.id);
							await this.plugin.savePluginData();
							this.display();
						},
						{
							folder: mapping.folder || this.plugin.t('rootFolder'),
							datasets: mapping.datasetIds.map((id) => this.plugin.getDatasetName(id)).join('、') || this.plugin.t('datasetMissing'),
						},
					).open();
				}).extraSettingsEl;
			remove.addClass('icon');
			remove.addClass('danger');
			remove.setAttr('data-action', 'delete-mapping');
			remove.setAttr('aria-label', this.plugin.t('delete'));
			remove.setAttr('title', this.plugin.t('delete'));
		});
	}

	private renderSyncSettingsSection(containerEl: HTMLElement) {
		const { card } = this.createReviewSection(containerEl, 'auto-title', this.plugin.t('settingsReviewSyncTitle'));
		this.createNativeSetting(card, 'setting-row', 'switch-row')
			.setName(this.createSettingName(this.plugin.t('sectionAuto')))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoSyncEnabled)
					.onChange(async (value) => {
						this.plugin.settings.autoSyncEnabled = value;
						await this.plugin.savePluginData();
						this.plugin.setupAutoSync();
						this.display();
					});
				toggle.toggleEl.setAttr('data-action', 'toggle-auto-sync');
			});
		const advanced = card.createDiv({ attr: { id: 'advanced-sync' } });
		this.createAdvancedSelect<number>(advanced, this.plugin.t('syncAfterChange'), this.plugin.settings.debounceSeconds, [
			[8, this.plugin.t('debounceOption8')],
			[15, this.plugin.t('debounceOption15')],
			[30, this.plugin.t('debounceOption30')],
		], async (value) => {
			this.plugin.settings.debounceSeconds = value;
			await this.plugin.savePluginData();
		}, 'debounce');
		this.createAdvancedSelect<number>(advanced, this.plugin.t('fullScanCheck'), this.plugin.settings.periodicFullScanEnabled ? this.plugin.settings.syncInterval : 0, [
			[30, this.plugin.t('fullScanOption30')],
			[60, this.plugin.t('fullScanOption60')],
			[0, this.plugin.t('fullScanOptionOff')],
		], async (value) => {
			this.plugin.settings.periodicFullScanEnabled = value > 0;
			if (value > 0) this.plugin.settings.syncInterval = value;
			await this.plugin.savePluginData();
			this.plugin.setupAutoSync();
		}, 'interval');
		this.createAdvancedSelect<boolean>(advanced, this.plugin.t('startupSyncShort'), this.plugin.settings.syncOnStartup, [
			[true, this.plugin.t('optionOn')],
			[false, this.plugin.t('optionOff')],
		], async (value) => {
			this.plugin.settings.syncOnStartup = value;
			await this.plugin.savePluginData();
		}, 'startup-sync');
		this.createAdvancedSelect<number>(advanced, this.plugin.t('concurrentUpload'), this.plugin.settings.maxConcurrent, [
			[2, this.plugin.t('concurrencyOption2')],
			[4, this.plugin.t('concurrencyOption4')],
		], async (value) => {
			this.plugin.settings.maxConcurrent = clampNumber(value, 1, 5, 2);
			await this.plugin.savePluginData();
		}, 'concurrency');
		const details = card.createEl('details', { cls: 'diagnostic-fold' });
		details.open = true;
		const summary = details.createEl('summary');
		summary.createSpan({ text: this.plugin.t('sectionDiagnostics') });
		summary.createSpan({ text: `Dify: ${this.plugin.t('ready')}` });
		const body = details.createDiv('diagnostic-body');
		const lastSyncText = this.plugin.settings.lastSyncTime
			? this.plugin.t('lastSync', { time: new Date(this.plugin.settings.lastSyncTime).toLocaleString() })
			: this.plugin.t('lastSyncInitial');
		body.createDiv({ text: lastSyncText, cls: 'dify-sync-diagnostic-line' });
		this.renderRecentSyncResult(body);
		const diagnosticActions = body.createDiv('sync-actions');
		const debugButton = new ButtonComponent(diagnosticActions)
			.setButtonText(this.plugin.settings.debugLogging ? `${this.plugin.t('debugName')} · ${this.plugin.t('enabled')}` : this.plugin.t('debugName'))
			.onClick(async () => {
				this.plugin.settings.debugLogging = !this.plugin.settings.debugLogging;
				await this.plugin.savePluginData();
				this.display();
			});
		debugButton.buttonEl.setAttr('data-action', 'toggle-debug-logging');
		const resetButton = new ButtonComponent(diagnosticActions)
			.setButtonText(this.plugin.t('resetRecords'))
			.onClick(async () => {
				this.plugin.syncRecords.clear();
				await this.plugin.savePluginData();
				new Notice(this.plugin.t('resetRecordsDone'));
				this.display();
			});
		resetButton.buttonEl.setAttr('data-action', 'reset-sync-records');
		const syncActions = card.createDiv('sync-actions manual-sync-actions');
		let syncNow: ButtonComponent;
		syncNow = new ButtonComponent(syncActions)
			.setButtonText(this.plugin.t('manualSync'))
			.setCta()
			.onClick(async () => {
				syncNow.setDisabled(true);
				syncNow.setButtonText(this.plugin.t('syncing'));
				await this.plugin.performSync('manual');
				syncNow.setDisabled(false);
				syncNow.setButtonText(this.plugin.t('manualSync'));
				this.display();
			});
		syncNow.buttonEl.setAttr('data-action', 'sync-now');
		syncNow.buttonEl.setAttr('aria-label', this.plugin.t('manualSync'));
	}

	private renderRecentSyncResult(containerEl: HTMLElement) {
		const result = this.plugin.settings.recentSyncResult;
		if (!result) {
			containerEl.createDiv({ text: this.plugin.t('recentSyncInitial'), cls: 'dify-sync-diagnostic-line' });
			return;
		}
		containerEl.createDiv({
			text: this.plugin.t('recentSyncSummary', {
				source: result.source,
				total: result.total,
				synced: result.synced,
				skipped: result.skipped,
				failed: result.failed,
				elapsed: formatDuration(result.elapsedMs),
			}),
			cls: 'dify-sync-diagnostic-line',
		});
		if (result.error) {
			containerEl.createDiv({ text: this.plugin.t('recentSyncError', { message: result.error }), cls: 'dify-sync-diagnostic-line dify-sync-diagnostic-error' });
		}
	}

	private createReviewSection(
		containerEl: HTMLElement,
		titleId: string,
		title: string,
		renderAction?: (head: HTMLElement) => void,
	): { card: HTMLElement } {
		const section = containerEl.createEl('section', { cls: 'section', attr: { 'aria-labelledby': titleId } });
		const head = section.createDiv('section-head');
		const titleLine = head.createDiv('heading-line');
		titleLine.createEl('h2', { text: title, cls: 'heading-text', attr: { id: titleId } });
		if (renderAction) renderAction(head);
		return { card: section.createDiv('section-card') };
	}

	private createSettingName(label: string, options: { required?: boolean; optional?: boolean } = {}): DocumentFragment {
		const fragment = document.createDocumentFragment();
		const labelEl = document.createElement('span');
		labelEl.className = 'setting-label';
		labelEl.textContent = label;
		fragment.appendChild(labelEl);
		if (options.required) {
			const required = document.createElement('span');
			required.className = 'required-marker';
			required.textContent = '*';
			required.setAttribute('aria-label', 'required');
			fragment.appendChild(required);
		}
		return fragment;
	}

	private createSettingRow(card: HTMLElement, label: string, tooltip: string, options: { required?: boolean } = {}): { control: HTMLElement } {
		const setting = this.createNativeSetting(card, 'setting-row')
			.setName(this.createSettingName(label, options))
			.setDesc(tooltip)
			.setTooltip(tooltip);
		return { control: setting.controlEl };
	}

	private createTextInput(container: HTMLElement, label: string, placeholder: string, value: string): HTMLInputElement {
		const input = container.createEl('input', { attr: { type: 'text', placeholder, 'aria-label': label } }) as HTMLInputElement;
		input.value = value;
		return input;
	}

	private createAdvancedText(container: HTMLElement, label: string, value: string, onChange: (value: string) => Promise<void>, id: string, placeholder = this.plugin.t('urlPlaceholder'), options: { optional?: boolean } = {}) {
		this.createNativeSetting(container, 'advanced-field')
			.setName(this.createSettingName(label, options))
			.addText((text) => {
				const input = text
					.setPlaceholder(placeholder)
					.setValue(value)
					.onChange(async (nextValue) => onChange(nextValue.trim())).inputEl;
				input.id = id;
			});
	}

	private createAdvancedNumber(container: HTMLElement, label: string, value: number, min: number, max: number, onChange: (value: number) => Promise<void>, id: string) {
		const field = container.createDiv('advanced-field');
		field.createEl('label', { text: label, attr: { for: id } });
		const input = field.createEl('input', { attr: { id, type: 'number', min: String(min), max: String(max) } }) as HTMLInputElement;
		input.value = String(value);
		input.addEventListener('change', async () => onChange(Number(input.value)));
	}

	private createAdvancedSelect<T extends string | number | boolean>(container: HTMLElement, label: string, value: T, options: Array<[T, string]>, onChange: (value: T) => Promise<void>, selectId: string) {
		const valueByKey = new Map(options.map(([optionValue]) => [String(optionValue), optionValue]));
		const dropdownOptions = Object.fromEntries(options.map(([optionValue, optionLabel]) => [String(optionValue), optionLabel]));
		this.createNativeSetting(container, 'advanced-field')
			.setName(this.createSettingName(label))
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(dropdownOptions)
					.setValue(String(value))
					.onChange(async (nextValue) => {
						const typedValue = valueByKey.get(nextValue);
						if (typedValue === undefined) return;
						await onChange(typedValue);
					});
				dropdown.selectEl.id = `${selectId}-select`;
				dropdown.selectEl.setAttr('aria-label', label);
			});
	}

	private createNativeSetting(container: HTMLElement, ...layoutClasses: string[]): Setting {
		const setting = new Setting(container).setClass('native-setting-row');
		layoutClasses.forEach((className) => setting.settingEl.addClass(className));
		return setting;
	}

	private createHelpIcon(container: HTMLElement, tooltip: string) {
		const help = container.createSpan({ text: '?', cls: 'help-icon' });
		help.setAttr('tabindex', '0');
		help.setAttr('aria-label', tooltip);
		help.setAttr('data-tooltip', tooltip);
	}

	private getConnectionStatusLabel(): string {
		const status = this.plugin.settings.connectionHealth.status;
		if (!this.plugin.settings.difyApiKey.trim() || this.plugin.getConfiguredBaseUrls().length === 0) return this.plugin.t('connectionMissing');
		if (status === 'connected') return this.plugin.t('connectionConnected');
		if (status === 'failed') return this.plugin.t('connectionFailedState');
		if (status === 'missing_config') return this.plugin.t('connectionMissing');
		return this.plugin.t('connectionUnknown');
	}

	private getConnectionStatusToneClass(): string {
		const status = this.plugin.settings.connectionHealth.status;
		if (!this.plugin.settings.difyApiKey.trim() || this.plugin.getConfiguredBaseUrls().length === 0) return 'is-muted';
		if (status === 'connected') return 'is-success';
		if (status === 'failed') return 'is-error';
		return 'is-muted';
	}

	private getActiveUrlLabel(): string {
		const health = this.plugin.settings.connectionHealth;
		return stripUrlScheme(health.activeBaseUrl || health.lastSuccessfulBaseUrl || sanitizeBaseUrl(this.plugin.settings.difyApiUrl) || '-');
	}

	private getConnectionNote(): string {
		const health = this.plugin.settings.connectionHealth;
		if (!this.plugin.settings.difyApiKey.trim() || this.plugin.getConfiguredBaseUrls().length === 0) {
			return this.plugin.t('connectionNoteMissing');
		}
		if (health.status === 'connected') {
			return this.plugin.t('connectionNoteSuccess', {
				count: health.datasetCount,
				url: stripUrlScheme(health.activeBaseUrl || health.lastSuccessfulBaseUrl),
			});
		}
		if (health.status === 'failed' && health.error) {
			return this.plugin.t('connectionNoteFailed', { message: health.error });
		}
		return this.plugin.t('connectionNoteIdle');
	}
}

type HelpSection = {
	titleKey: string;
	paragraphKeys?: string[];
	listKeys?: string[];
	orderedListKeys?: string[];
	errorListKeys?: string[];
};

class HelpModal extends Modal {
	private plugin: DifySyncPlugin;

	constructor(app: App, plugin: DifySyncPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('dify-sync-modal-shell');
		this.modalEl.addClass('help-modal-shell');
		contentEl.addClass('dify-sync-modal');
		contentEl.addClass('help-modal');

		const head = contentEl.createDiv('modal-head');
		const titleLine = head.createDiv('modal-title-line');
		titleLine.createEl('h2', { text: this.plugin.t('helpModalTitle'), attr: { id: 'help-modal-title' } });

		const body = contentEl.createDiv({ cls: 'help-modal-body', attr: { role: 'document', 'aria-labelledby': 'help-modal-title' } });
		this.getHelpSections().forEach((section) => this.renderHelpSection(body, section));
	}

	private getHelpSections(): HelpSection[] {
		return [
			{ titleKey: 'helpQuickStartTitle', paragraphKeys: ['helpQuickStartBody'], orderedListKeys: ['helpQuickStartList'] },
			{ titleKey: 'helpApiUrlTitle', paragraphKeys: ['helpApiUrlBody'] },
			{ titleKey: 'helpApiKeyTitle', paragraphKeys: ['helpApiKeyBody'] },
			{ titleKey: 'helpMappingTitle', paragraphKeys: ['helpMappingBody'], listKeys: ['helpMappingList'] },
			{ titleKey: 'helpSyncModesTitle', listKeys: ['helpSyncModesList'] },
			{ titleKey: 'helpSyncRecommendedTitle', listKeys: ['helpSyncRecommendedList'] },
			{ titleKey: 'helpSyncRulesTitle', paragraphKeys: ['helpSyncRulesBody'], orderedListKeys: ['helpSyncRulesList'] },
			{ titleKey: 'helpTroubleshootingTitle', orderedListKeys: ['helpTroubleshootingList'] },
			{ titleKey: 'helpCommonErrorsTitle', errorListKeys: ['helpCommonErrorsList'] },
			{ titleKey: 'helpDatasetsTitle', listKeys: ['helpDatasetsList'] },
			{ titleKey: 'helpFilesNotSyncingTitle', listKeys: ['helpFilesNotSyncingList'] },
			{ titleKey: 'helpSlowSyncTitle', listKeys: ['helpSlowSyncList'] },
			{ titleKey: 'helpDuplicateDocsTitle', paragraphKeys: ['helpDuplicateDocsBody'], orderedListKeys: ['helpDuplicateDocsList'] },
			{ titleKey: 'helpDebugTitle', paragraphKeys: ['helpDebugBody'] },
			{ titleKey: 'helpPrivacyTitle', paragraphKeys: ['helpPrivacyBody'] },
		];
	}

	private renderHelpSection(containerEl: HTMLElement, section: HelpSection) {
		const sectionEl = containerEl.createEl('section', { cls: 'help-section' });
		sectionEl.createEl('h3', { text: this.plugin.t(section.titleKey) });
		(section.paragraphKeys || []).forEach((key) => {
			this.splitHelpLines(this.plugin.t(key)).forEach((line) => {
				sectionEl.createEl('p', { text: line });
			});
		});
		(section.orderedListKeys || []).forEach((key) => {
			this.renderHelpList(sectionEl, this.splitHelpLines(this.plugin.t(key)), true);
		});
		(section.listKeys || []).forEach((key) => {
			this.renderHelpList(sectionEl, this.splitHelpLines(this.plugin.t(key)), false);
		});
		(section.errorListKeys || []).forEach((key) => {
			this.renderHelpErrorList(sectionEl, this.splitHelpLines(this.plugin.t(key)));
		});
	}

	private renderHelpList(containerEl: HTMLElement, items: string[], ordered: boolean) {
		const list = containerEl.createEl(ordered ? 'ol' : 'ul', { cls: 'help-list' });
		items.forEach((item) => list.createEl('li', { text: item }));
	}

	private renderHelpErrorList(containerEl: HTMLElement, items: string[]) {
		const list = containerEl.createDiv('help-error-list');
		items.forEach((item) => {
			const separator = item.includes('：') ? '：' : ':';
			const [label, ...rest] = item.split(separator);
			const row = list.createDiv('help-error-item');
			row.createEl('strong', { text: label.trim() });
			const description = rest.join(separator).trim();
			if (description) {
				row.createSpan({ text: description });
			}
		});
	}

	private splitHelpLines(value: string): string[] {
		return value.split('\n').map((item) => item.trim()).filter(Boolean);
	}
}

class ConfirmModal extends Modal {
	private title: string;
	private message: string;
	private confirmText: string;
	private cancelText: string;
	private onConfirm: () => Promise<void>;
	private preview?: { folder: string; datasets: string };

	constructor(app: App, title: string, message: string, confirmText: string, cancelText: string, onConfirm: () => Promise<void>, preview?: { folder: string; datasets: string }) {
		super(app);
		this.title = title;
		this.message = message;
		this.confirmText = confirmText;
		this.cancelText = cancelText;
		this.onConfirm = onConfirm;
		this.preview = preview;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('dify-sync-modal-shell');
		this.modalEl.addClass('confirm-modal-shell');
		contentEl.addClass('dify-sync-modal');
		contentEl.addClass('confirm-modal');
		const head = contentEl.createDiv('modal-head');
		const titleLine = head.createDiv('modal-title-line');
		titleLine.createEl('h2', { text: this.title, attr: { id: 'delete-modal-title' } });
		const body = contentEl.createDiv('confirm-body');
		const preview = body.createDiv({ cls: 'confirm-mapping', attr: { 'data-role': 'delete-mapping-preview' } });
		const folderRow = preview.createDiv('confirm-mapping-item');
		folderRow.createEl('strong', { text: this.pluginLabel('mappingFolderColumn'), cls: 'confirm-mapping-label' });
		folderRow.createSpan({ text: this.preview?.folder || '-', cls: 'confirm-mapping-value' }).setAttr('data-role', 'delete-folder');
		const datasetsRow = preview.createDiv('confirm-mapping-item');
		datasetsRow.createEl('strong', { text: this.pluginLabel('datasetName'), cls: 'confirm-mapping-label' });
		datasetsRow.createSpan({ text: this.preview?.datasets || '-', cls: 'confirm-mapping-value' }).setAttr('data-role', 'delete-datasets');
		const actions = contentEl.createDiv('modal-actions');
		const cancel = new ButtonComponent(actions)
			.setButtonText(this.cancelText)
			.onClick(() => this.close());
		cancel.buttonEl.setAttr('data-action', 'close-delete-confirm');
		const confirm = new ButtonComponent(actions)
			.setButtonText(this.confirmText)
			.setWarning()
			.onClick(async () => {
				await this.onConfirm();
				this.close();
			});
		confirm.buttonEl.setAttr('data-action', 'confirm-delete');
	}

	private pluginLabel(key: string): string {
		return ((this.app as any).plugins?.plugins?.['vault-to-dify'] as DifySyncPlugin | undefined)?.t(key) || key;
	}
}

class MappingEditorModal extends Modal {
	private plugin: DifySyncPlugin;
	private mapping: FolderMapping;
	private onSave: (mapping: FolderMapping) => Promise<void>;
	private selectedFolder = '';
	private folderSelected = false;
	private selectedDatasets = new Set<string>();
	private pendingMappings: FolderMapping[] = [];
	private isEditing: boolean;
	private folderSummaryEl!: HTMLElement;
	private datasetSummaryEl!: HTMLElement;
	private folderTreeEl!: HTMLElement;
	private datasetOptionsEl!: HTMLElement;
	private pendingTableEl!: HTMLElement;
	private pendingEmptyEl!: HTMLElement;
	private pendingPageInfoEl!: HTMLElement;
	private datasetTriggerEl!: HTMLButtonElement;
	private enableAllButtonEl!: HTMLButtonElement;
	private pauseAllButtonEl!: HTMLButtonElement;
	private folderInputEl!: HTMLInputElement;
	private datasetInputEl!: HTMLInputElement;

	constructor(app: App, plugin: DifySyncPlugin, mapping: FolderMapping | undefined, onSave: (mapping: FolderMapping) => Promise<void>) {
		super(app);
		this.plugin = plugin;
		this.isEditing = !!mapping;
		this.mapping = mapping ? {
			id: mapping.id,
			folder: mapping.folder,
			datasetIds: [...mapping.datasetIds],
			enabled: mapping.enabled,
		} : {
			id: createId(),
			folder: '',
			datasetIds: [],
			enabled: true,
		};
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('dify-sync-modal-shell');
		this.modalEl.addClass('mapping-modal-shell');
		contentEl.addClass('dify-sync-modal');
		contentEl.addClass('mapping-modal');
		this.contentEl.addEventListener('click', () => this.closeSiblingDropdowns());
		const head = contentEl.createDiv('modal-head');
		const titleLine = head.createDiv('modal-title-line');
		titleLine.createEl('h2', { text: this.plugin.t(this.isEditing ? 'mappingModalTitle' : 'addMappingModalTitle'), attr: { id: 'mapping-modal-title' } });

		const body = contentEl.createDiv('modal-body');
		const builder = body.createDiv('mapping-builder');
		this.renderFolderPanel(builder);
		const arrow = builder.createDiv({ cls: 'mapping-arrow', attr: { 'aria-hidden': 'true' } });
		const arrowIcon = arrow.createDiv('mapping-arrow-icon');
		setIcon(arrowIcon, 'arrow-right');
		this.renderDatasetPanel(builder);
		this.renderPendingMappings(body);

		const actions = contentEl.createDiv('modal-actions');
		const cancel = new ButtonComponent(actions)
			.setButtonText(this.plugin.t('cancel'))
			.onClick(() => this.close());
		cancel.buttonEl.setAttr('data-action', 'close-modal');
		const refresh = new ButtonComponent(actions)
			.setButtonText(this.plugin.t('refreshDatasets'))
			.onClick(async () => {
				try {
					await this.plugin.refreshKnowledgeBases();
					this.renderDatasetChoices();
					new Notice(this.plugin.t('datasetsRefreshed', { count: this.plugin.settings.knowledgeBases.length }));
				} catch (error) {
					this.plugin.showConnectionError(error);
				}
			});
		refresh.buttonEl.setAttr('data-action', 'refresh-modal-datasets');
		refresh.buttonEl.setAttr('aria-label', this.plugin.t('refreshDatasets'));
		const save = new ButtonComponent(actions)
			.setButtonText(this.plugin.t('saveMapping'))
			.setCta()
			.onClick(async () => this.savePendingMappings());
		save.buttonEl.setAttr('data-action', 'save-mapping');

		if (this.isEditing) {
			this.selectFolder(this.mapping.folder, false);
			this.mapping.datasetIds.forEach((id) => this.selectedDatasets.add(id));
			this.updateDatasetSummary();
			this.addPendingMapping(false, this.mapping.enabled, this.mapping.id);
		} else {
			this.updateDatasetSummary();
			this.updatePendingVisibility();
		}
	}

	private renderFolderPanel(builder: HTMLElement) {
		const panel = builder.createDiv('mapping-panel');
		const labelLine = panel.createDiv('label-line');
		labelLine.createEl('label', { text: this.plugin.t('folderName'), attr: { id: 'modal-folder-label' } });
		this.folderInputEl = panel.createEl('input', { attr: { id: 'modal-folder', type: 'hidden', value: '' } }) as HTMLInputElement;
		const box = panel.createDiv('dropdown-box');
		box.addEventListener('click', (event) => event.stopPropagation());
		const trigger = box.createEl('button', { cls: 'dropdown-trigger', attr: { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'folder-dropdown-menu', 'data-action': 'toggle-folder-dropdown' } });
		this.folderSummaryEl = trigger.createSpan({ text: this.plugin.t('selectFolderPlaceholder'), attr: { 'data-role': 'folder-summary' } });
		setIcon(trigger.createSpan({ cls: 'dropdown-caret', attr: { 'aria-hidden': 'true' } }), 'chevron-down');
		const menu = box.createDiv({ cls: 'dropdown-menu', attr: { id: 'folder-dropdown-menu' } });
		menu.hidden = true;
		const search = menu.createEl('input', { cls: 'folder-search', attr: { type: 'search', placeholder: this.plugin.t('folderSearch'), 'aria-label': this.plugin.t('folderSearch') } }) as HTMLInputElement;
		this.folderTreeEl = menu.createDiv({ cls: 'folder-tree dify-sync-obsidian-folder-tree', attr: { role: 'tree', 'aria-labelledby': 'modal-folder-label' } });
		this.renderFolderTree();
		trigger.addEventListener('click', () => this.toggleMenu(trigger, menu));
		search.addEventListener('input', () => {
			const keyword = search.value.trim().toLowerCase();
			this.applyFolderSearch(keyword);
		});
	}

	private renderDatasetPanel(builder: HTMLElement) {
		const panel = builder.createDiv('mapping-panel');
		const labelLine = panel.createDiv('label-line');
		labelLine.createEl('label', { text: this.plugin.t('datasetName'), attr: { id: 'modal-dataset-label' } });
		this.datasetInputEl = panel.createEl('input', { attr: { id: 'modal-dataset', type: 'hidden', value: '', 'data-dataset-id': '' } }) as HTMLInputElement;
		const row = panel.createDiv('dataset-select-row');
		const box = row.createDiv('dropdown-box');
		box.addEventListener('click', (event) => event.stopPropagation());
		this.datasetTriggerEl = box.createEl('button', { cls: 'dropdown-trigger', attr: { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'dataset-dropdown-menu', 'data-action': 'toggle-dataset-dropdown' } });
		this.datasetSummaryEl = this.datasetTriggerEl.createSpan({ attr: { 'data-role': 'dataset-summary' } });
		setIcon(this.datasetTriggerEl.createSpan({ cls: 'dropdown-caret', attr: { 'aria-hidden': 'true' } }), 'chevron-down');
		this.datasetOptionsEl = box.createDiv({ cls: 'dropdown-menu', attr: { id: 'dataset-dropdown-menu' } });
		this.datasetOptionsEl.hidden = true;
		this.renderDatasetChoices();
		this.datasetTriggerEl.addEventListener('click', () => {
			if (!this.folderSelected) {
				new Notice(this.plugin.t('chooseFolderFirst'));
				return;
			}
			this.toggleMenu(this.datasetTriggerEl, this.datasetOptionsEl);
		});
		const add = new ButtonComponent(row)
			.setButtonText(this.plugin.t('addPendingMapping'))
			.setCta()
			.onClick(() => this.addPendingMapping(true));
		add.buttonEl.setAttr('data-action', 'add-pending-mapping');
	}

	private renderFolderTree() {
		this.folderTreeEl.empty();
		const folders = this.app.vault.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder && !!file.path && file.path !== '/')
			.map((folder) => folder.path)
			.sort();
		const notes = this.app.vault.getMarkdownFiles()
			.filter((file) => file.extension.toLowerCase() === 'md')
			.map((file) => file.path)
			.sort();
		if (folders.length === 0 && notes.length === 0) {
			this.folderTreeEl.createDiv({ text: this.plugin.t('folderPickerEmpty'), cls: 'pending-empty' });
			return;
		}
		const childrenByParent = new Map<string, Array<{ path: string; type: 'folder' | 'file' }>>();
		folders.forEach((folder) => {
			const slashIndex = folder.lastIndexOf('/');
			const parent = slashIndex === -1 ? '' : folder.slice(0, slashIndex);
			const children = childrenByParent.get(parent) || [];
			children.push({ path: folder, type: 'folder' });
			childrenByParent.set(parent, children);
		});
		notes.forEach((note) => {
			const slashIndex = note.lastIndexOf('/');
			const parent = slashIndex === -1 ? '' : note.slice(0, slashIndex);
			const children = childrenByParent.get(parent) || [];
			children.push({ path: note, type: 'file' });
			childrenByParent.set(parent, children);
		});
		childrenByParent.forEach((children) => {
			children.sort((a, b) => {
				if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
				return a.path.localeCompare(b.path);
			});
		});
		(childrenByParent.get('') || []).forEach((item) => this.renderPathNode(item, childrenByParent, this.folderTreeEl, 0));
	}

	private renderPathNode(item: { path: string; type: 'folder' | 'file' }, childrenByParent: Map<string, Array<{ path: string; type: 'folder' | 'file' }>>, container: HTMLElement, depth: number) {
		if (item.type === 'file') {
			this.renderFileNode(item.path, container);
			return;
		}
		this.renderFolderNode(item.path, childrenByParent, container, depth);
	}

	private renderFolderNode(path: string, childrenByParent: Map<string, Array<{ path: string; type: 'folder' | 'file' }>>, container: HTMLElement, depth: number) {
		const children = childrenByParent.get(path) || [];
		const hasChildren = children.length > 0;
		const targetId = `folder-tree-${path.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()}`;
		const label = path.split('/').pop() || path;
		const node = container.createDiv({
			cls: [
				'nav-folder',
				depth === 0 ? 'mod-root' : '',
			].filter(Boolean).join(' '),
		});
		node.dataset.folder = path;
		const row = node.createDiv({
			cls: [
				'nav-folder-title',
				hasChildren ? '' : 'is-folder-leaf',
				path === this.selectedFolder && this.folderSelected ? 'is-selected' : '',
			].filter(Boolean).join(' '),
			attr: {
				role: 'treeitem',
				tabindex: '0',
				'data-action': hasChildren ? 'toggle-tree-folder' : 'select-folder',
				'aria-expanded': hasChildren ? 'true' : null,
				'data-tree-target': hasChildren ? targetId : null,
			},
		});
		row.dataset.folder = path;
		const collapseIcon = row.createSpan({
			cls: hasChildren ? 'nav-folder-collapse-indicator dify-sync-folder-toggle' : 'nav-folder-collapse-indicator dify-sync-folder-toggle is-leaf',
			attr: { 'aria-hidden': 'true' },
		});
		if (hasChildren) setIcon(collapseIcon, 'chevron-right');
		row.createDiv({ text: label, cls: 'nav-folder-title-content' });
		row.createSpan({ text: this.getFolderCountLabel(path), cls: 'dify-sync-folder-count' });
		row.addEventListener('click', () => {
			if (hasChildren) {
				this.toggleTreeFolder(row);
				this.selectFolder(path, false);
				return;
			}
			this.selectFolder(path, true);
		});
		row.addEventListener('keydown', (event) => this.handleFolderTreeKeydown(event, row, hasChildren));
		if (!hasChildren) return;
		const childContainer = node.createDiv({ cls: 'nav-folder-children', attr: { id: targetId, role: 'group' } });
		children.forEach((child) => this.renderPathNode(child, childrenByParent, childContainer, depth + 1));
	}

	private renderFileNode(path: string, container: HTMLElement) {
		const label = path.split('/').pop() || path;
		const node = container.createDiv({ cls: 'nav-file' });
		node.dataset.folder = path;
		const row = node.createDiv({
			cls: [
				'nav-file-title',
				path === this.selectedFolder && this.folderSelected ? 'is-selected' : '',
			].filter(Boolean).join(' '),
			attr: {
				role: 'treeitem',
				tabindex: '0',
				'data-action': 'select-note',
			},
		});
		row.dataset.folder = path;
		row.createDiv({ text: label, cls: 'nav-file-title-content' });
		row.addEventListener('click', () => this.selectFolder(path, true));
		row.addEventListener('keydown', (event) => this.handleFolderTreeKeydown(event, row, false));
	}

	private applyFolderSearch(keyword: string) {
		const nodes = Array.from(this.folderTreeEl.querySelectorAll<HTMLElement>('.nav-folder, .nav-file'));
		const paths = nodes.map((node) => node.dataset.folder || '');
		nodes.forEach((node) => {
			const path = node.dataset.folder || '';
			const lowerPath = path.toLowerCase();
			const visible = !keyword
				|| lowerPath.includes(keyword)
				|| paths.some((candidate) => candidate.startsWith(`${path}/`) && candidate.toLowerCase().includes(keyword));
			node.hidden = !visible;
		});
		this.folderTreeEl.querySelectorAll<HTMLElement>('.nav-folder-title[data-tree-target]').forEach((row) => {
			const target = this.getFolderChildContainer(row);
			if (!target) return;
			if (keyword) {
				const hasVisibleChild = Array.from(target.querySelectorAll<HTMLElement>('.nav-folder, .nav-file')).some((node) => !node.hidden);
				target.hidden = !hasVisibleChild;
				row.toggleClass('is-collapsed', !hasVisibleChild);
				row.setAttr('aria-expanded', String(hasVisibleChild));
				return;
			}
			const expanded = row.getAttr('aria-expanded') !== 'false';
			target.hidden = !expanded;
			row.toggleClass('is-collapsed', !expanded);
		});
	}

	private handleFolderTreeKeydown(event: KeyboardEvent, row: HTMLElement, hasChildren: boolean) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const path = row.dataset.folder || '';
			if (hasChildren) this.toggleTreeFolder(row);
			this.selectFolder(path, !hasChildren);
			return;
		}
		if (event.key === 'ArrowRight' && hasChildren) {
			event.preventDefault();
			this.setFolderExpanded(row, true);
			return;
		}
		if (event.key === 'ArrowLeft' && hasChildren) {
			event.preventDefault();
			this.setFolderExpanded(row, false);
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			const box = this.folderSummaryEl.closest('.dropdown-box');
			box?.querySelector<HTMLElement>('.dropdown-menu')?.setAttr('hidden', 'true');
			box?.querySelector<HTMLElement>('.dropdown-trigger')?.setAttr('aria-expanded', 'false');
		}
	}

	private getFolderCountLabel(path: string): string {
		const count = this.app.vault.getMarkdownFiles()
			.filter((file) => file.path.startsWith(`${path}/`))
			.length;
		return `${count} 篇`;
	}

	private renderDatasetChoices() {
		this.datasetOptionsEl.empty();
		if (this.plugin.settings.knowledgeBases.length === 0) {
			this.datasetOptionsEl.createDiv({ text: this.plugin.t('datasetsDropdownEmpty'), cls: 'dataset-empty-state' });
			return;
		}
		this.plugin.settings.knowledgeBases.forEach((dataset) => {
			const label = this.datasetOptionsEl.createEl('label', { cls: 'dataset-option' });
			const checkbox = label.createEl('input', {
				attr: {
					type: 'checkbox',
					'data-action': 'select-dataset',
					'data-dataset': dataset.name || dataset.id,
					'data-dataset-id': dataset.id,
				},
			}) as HTMLInputElement;
			checkbox.checked = this.selectedDatasets.has(dataset.id);
			const checkmark = label.createSpan({ cls: 'dataset-checkmark', attr: { 'aria-hidden': 'true' } });
			setIcon(checkmark, 'check');
			label.toggleClass('is-selected', checkbox.checked);
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					this.selectedDatasets.add(dataset.id);
				} else {
					this.selectedDatasets.delete(dataset.id);
				}
				label.toggleClass('is-selected', checkbox.checked);
				this.updateDatasetSummary();
			});
			const text = label.createSpan();
			text.createSpan({ text: dataset.name || dataset.id });
			text.createEl('small', { text: dataset.id });
		});
	}

	private renderPendingMappings(body: HTMLElement) {
		const pending = body.createDiv('pending-mappings');
		const head = pending.createDiv('pending-mapping-head');
		const labelLine = head.createDiv('label-line');
		labelLine.createEl('label', { text: this.plugin.t('pendingMappingsTitle') });
		const bulk = head.createDiv('pending-bulk-actions');
		bulk.setAttr('aria-label', this.plugin.t('bulkSet'));
		const enableAll = new ButtonComponent(bulk)
			.setButtonText(this.plugin.t('enableAll'))
			.setClass('bulk-action')
			.onClick(() => this.setAllPendingStatus(true));
		this.enableAllButtonEl = enableAll.buttonEl;
		this.enableAllButtonEl.setAttr('data-action', 'enable-all-pending');
		const pauseAll = new ButtonComponent(bulk)
			.setButtonText(this.plugin.t('pauseAll'))
			.setClass('bulk-action')
			.onClick(() => this.setAllPendingStatus(false));
		this.pauseAllButtonEl = pauseAll.buttonEl;
		this.pauseAllButtonEl.setAttr('data-action', 'pause-all-pending');
		this.pendingEmptyEl = pending.createDiv({ text: this.plugin.t('pendingEmptyDesc'), cls: 'pending-empty', attr: { 'data-role': 'pending-empty' } });
		this.pendingTableEl = pending.createDiv({ cls: 'mapping-table pending-mapping-table', attr: { 'data-role': 'pending-mapping-table', hidden: 'true' } });
		this.renderPendingHeader();
		const pagination = pending.createDiv({ cls: 'mapping-pagination', attr: { 'data-role': 'pending-pagination' } });
		new ButtonComponent(pagination).setButtonText('‹').setDisabled(true);
		this.pendingPageInfoEl = pagination.createSpan({ text: '0-0 / 0', attr: { 'data-role': 'pending-page-info' } });
		new ButtonComponent(pagination).setButtonText('›').setDisabled(true);
	}

	private renderPendingHeader() {
		this.pendingTableEl.empty();
		const header = this.pendingTableEl.createDiv({ cls: 'mapping-header', attr: { role: 'row' } });
		header.createDiv({ text: this.plugin.t('mappingIndex') });
		header.createDiv({ text: this.plugin.t('mappingFolderColumn') });
		header.createDiv({ text: this.plugin.t('mappingDatasetColumn') });
		header.createDiv({ text: this.plugin.t('mappingStatusColumn') });
		header.createDiv({ text: this.plugin.t('mappingActionColumn') });
	}

	private addPendingMapping(announce = true, enabled = true, id = createId()) {
		if (!this.folderSelected) {
			new Notice(this.plugin.t('chooseFolderFirst'));
			return;
		}
		if (this.selectedDatasets.size === 0) {
			new Notice(this.plugin.t('datasetMissing'));
			return;
		}
		const mapping: FolderMapping = {
			id,
			folder: normalizeFolderPath(this.selectedFolder),
			datasetIds: Array.from(this.selectedDatasets),
			enabled,
		};
		this.pendingMappings = this.isEditing ? [mapping] : this.pendingMappings.filter((item) => item.folder !== mapping.folder).concat(mapping);
		if (announce) new Notice(this.plugin.t('pendingAdded'));
		this.renderPendingRows();
		this.resetDraft();
	}

	private renderPendingRows() {
		this.renderPendingHeader();
		this.pendingMappings.forEach((mapping, index) => {
			const row = this.pendingTableEl.createDiv({ cls: 'mapping-row', attr: { role: 'row' } });
			renderMappingRowCells(row, this.plugin, mapping, index, 'toggle-pending-status', () => {
				mapping.enabled = !mapping.enabled;
				this.renderPendingRows();
			}, (actions) => {
				const refresh = new ExtraButtonComponent(actions)
					.setIcon('refresh-cw')
					.setTooltip(this.plugin.t('refreshDatasets'))
					.onClick(async () => {
						try {
							await this.plugin.refreshKnowledgeBases();
							this.renderDatasetChoices();
							new Notice(this.plugin.t('datasetsRefreshed', { count: this.plugin.settings.knowledgeBases.length }));
						} catch (error) {
							this.plugin.showConnectionError(error);
						}
					}).extraSettingsEl;
				refresh.addClass('icon');
				refresh.setAttr('data-action', 'refresh-pending-mapping');
				refresh.setAttr('aria-label', this.plugin.t('refreshDatasets'));
				refresh.setAttr('title', this.plugin.t('refreshDatasets'));
				const remove = new ExtraButtonComponent(actions)
					.setIcon('trash-2')
					.setTooltip(this.plugin.t('delete'))
					.onClick(() => {
						this.pendingMappings = this.pendingMappings.filter((item) => item.id !== mapping.id);
						this.renderPendingRows();
					}).extraSettingsEl;
				remove.addClass('icon');
				remove.addClass('danger');
				remove.setAttr('data-action', 'remove-pending-mapping');
				remove.setAttr('aria-label', this.plugin.t('delete'));
			});
		});
		this.updatePendingVisibility();
	}

	private updatePendingVisibility() {
		const count = this.pendingMappings.length;
		if (this.pendingTableEl) {
			this.pendingTableEl.hidden = count === 0;
			this.pendingTableEl.toggleClass('is-hidden', count === 0);
			this.pendingTableEl.style.display = count === 0 ? 'none' : '';
		}
		if (this.pendingEmptyEl) {
			this.pendingEmptyEl.hidden = count > 0;
			this.pendingEmptyEl.toggleClass('is-hidden', count > 0);
			this.pendingEmptyEl.style.display = count > 0 ? 'none' : '';
		}
		if (this.pendingPageInfoEl) this.pendingPageInfoEl.setText(count ? `1-${count} / ${count}` : '0-0 / 0');
		if (this.enableAllButtonEl) this.enableAllButtonEl.disabled = count === 0;
		if (this.pauseAllButtonEl) this.pauseAllButtonEl.disabled = count === 0;
	}

	private setAllPendingStatus(enabled: boolean) {
		this.pendingMappings = this.pendingMappings.map((mapping) => ({ ...mapping, enabled }));
		this.renderPendingRows();
	}

	private async savePendingMappings() {
		if (this.pendingMappings.length === 0) {
			new Notice(this.plugin.t('validationMapping'));
			return;
		}
		for (const mapping of this.pendingMappings) {
			await this.onSave(mapping);
		}
		this.close();
	}

	private selectFolder(path: string, closeMenu: boolean) {
		this.selectedFolder = path;
		this.folderSelected = true;
		if (this.folderInputEl) this.folderInputEl.value = path;
		this.folderSummaryEl.setText(path || this.plugin.t('rootFolder'));
		this.folderTreeEl.querySelectorAll<HTMLElement>('.nav-folder-title, .nav-file-title').forEach((row) => {
			row.toggleClass('is-selected', row.dataset.folder === path);
		});
		this.datasetTriggerEl.disabled = false;
		this.updateDatasetSummary();
		if (closeMenu) {
			const box = this.folderSummaryEl.closest('.dropdown-box');
			box?.querySelector<HTMLElement>('.dropdown-menu')?.setAttr('hidden', 'true');
			box?.querySelector<HTMLElement>('.dropdown-trigger')?.setAttr('aria-expanded', 'false');
		}
	}

	private updateDatasetSummary() {
		if (!this.datasetSummaryEl) return;
		if (!this.folderSelected) {
			this.datasetSummaryEl.setText(this.plugin.t('chooseFolderFirst'));
			if (this.datasetTriggerEl) this.datasetTriggerEl.disabled = true;
			if (this.datasetInputEl) {
				this.datasetInputEl.value = '';
				this.datasetInputEl.dataset.datasetId = '';
			}
			return;
		}
		if (this.selectedDatasets.size === 0) {
			this.datasetSummaryEl.setText(this.plugin.t('datasetName'));
			if (this.datasetInputEl) {
				this.datasetInputEl.value = '';
				this.datasetInputEl.dataset.datasetId = '';
			}
			return;
		}
		const selectedIds = Array.from(this.selectedDatasets);
		const selectedNames = selectedIds.map((id) => this.plugin.getDatasetName(id));
		this.datasetSummaryEl.setText(selectedNames.join('、'));
		if (this.datasetInputEl) {
			this.datasetInputEl.value = selectedNames.join(',');
			this.datasetInputEl.dataset.datasetId = selectedIds.join(',');
		}
	}

	private resetDraft() {
		if (this.isEditing) return;
		this.folderSelected = false;
		this.selectedFolder = '';
		this.selectedDatasets.clear();
		if (this.folderInputEl) this.folderInputEl.value = '';
		this.folderSummaryEl.setText(this.plugin.t('selectFolderPlaceholder'));
		this.renderDatasetChoices();
		this.updateDatasetSummary();
	}

	private toggleMenu(trigger: HTMLElement, menu: HTMLElement) {
		const expanded = trigger.getAttr('aria-expanded') === 'true';
		if (expanded) {
			trigger.setAttr('aria-expanded', 'false');
			menu.hidden = true;
			return;
		}
		this.closeSiblingDropdowns(menu);
		trigger.setAttr('aria-expanded', 'true');
		menu.hidden = false;
	}

	private closeSiblingDropdowns(currentMenu?: HTMLElement) {
		const root = currentMenu?.closest('.dify-sync-modal') || this.contentEl;
		root.querySelectorAll<HTMLElement>('.dropdown-menu').forEach((menu) => {
			if (menu === currentMenu) return;
			menu.hidden = true;
			const trigger = menu.id
				? root.querySelector<HTMLElement>(`.dropdown-trigger[aria-controls="${menu.id}"]`)
				: menu.parentElement?.querySelector<HTMLElement>('.dropdown-trigger');
			trigger?.setAttr('aria-expanded', 'false');
		});
	}

	private toggleTreeFolder(row: HTMLElement) {
		const expanded = row.getAttr('aria-expanded') === 'true';
		this.setFolderExpanded(row, !expanded);
	}

	private setFolderExpanded(row: HTMLElement, expanded: boolean) {
		const target = this.getFolderChildContainer(row);
		if (!target) return;
		row.setAttr('aria-expanded', String(expanded));
		row.toggleClass('is-collapsed', !expanded);
		target.hidden = !expanded;
	}

	private getFolderChildContainer(row: HTMLElement): HTMLElement | null {
		const targetId = row.dataset.treeTarget;
		return targetId ? this.contentEl.querySelector<HTMLElement>(`#${targetId}`) : null;
	}

	onClose() {
		this.contentEl.empty();
	}
}

function createEmptyConnectionHealth(): ConnectionHealth {
	return {
		status: 'unknown',
		checkedAt: '',
		activeBaseUrl: '',
		lastSuccessfulBaseUrl: '',
		datasetCount: 0,
		latencyMs: 0,
	};
}

function normalizeConnectionHealth(value: any): ConnectionHealth {
	const fallback = createEmptyConnectionHealth();
	const status = ['unknown', 'missing_config', 'connected', 'failed'].includes(value?.status) ? value.status : fallback.status;
	const reason = isConnectionErrorReason(value?.reason)
		? value.reason as ConnectionErrorReason
		: undefined;
	return {
		status,
		checkedAt: typeof value?.checkedAt === 'string' ? value.checkedAt : fallback.checkedAt,
		activeBaseUrl: typeof value?.activeBaseUrl === 'string' ? value.activeBaseUrl : fallback.activeBaseUrl,
		lastSuccessfulBaseUrl: typeof value?.lastSuccessfulBaseUrl === 'string' ? value.lastSuccessfulBaseUrl : fallback.lastSuccessfulBaseUrl,
		datasetCount: clampNumber(value?.datasetCount, 0, 100000, fallback.datasetCount),
		latencyMs: clampNumber(value?.latencyMs, 0, 600000, fallback.latencyMs),
		error: typeof value?.error === 'string' ? value.error : undefined,
		reason,
		statusCode: typeof value?.statusCode === 'number' ? value.statusCode : undefined,
	};
}

function getFinalFailedCandidate(probe: ConnectionProbeResult) {
	for (let index = probe.candidates.length - 1; index >= 0; index--) {
		const candidate = probe.candidates[index];
		if (!candidate.ok) return candidate;
	}
	return undefined;
}

function getConnectionErrorMessageKey(reason: ConnectionErrorReason): string {
	const keys: Record<ConnectionErrorReason, string> = {
		missing_config: 'connectionErrorMissingConfig',
		auth_failed: 'connectionErrorAuthFailed',
		permission_denied: 'connectionErrorPermissionDenied',
		not_found: 'connectionErrorNotFound',
		timeout: 'connectionErrorTimeout',
		network: 'connectionErrorNetwork',
		server: 'connectionErrorServer',
		path_mismatch: 'connectionErrorPathMismatch',
		rate_limited: 'connectionErrorRateLimited',
		unexpected_response: 'connectionErrorUnexpectedResponse',
		unknown: 'connectionErrorUnknown',
	};
	return keys[reason] || keys.unknown;
}

function isConnectionErrorReason(value: unknown): value is ConnectionErrorReason {
	return [
		'missing_config',
		'auth_failed',
		'permission_denied',
		'not_found',
		'timeout',
		'network',
		'server',
		'path_mismatch',
		'rate_limited',
		'unexpected_response',
		'unknown',
	].includes(String(value));
}

function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(1)}s`;
}

function syncStatsVars(stats: SyncStats): Record<string, number> {
	return {
		synced: stats.synced,
		skipped: stats.skipped,
		failed: stats.failed,
	};
}

function stripUrlScheme(url: string): string {
	return (url || '').replace(/^https?:\/\//i, '') || '-';
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function renderMappingRowCells(
	row: HTMLElement,
	plugin: DifySyncPlugin,
	mapping: FolderMapping,
	index: number,
	statusAction: string,
	onToggleStatus: () => void | Promise<void>,
	renderActions: (actions: HTMLElement) => void,
) {
	row.dataset.folder = mapping.folder;
	row.dataset.dataset = mapping.datasetIds.map((id) => plugin.getDatasetName(id)).join(',');
	row.dataset.datasetId = mapping.datasetIds.join(',');
	row.createDiv({ text: String(index + 1), cls: 'mapping-index' });
	const folderCell = row.createDiv();
	folderCell.createDiv({ text: mapping.folder || plugin.t('rootFolder'), cls: 'folder-name' });
	const tags = row.createDiv('tags');
	(mapping.datasetIds.length ? mapping.datasetIds : ['']).forEach((id) => {
		tags.createSpan({ text: id ? plugin.getDatasetName(id) : plugin.t('datasetMissing'), cls: 'tag dataset-name' });
	});
	const statusCell = row.createDiv();
	const statusControl = statusCell.createDiv('mapping-status-control');
	const toggle = new ToggleComponent(statusControl)
		.setValue(mapping.enabled)
		.onChange(async () => {
			await onToggleStatus();
		});
	toggle.toggleEl.setAttr('data-action', statusAction);
	toggle.toggleEl.setAttr('aria-label', mapping.enabled ? plugin.t('enabled') : plugin.t('disabled'));
	statusControl.createSpan({ text: mapping.enabled ? plugin.t('enabled') : plugin.t('disabled'), cls: 'mapping-status-label' });
	renderActions(row.createDiv('row-actions'));
}

function createId(): string {
	return `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getErrorMessage(error: unknown): string {
	const anyError = error as any;
	return anyError?.message || String(error);
}
