import type { ProjectManifest, SourceSnapshot } from '../../workspace/src/project.ts';
export interface AgentFile extends SourceSnapshot { saved: string }
export interface AgentWorkspaceState { sessionId: string; manifest: ProjectManifest; files: AgentFile[] }
export interface ToolDefinition { type: 'function'; name: string; description: string; strict: true; parameters: Record<string, unknown> }
export interface ModelTurn { output: Record<string, unknown>[]; tokens: number }
export interface ModelPort { respond(input: Record<string, unknown>[], tools: ToolDefinition[], signal: AbortSignal): Promise<ModelTurn> }
export interface ToolPort { definitions: ToolDefinition[]; execute(name: string, args: unknown): Promise<unknown> }
export interface ImageToolResult { kind: 'image'; dataUrl: string; metadata: Record<string, unknown> }
export interface AgentEvent { kind: 'model' | 'tool' | 'message' | 'limit' | 'error'; text: string }
export interface AgentResult { status: 'completed' | 'blocked' | 'failed' | 'cancelled' | 'paused-limit'; turns: number; calls: number; tokens: number; summary: string }
export interface AgentView extends AgentResult { taskId: string; running: boolean; events: AgentEvent[]; workspace: AgentWorkspaceState; changed: string[]; before: { id: string; source: string }[]; buildVerified: boolean }
export interface AgentPort {
  configure(key: string, model: string): Promise<{ configured: boolean; model: string } | { error: string }>;
  start(sessionId: string, objective: string, buffers: { id: string; source: string }[], includeDocuments?: boolean): Promise<{ taskId: string } | { error: string }>;
  status(taskId: string): Promise<AgentView | { error: string }>;
  cancel(taskId: string): Promise<{ ok: boolean } | { error: string }>;
  steer(taskId: string, instruction: string): Promise<{ ok: boolean } | { error: string }>;
  restore(taskId: string, buffers: { id: string; source: string }[], sessionId: string): Promise<AgentWorkspaceState | { error: string }>;
}
