import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { durableReplace } from './save-journal.ts';
import type { RecentProject } from '../../packages/workspace/src/recent-projects.ts';

interface Entry { id: string; projectId: string; name: string; path: string; lastOpenedAt: string }
const LIMIT = 128 * 1024, COUNT = 20;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const pathKey = (path: string) => process.platform === 'win32' ? path.toLowerCase() : path;
function validText(value: unknown, limit: number): value is string { return typeof value === 'string' && !!value.trim() && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value); }
function parse(value: unknown): Entry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || Object.keys(input).length !== 2 || !Array.isArray(input.entries) || input.entries.length > COUNT) throw new Error();
  const entries = input.entries.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const entry = value as Record<string, unknown>;
    if (Object.keys(entry).length !== 5 || typeof entry.id !== 'string' || !UUID.test(entry.id) || typeof entry.projectId !== 'string' || !UUID.test(entry.projectId) ||
      !validText(entry.name, 100) || !validText(entry.path, 4096) || !isAbsolute(entry.path) || typeof entry.lastOpenedAt !== 'string' ||
      !Number.isFinite(Date.parse(entry.lastOpenedAt)) || new Date(entry.lastOpenedAt).toISOString() !== entry.lastOpenedAt) throw new Error();
    return { id: entry.id, projectId: entry.projectId, name: entry.name, path: entry.path, lastOpenedAt: entry.lastOpenedAt };
  });
  if (new Set(entries.map(entry => entry.id)).size !== entries.length || new Set(entries.map(entry => pathKey(entry.path))).size !== entries.length) throw new Error();
  return entries;
}
/** Main-owned private registry. Renderer requests use opaque IDs, never arbitrary folders. */
export class RecentProjectsStore {
  private readonly userData: string;
  constructor(userData: string) { this.userData = userData; }
  private async read(): Promise<Entry[]> {
    const root = await lstat(this.userData);
    if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('Profil des projets récents inaccessible ; liste conservée.');
    let stat; const path = join(this.userData, 'recent-projects.json');
    try { stat = await lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw new Error('Projets récents inaccessibles ; liste conservée.'); }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > LIMIT) throw new Error('Registre des projets récents invalide ; liste conservée.');
    try { const bytes = await readFile(path); if (bytes.length > LIMIT) throw new Error(); return parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); }
    catch { throw new Error('Registre des projets récents invalide ou version inconnue ; liste conservée.'); }
  }
  private async write(entries: Entry[]): Promise<void> {
    const bytes = Buffer.from(JSON.stringify({ version: 1, entries }) + '\n');
    if (bytes.length > LIMIT) throw new Error('Liste des projets récents trop volumineuse ; ancienne liste conservée.');
    await durableReplace(join(this.userData, 'recent-projects.json'), bytes);
  }
  async remember(root: string, projectId: string, name: string): Promise<void> {
    const entries = await this.read(), path = await realpath(root);
    if (!UUID.test(projectId) || !validText(name, 100) || !validText(path, 4096)) throw new Error('Projet non mémorisable dans la liste récente.');
    const existing = entries.find(entry => pathKey(entry.path) === pathKey(path));
    await this.write([{ id: existing?.id ?? randomUUID(), projectId, name, path, lastOpenedAt: new Date().toISOString() }, ...entries.filter(entry => pathKey(entry.path) !== pathKey(path))].slice(0, COUNT));
  }
  async get(id: unknown): Promise<Entry> {
    if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Identifiant de projet récent requis.');
    const entry = (await this.read()).find(entry => entry.id === id);
    if (!entry) throw new Error('Projet récent oublié ou inconnu ; choisissez son dossier avec Ouvrir projet.');
    return entry;
  }
  async list(): Promise<RecentProject[]> {
    const entries = await this.read();
    return Promise.all(entries.map(async entry => {
      let available = false;
      try { const folder = await lstat(entry.path), manifest = await lstat(join(entry.path, 'microide.project.json')); available = folder.isDirectory() && !folder.isSymbolicLink() && manifest.isFile() && !manifest.isSymbolicLink() && manifest.size <= 1024 * 1024; } catch { /* Missing, moved or inaccessible entries remain removable. */ }
      return { id: entry.id, name: entry.name, path: entry.path, lastOpenedAt: entry.lastOpenedAt, available };
    }));
  }
  async remove(id: unknown): Promise<RecentProject[]> { const entry = await this.get(id); const entries = await this.read(); await this.write(entries.filter(item => item.id !== entry.id)); return this.list(); }
  async clear(): Promise<RecentProject[]> { await this.read(); await this.write([]); return []; }
}
