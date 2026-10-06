import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { SourceJournal } from '../apps/desktop/source-journal.ts';
// ProjectStore canonicalizes the project root; match its actual I/O paths on
// Windows (drive/directory casing) and when the launcher uses a root alias.
const root = await fs.promises.realpath(process.argv[2]!), stop = process.argv[3]!, action = process.argv[4]!;
const pause = async () => { process.on('message', () => {}); process.send?.({ ready: true }); await new Promise(() => {}); };
const prepare = SourceJournal.prototype.prepare;
SourceJournal.prototype.prepare = async function(...args) { const result = await prepare.apply(this, args); if (stop === 'prepared') await pause(); return result; };
const rename = fs.promises.rename;
fs.promises.rename = async (old, next) => {
  await rename(old, next);
  if (stop === 'destination' && String(next) === join(root, 'src/levels/main.bas') || stop === 'manifest' && String(next) === join(root, 'microide.project.json')) await pause();
  if (stop === 'undo-pending' && String(next) === join(root, '.microide/source-journal/current.json')) {
    const record = JSON.parse(await fs.promises.readFile(next, 'utf8')); if (record.phase === 'pending' && undoing) await pause();
  }
};
const unlink = fs.promises.unlink;
fs.promises.unlink = async path => { await unlink(path); if (stop === 'removed' && String(path) === join(root, 'src/main.bas')) await pause(); };
syncBuiltinESMExports();
const { ProjectStore } = await import('../apps/desktop/project-store.ts'); const { store, snapshot } = await ProjectStore.open(root);
let undoing = false;
const request = action.includes('delete') ? { action: 'delete', id: 'main', entryPoint: 'util' } : { action: 'move', id: 'main', path: 'src/levels/main.bas' };
const plan = await store.prepareSourceOperation(request); await store.applySourceOperation(plan.id, action.includes('delete') ? '10 REM ARCHIVED DRAFT\n20 END\n' : snapshot.files[0]!.source);
if (action === 'undo-delete') { undoing = true; await store.restoreSourceOperation((await store.lastSourceOperation())!.revision); }
throw new Error('Fixture boundary not reached: ' + stop);
