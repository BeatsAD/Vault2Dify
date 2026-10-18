import { getFrontMatterInfo, parseYaml } from 'obsidian';
import { DifyApiClient, DifyApiError } from '../api/DifyApiClient';
import type { DifyMetadataField, PreparedMetadata } from '../types';
import { isRecord } from '../utils/path';

const BUILT_IN_FIELDS = new Set(['document_name', 'uploader', 'upload_date', 'last_update_date', 'source']);

export class MetadataSyncError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MetadataSyncError';
	}
}

function stableValue(value: unknown, ancestors = new Set<object>()): unknown {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite number');
	if (value !== null && typeof value === 'object') {
		if (ancestors.has(value)) throw new Error('Circular YAML value');
		ancestors.add(value);
		const result: unknown = Array.isArray(value)
			? value.map(item => stableValue(item, ancestors))
			: Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue((value as Record<string, unknown>)[key], ancestors)]));
		ancestors.delete(value);
		return result;
	}
	return value;
}

function timestamp(value: unknown): number | undefined {
	if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() / 1000 : undefined;
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return undefined;
	const time = Date.parse(value);
	if (!Number.isFinite(time)) return undefined;
	if (value.length === 10 && new Date(time).toISOString().slice(0, 10) !== value) return undefined;
	return time / 1000;
}

export function prepareMetadata(content: string, generation: number): PreparedMetadata {
	const values: PreparedMetadata['values'] = [];
	const errors: string[] = [];
	try {
		const info = getFrontMatterInfo(content);
		const yaml: unknown = info.exists ? parseYaml(info.frontmatter) : null;
		if (yaml !== null && yaml !== undefined && !isRecord(yaml)) throw new Error('YAML properties must be an object');
		if (isRecord(yaml)) {
			for (const name of Object.keys(yaml).sort()) {
				const raw = yaml[name];
				if (raw === null || raw === undefined || raw === '') continue;
				try {
					if (!name.trim() || Array.from(name).length > 255) throw new Error('Invalid field name');
					if (BUILT_IN_FIELDS.has(name)) throw new Error('Dify built-in field is read-only');
					const normalized = stableValue(raw);
					const text = typeof normalized === 'string' ? normalized : JSON.stringify(normalized);
					if (typeof text !== 'string') throw new Error('Unsupported YAML value');
					const time = timestamp(raw);
					const type = time !== undefined ? 'time' : typeof raw === 'number' ? 'number' : 'string';
					values.push({ name, type, value: time ?? (typeof raw === 'number' ? raw : text), text });
				} catch (error) {
					errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
	} catch (error) {
		errors.push(`YAML: ${error instanceof Error ? error.message : String(error)}`);
	}
	return { values, errors, fingerprint: JSON.stringify([generation, values, errors]) };
}

// One instance per sync run: share field discovery and creation across workers.
export class MetadataSync {
	private fields = new Map<string, Promise<DifyMetadataField[]>>();
	private creations = new Map<string, Promise<DifyMetadataField>>();

	constructor(private client: DifyApiClient, private enabled: () => boolean) {}

	private getFields(datasetId: string): Promise<DifyMetadataField[]> {
		let pending = this.fields.get(datasetId);
		if (!pending) {
			pending = this.client.listMetadataFields(datasetId);
			this.fields.set(datasetId, pending);
		}
		return pending;
	}

	private async getField(datasetId: string, value: PreparedMetadata['values'][number]): Promise<DifyMetadataField> {
		const fields = await this.getFields(datasetId);
		const existing = fields.find(field => field.name === value.name);
		if (existing) return existing;
		const key = `${datasetId}\0${value.name}`;
		let pending = this.creations.get(key);
		if (!pending) {
			pending = (async () => {
				if (!this.enabled()) throw new Error('Metadata sync disabled');
				try {
					const field = await this.client.createMetadataField(datasetId, value.name, value.type);
					fields.push(field);
					return field;
				} catch (error) {
					// Another client may have created the same field concurrently.
					if (error instanceof DifyApiError && (error.status === 400 || error.status === 409)) {
						const refreshed = await this.client.listMetadataFields(datasetId);
						const field = refreshed.find(item => item.name === value.name);
						if (field) { fields.push(field); return field; }
					}
					throw error;
				}
			})();
			this.creations.set(key, pending);
		}
		return pending;
	}

	async sync(datasetId: string, documentId: string, metadata: PreparedMetadata): Promise<boolean> {
		const errors = [...metadata.errors];
		const items: { id: string; name: string; value: string | number }[] = [];
		for (const value of metadata.values) {
			if (!this.enabled()) return false;
			try {
				const field = await this.getField(datasetId, value);
				let converted: string | number = value.value;
				if (field.type === 'string') converted = value.text;
				else if (field.type === 'time') {
					const time = value.type === 'time' ? Number(value.value) : timestamp(value.text);
					if (time === undefined) throw new Error('Expected an ISO date or datetime');
					converted = time;
				} else {
					if (value.type === 'time' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.text)) throw new Error('Expected a finite number');
					converted = Number(value.text);
					if (!Number.isFinite(converted)) throw new Error('Expected a finite number');
				}
				items.push({ id: field.id, name: field.name, value: converted });
			} catch (error) {
				errors.push(`${value.name}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		if (!this.enabled()) return false;
		if (items.length) {
			try { await this.client.updateDocumentMetadata(datasetId, documentId, items); }
			catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
		}
		if (errors.length) throw new MetadataSyncError(errors.join('; '));
		return true;
	}
}
