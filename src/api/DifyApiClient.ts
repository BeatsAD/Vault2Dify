import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';
import {
	assertDifyDatasetResponse,
	describeDifyResponse,
	extractKnowledgeBasesFromResponse,
} from './DifyDatasetResponse';
import type {
	ApiPathStyle,
	ConnectionCandidateResult,
	ConnectionErrorReason,
	ConnectionProbeResult,
	DifyDocument,
	DifyMutationResponse,
	DifySyncSettings,
	KnowledgeBaseInfo,
} from '../types';
import {
	getStringProperty,
	isRecord,
	parseJson,
	sanitizeBaseUrl,
	uniqueStrings,
} from '../utils/path';

type ErrorLikeRecord = {
	message?: unknown;
	reason?: unknown;
	responseText?: unknown;
	status?: unknown;
	text?: unknown;
};

export interface DifyApiClientHost {
	settings: DifySyncSettings;
	debug(...args: unknown[]): void;
}

export class DifyApiError extends Error {
	status?: number;
	responseText?: string;
	reason?: ConnectionErrorReason;

	constructor(message: string, status?: number, responseText?: string, reason?: ConnectionErrorReason) {
		super(message);
		this.name = 'DifyApiError';
		this.status = status;
		this.responseText = responseText;
		this.reason = reason;
		Object.setPrototypeOf(this, DifyApiError.prototype);
	}

	get isTransient(): boolean {
		return !this.status || this.status === 408 || this.status === 429 || this.status >= 500;
	}

	get isPathMismatch(): boolean {
		return this.status === 404 || this.status === 405;
	}
}

export class DifyApiClient {
	private host: DifyApiClientHost;
	private activeBaseUrl = '';
	private runtimePathStyle: Exclude<ApiPathStyle, 'auto'> | null = null;

	constructor(host: DifyApiClientHost) {
		this.host = host;
	}

	getActiveBaseUrl(): string {
		return this.activeBaseUrl;
	}

	setActiveBaseUrl(baseUrl: string) {
		const candidates = this.getCandidateBaseUrls(false);
		if (baseUrl && candidates.includes(baseUrl)) {
			this.activeBaseUrl = baseUrl;
		}
	}

	clearActiveBaseUrl() {
		this.activeBaseUrl = '';
	}

	async probeConnection(): Promise<ConnectionProbeResult> {
		const candidates = this.getCandidateBaseUrls(false);
		const checkedAt = new Date().toISOString();
		const results: ConnectionCandidateResult[] = [];
		let lastError: DifyApiError | null = null;
		let lastFailedCandidate: ConnectionCandidateResult | null = null;

		for (const baseUrl of candidates) {
			const started = Date.now();
			try {
				const datasets = await this.listDatasetsFromBaseUrl(baseUrl);
				const latencyMs = Date.now() - started;
				this.activeBaseUrl = baseUrl;
				results.push({
					baseUrl,
					ok: true,
					latencyMs,
					datasetCount: datasets.length,
				});
				return {
					status: 'connected',
					checkedAt,
					activeBaseUrl: baseUrl,
					lastSuccessfulBaseUrl: baseUrl,
					datasetCount: datasets.length,
					latencyMs,
					candidates: results,
					datasets,
				};
			} catch (error) {
				const apiError = this.toApiError(error);
				const reason = classifyConnectionApiError(apiError);
				lastError = apiError;
				lastFailedCandidate = {
					baseUrl,
					ok: false,
					latencyMs: Date.now() - started,
					statusCode: apiError.status,
					error: apiError.message,
					reason,
				};
				results.push(lastFailedCandidate);
				if (!this.shouldTryNextBase(apiError)) {
					break;
				}
			}
		}

		return {
			status: 'failed',
			checkedAt,
			activeBaseUrl: '',
			datasetCount: 0,
			latencyMs: results.reduce((total, item) => total + item.latencyMs, 0),
			candidates: results,
			error: lastFailedCandidate?.error || lastError?.message || 'No Dify API URL is available.',
			reason: lastFailedCandidate?.reason || (lastError ? classifyConnectionApiError(lastError) : 'unknown'),
			statusCode: lastFailedCandidate?.statusCode,
			datasets: [],
		};
	}

	async listDatasets(): Promise<KnowledgeBaseInfo[]> {
		const results: KnowledgeBaseInfo[] = [];
		const limit = 100;

		for (let page = 1; page <= 50; page++) {
			const json = await this.requestUnknown(`/datasets?page=${page}&limit=${limit}`, { method: 'GET' });
			const items = this.extractDatasets(json);
			results.push(...items);

			if (!hasMore(json) && items.length < limit) {
				break;
			}
		}

		return results;
	}

	private extractDatasets(json: unknown): KnowledgeBaseInfo[] {
		return extractKnowledgeBasesFromResponse(json);
	}

	private async listDatasetsFromBaseUrl(baseUrl: string): Promise<KnowledgeBaseInfo[]> {
		const results: KnowledgeBaseInfo[] = [];
		const limit = 100;

		for (let page = 1; page <= 50; page++) {
			const json = await this.requestOnce(baseUrl, `/datasets?page=${page}&limit=${limit}`, { method: 'GET' });
			const items = this.extractDatasets(json);
			results.push(...items);
			if (!hasMore(json) && items.length < limit) {
				break;
			}
		}

		return results;
	}

