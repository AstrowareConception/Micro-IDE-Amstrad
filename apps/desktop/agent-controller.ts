import { AgentBasicTests, type AgentTestPort } from '../../packages/agent/src/basic-tests.ts';
import { BasicTestSuiteStore } from './basic-test-suite-store.ts';
import type { DocumentSnapshot } from '../../packages/workspace/src/project.ts';
import type { KnowledgeRequest } from '../../packages/workspace/src/knowledge.ts';
import { documentAllowed, knowledgeContext } from '../../packages/workspace/src/knowledge.ts';
import { BinaryWorkspaceTools, BINARY_INSTRUCTIONS } from '../../packages/agent/src/binary-tools.ts';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { runAgent, createRunState, type AgentRunState } from '../../packages/agent/src/runner.ts';
import { parseBudget } from '../../packages/agent/src/consumption.ts';
import { fetchOfficialPricing } from './openai-pricing.ts';
import { WorkspaceTools } from '../../packages/agent/src/workspace-tools.ts';
import type { AgentEvent, AgentResult, AgentView, AgentWorkspaceState, ModelCatalog, AgentBudget, PricingProfile } from '../../packages/agent/src/types.ts';
import { OpenAIProvider, DEFAULT_MODEL } from './openai-provider.ts';
import type { ProjectStore } from './project-store.ts';

