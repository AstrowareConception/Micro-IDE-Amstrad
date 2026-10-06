import type { PricingProfile } from '../../packages/agent/src/types.ts';

/** A changed or ambiguous official format disables the estimate. */
export function parseOfficialPricing(text: string, model: string, fetchedAt = new Date().toISOString()): PricingProfile {
  if (!text.includes(`Model ID: \`${model}\``)) throw new Error('Tarif officiel non identifié pour ce modèle.');
  const section = text.split('## Pricing\n')[1]?.split('\n## ')[0];
  if (!section || /\b(batch|flex|priority|tier)\b/i.test(section)) throw new Error('Format tarifaire non pris en charge.');
  const price = (metric: string) => {
    const rows = [...section.matchAll(new RegExp(`^\\| ${metric} \\| \\$([0-9]+(?:\\.[0-9]+)?) \\| 1M tokens \\|$`, 'gm'))];
    if (rows.length !== 1) throw new Error('Tarif officiel absent ou ambigu.');
    const value = Number(rows[0]![1]); if (!Number.isFinite(value) || value < 0 || value > 1000) throw new Error('Tarif invalide.'); return value;
  };
  const profile: PricingProfile = { model, input: price('Input'), cached: price('Cached input'), output: price('Output'), cacheWriteMultiplier: 1,
    fetchedAt, source: `https://developers.openai.com/api/docs/models/${model}` };
  const snapshot = /^- Default snapshot: `([A-Za-z0-9._-]{1,80})`$/m.exec(text)?.[1];
  if (snapshot) profile.billedModels = [...new Set([model, snapshot])];
  for (const note of section.split('\n').filter(line => line.startsWith('- '))) {
    const long = /^- Prompts with >([\d]+)K input tokens are priced at ([\d.]+)x input and ([\d.]+)x output for the full request\.$/.exec(note);
    const write = /^- Cache writes are billed at ([\d.]+)x the uncached input token rate\.$/.exec(note);
    if (long) profile.longContext = { threshold: Number(long[1]) * 1000, inputMultiplier: Number(long[2]), outputMultiplier: Number(long[3]) };
    else if (write) profile.cacheWriteMultiplier = Number(write[1]);
    else throw new Error('Règle tarifaire officielle non prise en charge ; estimation indisponible.');
  }
  if ([profile.cacheWriteMultiplier, profile.longContext?.inputMultiplier ?? 1, profile.longContext?.outputMultiplier ?? 1].some(value => !Number.isFinite(value) || value < 1 || value > 10)) throw new Error('Multiplicateur tarifaire invalide.');
  return profile;
}
export async function fetchOfficialPricing(model: string, transport: typeof fetch = fetch): Promise<PricingProfile> {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(model)) throw new Error('Modèle tarifaire invalide.');
  try { return await fetchPage(model, transport); }
  catch (error) {
    const alias = model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
    if (alias === model) throw error;
    const profile = await fetchPage(alias, transport);
    if (!profile.billedModels?.includes(model)) throw new Error('Snapshot sans correspondance tarifaire officielle ; estimation indisponible.');
    return { ...profile, model };
  }
}
async function fetchPage(model: string, transport: typeof fetch): Promise<PricingProfile> {
  // Public documentation: no key, source code or billable inference.
  const response = await transport(`https://developers.openai.com/api/docs/models/${model}.md`, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { Accept: 'text/markdown' } });
  if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('Tarif officiel inaccessible ; estimation indisponible.'); }
  const reader = response.body.getReader(), decoder = new TextDecoder(); let text = '', bytes = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length;
      if (bytes > 64 * 1024) { await reader.cancel(); throw new Error('Document tarifaire trop volumineux.'); } text += decoder.decode(part.value, { stream: true }); }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  return parseOfficialPricing(text, model);
}
