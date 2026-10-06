import { tokenize, type Token } from './language.ts';
import { analyzeEditor, ANALYSIS_LIMITS, type EditorAnalysis } from './syntax.ts';

export interface AnalysisRequest { id: string; revision: number; source: string }
export interface AnalysisResponse { id: string; revision: number; analysis: EditorAnalysis; durationMs: number; cacheHits: number; cacheMisses: number; cacheTokens: number }
export interface AnalysisEntry extends AnalysisRequest { result?: AnalysisResponse; error?: string }
export interface AnalysisSnapshot { entries: AnalysisEntry[]; submitted: number; accepted: number; discarded: number; running: boolean; suspended: boolean }

/** Worker-owned LRU. Cache keys are exact lines; semantic checks always use the current listing. */
export function createAnalysisEngine() {
 const cache = new Map<string, Token[]>(); let characters = 0, tokenCount = 0;
 return (request: AnalysisRequest): AnalysisResponse => {
  let hits = 0, misses = 0; const start = performance.now();
  const lex = (line: string) => {
   const previous = cache.get(line);
   if (previous) { hits++; cache.delete(line); cache.set(line, previous); return previous; }
   misses++; const tokens = tokenize(line);
   if (tokens.length <= 2048) {
    cache.set(line, tokens); characters += line.length; tokenCount += tokens.length;
    while (characters > 2_097_152 || tokenCount > 50_000 || cache.size > 10_000) {
     const key = cache.keys().next().value!; const removed = cache.get(key)!;
     characters -= key.length; tokenCount -= removed.length; cache.delete(key);
    }
   }
   return tokens;
  };
  return { id: request.id, revision: request.revision, analysis: analyzeEditor(request.source, lex), durationMs: performance.now() - start, cacheHits: hits, cacheMisses: misses, cacheTokens: tokenCount };
 };
}

interface Clock { later(callback: () => void, ms: number): unknown; cancel(timer: unknown): void }
const clock: Clock = { later: (callback, ms) => setTimeout(callback, ms), cancel: timer => clearTimeout(timer as ReturnType<typeof setTimeout>) };
/** Single-flight scheduling, latest revision only, no idle polling. */
export class AnalysisCoordinator {
 private entries = new Map<string, AnalysisEntry>(); private revision = 0;
 private submitted = 0; private accepted = 0; private discarded = 0;
 private timer: unknown; private deadline: unknown; private current: AnalysisRequest | undefined;
 private suspended = false; private disposed = false; private activeId = ''; private ready = false;
 private send: (request: AnalysisRequest) => void;
 private changed: (snapshot: AnalysisSnapshot) => void;
 private restart: () => void;
 private timing: Clock;
 constructor(send: (request: AnalysisRequest) => void, changed: (snapshot: AnalysisSnapshot) => void, restart: () => void, timing: Clock = clock) {
  this.send = send; this.changed = changed; this.restart = restart; this.timing = timing;
 }
 snapshot(): AnalysisSnapshot { return { entries: [...this.entries.values()], submitted: this.submitted, accepted: this.accepted, discarded: this.discarded, running: !!this.current, suspended: this.suspended }; }
 private emit() { if (!this.disposed) this.changed(this.snapshot()); }
 update(documents: { id: string; source: string }[], activeId: string) {
  if (this.disposed) return;
  const next = new Map<string, AnalysisEntry>(); let modified = false;
  for (const doc of documents.slice(0, 64)) {
   const old = this.entries.get(doc.id);
   if (old?.source === doc.source) next.set(doc.id, old);
   else { next.set(doc.id, { ...doc, revision: ++this.revision }); modified = true; }
  }
  this.entries = next; this.activeId = activeId;
  if (modified) { this.ready = false; this.timing.cancel(this.timer); this.timer = this.timing.later(() => { this.ready = true; this.pump(); }, 200); }
  else this.pump();
  this.emit();
 }
 private pump() {
  if (this.disposed || this.suspended || this.current || !this.ready) return;
  const pending = [...this.entries.values()].filter(entry => !entry.result && !entry.error);
  const next = pending.find(entry => entry.id === this.activeId) ?? pending[0]; if (!next) return;
  this.current = { id: next.id, revision: next.revision, source: next.source }; this.submitted++;
  this.deadline = this.timing.later(() => this.fail('Analyse interrompue après 5 secondes. Réessayer dans Problèmes.', true), 5000);
  try { this.send({ ...this.current, source: this.current.source.slice(0, ANALYSIS_LIMITS.characters + 1) }); } catch { this.fail('Worker d’analyse indisponible. Réessayer dans Problèmes.', true); }
  this.emit();
 }
 receive(response: AnalysisResponse) {
  if (this.disposed) return;
  // A delayed response from a terminated worker cannot complete another job.
  if (response.id !== this.current?.id || response.revision !== this.current.revision) { this.discarded++; this.emit(); return; }
  this.timing.cancel(this.deadline); this.current = undefined;
  const entry = this.entries.get(response.id);
  if (entry?.revision === response.revision) { this.entries.set(entry.id, { ...entry, result: response }); this.accepted++; }
  else this.discarded++;
  this.pump(); this.emit();
 }
 fail(message: string, recreate = false) {
  if (this.disposed) return;
  this.timing.cancel(this.deadline);
  // Fail all pending sources: a broken worker must not cause an infinite restart loop.
  for (const entry of this.entries.values()) if (!entry.result) this.entries.set(entry.id, { ...entry, error: message });
  this.current = undefined;
  if (recreate) this.restart(); this.emit();
 }
 retry() {
  for (const entry of this.entries.values()) if (entry.error) this.entries.set(entry.id, { id: entry.id, source: entry.source, revision: ++this.revision });
  this.ready = true; this.pump(); this.emit();
 }
 suspend(value: boolean) { this.suspended = value; this.pump(); this.emit(); }
 dispose() { this.disposed = true; this.timing.cancel(this.timer); this.timing.cancel(this.deadline); this.entries.clear(); this.current = undefined; }
}
