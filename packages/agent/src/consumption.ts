import type { AgentBudget, PricingProfile, TokenUsage } from './types.ts';

export const DEFAULT_BUDGET: AgentBudget = { maxTurns: 20, maxCalls: 60, maxTokens: 60000 };
export function parseBudget(value: unknown): AgentBudget {
  if (value === undefined) return { ...DEFAULT_BUDGET };
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Budget IA invalide.');
  const budget = value as Record<string, unknown>;
  const limits = { maxTurns: [1, 100], maxCalls: [1, 200], maxTokens: [1000, 500000] };
  if (Object.keys(budget).length !== 3) throw new Error('Budget IA invalide.');
  for (const [key, [min, max]] of Object.entries(limits)) {
    if (!Number.isSafeInteger(budget[key]) || (budget[key] as number) < min! || (budget[key] as number) > max!) throw new Error('Budget IA hors limites.');
  }
  return { maxTurns: budget.maxTurns as number, maxCalls: budget.maxCalls as number, maxTokens: budget.maxTokens as number };
}
export function readUsage(value: unknown, cacheWritesRequired: boolean): TokenUsage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const input = raw.input_tokens, output = raw.output_tokens;
  const details = raw.input_tokens_details as Record<string, unknown> | undefined;
  const cached = details?.cached_tokens, cacheWrite = details?.cache_write_tokens ?? (cacheWritesRequired ? undefined : 0);
  const reasoning = (raw.output_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens ?? 0;
  const valid = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
  if (!valid(input) || !valid(output) || !valid(cached) || !valid(reasoning) || reasoning > output || input + output !== raw.total_tokens || cached > input || cacheWrite !== undefined && (!valid(cacheWrite) || cached + cacheWrite > input)) return undefined;
  return { input, output, cached, cacheWrite: cacheWrite as number ?? 0, reasoning, complete: cacheWrite !== undefined };
}
export function estimateTurn(usage: TokenUsage | undefined, pricing: PricingProfile | undefined, model: string | undefined, tier: string | undefined): number | undefined {
  if (!usage?.complete || !pricing || !model || (model !== pricing.model && !pricing.billedModels?.includes(model)) || tier !== 'default') return undefined;
  const age = Date.now() - Date.parse(pricing.fetchedAt);
  if (!Number.isFinite(age) || age < 0 || age > 60 * 60 * 1000) return undefined;
  const long = pricing.longContext && usage.input > pricing.longContext.threshold ? pricing.longContext : undefined;
  const inputFactor = long?.inputMultiplier ?? 1, outputFactor = long?.outputMultiplier ?? 1;
  return ((usage.input - usage.cached - usage.cacheWrite) * pricing.input * inputFactor + usage.cached * pricing.cached * inputFactor + usage.cacheWrite * pricing.input * pricing.cacheWriteMultiplier * inputFactor + usage.output * pricing.output * outputFactor) / 1_000_000;
}
