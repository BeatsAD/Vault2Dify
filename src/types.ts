import type { TFile } from 'obsidian';

export type Language = 'zh-CN' | 'en';
export type EndpointMode = 'primary' | 'lan' | 'public' | 'auto';
export type ApiPathStyle = 'auto' | 'hyphen' | 'underscore';
export type SyncSource = 'manual' | 'event' | 'interval' | 'startup' | 'settings';
export type ConnectionStatus = 'unknown' | 'missing_config' | 'connected' | 'failed';
export type ConnectionErrorReason = 'missing_config' | 'auth_failed' | 'permission_denied' | 'not_found' | 'timeout' | 'network' | 'server' | 'path_mismatch' | 'rate_limited' | 'unexpected_response' | 'unknown';

export interface KnowledgeBaseInfo {
	id: string;
	name: string;
	description?: string;
}

export interface FolderMapping {
	id: string;
	folder: string;
	datasetIds: string[];
	enabled: boolean;
}

export interface ConnectionCandidateResult {
	baseUrl: string;
	ok: boolean;
	latencyMs: number;
	datasetCount?: number;
	statusCode?: number;
	error?: string;
	reason?: ConnectionErrorReason;
}

export interface ConnectionProbeResult {
	status: ConnectionStatus;
	checkedAt: string;
	activeBaseUrl: string;
	lastSuccessfulBaseUrl?: string;
	datasetCount: number;
	latencyMs: number;
	candidates: ConnectionCandidateResult[];
	error?: string;
	reason?: ConnectionErrorReason;
	statusCode?: number;
	datasets: KnowledgeBaseInfo[];
}

export interface ConnectionHealth {
	status: ConnectionStatus;
	checkedAt: string;
	activeBaseUrl: string;
	lastSuccessfulBaseUrl: string;
	datasetCount: number;
	latencyMs: number;
	error?: string;
	reason?: ConnectionErrorReason;
	statusCode?: number;
}

export interface DifySyncSettings {
	schemaVersion: number;
	initialSetupCompleted: boolean;
	language: Language;
	difyApiKey: string;
	difyApiUrl: string;
	lanApiUrl: string;
	publicApiUrl: string;
	endpointMode: EndpointMode;
	apiPathStyle: ApiPathStyle;
	difyKnowledgeId: string;
	obsidianFolders: string[];
	mappings: FolderMapping[];
	knowledgeBases: KnowledgeBaseInfo[];
	lastDatasetRefresh: string;
	autoSyncEnabled: boolean;
	eventSyncEnabled: boolean;
	syncOnStartup: boolean;
	periodicFullScanEnabled: boolean;
	syncInterval: number;
	debounceSeconds: number;
	requestTimeoutSeconds: number;
	maxRetries: number;
	maxConcurrent: number;
	pollIndexStatus: boolean;
	debugLogging: boolean;
	lastSyncTime: string;
	connectionHealth: ConnectionHealth;
	recentSyncResult?: RecentSyncResult;
}

export interface SyncRecord {
	filePath: string;
	datasetId: string;
	documentId?: string;
	remoteName: string;
	hash: string;
	lastModified: number;
	lastSyncedAt: string;
	lastBatch?: string;
	deletedLocal?: boolean;
	lastError?: string;
}

export interface SyncFailureDetail {
	filePath: string;
	datasetId: string;
	message: string;
}

export interface RecentSyncResult {
	source: SyncSource;
	status?: 'success' | 'failed';
	startedAt: string;
	finishedAt: string;
	elapsedMs: number;
	activeBaseUrl: string;
	synced: number;
	skipped: number;
	failed: number;
	total: number;
	syncedFiles: string[];
	failedFiles: SyncFailureDetail[];
	error?: string;
}

export interface DifyDataset {
	id: string;
	name?: string;
	description?: string;
}

export interface DifyDocument {
	id: string;
	name?: string;
	[key: string]: unknown;
}

export interface DifyMutationResponse {
	['document']?: DifyDocument;
	data?: DifyDocument;
	batch?: string;
	[key: string]: unknown;
}

export interface SyncTask {
	file: TFile;
	content: string;
	hash: string;
	datasetId: string;
	remoteName: string;
	recordKey: string;
}

export interface DocumentIndex {
	byId: Map<string, DifyDocument>;
	byName: Map<string, DifyDocument>;
}

export interface SyncStats {
	synced: number;
	skipped: number;
	failed: number;
	total: number;
	syncedFiles: string[];
	failedFiles: SyncFailureDetail[];
}
