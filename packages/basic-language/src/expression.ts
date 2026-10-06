import type { Token } from './language.ts';

const precedence: Record<string, number> = { OR: 1, XOR: 2, AND: 3, '=': 4, '<>': 4, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '\\': 6, MOD: 6, '^': 7 };

/** Pratt parser for ordinary CPC expressions. Returns the first offending token.
 * Stream/address forms are intentionally opaque to this editor-only inspection.
 */
export function expressionError(tokens: Token[]): Token | undefined {
  if (!tokens.length || tokens.length > 1024 || tokens.some(token => ['#', '@', 'FN'].includes(token.text.toUpperCase()))) return undefined;
  let cursor = 0;
  let error: Token | undefined;
  const value = () => tokens[cursor]?.text.toUpperCase() ?? '';
  const fail = () => { error ??= tokens[cursor] ?? tokens.at(-1); };
  function primary(): boolean {
    const token = tokens[cursor];
    if (!token) { fail(); return false; }
    if (['+', '-', 'NOT'].includes(value())) { cursor++; return primary(); }
    if (token.text === '(') {
      cursor++; if (!expression(1)) return false;
      if (value() !== ')') { fail(); return false; }
      cursor++; return true;
    }
    if (token.kind === 'number' || token.kind === 'string') { cursor++; return true; }
    if (token.kind === 'identifier' || token.kind === 'keyword') {
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
  return error;
}
