export interface DraftSummary {
  revision: string | null;
  snapshot: { id: string; createdAt: string; files: { id: string; path: string; bytes: number }[] } | null;
}
export interface DraftRecovery {
  revision: string;
  files: { id: string; path: string; base: string; source: string }[];
}
export interface DraftPort {
  status(sessionId: string): Promise<DraftSummary | { error: string }>;
  capture(sessionId: string, sources: { id: string; source: string }[], revision: string | null): Promise<DraftSummary | { error: string }>;
  read(sessionId: string, revision: string): Promise<DraftRecovery | { error: string }>;
  forget(sessionId: string, revision: string): Promise<DraftSummary | { error: string }>;
}