const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
interface Job { id: string; store: ProjectStore; initial: AgentWorkspaceState; tools: WorkspaceTools | BinaryWorkspaceTools; result: AgentResult; running: boolean; events: AgentEvent[]; steering: string[]; abort: AbortController; directory: string; documentIds: string[]; initialDocuments: DocumentSnapshot[]; documents: DocumentSnapshot[]; state: AgentRunState; budget: AgentBudget; provider: OpenAIProvider | undefined; model: string; pricing?: PricingProfile | undefined; continuations: number; restored: boolean }
export class AgentController {
  private provider: OpenAIProvider | undefined;
  private job: Job | undefined;
  private readonly storage: string;
  private readonly corpusRoot: string;
  private catalog: ModelCatalog | undefined;
  private configurationRevision = 0;
  private selectionRequired = false;
  private readonly prices = new Map<string, PricingProfile>();
  private readonly transport: typeof fetch | undefined;
  private readonly testRunner: AgentTestPort['run'] | undefined;
  constructor(storage: string, corpusRoot: string, transport?: typeof fetch, testRunner?: AgentTestPort['run']) { this.storage = storage; this.corpusRoot = corpusRoot; this.transport = transport; this.testRunner = testRunner; }
  get running(): boolean { return this.job?.running ?? false; }
  async suggestCommit(diff: string): Promise<{ message: string; model: string }> {
    if (this.running || this.selectionRequired || !this.provider) throw new Error('Configurez la clé et choisissez un modèle OpenAI dans le panneau IA avant cette suggestion.');
    const provider = this.provider;
    return { message: await provider.suggestCommit(diff), model: provider.model };
  }
  configure(key: unknown, model: unknown): { configured: boolean; model: string } {
    if (this.running) throw new Error('Arrêtez la mission avant de changer la configuration.');
    if (key === '') { if (this.job) this.job.provider = undefined; this.provider = undefined; this.catalog = undefined; this.selectionRequired = false; this.configurationRevision++; return { configured: false, model: DEFAULT_MODEL }; }
    if (typeof key !== 'string' || typeof model !== 'string') throw new Error('Configuration invalide.');
    const candidate = new OpenAIProvider(key, model, this.transport ?? fetch); if (this.job) this.job.provider = undefined; this.provider = candidate; this.catalog = undefined; this.selectionRequired = false; this.configurationRevision++; return { configured: true, model };
  }
  async models(key?: unknown): Promise<ModelCatalog> {
    if (this.running) throw new Error('Arrêtez la mission avant d’actualiser les modèles.');
    if (key !== undefined && typeof key !== 'string') throw new Error('Clé invalide.');
    const revision = this.configurationRevision;
    const candidate = key === undefined ? this.provider : new OpenAIProvider(key as string, DEFAULT_MODEL, this.transport ?? fetch);
    if (!candidate) throw new Error('Configurez une clé OpenAI pour charger les modèles.');
    const models = await candidate.listModels();
    if (this.running || revision !== this.configurationRevision) throw new Error('Configuration modifiée pendant la lecture ; réessayez.');
    if (key !== undefined) { if (this.job) this.job.provider = undefined; this.provider = candidate; this.selectionRequired = true; this.configurationRevision++; }
    this.catalog = { models, fetchedAt: new Date().toISOString(), model: this.selectionRequired ? '' : candidate.model };
    return structuredClone(this.catalog);
  }
  selectModel(model: unknown): { model: string } {
    if (this.running) throw new Error('Arrêtez la mission avant de changer de modèle.');
    if (typeof model !== 'string' || !this.provider || !this.catalog?.models.some(item => item.id === model)) throw new Error('Choisissez un modèle dans la liste OpenAI actualisée.');
    this.provider = this.provider.withModel(model); this.catalog.model = model; this.selectionRequired = false; this.configurationRevision++;
    return { model };
  }
  async pricing(model: unknown): Promise<PricingProfile> {
    if (this.running || typeof model !== 'string' || this.selectionRequired || model !== this.provider?.model) throw new Error('Choisissez le modèle avant de charger son tarif.');
    const revision = this.configurationRevision;
    const pricing = await fetchOfficialPricing(model, this.transport ?? fetch);
    if (this.running || revision !== this.configurationRevision) throw new Error('Modèle modifié pendant la lecture du tarif.');
    this.prices.set(model, pricing); return structuredClone(pricing);
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
  private async record(job: Job, state: AgentWorkspaceState, phase: string, documentOperation?: KnowledgeRequest) {
    const temp = join(job.directory, `.${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify({ schemaVersion: 1, taskId: job.id, phase, projectRoot: job.store.root, authorizedDocumentIds: job.documentIds, ...(documentOperation ? {documentOperation} : {}), initial: job.initial, current: state, result: job.result, events: job.events }, null, 2), { flag: 'wx', mode: 0o600 });
    await rename(temp, join(job.directory, 'checkpoint.json'));
  }
  async start(store: ProjectStore, objective: unknown, buffers: { id: string; source: string }[], includeDocuments = false, budgetInput?: unknown): Promise<{ taskId: string }> {
    if (this.selectionRequired) throw new Error('Choisissez un modèle OpenAI avant de lancer une mission.');
    if (this.running) throw new Error('Une mission est déjà active.');
    if (!this.provider) throw new Error('Configurez une clé API OpenAI.');
    if (typeof objective !== 'string' || !objective.trim() || objective.length > 20000) throw new Error('Mission requise, 20 000 caractères maximum.');
    const budget = parseBudget(budgetInput);
    const initial = await store.agentState(buffers); const binary = initial.manifest.kind === 'binary';
    if (binary && !initial.binaryAnalysis?.regions.length) throw Error('Enregistrez une zone Z80 avant la mission.');
    const corpus = binary ? [] : await this.corpus();
    const documents = (await store.agentDocuments()).filter(document => documentAllowed(document,includeDocuments));
    const id = randomUUID(), directory = join(this.storage, id); await mkdir(directory, { recursive: true, mode: 0o700 });
    const context = { kind: binary ? 'binary' : 'basic', target: initial.manifest.target, entryPoint: initial.manifest.entryPoint, files: binary ? initial.manifest.assets.map(({ id, cpcName, byteLength, sha256 }) => ({ id, cpcName, byteLength, sha256 })) : initial.manifest.sources, documents: documents.map(item => ({ id: item.id, originalName: item.originalName, mediaType: item.mediaType, sha256: item.sha256, bytes: item.bytes })), knowledge: knowledgeContext(documents), corpusVersion: 'initial-import-1' };
    const job: Job = { id, store, initial, directory, documentIds: documents.map(item => item.id), initialDocuments:structuredClone(documents), documents:structuredClone(documents), abort: new AbortController(), steering: [], events: [], running: true,
      state: createRunState(objective, context), budget, provider: this.provider, model: this.provider.model, pricing: this.prices.get(this.provider.model), continuations: 0, restored: false,
      tools: undefined as unknown as WorkspaceTools, result: { status: 'blocked', turns: 0, calls: 0, tokens: 0, summary: 'Mission en cours.' } };
    const persist = async (state: AgentWorkspaceState) => {
      if (job.abort.signal.aborted) throw new Error('cancelled');
      await this.record(job, state, 'prepared');
      await store.applyAgentState(state);
      // Adoption is immediate after disk commit, even if the next journal write fails.
      job.tools.state = structuredClone(state);
      job.tools.buildVerified = false;
      try { await this.record(job, state, 'committed'); } catch { job.abort.abort(); throw new Error('Écriture journal interrompue après commit ; modifications conservées.'); }
    };
    const writeKnowledge = async (request: Extract<KnowledgeRequest,{action:'create'|'save'}>) => {
      if(job.abort.signal.aborted) throw Error('cancelled');
      const current=await store.agentState(job.tools.state.files.map(({id,source})=>({id,source})));
      if(JSON.stringify(current)!==JSON.stringify(job.tools.state)) throw Error('stale-read : projet modifié depuis la mission.');
      if(request.action==='save' && !job.documents.some(d=>d.id===request.id && d.knowledge?.editable && d.knowledge.access!=='excluded')) throw Error('scope-denied');
      await this.record(job,job.tools.state,'document-prepared',request);
      const result=await store.writeKnowledge(request);
      job.tools.state.manifest=structuredClone(result.manifest); job.tools.buildVerified=false;
      job.documents=[...job.documents.filter(d=>d.id!==result.document.id),result.document];
      job.documentIds=job.documents.map(d=>d.id);
      job.tools.updateDocuments(job.documents);
      try { await this.record(job,job.tools.state,'document-committed'); }
      catch { job.abort.abort(); throw Error('Journal interrompu après commit documentaire ; version enregistrée conservée.'); }
      return result;
    };
    const suiteStore=new BasicTestSuiteStore(store.root,store.manifest.projectId);
    const tests=!binary && this.testRunner ? new AgentBasicTests({load:()=>suiteStore.load(),run:this.testRunner,record:async report=>{await suiteStore.record(report);}},digest,randomUUID,()=>job.abort.signal) : undefined;
    job.tools = binary ? new BinaryWorkspaceTools(initial, persist, digest, documents,writeKnowledge) : new WorkspaceTools(initial, persist, digest, corpus, documents,writeKnowledge,tests);
    await this.record(job, initial, 'initial'); this.job = job;
    this.launch(job);
    return { taskId: id };
  }
  private launch(job: Job): void {
    const provider = job.provider; if (!provider) throw new Error('Connexion IA modifiée ; nouvelle mission requise.');
    const deadline=setTimeout(()=>job.abort.abort(),15*60*1000);
    void runAgent({ model: job.initial.binaryAnalysis ? { respond: (input, tools, signal) => provider.respond(input, tools, signal, BINARY_INSTRUCTIONS) } : provider, tools: job.tools, objective: '', context: {}, state: job.state, pricing: job.pricing, ...job.budget,
      signal: job.abort.signal, progress: result => { job.result = result; },
      emit: event => { job.events.push(event); if (job.events.length > 300) job.events.shift(); }, takeSteering: () => job.steering.splice(0),
    }).then(async result => {
      if (result.status === 'completed') {
        await job.store.agentDocuments();
        const current = await job.store.agentState(job.tools.state.files.map(({id,source})=>({id,source})));
        if (JSON.stringify(current) !== JSON.stringify(job.tools.state)) result = { ...result, status: 'blocked', summary: result.summary + '\nProjet modifié ailleurs ; validation périmée.' };
      }
      job.result = result;
      if (result.status === 'completed') {
        const runs=job.tools instanceof WorkspaceTools ? await job.tools.tests?.validate(job.tools.state) ?? [] : [];
        const latest=runs.at(-1);
        const latestBySuite=[...new Map(runs.map(run=>[run.report.suiteId,run])).values()];
        const coverage=job.tools instanceof WorkspaceTools ? job.tools.tests?.coverage(job.initial,job.tools.state) : undefined;
        const untested=coverage?.sources.filter(source=>!source.afterPassed) ?? [];
        const valid=!!latest && latestBySuite.every(run=>!run.stale && run.report.results.every(r=>r.outcome==='passed')) && !untested.length;
        const proof=untested.length ? `Sources BASIC modifiées non exécutées directement : ${untested.map(source=>source.path).join(', ')}. Une copie ou un témoin autonome ne couvre pas ces fichiers.` :
          coverage?.sources.length ? `${coverage.directlyTested}/${coverage.sources.length} sources modifiées directement testées ; ${coverage.baselined} avec essai initial sur la même suite. Les assertions ne prouvent pas une équivalence universelle.` :
          'Aucune source BASIC modifiée à rattacher.';
        job.result={...result,status:latest&&!valid?'blocked':result.status,summary:`${result.summary}\nValidation IDE : DSK structurel. ${latest ? valid ? 'Suites CPC réussies sur cette révision.' : 'Tests CPC non concluants ou sources modifiées non couvertes ; validation non obtenue.' : 'Aucun test CPC exécuté ; comportement non vérifié.'} ${proof}`};
      }
      if (result.status === 'completed' && !job.tools.buildVerified) job.result = { ...job.result, status: 'blocked', summary: `${job.result.summary}\nAucune construction réussie de la révision finale ; mission non validée.` };
      try { await this.record(job, job.tools.state, 'finished'); }
      catch { job.result = { ...job.result, status: 'failed', summary: 'Journal final non écrit ; modifications terminées conservées.' }; }
      finally { clearTimeout(deadline); job.running = false; }
    }).catch(() => { clearTimeout(deadline); job.result = { ...job.result, status: 'failed', summary: 'Échec du contrôleur ; consulter le checkpoint local.' }; job.running = false; });
  }
  async resume(id: unknown, store: ProjectStore, buffers: { id: string; source: string }[]): Promise<{ taskId: string }> {
    const job = this.get(id);
    if (this.running || !job.provider || job.store !== store || job.restored || job.continuations >= 10 || job.result.status !== 'paused-limit' || /^Budget de contexte|^Stagnation/.test(job.result.summary)) throw new Error('Cette mission ne peut pas être reprise. Démarrez une nouvelle mission ciblée.');
    await store.assertCurrent(); await store.agentDocuments();
    const now = await store.agentState(buffers);
    if (JSON.stringify(now) !== JSON.stringify(job.tools.state)) throw new Error('stale-read : projet ou buffers modifiés depuis la pause ; reprise refusée.');
    job.abort = new AbortController(); job.continuations++; job.running = true;
    job.events.push({ kind: 'message', text: `Reprise ${job.continuations} : contexte conservé, budget supplémentaire de ${job.budget.maxTurns} tours et ${job.budget.maxTokens} tokens. API facturée.` });
    this.launch(job); return { taskId: job.id };
  }
  private get(id: unknown): Job { if (!this.job || this.job.id !== id) throw new Error('Mission périmée.'); return this.job; }
  status(id: unknown): AgentView {
    const job = this.get(id); const changed = job.tools.state.files.filter(file => job.initial.files.find(old => old.id === file.id)?.source !== file.source).map(file => file.path);
    if (job.initial.binaryAnalysis && JSON.stringify(job.initial.binaryAnalysis.regions) !== JSON.stringify(job.tools.state.binaryAnalysis?.regions)) changed.push('binary-z80.json');
    const documentChanges=job.documents.filter(d=>d.knowledge?.editable && d.sha256!==job.initialDocuments.find(old=>old.id===d.id)?.sha256).map(d=>{
      const old=job.initialDocuments.find(item=>item.id===d.id), before=old && 'text' in old ? old.text : undefined, after='text' in d?d.text:'';
      changed.push(d.originalName);
      return {id:d.id,title:d.originalName,created:!old,...(before===undefined?{}:{before:before.slice(0,16384)}),after:after.slice(0,16384),truncated:after.length>16384 || (before?.length??0)>16384};
    });
    const { assets: _assets, ...binaryWorkspace } = job.tools.state;
    const workspace = job.tools.state.binaryAnalysis ? binaryWorkspace : job.tools.state;
    return structuredClone({ ...job.result, taskId: job.id, running: job.running, events: job.events, workspace, changed, documentChanges, testRuns:job.tools instanceof WorkspaceTools ? job.tools.tests?.views(job.tools.state) ?? [] : [], renameOperations:job.tools instanceof WorkspaceTools ? structuredClone(job.tools.renameOperations) : [], formatOperations:job.tools instanceof WorkspaceTools ? structuredClone(job.tools.formatOperations) : [], commentOperations:job.tools instanceof WorkspaceTools ? structuredClone(job.tools.commentOperations) : [], moduleReviews:job.tools instanceof WorkspaceTools ? job.tools.moduleReviewViews() : [], loadContracts:job.tools instanceof WorkspaceTools ? job.tools.loadingReportViews() : [], overlayReviews:job.tools instanceof WorkspaceTools ? job.tools.chainMergeViews() : [], extractionSimulations:job.tools instanceof WorkspaceTools ? job.tools.extractionSimulationViews() : [], testCoverage:job.tools instanceof WorkspaceTools ? job.tools.tests?.coverage(job.initial,job.tools.state) : undefined, before: job.initial.files.filter(file => changed.includes(file.path)).map(({ id, source }) => ({ id, source })), ...(job.initial.binaryAnalysis ? { binaryBefore: job.initial.binaryAnalysis } : {}), buildVerified: job.tools.buildVerified,
      model: job.model, budget: job.budget, pricing: job.pricing, resumable: !!job.provider && !job.running && !job.restored && job.continuations < 10 && job.result.status === 'paused-limit' && !/^Budget de contexte|^Stagnation/.test(job.result.summary) });
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
    const restored = structuredClone(job.initial);
    if (restored.binaryAnalysis) restored.binaryAnalysis.revision = now.binaryAnalysis!.revision;
    await this.record(job, restored, 'restore-prepared'); await job.store.applyAgentState(restored,now);
    job.tools.state = restored; job.tools.buildVerified = false; job.documents=structuredClone(job.initialDocuments); job.tools.updateDocuments(job.documents);
    job.restored = true;
    await this.record(job, restored, 'restored'); return structuredClone(restored);
  }
}
