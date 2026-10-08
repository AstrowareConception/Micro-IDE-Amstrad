import type { Token } from './language.ts';

export const CONDITIONAL_DEPTH_LIMIT = 16;

/** Locate this IF's ELSE, skipping ELSEs belonging to nested IFs.
 * Input starts after THEN/GOTO. DATA, strings and comments are indivisible tokens.
 * Qualified on the identified CPC 6128 BASIC 1.1; no source text is evaluated.
 */
export function conditionalElse(body: Token[]): number {
 let depth = 0;
 for (let index = 0; index < body.length; index++) {
  const token = body[index]!;
  if (token.kind === 'comment') break;
  if (token.kind !== 'keyword') continue;
  const name = token.text.toUpperCase();
  if (name === 'IF') depth++;
  else if (name === 'ELSE') {
   if (!depth) return index;
   depth--;
  }
 }
 return -1;
}
