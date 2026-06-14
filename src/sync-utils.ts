export * from './utils/path';
export {
	getSyncRecordKey as getRecordKey,
	migrateRenamedSyncRecords,
	recoverDeletedSyncRecordForCreatedFile,
} from './sync/SyncRecords';

export type SettingsReviewMetricKey = 'total' | 'synced' | 'skipped' | 'failed';
export type SettingsReviewTone = 'default' | 'accent' | 'success' | 'warning' | 'error' | 'muted';

export interface SettingsReviewMetric {
	key: SettingsReviewMetricKey;
	value: number;
	tone: SettingsReviewTone;
}

export interface SettingsReviewSummaryInput {
	connectionHealth?: {
		status?: string;
	};
	recentSyncResult?: {
		total?: number;
		synced?: number;
		skipped?: number;
		failed?: number;
	};
}

export interface SettingsReviewSummary {
	metrics: SettingsReviewMetric[];
	connectionTone: SettingsReviewTone;
	hasRecentSync: boolean;
}

export function buildSettingsReviewSummary(input: SettingsReviewSummaryInput): SettingsReviewSummary {
	const result = input.recentSyncResult;
	const failed = normalizeCount(result?.failed);

	return {
		metrics: [
			{ key: 'total', value: normalizeCount(result?.total), tone: 'accent' },
			{ key: 'synced', value: normalizeCount(result?.synced), tone: 'success' },
			{ key: 'skipped', value: normalizeCount(result?.skipped), tone: 'warning' },
			{ key: 'failed', value: failed, tone: 'error' },
		],
		connectionTone: getConnectionTone(input.connectionHealth?.status),
		hasRecentSync: !!result,
	};
}

function getConnectionTone(status?: string): SettingsReviewTone {
	if (status === 'connected') return 'success';
	if (status === 'failed') return 'error';
	if (status === 'missing_config') return 'warning';
	return 'muted';
}

function normalizeCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
