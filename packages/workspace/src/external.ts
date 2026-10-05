/** Read-only inspection and explicit adoption of a reviewed disk baseline. */
export interface ExternalChange { id: string; path: string; revision?: string; issue?: string }
export interface ExternalVersion { id: string; path: string; revision: string; baseRevision: string; source: string }
export interface ExternalPort {
  status(sessionId: string): Promise<ExternalChange[] | { error: string }>;
  read(sessionId: string, id: string, revision: string): Promise<ExternalVersion | { error: string }>;
  accept(sessionId: string, id: string, revision: string, baseRevision: string): Promise<ExternalVersion | { error: string }>;
}
