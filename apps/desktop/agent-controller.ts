import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { runAgent } from '../../packages/agent/src/runner.ts';
import { WorkspaceTools } from '../../packages/agent/src/workspace-tools.ts';
import type { AgentEvent, AgentResult, AgentView, AgentWorkspaceState, ModelCatalog } from '../../packages/agent/src/types.ts';
import { OpenAIProvider, DEFAULT_MODEL } from './openai-provider.ts';
import type { ProjectStore } from './project-store.ts';

const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
interface Job { id: string; store: ProjectStore; initial: AgentWorkspaceState; tools: WorkspaceTools; result: AgentResult; running: boolean; events: AgentEvent[]; steering: string[]; abort: AbortController; directory: string; documentIds: string[] }
export class AgentController {
  private provider: OpenAIProvider | undefined;
  private job: Job | undefined;
  private readonly storage: string;
  private readonly corpusRoot: string;
  private catalog: ModelCatalog | undefined;
  private configurationRevision = 0;
  private selectionRequired = false;
  private readonly transport: typeof fetch | undefined;
  constructor(storage: string, corpusRoot: string, transport?: typeof fetch) { this.storage = storage; this.corpusRoot = corpusRoot; this.transport = transport; }
  get running(): boolean { return this.job?.running ?? false; }
  async suggestCommit(diff: string): Promise<{ message: string; model: string }> {
    if (this.running || this.selectionRequired || !this.provider) throw new Error('Configurez la clé et choisissez un modèle OpenAI dans le panneau IA avant cette suggestion.');
    const provider = this.provider;
    return { message: await provider.suggestCommit(diff), model: provider.model };
  }
  configure(key: unknown, model: unknown): { configured: boolean; model: string } {
    if (this.running) throw new Error('Arrêtez la mission avant de changer la configuration.');
    if (key === '') { this.provider = undefined; this.catalog = undefined; this.selectionRequired = false; this.configurationRevision++; return { configured: false, model: DEFAULT_MODEL }; }
    if (typeof key !== 'string' || typeof model !== 'string') throw new Error('Configuration invalide.');
    this.provider = new OpenAIProvider(key, model, this.transport ?? fetch); this.catalog = undefined; this.selectionRequired = false; this.configurationRevision++; return { configured: true, model };
  }
  async models(key?: unknown): Promise<ModelCatalog> {
    if (this.running) throw new Error('Arrêtez la mission avant d’actualiser les modèles.');
    if (key !== undefined && typeof key !== 'string') throw new Error('Clé invalide.');
    const revision = this.configurationRevision;
    const candidate = key === undefined ? this.provider : new OpenAIProvider(key as string, DEFAULT_MODEL, this.transport ?? fetch);
    if (!candidate) throw new Error('Configurez une clé OpenAI pour charger les modèles.');
    const models = await candidate.listModels();
    if (this.running || revision !== this.configurationRevision) throw new Error('Configuration modifiée pendant la lecture ; réessayez.');
    if (key !== undefined) { this.provider = candidate; this.selectionRequired = true; this.configurationRevision++; }
    this.catalog = { models, fetchedAt: new Date().toISOString(), model: this.selectionRequired ? '' : candidate.model };
    return structuredClone(this.catalog);
  }
  selectModel(model: unknown): { model: string } {
    if (this.running) throw new Error('Arrêtez la mission avant de changer de modèle.');
    if (typeof model !== 'string' || !this.provider || !this.catalog?.models.some(item => item.id === model)) throw new Error('Choisissez un modèle dans la liste OpenAI actualisée.');
    this.provider = this.provider.withModel(model); this.catalog.model = model; this.selectionRequired = false; this.configurationRevision++;
    return { model };
  }
  private async corpus() {
    const catalog = JSON.parse(await readFile(join(this.corpusRoot, 'catalog.json'), 'utf8')) as { sources: { id: string; path: string; sha256: string }[] };
    const allowed = new Set(['originals/locomotive-basic-fr.txt', 'originals/command-reference.txt', 'originals/cpcwiki-locomotive-basic.html']);
    const result = [];
    for (const source of catalog.sources) {
      if (!allowed.has(source.path)) throw new Error('Catalogue du corpus invalide.');
      const raw = await readFile(join(this.corpusRoot, source.path)); if (digest(raw) !== source.sha256) throw new Error('Empreinte du corpus invalide.');
      let text = new TextDecoder('utf8', { fatal: true }).decode(raw);
      if (source.path.endsWith('.html')) text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<[^>]*>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n[ \t]*\n+/g, '\n');
      result.push({ id: source.id, sha256: source.sha256, text });
    }
    return result;
  }
  private async record(job: Job, state: AgentWorkspaceState, phase: string) {
    const temp = join(job.directory, `.${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify({ schemaVersion: 1, taskId: job.id, phase, projectRoot: job.store.root, authorizedDocumentIds: job.documentIds, initial: job.initial, current: state, result: job.result, events: job.events }, null, 2), { flag: 'wx', mode: 0o600 });
    await rename(temp, join(job.directory, 'checkpoint.json'));
  }
  async start(store: ProjectStore, objective: unknown, buffers: { id: string; source: string }[], includeDocuments = false): Promise<{ taskId: string }> {
    if (this.selectionRequired) throw new Error('Choisissez un modèle OpenAI avant de lancer une mission.');
    if (this.running) throw new Error('Une mission est déjà active.');
    if (!this.provider) throw new Error('Configurez une clé API OpenAI.');
    if (typeof objective !== 'string' || !objective.trim() || objective.length > 20000) throw new Error('Mission requise, 20 000 caractères maximum.');
    const initial = await store.agentState(buffers); const corpus = await this.corpus();
    const documents = includeDocuments ? await store.agentDocuments() : [];
    const id = randomUUID(), directory = join(this.storage, id); await mkdir(directory, { recursive: true, mode: 0o700 });
    const job: Job = { id, store, initial, directory, documentIds: documents.map(item => item.id), abort: new AbortController(), steering: [], events: [], running: true,
      tools: undefined as unknown as WorkspaceTools, result: { status: 'blocked', turns: 0, calls: 0, tokens: 0, summary: 'Mission en cours.' } };
    job.tools = new WorkspaceTools(initial, async state => {
      if (job.abort.signal.aborted) throw new Error('cancelled');
      await this.record(job, state, 'prepared');
      await store.applyAgentState(state);
      // Adoption is immediate after disk commit, even if the next journal write fails.
      job.tools.state = structuredClone(state);
      job.tools.buildVerified = false;
      try { await this.record(job, state, 'committed'); } catch { job.abort.abort(); throw new Error('Écriture journal interrompue après commit ; modifications conservées.'); }
    }, digest, corpus, documents);
    await this.record(job, initial, 'initial'); this.job = job;
    const provider = this.provider;
    void runAgent({ model: provider, tools: job.tools, objective, signal: AbortSignal.any([job.abort.signal, AbortSignal.timeout(15 * 60 * 1000)]),
      context: { target: initial.manifest.target, entryPoint: initial.manifest.entryPoint, files: initial.manifest.sources, documents: documents.map(item => ({ id: item.id, originalName: item.originalName, mediaType: item.mediaType, sha256: item.sha256, bytes: item.bytes })), corpusVersion: 'initial-import-1' },
      emit: event => { if (job.events.length < 150) job.events.push(event); }, takeSteering: () => job.steering.splice(0),
    }).then(async result => {
      job.result = result;
      if (result.status === 'completed') job.result = { ...result, summary: `${result.summary}\nValidation IDE : DSK structurel uniquement. Aucun programme exécuté sur CPC.` };
      if (result.status === 'completed' && !job.tools.buildVerified) job.result = { ...result, status: 'blocked', summary: `${result.summary}\nAucune construction réussie de la révision finale ; mission non validée.` };
      try { await this.record(job, job.tools.state, 'finished'); }
      catch { job.result = { ...job.result, status: 'failed', summary: 'Journal final non écrit ; modifications terminées conservées.' }; }
      finally { job.running = false; }
    }).catch(() => { job.result = { ...job.result, status: 'failed', summary: 'Échec du contrôleur ; consulter le checkpoint local.' }; job.running = false; });
    return { taskId: id };
  }
  private get(id: unknown): Job { if (!this.job || this.job.id !== id) throw new Error('Mission périmée.'); return this.job; }
  status(id: unknown): AgentView {
    const job = this.get(id); const changed = job.tools.state.files.filter(file => job.initial.files.find(old => old.id === file.id)?.source !== file.source).map(file => file.path);
    return structuredClone({ ...job.result, taskId: job.id, running: job.running, events: job.events, workspace: job.tools.state, changed, before: job.initial.files.filter(file => changed.includes(file.path)).map(({ id, source }) => ({ id, source })), buildVerified: job.tools.buildVerified });
  }
  cancel(id: unknown): { ok: boolean } { this.get(id).abort.abort(); return { ok: true }; }
  steer(id: unknown, instruction: unknown): { ok: boolean } {
    const job = this.get(id);
    if (!job.running || typeof instruction !== 'string' || !instruction.trim() || instruction.length > 20000 || job.steering.length >= 8) throw new Error('Consigne invalide ou mission terminée.');
    job.steering.push(instruction); job.events.push({ kind: 'message', text: `Consigne utilisateur reçue : ${instruction}` }); return { ok: true };
  }
  async restore(id: unknown, buffers: { id: string; source: string }[]): Promise<AgentWorkspaceState> {
    const job = this.get(id); if (job.running) throw new Error('Arrêtez la mission avant restauration.');
    const now = job.tools.state;
    if (buffers.length !== now.files.length || new Set(buffers.map(file => file.id)).size !== buffers.length || now.files.some(file => buffers.find(buffer => buffer.id === file.id)?.source !== file.source)) throw new Error('stale-read : modifications manuelles postérieures conservées ; restauration refusée.');
    await this.record(job, job.initial, 'restore-prepared'); await job.store.applyAgentState(job.initial);
    job.tools.state = structuredClone(job.initial); job.tools.buildVerified = false;
    await this.record(job, job.initial, 'restored'); return structuredClone(job.initial);
  }
}
