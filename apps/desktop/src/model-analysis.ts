import type { Analysis } from '../../../packages/basic-language/src/language.ts';
interface Model { uri: { toString(): string }; getVersionId(): number }
const indexes = new Map<string, { version: number; analysis: Analysis }>();
const waiters = new Map<string, Set<{ version: number; finish(analysis: Analysis | undefined): void }>>();
export function cachedModelAnalysis(model: Model): Analysis | undefined {
 const item = indexes.get(model.uri.toString()); return item?.version === model.getVersionId() ? item.analysis : undefined;
}
export function indexModelAnalysis(model: Model, analysis: Analysis | undefined) {
 const key = model.uri.toString();
 if (analysis) indexes.set(key, { version: model.getVersionId(), analysis }); else indexes.delete(key);
 for (const item of waiters.get(key) ?? []) if (analysis || item.version !== model.getVersionId()) item.finish(item.version === model.getVersionId() ? analysis : undefined);
}
export function releaseModelAnalysis(model: Model) {
 const key = model.uri.toString(); indexes.delete(key);
 for (const item of waiters.get(key) ?? []) item.finish(undefined); waiters.delete(key);
}
/** Only explicit target navigation waits. Completion of keywords never waits or reparses. */
export function awaitModelAnalysis(model: Model): Promise<Analysis | undefined> {
 const analysis = cachedModelAnalysis(model); if (analysis) return Promise.resolve(analysis);
 const key = model.uri.toString();
 return new Promise(resolve => {
  const items = waiters.get(key) ?? new Set(); waiters.set(key, items);
  const item = { version: model.getVersionId(), finish(value: Analysis | undefined) { clearTimeout(timer); items.delete(item); if (!items.size) waiters.delete(key); resolve(value); } };
  const timer = setTimeout(() => item.finish(undefined), 2000); items.add(item);
 });
}
