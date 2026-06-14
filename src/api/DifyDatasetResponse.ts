import type {
	DifyDataset,
	KnowledgeBaseInfo,
} from '../types';

export interface DifyResponseDiagnostics {
	topLevelType: string;
	topLevelKeys: string[];
	dataIsArray: boolean;
	dataLength?: number;
	looksLikeHtml: boolean;
}

export function extractKnowledgeBasesFromResponse(json: unknown, rawText = ''): KnowledgeBaseInfo[] {
	const diagnostics = describeDifyResponse(json, rawText);
	const items = getDatasetItems(json);

	if (!items) {
		throw new Error(buildUnexpectedDatasetResponseMessage(diagnostics));
	}

	return items
		.filter((item) => !!item?.id)
		.map((item) => ({
			id: item.id,
			name: item.name || item.id,
			description: item.description,
		}));
}

export function assertDifyDatasetResponse(json: unknown, rawText = '') {
	if (!getDatasetItems(json)) {
		throw new Error(buildUnexpectedDatasetResponseMessage(describeDifyResponse(json, rawText)));
	}
}

export function describeDifyResponse(json: unknown, rawText = ''): DifyResponseDiagnostics {
	const looksLikeHtml = /^\s*</.test(rawText || '');
	const topLevelType = Array.isArray(json) ? 'array' : json === null ? 'null' : typeof json;
	const objectValue = isRecord(json) ? json : undefined;
	const data = objectValue?.data;

	return {
		topLevelType,
		topLevelKeys: objectValue ? Object.keys(objectValue).slice(0, 12) : [],
		dataIsArray: Array.isArray(data),
		dataLength: Array.isArray(data) ? data.length : undefined,
		looksLikeHtml,
	};
}

function getDatasetItems(json: unknown): DifyDataset[] | null {
	if (Array.isArray(json)) {
		return json as DifyDataset[];
	}
	if (isRecord(json) && Array.isArray(json.data)) {
		return json.data as DifyDataset[];
	}
	return null;
}

function buildUnexpectedDatasetResponseMessage(diagnostics: DifyResponseDiagnostics): string {
	const responseKind = diagnostics.looksLikeHtml
		? 'received an HTML page'
		: `top-level type ${diagnostics.topLevelType}`;
	const keySummary = diagnostics.topLevelKeys.length > 0
		? `; top-level fields: ${diagnostics.topLevelKeys.join(', ')}`
		: '';

	return `Current address did not return a Dify knowledge base API response (${responseKind}${keySummary}).`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
