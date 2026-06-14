export function sanitizeBaseUrl(value: string): string {
	const trimmed = (value || '')
		.trim()
		.replace(/\/+$/, '')
		.replace(/\/v1\/datasets$/i, '')
		.replace(/\/v1$/i, '');
	if (!trimmed) {
		return '';
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}
	return `http://${trimmed}`;
}

export function normalizeFolderPath(value: string): string {
	return (value || '').trim().replace(/^\/+|\/+$/g, '');
}

export function pathMatchesFolder(filePath: string, folder: string): boolean {
	const normalizedFolder = normalizeFolderPath(folder);
	if (normalizedFolder === '') {
		return true;
	}
	if (normalizedFolder.toLowerCase().endsWith('.md')) {
		return filePath === normalizedFolder;
	}
	return filePath === normalizedFolder || filePath.startsWith(`${normalizedFolder}/`);
}

export function parseJson(text: string): unknown {
	if (!text) {
		return {};
	}
	try {
		return JSON.parse(text);
	} catch {
		return {};
	}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getStringProperty(value: Record<string, unknown>, key: string): string | undefined {
	const property = value[key];
	return typeof property === 'string' ? property : undefined;
}

export function getNumberProperty(value: Record<string, unknown>, key: string): number | undefined {
	const property = value[key];
	return typeof property === 'number' ? property : undefined;
}

export function uniqueStrings(values: string[]): string[] {
	return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function splitIds(value: string): string[] {
	return uniqueStrings((value || '').split(/[\s,，;；]+/));
}

export function getDatasetIdsForPathFromMappings(
	filePath: string,
	mappings: Array<{ folder: string; datasetIds: string[]; enabled: boolean }>,
): string[] {
	const matches: string[] = [];
	mappings
		.filter((mapping) => mapping.enabled && Array.isArray(mapping.datasetIds) && mapping.datasetIds.length > 0)
		.forEach((mapping) => {
			if (pathMatchesFolder(filePath, mapping.folder)) {
				matches.push(...mapping.datasetIds);
			}
		});
	return uniqueStrings(matches);
}

export function removeMappingById<T extends { id: string }>(mappings: T[], mappingId: string): T[] {
	return mappings.filter((mapping) => mapping.id !== mappingId);
}

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) {
		return fallback;
	}
	return Math.min(max, Math.max(min, numeric));
}
