import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

const directory = resolve(process.argv[2] ?? 'release');
const entries = await readdir(directory, { withFileTypes: true });
const names = entries
  .filter(entry => entry.isFile() && (entry.name.endsWith('.exe') || entry.name.endsWith('.AppImage') || entry.name.endsWith('.deb')))
  .map(entry => entry.name)
  .sort((a, b) => a.localeCompare(b));

if (!names.length) throw new Error('Aucun artefact de release trouvé pour calculer les checksums.');

const lines = [];
for (const name of names) {
  const bytes = await readFile(resolve(directory, name));
  lines.push(`${createHash('sha256').update(bytes).digest('hex')}  ${basename(name)}`);
}
await writeFile(resolve(directory, 'SHA256SUMS.txt'), lines.join('\n') + '\n', 'utf8');
console.log(lines.join('\n'));