	async listDocuments(datasetId: string): Promise<DifyDocument[]> {
		const results: DifyDocument[] = [];
		const limit = 100;

		for (let page = 1; page <= 100; page++) {
			const json = await this.requestUnknown(`/datasets/${encodeURIComponent(datasetId)}/documents?page=${page}&limit=${limit}`, { method: 'GET' });
			const items = getDifyDocumentItems(json);
			items.forEach((item) => {
				results.push(item);
			});

			if (!hasMore(json) && items.length < limit) {
				break;
			}
		}

		return results;
	}

	async createDocumentByText(datasetId: string, name: string, text: string): Promise<DifyMutationResponse> {
		return this.mutateTextDocument(datasetId, undefined, {
			name,
			text,
			indexing_technique: 'high_quality',
			process_rule: { mode: 'automatic' },
		});
	}

	async updateDocumentByText(datasetId: string, documentId: string, name: string, text: string): Promise<DifyMutationResponse> {
		return this.mutateTextDocument(datasetId, documentId, {
			name,
			text,
			process_rule: { mode: 'automatic' },
		});
	}

	async getIndexingStatus(datasetId: string, batch: string): Promise<unknown> {
		return this.requestUnknown(`/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(batch)}/indexing-status`, { method: 'GET' });
	}

	private async mutateTextDocument(datasetId: string, documentId: string | undefined, body: Record<string, unknown>): Promise<DifyMutationResponse> {
		const styles = this.getPathStyleCandidates();
		let lastError: DifyApiError | null = null;

		for (const style of styles) {
			const path = documentId
				? `/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}/${style === 'hyphen' ? 'update-by-text' : 'update_by_text'}`
				: `/datasets/${encodeURIComponent(datasetId)}/document/${style === 'hyphen' ? 'create-by-text' : 'create_by_text'}`;

			try {
					const response = await this.request<DifyMutationResponse>(path, {
						method: 'POST',
						body,
					}, isDifyMutationResponse);
				this.runtimePathStyle = style;
				return response;
			} catch (error) {
				const apiError = this.toApiError(error);
				lastError = apiError;
				if (this.host.settings.apiPathStyle === 'auto' && apiError.isPathMismatch) {
					this.host.debug(`Dify API path style ${style} failed, trying fallback`, apiError.message);
					continue;
				}
				throw apiError;
			}
		}

		throw lastError || new DifyApiError('Unable to resolve Dify document API path.');
	}

	private getPathStyleCandidates(): Exclude<ApiPathStyle, 'auto'>[] {
		if (this.host.settings.apiPathStyle === 'hyphen') {
			return ['hyphen'];
		}
		if (this.host.settings.apiPathStyle === 'underscore') {
			return ['underscore'];
		}
		if (this.runtimePathStyle) {
			return [this.runtimePathStyle, this.runtimePathStyle === 'hyphen' ? 'underscore' : 'hyphen'];
		}
		return ['hyphen', 'underscore'];
	}

	private async requestUnknown(path: string, options: { method: string; body?: unknown }): Promise<unknown> {
		return this.request(path, options, (value): value is unknown => true);
	}

	private async request<T>(path: string, options: { method: string; body?: unknown }, validate: (value: unknown) => value is T): Promise<T> {
		const baseUrls = this.getCandidateBaseUrls();
		let lastError: DifyApiError | null = null;

		for (const baseUrl of baseUrls) {
			const maxAttempts = Math.max(1, this.host.settings.maxRetries + 1);

			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
					try {
						const response = await this.requestOnce(baseUrl, path, options);
						this.activeBaseUrl = baseUrl;
						if (!validate(response)) {
							throw new DifyApiError('Dify returned an unexpected response shape.', undefined, JSON.stringify(response));
						}
						return response;
					} catch (error) {
					const apiError = this.toApiError(error);
					lastError = apiError;

					if (!apiError.isTransient || attempt >= maxAttempts) {
						break;
					}

					await sleep(400 * attempt);
				}
			}

			if (lastError && !this.shouldTryNextBase(lastError)) {
				throw lastError;
			}
		}

