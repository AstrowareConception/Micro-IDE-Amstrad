import type { BasicTestSuitesPort } from '../../../packages/emulator/src/basic-test-suites.ts';
import type { RecentProjectsPort } from '../../../packages/workspace/src/recent-projects.ts';
import type { ExplorerPort } from '../../../packages/workspace/src/explorer.ts';
import type { SourceOperationsPort } from '../../../packages/workspace/src/source-operations.ts';
import type { GitOperationsPort, GitHubPort } from '../../../packages/version-control/src/operations.ts';
import { feedbackReport, type FeedbackInput } from '../feedback.ts';
import { buildListingDisk } from '../../../packages/basic-language/src/build.ts';
import type { ProjectManifest, ProjectSnapshot, DocumentSnapshot } from '../../../packages/workspace/src/project.ts';
import type { AgentPort } from '../../../packages/agent/src/types.ts';
import type { EmulatorPort } from '../../../packages/emulator/src/run.ts';
import type { FirmwarePort } from '../../../packages/emulator/src/firmware.ts';
import type { VersionControlPort } from '../../../packages/version-control/src/inspection.ts';
import type { TerminalPort } from '../../../packages/workspace/src/terminal.ts';
import type { HistoryPort } from '../../../packages/workspace/src/history.ts';
import type { DraftPort } from '../../../packages/workspace/src/drafts.ts';
import type { ExternalPort } from '../../../packages/workspace/src/external.ts';
import type { DiskImportPreview, DiskImportRequest } from '../../../packages/cpc-disk/src/import-disk.ts';
export interface FileResult { name: string; source?: string }
export interface Failure { error: string }
export interface DesktopPort {
  knowledge?: import('../../../packages/workspace/src/knowledge.ts').KnowledgePort;
  open(): Promise<FileResult | Failure | null>;
  save(source: string, saveAs?: boolean): Promise<FileResult | Failure | null>;
  exportDisk(source: string): Promise<FileResult | Failure | null>;
  setDirty(dirty: boolean): void;
  distribution?: { export(request: { sessionId?: string | undefined; sources: { id: string; source: string }[]; options: import('../../../packages/cpc-disk/src/distribution.ts').DistributionOptions }): Promise<FileResult | Failure | null> };
  diskImport?: {
    inspect(): Promise<DiskImportPreview | Failure | null>;
    inspectFile?(): Promise<DiskImportPreview | Failure | null>;
    disassemble?(request:{id:string;fileId:string;offset:number;length:number;origin:number}):Promise<{listing:string}|Failure>;
    extract?(request:{id:string;fileId:string;listing?:string}):Promise<FileResult|Failure|null>;
    create(request: DiskImportRequest): Promise<ProjectSnapshot | Failure | null>;
  };
  binary?: import('../../../packages/z80/src/workbench.ts').BinaryWorkbenchPort;
  feedback?: { open(input: FeedbackInput): Promise<{ url: string; prefilled: boolean } | Failure> };
  agent?: AgentPort;
  firmware?: FirmwarePort;
  emulator?: EmulatorPort;
  git?: VersionControlPort;
  gitOperations?: GitOperationsPort & { clone(url: string, name: string): Promise<ProjectSnapshot | Failure | null> };
  github?: GitHubPort;
  terminal?: TerminalPort;
  history?: HistoryPort;
  drafts?: DraftPort;
  external?: ExternalPort;
  recentProjects?: RecentProjectsPort;
  explorer?: ExplorerPort;
  sourceOperations?: SourceOperationsPort;
  agentMutations?: {
    last(sessionId:string):Promise<import('../../../packages/workspace/src/source-operations.ts').SourceUndo|Failure|undefined>;
    restore(sessionId:string,revision:string,buffers:{id:string;source:string}[]):Promise<import('../../../packages/agent/src/types.ts').AgentWorkspaceState|Failure|null>;
  };
  basicTestSuites?: BasicTestSuitesPort;
  project?: {
    open(): Promise<ProjectSnapshot | Failure | null>;
    create(name: string): Promise<ProjectSnapshot | Failure | null>;
    save(sessionId: string, id: string, source: string): Promise<FileResult | Failure | null>;
    saveAll(sessionId: string, sources: { id: string; source: string }[]): Promise<{ name: string; savedIds: string[]; changedCount: number } | Failure>;
    add(sessionId: string, name: string): Promise<ProjectSnapshot | Failure | null>;
    setEntry(sessionId: string, id: string): Promise<ProjectManifest | Failure | null>;
    exportDisk(sessionId: string, sources: { id: string; source: string }[]): Promise<FileResult | Failure | null>;
    importDocument(sessionId: string, kind?: 'text' | 'image' | 'pdf'): Promise<ProjectManifest | Failure | null>;
    readDocument(sessionId: string, id: string): Promise<DocumentSnapshot | Failure>;
  };
}
declare global { interface Window { desktop?: DesktopPort } }

function download(name: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Preview adapter only: browsers cannot persist a native document handle. */
const preview: DesktopPort = {
  feedback: { open: async input => { const report = feedbackReport(input); window.open(report.url, '_blank', 'noopener,noreferrer'); return report; } },
  open: () => new Promise(resolve => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.bas,.txt';
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (file.size > 1024 * 1024) { resolve({ error: 'Listing supérieur à 1 Mio.' }); return; }
      try {
        const source = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/\r\n?/g, '\n');
        if (source.includes('\0')) throw new Error('Listing UTF-8 requis.');
        resolve({ name: file.name, source });
      } catch { resolve({ error: 'Listing texte UTF-8 requis.' }); }
    }, { once: true });
    input.click();
  }),
  save: async source => { download('MAIN.bas', new TextEncoder().encode(source)); return { name: 'MAIN.bas' }; },
  exportDisk: async source => { download('program.dsk', buildListingDisk(source)); return { name: 'program.dsk' }; },
  setDirty: () => undefined,
};
export const files = window.desktop ?? preview;
