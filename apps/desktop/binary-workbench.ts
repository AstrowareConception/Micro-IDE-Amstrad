import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { ProjectStore } from './project-store.ts';
import { durableReplace } from './save-journal.ts';
import { inspectCpcFile } from '../../packages/cpc-disk/src/import-disk.ts';
import { reassemblableListing } from '../../packages/z80/src/assemble.ts';
import { validateRegions, patchRegions, type BinaryAnalysis, type BinaryFileView, type BinaryComparison } from '../../packages/z80/src/workbench.ts';
import { buildProjectDisk } from '../../packages/workspace/src/project.ts';
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** Project-owned analysis, optimistic revision checks, original assets never overwritten. */
export class BinaryWorkbench {
  private readonly store: ProjectStore;
  constructor(store: ProjectStore) { this.store = store; }
  private get path() { return join(this.store.root, 'binary-z80.json'); }
  private async record(): Promise<Buffer | undefined> {
    try {
      const stat = await lstat(this.path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw Error('Analyse ordinaire de 1 Mio maximum requise.');
      const bytes = await readFile(this.path); if (bytes.length > 1024 * 1024) throw Error('Analyse trop volumineuse.'); return bytes;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  }
  async load(): Promise<BinaryAnalysis> {
    await this.store.assertCurrent(); await this.store.readAssets();
    const record = await this.record(); if (!record) return { revision: null, regions: [] };
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(record));
    if (!value || value.version !== 1 || value.projectId !== this.store.manifest.projectId || Object.keys(value).sort().join(',') !== 'projectId,regions,version') throw Error('Analyse incompatible avec ce projet.');
    return { revision: sha(record), regions: validateRegions(value.regions, this.store.manifest.assets) };
  }
  private async asset(id: string) {
    const item = this.store.manifest.assets.find(item => item.id === id);
    const data = (await this.store.readAssets()).find(item => item.id === id);
    if (!item || !data) throw Error('Ressource non déclarée.');
    const view = inspectCpcFile(item.cpcName, data.bytes, id);
    const base = view.payloadBytes === undefined ? 0 : 128;
    return { item, bytes: data.bytes, view, base, length: view.payloadBytes ?? data.bytes.length };
  }
  async inspect(id: string): Promise<BinaryFileView> {
    const { item, bytes, view, base, length } = await this.asset(id);
    const hex = [...bytes.subarray(base, base + Math.min(length, 256))].reduce((lines, byte, i) => lines + (i % 16 === 0 ? `\n${i.toString(16).padStart(4, '0')}: ` : '') + byte.toString(16).padStart(2, '0') + ' ', '').trim();
    return { id, name: item.cpcName, sha256: item.sha256, size: bytes.length, payloadBytes: length, hex,
      ...(view.loadAddress === undefined ? {} : { loadAddress: view.loadAddress }), ...(view.entryAddress === undefined ? {} : { entryAddress: view.entryAddress }) };
  }
  async generate(id: string, offset: number, length: number, origin: number, kind: 'code' | 'data') {
    const asset = await this.asset(id);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(length) || length < 1 || length > 16384 || offset + length > asset.length || !Number.isInteger(origin) || origin < 0 || origin + length > 65536 || !['code','data'].includes(kind)) throw Error('Plage ou origine invalide.');
    return { listing: reassemblableListing(asset.bytes.subarray(asset.base + offset, asset.base + offset + length), origin, kind === 'code') };
  }
  async save(revision: unknown, regions: unknown): Promise<BinaryAnalysis> {
    const current = await this.load(); if (current.revision !== revision) throw Error('Analyse modifiée ailleurs : rouvrez l’atelier avant de sauvegarder.');
    const checked = validateRegions(regions, this.store.manifest.assets);
    // Invalid/in-progress assembly can be saved as a draft, but never exported.
    for (const region of checked) { const asset = await this.asset(region.assetId); if (region.offset + region.length > asset.length) throw Error('Zone hors charge utile.'); }
    const bytes = Buffer.from(JSON.stringify({ version: 1, projectId: this.store.manifest.projectId, regions: checked }, null, 2) + '\n');
    if (bytes.length > 1024 * 1024) throw Error('Analyse trop volumineuse.');
    const again = await this.record(); if ((again ? sha(again) : null) !== revision) throw Error('Analyse périmée.');
    await this.store.assertCurrent(); await durableReplace(this.path, bytes);
    return { revision: sha(bytes), regions: checked };
  }
  async compile(revision: unknown) {
    const analysis = await this.load(); if (analysis.revision !== revision) throw Error('Analyse périmée ; rechargez.');
    const assets = await this.store.readAssets(); let changedBytes = 0; const changes: BinaryComparison['changes'] = [];
    for (const asset of assets) {
      const source = await this.asset(asset.id);
      const result = patchRegions(asset.bytes, source.base, source.length, analysis.regions.filter(region => region.assetId === asset.id));
      for (const region of analysis.regions.filter(region => region.assetId === asset.id)) {
        for (let i = 0; i < region.length && changes.length < 128; i++) {
          const position = source.base + region.offset + i;
          if (asset.bytes[position] !== result.bytes[position]) changes.push({ assetId: asset.id, offset: region.offset + i, address: region.origin + i, before: asset.bytes[position]!, after: result.bytes[position]! });
        }
      }
      asset.bytes = result.bytes; changedBytes += result.changedBytes;
    }
    return { assets, changedBytes, regions: analysis.regions.length, changes, truncated: changedBytes > changes.length };
  }
  async disk(revision: unknown) {
    if (this.store.manifest.kind !== 'binary') throw Error('Export assembleur réservé aux projets binaires ; sources BASIC inchangées.');
    const compiled = await this.compile(revision);
    return { disk: buildProjectDisk(this.store.manifest, [], compiled.assets), changedBytes: compiled.changedBytes };
  }
}
