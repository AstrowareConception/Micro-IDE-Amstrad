export interface FeedbackInput { kind: 'feature' | 'bug'; title: string; usage: string; need: string; expected: string }
export const FEEDBACK_REPOSITORY = 'https://github.com/AstrowareConception/Micro-IDE-Amstrad';
export function feedbackReport(value: unknown): { body: string; url: string; prefilled: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Demande invalide.');
  const input = value as Record<string, unknown>;
  if (input.kind !== 'feature' && input.kind !== 'bug') throw new Error('Type de demande invalide.');
  const fields: Record<string, string> = {};
  for (const [key, max] of [['title', 100], ['usage', 1000], ['need', 1500], ['expected', 1500]] as const) {
    const text = input[key];
    if (typeof text !== 'string' || text.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new Error('Description invalide ou trop longue.');
    fields[key] = text.trim();
  }
  if (!fields.title || !fields.need) throw new Error('Titre et description du besoin requis.');
  const feature = input.kind === 'feature';
  const body = `## Mon utilisation de CPCéleste\n${fields.usage || 'À compléter.'}\n\n## ${feature ? 'Besoin et difficulté actuelle' : 'Problème et étapes de reproduction'}\n${fields.need}\n\n## Résultat souhaité\n${fields.expected || 'À compléter.'}\n\n---\nDemande préparée depuis CPCéleste.\n`;
  const url = new URL(`${FEEDBACK_REPOSITORY}/issues/new`);
  url.searchParams.set('template', feature ? 'feature_request.md' : 'bug_report.md');
  url.searchParams.set('title', `${feature ? '[Amélioration]' : '[Bug]'} ${fields.title}`);
  url.searchParams.set('body', body);
  const prefilled = url.href.length <= 7500;
  if (!prefilled) url.searchParams.delete('body');
  return { body, url: url.href, prefilled };
}
