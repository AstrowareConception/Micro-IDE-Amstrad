import { INSTRUCTIONS } from '../../packages/agent/src/runner.ts';
import type { ModelPort, ModelTurn, ToolDefinition, OpenAIModel } from '../../packages/agent/src/types.ts';

export const DEFAULT_MODEL = 'gpt-5.4-2026-03-05';
/** Key and network stay in main. No SDK dependency, remote tool or automatic billable retry. */
export class OpenAIProvider implements ModelPort {
  private readonly key: string;
  readonly model: string;
  private readonly transport: typeof fetch;
  constructor(key: string, model: string, transport: typeof fetch = fetch) {
    if (!/^sk-[A-Za-z0-9_-]{8,500}$/.test(key) || !/^[A-Za-z0-9._-]{1,80}$/.test(model)) throw new Error('Clé ou identifiant de modèle invalide.');
    this.key = key; this.model = model; this.transport = transport;
  }
  withModel(model: string): OpenAIProvider { return new OpenAIProvider(this.key, model, this.transport); }
  async listModels(): Promise<OpenAIModel[]> {
    const response = await this.transport('https://api.openai.com/v1/models', {
      method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${this.key}`, Accept: 'application/json' },
    }).catch(() => { throw new Error('Liste des modèles inaccessible : connexion ou délai OpenAI.'); });
    if (!response.ok) { await response.body?.cancel(); throw new Error(response.status === 401 ? 'Clé OpenAI refusée (401).' : response.status === 403 ? 'Accès à la liste des modèles refusé (403). Vérifiez les permissions de la clé.' : `Liste des modèles : OpenAI HTTP ${response.status}.`); }
    if (!response.body) throw new Error('Liste des modèles OpenAI absente.');
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > 1024 * 1024) { await reader.cancel(); throw new Error('Liste des modèles OpenAI trop volumineuse.'); } chunks.push(part.value); } }
    catch { await reader.cancel().catch(() => undefined); throw new Error(length > 1024 * 1024 ? 'Liste des modèles OpenAI trop volumineuse.' : 'Lecture de la liste des modèles interrompue.'); }
    finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const text = new TextDecoder().decode(bytes);
    if (text.includes(this.key)) throw new Error('Liste des modèles contenant un secret refusée.');
    let data: unknown; try { data = JSON.parse(text); } catch { throw new Error('Liste des modèles OpenAI JSON invalide.'); }
    if (!data || typeof data !== 'object' || !('data' in data) || !Array.isArray(data.data) || data.data.length > 5000) throw new Error('Liste des modèles OpenAI invalide.');
    const models = new Map<string, OpenAIModel>();
    for (const item of data.data) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(item.id) || !Number.isSafeInteger(item.created) || item.created < 0 || typeof item.owned_by !== 'string' || item.owned_by.length > 120) continue;
      // Families are candidates, not a claim of tool/vision support. Future GPT versions enter automatically.
      if (!/^(gpt-\d|o\d|codex-)/.test(item.id) || /audio|realtime|transcrib|tts|search|deep-research/.test(item.id)) continue;
      const shutdownDate = typeof item.shutdown_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.shutdown_date) ? item.shutdown_date : undefined;
      if (shutdownDate && shutdownDate <= new Date().toISOString().slice(0, 10)) continue;
      models.set(item.id, { id: item.id, created: item.created, owner: item.owned_by, ...(shutdownDate ? { shutdownDate } : {}) });
    }
    if (!models.size) throw new Error('Aucun modèle de programmation candidat accessible avec cette clé.');
    return [...models.values()].sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));
  }
  async respond(input: Record<string, unknown>[], tools: ToolDefinition[], signal: AbortSignal): Promise<ModelTurn> {
    const response = await this.transport('https://api.openai.com/v1/responses', {
      method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, instructions: INSTRUCTIONS, input, tools, store: false,
        include: ['reasoning.encrypted_content'], parallel_tool_calls: false, max_output_tokens: 4096 }),
    }).catch(() => { throw new Error(signal.aborted ? 'Mission annulée.' : 'Connexion interrompue ou délai fournisseur dépassé. Aucun retry automatique.'); });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(response.status === 401 ? 'Clé OpenAI refusée (401).' : response.status === 429 ? 'Quota ou débit OpenAI atteint (429).' : `OpenAI HTTP ${response.status}. Aucun retry automatique.`);
    }
    if (!response.body) throw new Error('Réponse OpenAI absente.');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length;
        if (length > 1024 * 1024) { await reader.cancel(); throw new Error('Réponse OpenAI trop volumineuse.'); } chunks.push(part.value); }
    } finally { reader.releaseLock(); }
    const content = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.length; }
    let data: Record<string, unknown>;
    try { data = JSON.parse(new TextDecoder().decode(content)) as Record<string, unknown>; } catch { throw new Error('Réponse OpenAI JSON invalide.'); }
    if (data.status !== 'completed' || !Array.isArray(data.output) || data.output.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error('Réponse OpenAI incomplète ; aucune mutation issue de cette réponse.');
    const usage = data.usage as Record<string, unknown> | undefined;
    if (!usage || !Number.isSafeInteger(usage.total_tokens) || (usage.total_tokens as number) < 0) throw new Error('Usage OpenAI absent ou invalide.');
    // Never reflect credentials in public errors or model/tool transcripts.
    if (JSON.stringify(data.output).includes(this.key)) throw new Error('Réponse contenant le secret refusée.');
    return { output: data.output as Record<string, unknown>[], tokens: usage.total_tokens as number };
  }
}
