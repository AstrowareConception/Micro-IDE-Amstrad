import { WorkspaceJournal } from './workspace-journal.ts';
export type { AgentJournalSource as SourceJournalFile } from './workspace-journal.ts';
/** Human source operations have their own durable record and recovery. */
export class SourceJournal extends WorkspaceJournal {
  constructor(root: string) { super(root, 'source'); }
  async last() { return this.undoStatus(); }
  async restoreLast(revision: string) { return this.undoLast(revision); }
  async draft(projectId: string) { return this.readDraft(projectId); }
}
