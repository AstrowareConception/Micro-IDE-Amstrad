import type { Token } from './language.ts';

/** Recognize only scalar = atom division atom; no evaluation or type inference. */
export function simpleDivisionOperator(tokens: Token[]): '/' | '\\' | 'MOD' | null {
 let cursor = tokens[0]?.kind === 'keyword' && tokens[0].text.toUpperCase() === 'LET' ? 1 : 0;
 const scalar = (token: Token | undefined) => token?.kind === 'identifier' && !token.text.endsWith('$');
 if (!scalar(tokens[cursor++]) || tokens[cursor++]?.text !== '=') return null;
 function atom(): boolean {
  const token = tokens[cursor];
  if (scalar(token)) { cursor++; return true; }
  if (token?.text === '+' || token?.text === '-') cursor++;
  const number = tokens[cursor++];
  return number?.kind === 'number' && /^\d+$/.test(number.text) && Number(number.text) <= 32767;
 }
 if (!atom()) return null;
 const operator = tokens[cursor++];
 if (!(operator?.kind === 'operator' && ['/', '\\'].includes(operator.text) || operator?.kind === 'keyword' && operator.text.toUpperCase() === 'MOD')) return null;
 return atom() && cursor === tokens.length ? operator.text.toUpperCase() as '/' | '\\' | 'MOD' : null;
}
