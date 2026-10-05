import { lstat, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { gitIdentity, type GitIdentitySnapshot } from '../../packages/version-control/src/inspection.ts';
import { durableReplace, syncDirectory } from './save-journal.ts';

const LIMIT = 4096;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** A private application preference, never a repository/global Git configuration. */
export class GitIdentityStore {
  private mutating = false;
  private readonly userData: string;
  constructor(userData: string) { this.userData = userData; }
  private async folder(create = false): Promise<string | undefined> {
    const root = await lstat(this.userData);
    if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('Dossier de profil Git ordinaire requis.');
    const path = join(this.userData, 'git-profile');
    let stat;
    try { stat = await lstat(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Profil Git inaccessible.');
      if (!create) return undefined;
      await mkdir(path, { mode: 0o700 }); await syncDirectory(this.userData); stat = await lstat(path);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Lien de profil Git refusé ; données conservées.');
    return path;
  }
  private async read(): Promise<GitIdentitySnapshot> {
    const folder = await this.folder(); if (!folder) return { revision: null, identity: null };
    const path = join(folder, 'identity.json'); let stat;
    try { stat = await lstat(path); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { revision: null, identity: null }; throw new Error('Profil Git inaccessible.'); }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > LIMIT) throw new Error('Profil Git ordinaire de 4 Kio maximum requis ; données conservées.');
    const bytes = await readFile(path);
    try {
      if (bytes.length > LIMIT || bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error();
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3 || !['version', 'id', 'identity'].every(key => Object.hasOwn(value, key))) throw new Error();
      const record = value as Record<string, unknown>;
      if (record.version !== 1 || typeof record.id !== 'string' || !UUID.test(record.id)) throw new Error();
      const identity = record.identity === null ? null : gitIdentity(record.identity);
      if (identity && identity.name !== (record.identity as Record<string, unknown>).name) throw new Error();
      return { revision: digest(bytes), identity };
    } catch { throw new Error('Profil Git invalide ou version inconnue ; données conservées.'); }
  }
  async status(): Promise<GitIdentitySnapshot> {
    try { return await this.read(); }
    catch (error) {
      if (error instanceof Error && /^(Profil Git|Lien de profil|Dossier de profil)/.test(error.message)) throw error;
      throw new Error('Profil Git inaccessible ; données conservées.');
    }
  }
  private async replace(revision: unknown, identity: GitIdentitySnapshot['identity']): Promise<GitIdentitySnapshot> {
    if (revision !== null && (typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision))) throw new Error('Révision du profil Git requise.');
    if (this.mutating) throw new Error('Mise à jour du profil Git déjà en cours.');
    this.mutating = true;
    try {
      if ((await this.status()).revision !== revision) throw new Error('Profil Git modifié depuis sa lecture ; rechargez l’identité.');
      const folder = (await this.folder(true))!;
      if ((await this.status()).revision !== revision) throw new Error('Profil Git modifié depuis sa lecture ; rechargez l’identité.');
      const bytes = Buffer.from(JSON.stringify({ version: 1, id: randomUUID(), identity }) + '\n');
      await durableReplace(join(folder, 'identity.json'), bytes);
      const result = await this.status();
      if (result.revision !== digest(bytes)) throw new Error('Profil Git modifié après publication.');
      return result;
    } catch (error) {
      // No host path, filesystem stderr or identity is included in adapter failures.
      if (error instanceof Error && /^(Profil Git|Lien de profil|Dossier de profil|Révision du profil)/.test(error.message)) throw error;
      throw new Error('Résultat de mémorisation non confirmé ; rechargez l’identité avant de reprendre.');
    } finally { this.mutating = false; }
  }
  async remember(revision: unknown, value: unknown): Promise<GitIdentitySnapshot> { return this.replace(revision, gitIdentity(value)); }
  async forget(revision: unknown): Promise<GitIdentitySnapshot> { return this.replace(revision, null); }
}