		throw lastError || new DifyApiError('No Dify API URL is available.');
	}

	private async requestOnce(baseUrl: string, path: string, options: { method: string; body?: unknown }): Promise<unknown> {
		const url = `${baseUrl}/v1${path}`;
		this.host.debug(`${options.method} ${url}`);

		const timeoutMs = Math.max(5, this.host.settings.requestTimeoutSeconds) * 1000;
		let timeoutId: number | null = null;

		const timeoutPromise = new Promise<never>((_, reject) => {
			timeoutId = window.setTimeout(() => {
				reject(new DifyApiError(`Request timed out after ${this.host.settings.requestTimeoutSeconds}s`));
			}, timeoutMs);
		});

		try {
				const requestOptions: RequestUrlParam = {
					url,
					method: options.method,
					headers: {
						Authorization: `Bearer ${this.host.settings.difyApiKey}`,
						'Content-Type': 'application/json',
					},
					body: options.body ? JSON.stringify(options.body) : undefined,
					throw: false,
				};
				const requestPromise = requestUrl(requestOptions);

				const response = await Promise.race<RequestUrlResponse>([requestPromise, timeoutPromise]);
			if (timeoutId !== null) {
				window.clearTimeout(timeoutId);
			}

			if (response.status < 200 || response.status >= 300) {
				throw new DifyApiError(this.extractErrorMessage(response.text, response.status), response.status, response.text);
			}

			const json = parseJson(response.text);
			this.logResponseDiagnostics(url, response.status, json, response.text);
			if (isDatasetListPath(path)) {
				assertDifyDatasetResponse(json, response.text);
			}
			return json;
		} catch (error) {
			if (timeoutId !== null) {
				window.clearTimeout(timeoutId);
			}
			throw this.toApiError(error);
		}
	}

	private getCandidateBaseUrls(preferActive = true): string[] {
		const settings = this.host.settings;
		const primary = sanitizeBaseUrl(settings.difyApiUrl);
		const urls = [primary];

		const unique = uniqueStrings(urls.filter(Boolean));
		if (preferActive && this.activeBaseUrl && unique.includes(this.activeBaseUrl)) {
			return [this.activeBaseUrl, ...unique.filter((url) => url !== this.activeBaseUrl)];
		}
		return unique;
	}

	private shouldTryNextBase(error: DifyApiError): boolean {
		return !error.status || error.status === 404 || error.status >= 500;
	}

	private extractErrorMessage(text: string, status: number): string {
		const json = parseJson(text);
		const message = isRecord(json)
			? getStringProperty(json, 'message') || getStringProperty(json, 'error') || getStringProperty(json, 'detail') || text || 'Unknown error'
			: text || 'Unknown error';
		return `HTTP ${status}: ${String(message).slice(0, 300)}`;
	}

	private logResponseDiagnostics(url: string, status: number, json: unknown, rawText = '') {
		const diagnostics = describeDifyResponse(json, rawText);
		this.host.debug('Dify API response', {
			url,
			status,
			topLevelType: diagnostics.topLevelType,
			topLevelKeys: diagnostics.topLevelKeys,
			dataIsArray: diagnostics.dataIsArray,
			dataLength: diagnostics.dataLength,
			looksLikeHtml: diagnostics.looksLikeHtml,
		});
	}

	private toApiError(error: unknown): DifyApiError {
		if (error instanceof DifyApiError) {
			return error;
		}

		const errorRecord = toErrorRecord(error);
		const status = typeof errorRecord.status === 'number' ? errorRecord.status : undefined;
		const message = typeof errorRecord.message === 'string' ? errorRecord.message : String(error);
		const responseText = typeof errorRecord.text === 'string'
			? errorRecord.text
			: typeof errorRecord.responseText === 'string'
				? errorRecord.responseText
				: undefined;
		const reason = isConnectionErrorReason(errorRecord.reason) ? errorRecord.reason : undefined;
		return new DifyApiError(message, status, responseText, reason);
	}
}

function hasMore(value: unknown): boolean {
	return isRecord(value) && value.has_more === true;
}

function getDifyDocumentItems(value: unknown): DifyDocument[] {
	const candidates = Array.isArray(value)
		? value
		: isRecord(value) && Array.isArray(value.data)
			? value.data
			: [];
	return candidates.filter(isDifyDocument);
}

function isDifyDocument(value: unknown): value is DifyDocument {
	return isRecord(value) && typeof value.id === 'string';
}

function isDifyMutationResponse(value: unknown): value is DifyMutationResponse {
	if (!isRecord(value)) return false;
	const maybeDocument = value['document'];
	const maybeData = value.data;
	return (maybeDocument === undefined || isDifyDocument(maybeDocument))
		&& (maybeData === undefined || isDifyDocument(maybeData));
}

function toErrorRecord(error: unknown): ErrorLikeRecord {
	return isRecord(error) ? error : {};
}

export function classifyConnectionApiError(error: DifyApiError): ConnectionErrorReason {
	if (error.reason) return error.reason;
	const message = error.message.toLowerCase();
	if (error.status === 401) return 'auth_failed';
	if (error.status === 403) return 'permission_denied';
	if (error.status === 404) return 'not_found';
	if (error.status === 405) return 'path_mismatch';
	if (error.status === 429) return 'rate_limited';
	if (error.status && error.status >= 500) return 'server';
	if (
		message.includes('did not return a dify knowledge base api response') ||
		message.includes('received an html page')
	) {
		return 'unexpected_response';
	}
	if (message.includes('timed out') || message.includes('timeout')) return 'timeout';
	if (
		message.includes('failed to fetch') ||
		message.includes('network') ||
		message.includes('econnrefused') ||
		message.includes('enotfound') ||
		message.includes('econnreset')
	) {
		return 'network';
	}
	return 'unknown';
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

function isDatasetListPath(path: string): boolean {
	return path === '/datasets' || path.startsWith('/datasets?');
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}
