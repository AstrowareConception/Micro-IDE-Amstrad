import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DISTRIBUTION = /(?:\.exe|\.AppImage|\.deb)$/i;

export function distributionArtifacts(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && DISTRIBUTION.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en'));
}

export function writeChecksums(directory, outputName = 'SHA256SUMS.txt') {
  const root = resolve(directory);
  const artifacts = distributionArtifacts(root);
  if (!artifacts.length) throw new Error('Aucun artefact de distribution à signer par checksum.');
  const lines = artifacts.map(name => {
    const digest = createHash('sha256').update(readFileSync(resolve(root, name))).digest('hex');
    return `${digest}  ${basename(name)}`;
  });
  const output = resolve(root, outputName);
  writeFileSync(output, lines.join('\n') + '\n', 'utf8');
  return { output, artifacts, lines };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = writeChecksums(process.argv[2] ?? 'release', process.argv[3] ?? 'SHA256SUMS.txt');
    console.log(`Checksums écrits pour ${result.artifacts.length} artefact(s) dans ${result.output}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
