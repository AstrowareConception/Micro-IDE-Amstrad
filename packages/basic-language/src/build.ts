import { encodeBasicAscii } from '../../cpc-disk/src/basic-ascii.ts';
import { createDataDisk, readDataDisk } from '../../cpc-disk/src/data-disk.ts';
import { analyze } from './language.ts';

export function buildListingDisk(source: string): Uint8Array {
  const normalized = source.replace(/\r\n?/g, '\n');
  const diagnostics = analyze(normalized).diagnostics.filter(item => item.severity === 'error');
  if (diagnostics.length) throw new Error(diagnostics[0]!.message);
  // Blank editor lines are kept in the source and omitted only in the CPC artifact.
  const listing = normalized.split('\n').filter(line => line.trim())
    .map(line => line.trimStart().replace(/^(\d+)(?=[A-Za-z?'])/, '$1 ')).join('\n');
  const bytes = createDataDisk([{ name: 'MAIN.BAS', bytes: encodeBasicAscii(listing) }]);
  readDataDisk(bytes);
  return bytes;
}
