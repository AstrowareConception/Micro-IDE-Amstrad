import type { Token } from './language.ts';
import { inspectExpression } from './expression.ts';

export type FlowEventKind = 'error' | 'break' | 'sound' | 'after' | 'every';
export type FlowEventAction = 'register' | 'disable' | 'continue' | 'stop';
export interface FlowEventForm { event: FlowEventKind; action: FlowEventAction; targetLine: number | null }
export const FLOW_EVENT_LABELS: Record<FlowEventKind, string> = { error: 'Erreur', break: 'Interruption clavier', sound: 'File sonore', after: 'Minuteur unique', every: 'Minuteur périodique' };
export const FLOW_EVENT_ACTION_LABELS: Record<FlowEventAction, string> = { register: 'Déclaration', disable: 'Désactivation', continue: 'Poursuite sur interruption', stop: 'Arrêt sur interruption' };
const is = (token: Token | undefined, name: string) => token?.kind === 'keyword' && token.text.toUpperCase() === name;
const line = (tokens: Token[]) => tokens.length === 1 && tokens[0]!.kind === 'number' && /^\d+$/.test(tokens[0]!.text) && Number(tokens[0]!.text) <= 65535 ? Number(tokens[0]!.text) : undefined;
function expressions(tokens: Token[], maximum: number): boolean {
 const groups: Token[][] = [[]]; let depth = 0;
 for (const token of tokens) {
  if (token.text === '(') depth++;
  if (token.text === ')') depth--;
  if (token.text === ',' && depth === 0) groups.push([]); else groups.at(-1)!.push(token);
 }
 return groups.length <= maximum && groups.every(group => {
  const result = inspectExpression(group); return !result.error && !result.opaque;
 });
}
/** Declaration shapes only: never claims that a handler is active or triggered. */
export function parseFlowEvent(tokens: Token[]): FlowEventForm | undefined {
 const at = tokens.findIndex(t => is(t, 'GOSUB') || is(t, 'GOTO'));
 const targetLine = at < 0 ? undefined : line(tokens.slice(at + 1));
 if (is(tokens[0], 'ON') && is(tokens[1], 'BREAK')) {
  if (tokens.length === 3 && (is(tokens[2], 'CONT') || is(tokens[2], 'STOP'))) return { event: 'break', action: is(tokens[2], 'CONT') ? 'continue' : 'stop', targetLine: null };
  if (at === 2 && is(tokens[at], 'GOSUB') && targetLine) return { event: 'break', action: 'register', targetLine };
 } else if (is(tokens[0], 'ON') && is(tokens[1], 'ERROR')) {
  if (at === 2 && is(tokens[at], 'GOTO') && targetLine !== undefined) return { event: 'error', action: targetLine === 0 ? 'disable' : 'register', targetLine: targetLine || null };
 } else if (is(tokens[0], 'ON') && is(tokens[1], 'SQ')) {
  if (at > 4 && tokens[2]?.text === '(' && tokens[at - 1]?.text === ')' && expressions(tokens.slice(3, at - 1), 1) && is(tokens[at], 'GOSUB') && targetLine) return { event: 'sound', action: 'register', targetLine };
 } else if (is(tokens[0], 'AFTER') || is(tokens[0], 'EVERY')) {
  if (at > 1 && expressions(tokens.slice(1, at), 2) && is(tokens[at], 'GOSUB') && targetLine) return { event: is(tokens[0], 'AFTER') ? 'after' : 'every', action: 'register', targetLine };
 }
 return undefined;
}
