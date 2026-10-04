import { open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { DOCUMENT_LIMIT } from '../../packages/workspace/src/project.ts';

/** Bounded ordinary-file read; reject a replaced inode, symlink, FIFO or growth while reading. */
export async function readDocumentBytes(path: string): Promise<Buffer> {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > DOCUMENT_LIMIT) throw new Error('Document ordinaire de 1 Mio maximum requis.');
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const initial = await file.stat();
    if (!initial.isFile() || initial.dev !== before.dev || initial.ino !== before.ino || initial.size > DOCUMENT_LIMIT) throw new Error('Document remplacé pendant la lecture.');
    const buffer = Buffer.alloc(DOCUMENT_LIMIT + 1); let size = 0;
    while (size < buffer.length) {
      const chunk = await file.read(buffer, size, buffer.length - size, size);
      if (!chunk.bytesRead) break;
      size += chunk.bytesRead;
    }
    const final = await file.stat();
    if (size > DOCUMENT_LIMIT || initial.size !== size || final.size !== size || initial.mtimeMs !== final.mtimeMs || initial.ctimeMs !== final.ctimeMs) throw new Error('Document trop volumineux ou modifié pendant la lecture.');
    return buffer.subarray(0, size);
  } finally { await file.close(); }
}
export function decodeDocument(content: Uint8Array): string {
  const value = new TextDecoder('utf-8', { fatal: true }).decode(content);
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error('Document texte UTF-8 requis, sans contrôles binaires.');
  // Original bytes remain immutable; BOM removal and LF affect only the derived view.
  return value.replace(/\r\n?/g, '\n');
}
