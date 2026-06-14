import type { SyncRecord } from '../types';

export function getSyncRecordKey(datasetId: string, filePath: string): string {
	return `${datasetId}::${filePath}`;
}

export function migrateRenamedSyncRecords(
	syncRecords: Map<string, SyncRecord>,
	oldPath: string,
	newPath: string,
	makeRemoteName: (filePath: string) => string,
): boolean {
	const updates: [string, SyncRecord][] = [];
	syncRecords.forEach((record, key) => {
		if (record.filePath === oldPath) {
			updates.push([key, {
				...record,
				filePath: newPath,
				remoteName: record.remoteName || makeRemoteName(oldPath),
				deletedLocal: false,
			}]);
		}
	});

	updates.forEach(([oldKey, record]) => {
		syncRecords.delete(oldKey);
		syncRecords.set(getSyncRecordKey(record.datasetId, newPath), record);
	});

	return updates.length > 0;
}

export function recoverDeletedSyncRecordForCreatedFile(
	syncRecords: Map<string, SyncRecord>,
	datasetId: string,
	newPath: string,
	hash: string,
	makeRemoteName: (filePath: string) => string,
	now = new Date(),
	recoveryWindowMs = 30000,
): boolean {
	const newKey = getSyncRecordKey(datasetId, newPath);
	if (syncRecords.has(newKey)) {
		return false;
	}

	let matchKey: string | undefined;
	let matchRecord: SyncRecord | undefined;
	let newestDeletedAt = -1;

	syncRecords.forEach((record, key) => {
		if (
			record.datasetId !== datasetId ||
			record.filePath === newPath ||
			!record.documentId ||
			!record.deletedLocal ||
			record.hash !== hash
		) {
			return;
		}

		const deletedAt = Date.parse(record.lastSyncedAt);
		if (!Number.isFinite(deletedAt)) {
			return;
		}

		const ageMs = now.getTime() - deletedAt;
		if (ageMs < 0 || ageMs > recoveryWindowMs || deletedAt <= newestDeletedAt) {
			return;
		}

		matchKey = key;
		matchRecord = record;
		newestDeletedAt = deletedAt;
	});

	if (!matchKey || !matchRecord) {
		return false;
	}

	syncRecords.delete(matchKey);
	syncRecords.set(newKey, {
		...matchRecord,
		filePath: newPath,
		remoteName: matchRecord.remoteName || makeRemoteName(matchRecord.filePath),
		deletedLocal: false,
	});

	return true;
}
