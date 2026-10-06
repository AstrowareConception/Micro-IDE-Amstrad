import { lstat, realpath, opendir, open } from 'node:fs/promises';
import { constants, type Stats } from 'node:fs';
import { join, relative, isAbsolute, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { EXPLORER_ENTRY_LIMIT, EXPLORER_PREVIEW_LIMIT, hiddenExplorerName, explorerPath, type ExplorerEntry, type ExplorerListing, type ExplorerPreview } from '../../packages/workspace/src/explorer.ts';
import type { ProjectStore } from './project-store.ts';

function revision(stat: Stats): string { return createHash('sha256').update([stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeMs, stat.ctimeMs].join(':')).digest('hex'); }
/** Bounded, read-only adapter; never grants this capability to the agent. */
export class ProjectExplorer {
  private readonly store: ProjectStore;
  constructor(store: ProjectStore) { this.store = store; }
  private async resolve(value: unknown, directory = false): Promise<string> {
    const path = explorerPath(value, directory);
    let target = this.store.root;
    if (!(await lstat(target)).isDirectory() || (await lstat(target)).isSymbolicLink()) throw new Error('Dossier du projet remplacé ; rouvrez le projet.');
    for (const part of path ? path.split('/') : []) {
      target = join(target, part);
      if ((await lstat(target)).isSymbolicLink()) throw new Error('Lien symbolique ou jonction : navigation refusée.');
    }
    const location = relative(this.store.root, await realpath(target));
    if (location === '..' || location.startsWith('../') || location.startsWith('..\\') || isAbsolute(location)) throw new Error('Chemin sortant du projet refusé.');
    return target;
  }
  async list(value: unknown, showHidden: unknown): Promise<ExplorerListing> {
    if (typeof showHidden !== 'boolean') throw new Error('Option de visibilité invalide.');
    await this.store.assertCurrent();
    const directory = explorerPath(value, true), target = await this.resolve(directory, true);
    if (!(await lstat(target)).isDirectory()) throw new Error('Dossier ordinaire requis.');
    const entries: ExplorerEntry[] = []; let hiddenCount = 0, scanned = 0, complete = true;
    // opendir avoids allocating an unbounded array for very large folders.
    const handle = await opendir(target);
    for await (const item of handle) {
      if (++scanned > 2000 || entries.length >= EXPLORER_ENTRY_LIMIT) { complete = false; break; }
      if (!showHidden && hiddenExplorerName(item.name)) { hiddenCount++; continue; }
      if (/[\\\x00-\x1f\x7f:]/.test(item.name)) { complete = false; continue; }
      const path = directory ? `${directory}/${item.name}` : item.name;
      if (path.length > 1024) { complete = false; continue; }
      let stat: Stats;
      try { stat = await lstat(join(target, item.name)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { complete = false; continue; } throw error; }
      const source = this.store.manifest.sources.find(source => source.path === path);
      const document = this.store.manifest.documents.find(document => document.path === path);
      entries.push({ path, name: basename(path), kind: stat.isSymbolicLink() ? 'link' : stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other',
        role: source ? 'source' : document ? 'document' : path === 'microide.project.json' ? 'manifest' : 'ordinary',
        ...(source ? { sourceId: source.id } : {}), ...(document ? { documentId: document.id } : {}), bytes: stat.size, revision: revision(stat) });
    }
    await this.resolve(directory, true); await this.store.assertCurrent();
    entries.sort((a, b) => Number(b.kind === 'directory') - Number(a.kind === 'directory') || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return { directory, entries, complete, hiddenCount };
  }
  async preview(value: unknown, expected: unknown): Promise<ExplorerPreview> {
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Révision du fichier requise.');
    await this.store.assertCurrent();
    const path = explorerPath(value), target = await this.resolve(path), stat = await lstat(target);
    if (!stat.isFile()) throw new Error('Aperçu réservé aux fichiers ordinaires.');
    if (revision(stat) !== expected) throw new Error('Fichier modifié depuis l’affichage ; actualisez l’explorateur.');
    if (this.store.manifest.sources.some(source => source.path === path) || this.store.manifest.documents.some(document => document.path === path)) throw new Error('Ouvrez cette source ou ce document dans sa vue dédiée.');
    const metadata = { path, bytes: stat.size };
    if (stat.size > EXPLORER_PREVIEW_LIMIT) return { ...metadata, notice: 'Aperçu texte limité à 64 Kio ; fichier conservé, contenu non chargé.' };
    // No unbounded read and no following of a final symlink introduced after lstat.
    const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let content: Buffer;
    try {
      if (revision(await handle.stat()) !== expected) throw new Error('Fichier remplacé ; actualisez l’explorateur.');
      const buffer = Buffer.alloc(EXPLORER_PREVIEW_LIMIT + 1); let length = 0;
      while (length < buffer.length) { const result = await handle.read(buffer, length, buffer.length - length, null); if (!result.bytesRead) break; length += result.bytesRead; }
      if (length > EXPLORER_PREVIEW_LIMIT || revision(await handle.stat()) !== expected) throw new Error('Fichier modifié pendant la lecture ; actualisez l’explorateur.');
      content = buffer.subarray(0, length);
    } finally { await handle.close(); }
    if (revision(await lstat(await this.resolve(path))) !== expected) throw new Error('Fichier remplacé pendant la lecture ; actualisez l’explorateur.');
    await this.store.assertCurrent();
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new Error('binary');
      return { ...metadata, text, notice: 'Lecture seule · fichier hors des sources CPC · aucun ajout au DSK.' };
    } catch { return { ...metadata, notice: 'Format binaire ou encodage non UTF-8 ; contenu non affiché.' }; }
  }
}
