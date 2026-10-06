/** Local snapshots of declared BASIC sources, independent from Git commits. */
export interface HistorySnapshot {
  id: string; revision: string; createdAt: string; reason: 'before-save' | 'after-save' | 'before-agent' | 'after-agent' | 'before-source' | 'after-source' | 'source-draft';
  files: { id: string; path: string; sha256: string; bytes: number }[];
}
export interface HistoryVersion {
  snapshotId: string; revision: string; sourceId: string; path: string; sha256: string; source: string;
}
export interface HistoryPort {
  list(sessionId: string): Promise<HistorySnapshot[] | { error: string }>;
  version(sessionId: string, snapshotId: string, sourceId: string, revision: string): Promise<HistoryVersion | { error: string }>;
}
