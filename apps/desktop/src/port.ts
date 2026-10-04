import { buildListingDisk } from '../../../packages/basic-language/src/build.ts';
import type { ProjectManifest, ProjectSnapshot, DocumentSnapshot } from '../../../packages/workspace/src/project.ts';
import type { AgentPort } from '../../../packages/agent/src/types.ts';
import type { FirmwarePort } from '../../../packages/emulator/src/firmware.ts';
import type { VersionControlPort } from '../../../packages/version-control/src/inspection.ts';
import type { TerminalPort } from '../../../packages/workspace/src/terminal.ts';
export interface FileResult { name: string; source?: string }
export interface Failure { error: string }
export interface DesktopPort {
  open(): Promise<FileResult | Failure | null>;
  save(source: string, saveAs?: boolean): Promise<FileResult | Failure | null>;
  exportDisk(source: string): Promise<FileResult | Failure | null>;
  setDirty(dirty: boolean): void;
  agent?: AgentPort;
  firmware?: FirmwarePort;
  git?: VersionControlPort;
  terminal?: TerminalPort;
  project?: {
    open(): Promise<ProjectSnapshot | Failure | null>;
    create(name: string): Promise<ProjectSnapshot | Failure | null>;
    save(sessionId: string, id: string, source: string): Promise<FileResult | Failure | null>;
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
