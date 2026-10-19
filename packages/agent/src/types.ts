import type { ProjectManifest, SourceSnapshot } from '../../workspace/src/project.ts';
export interface AgentFile extends SourceSnapshot { saved: string }
export interface AgentWorkspaceState { sessionId: string; manifest: ProjectManifest; files: AgentFile[]; binaryAnalysis?: import('../../z80/src/workbench.ts').BinaryAnalysis; assets?: import('../../workspace/src/project.ts').AssetSnapshot[] }
export interface ToolDefinition { type: 'function'; name: string; description: string; strict: true; parameters: Record<string, unknown> }
export interface TokenUsage { input: number; output: number; cached: number; cacheWrite: number; reasoning: number; complete: boolean }
export interface ModelTurn { output: Record<string, unknown>[]; tokens: number; usage?: TokenUsage | undefined; model?: string | undefined; serviceTier?: string | undefined; incomplete?: boolean }
export interface ModelPort { respond(input: Record<string, unknown>[], tools: ToolDefinition[], signal: AbortSignal): Promise<ModelTurn> }
export interface ToolPort { definitions: ToolDefinition[]; execute(name: string, args: unknown): Promise<unknown> }
export interface ImageToolResult { kind: 'image'; dataUrl: string; metadata: Record<string, unknown> }
export interface AgentBudget { maxTurns: number; maxCalls: number; maxTokens: number }
export interface PricingProfile { model: string; billedModels?: string[]; input: number; cached: number; output: number; cacheWriteMultiplier: number; longContext?: { threshold: number; inputMultiplier: number; outputMultiplier: number }; fetchedAt: string; source: string }
export interface AgentEvent { kind: 'model' | 'tool' | 'tool-result' | 'message' | 'limit' | 'error'; text: string; tool?: string; success?: boolean }
export interface AgentResult { status: 'completed' | 'blocked' | 'failed' | 'cancelled' | 'paused-limit'; turns: number; calls: number; tokens: number; summary: string; usage?: TokenUsage | undefined; failedCalls?: number; estimatedUsd?: number; costComplete?: boolean }
export interface AgentExtractionSimulation {
 previewId:string;status:'preview'|'applied'|'obsolete'|'failed';
 profile:string;sourceId:string;entryLine:number;gotoLine:number;createdPath:string;createdCpcName:string;movedLines:number;
 beforeMain:string;afterMain:string;newPart:string;
 originalDiskSha256:string;proposedDiskSha256:string;originalSourceSha256:string;newMainSha256:string;newPartSha256:string;
 checks:string[];warnings:string[];
}
export interface AgentExtractionSimulationView {stale:boolean;record:AgentExtractionSimulation}
export interface AgentOverlayReviewRecord { stale:boolean; report:import('../../basic-language/src/chain-merge-overlay.ts').ChainMergeOverlayReport }
export interface AgentLoadContractRecord { stale:boolean; report:import('../../basic-language/src/load-contract.ts').LoadContractReport }
export interface AgentModuleReviewRecord { sourceId:string; sourceSha256:string; stale:boolean; review:import('../../basic-language/src/module-review.ts').BasicModuleReview }
export interface AgentCommentRecord {
 previewId:string; fileId:string; path:string; status:'preview'|'applied'|'obsolete';
 comment:string; basicLine:number; beforeBasicLine:number;
 warnings:string[]; before:string; after:string; truncated:boolean;
}
export interface AgentFormatRecord {
 previewId:string; fileId:string; path:string; status:'preview'|'applied'|'obsolete';
 changedLines:number; skipped:number; warnings:string[]; before:string; after:string; truncated:boolean;
 beforeMetrics:import('../../basic-language/src/quality.ts').QualityMetrics|null;
 afterMetrics:import('../../basic-language/src/quality.ts').QualityMetrics|null;
}
export interface AgentRenameRecord { previewId:string; fileId:string; path:string; kind:string; originalName:string; newName:string; occurrences:number; status:'preview'|'applied'|'obsolete'; warnings:string[]; before:string; after:string; truncated:boolean }
export interface AgentView extends AgentResult { projectTestRuns?: import('./project-tests.ts').AgentProjectTestRun[]; projectTestAssessment?: import('./project-tests.ts').ProjectTestAssessment | undefined; testRuns?: import('./basic-tests.ts').AgentTestRun[]; testCoverage?: import('./basic-tests.ts').AgentTestCoverage | undefined; renameOperations?: AgentRenameRecord[]; formatOperations?: AgentFormatRecord[]; commentOperations?: AgentCommentRecord[]; moduleReviews?: AgentModuleReviewRecord[]; loadContracts?: AgentLoadContractRecord[]; overlayReviews?: AgentOverlayReviewRecord[]; extractionSimulations?: AgentExtractionSimulationView[]; taskId: string; running: boolean; events: AgentEvent[]; workspace: AgentWorkspaceState; changed: string[]; documentChanges?: {id:string;title:string;created:boolean;before?:string;after:string;truncated:boolean}[]; before: { id: string; source: string }[]; binaryBefore?: import('../../z80/src/workbench.ts').BinaryAnalysis; buildVerified: boolean; model?: string | undefined; budget?: AgentBudget; pricing?: PricingProfile | undefined; resumable?: boolean }
export interface OpenAIModel { id: string; created: number; owner: string; shutdownDate?: string }
export interface ModelCatalog { models: OpenAIModel[]; fetchedAt: string; model: string }
export interface AgentPort {
  models(key?: string): Promise<ModelCatalog | { error: string }>;
  selectModel(model: string): Promise<{ model: string } | { error: string }>;
  pricing?(model: string): Promise<PricingProfile | { error: string }>;
  configure(key: string, model: string): Promise<{ configured: boolean; model: string } | { error: string }>;
  start(sessionId: string, objective: string, buffers: { id: string; source: string }[], includeDocuments?: boolean, budget?: AgentBudget): Promise<{ taskId: string } | { error: string }>;
  resume?(taskId: string, buffers: { id: string; source: string }[], sessionId: string): Promise<{ taskId: string } | { error: string }>;
  status(taskId: string): Promise<AgentView | { error: string }>;
  cancel(taskId: string): Promise<{ ok: boolean } | { error: string }>;
  steer(taskId: string, instruction: string): Promise<{ ok: boolean } | { error: string }>;
  restore(taskId: string, buffers: { id: string; source: string }[], sessionId: string): Promise<AgentWorkspaceState | { error: string }>;
}
