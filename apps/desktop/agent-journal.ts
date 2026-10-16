import { WorkspaceJournal } from './workspace-journal.ts';
export type { AgentJournalSource } from './workspace-journal.ts';
/** Agent policy remains restricted to 64 KiB/source, 256 KiB/project and no rename. */
export class AgentJournal extends WorkspaceJournal {
  constructor(root: string) { super(root, 'agent'); }
  async last() { return this.undoStatus(); }
  async restoreLast(revision: string) { return this.undoLast(revision); }
}
