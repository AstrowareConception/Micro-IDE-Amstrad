import type { Token } from './language.ts';

const precedence: Record<string, number> = { OR: 1, XOR: 2, AND: 3, '=': 4, '<>': 4, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '\\': 6, MOD: 6, '^': 7 };
const values = new Set('ABS ASC ATN BIN$ CHR$ CINT COPYCHR$ COS CREAL DEC$ DERR EOF ERL ERR EXP FIX FRE HEX$ HIMEM INKEY INKEY$ INP INSTR INT JOY LEFT$ LEN LOG LOG10 LOWER$ MAX MID$ MIN PEEK PI POS REMAIN RIGHT$ RND ROUND SGN SIN SPACE$ SQ SQR STR$ STRING$ TAN TEST TESTR TIME UNT UPPER$ VAL VPOS XPOS YPOS'.split(' '));

/** Pratt parser for ordinary CPC expressions. Returns the first offending token.
 * Stream/address forms are intentionally opaque to this editor-only inspection.
 */
export function inspectExpression(tokens: Token[]): { error: Token | undefined; opaque: boolean } {
  if (!tokens.length || tokens.length > 1024 || tokens.some(token => ['#', '@', 'FN'].includes(token.text.toUpperCase()))) return { error: undefined, opaque: true };
  let cursor = 0;
  let depth = 0;
  let limited = false;
  let error: Token | undefined;
  const value = () => tokens[cursor]?.text.toUpperCase() ?? '';
  const fail = () => { error ??= tokens[cursor] ?? tokens.at(-1); };
  function primary(): boolean {
    if (++depth > 64) { limited = true; depth--; return false; }
    const result = primaryValue(); depth--; return result;
  }
  function primaryValue(): boolean {
    const token = tokens[cursor];
    if (!token) { fail(); return false; }
    if (['+', '-', 'NOT'].includes(value())) { cursor++; return primary(); }
    if (token.text === '(') {
      cursor++; if (!expression(1)) return false;
      if (value() !== ')') { fail(); return false; }
      cursor++; return true;
    }
    if (token.kind === 'number' || token.kind === 'string') { cursor++; return true; }
    if (token.kind === 'identifier' || token.kind === 'keyword' && values.has(value())) {
      cursor++;
      // Arrays and functions share the same expression argument grammar.
      if (value() === '(') {
        cursor++; if (!expression(1)) return false;
        while (value() === ',') { cursor++; if (!expression(1)) return false; }
        if (value() !== ')') { fail(); return false; }
        cursor++;
      }
      return true;
    }
    fail(); return false;
  }
  function expression(minimum: number): boolean {
    if (++depth > 64) { limited = true; depth--; return false; }
    const result = expressionValue(minimum); depth--; return result;
  }
  function expressionValue(minimum: number): boolean {
    if (!primary()) return false;
    while (cursor < tokens.length) {
      let operator = value(), width = 1;
      const combined = operator + (tokens[cursor + 1]?.text ?? '');
      if (['<=', '>=', '<>'].includes(combined)) { operator = combined; width = 2; }
      const rank = precedence[operator];
      if (rank === undefined || rank < minimum) break;
      cursor += width;
      if (!expression(rank + (operator === '^' ? 0 : 1))) return false;
    }
    return true;
  }
  if (expression(1) && cursor < tokens.length) fail();
  return { error: limited ? undefined : error, opaque: limited };
}

export const expressionError = (tokens: Token[]): Token | undefined => inspectExpression(tokens).error;
