import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseProject } from '../packages/workspace/src/project.ts';
import { SaveJournal, durableReplace } from '../apps/desktop/save-journal.ts';
import { saveBatch } from '../packages/workspace/src/save-batch.ts';

const root = process.argv[2]!, stop = Number(process.argv[3]);
const manifestBytes = await readFile(join(root, 'microide.project.json'));
const manifest = parseProject(JSON.parse(manifestBytes.toString('utf8')));
const journal = new SaveJournal(root, manifest, createHash('sha256').update(manifestBytes).digest('hex'));
const entries = await Promise.all(manifest.sources.map(async source => ({ id: source.id, path: source.path, before: await readFile(join(root, source.path)), after: Buffer.from(`10 REM NEW ${source.id}\n20 END\n`) })));
const pause = async () => { process.on('message', () => {}); process.send?.({ ready: true }); await new Promise(() => {}); };
await journal.prepare(entries);
if (stop === 0) await pause();
let count = 0;
await saveBatch(entries, {
  assertCurrent: async () => {},
  read: id => readFile(join(root, entries.find(item => item.id === id)!.path)),
  write: async (id, content) => { await durableReplace(join(root, entries.find(item => item.id === id)!.path), content, false); if (++count === stop) await pause(); },
});
throw new Error('Expected the parent to kill this original fixture before commit.');
