import { disassembleZ80 } from './disassemble.ts';

/** Bounded CPCéleste Z80 dialect: one ORG, labels, numeric operands and DEFB.
 * No macros, includes, expressions, external tools or automatic relocation. */
const normalize = (text: string) => text.trim().toUpperCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')');
const registers = ['B','C','D','E','H','L','(HL)','A'];
const pairs = ['BC','DE','HL','SP'];
const conditions = ['NZ','Z','NC','C','PO','PE','P','M'];
const fixed = new Map<string, number[]>();
for (const prefix of [[], [0xcb], [0xed], [0xdd], [0xfd]]) {
  for (let opcode = 0; opcode < 256; opcode++) {
    const bytes = Uint8Array.from([...prefix, opcode, 0x35, 0x46, 0x57]);
    const row = disassembleZ80(bytes, 0x2000)[0]!;
    if (!row.instruction.startsWith('DEFB') && !row.instruction.includes('$') && row.bytes.length === prefix.length + 1 && !fixed.has(row.instruction))
      fixed.set(row.instruction, row.bytes);
  }
}
function number(text: string, labels: Map<string, number>, unresolved: boolean): number {
  const value = text.trim().toUpperCase();
  if (/^[+-]?\d+$/.test(value)) return Number(value);
  if (/^\$[0-9A-F]+$/.test(value)) return parseInt(value.slice(1), 16);
  if (/^0X[0-9A-F]+$/.test(value)) return parseInt(value.slice(2), 16);
  if (/^[A-Z_][A-Z0-9_]*$/.test(value)) {
    if (labels.has(value)) return labels.get(value)!;
    if (unresolved) return 0;
  }
  throw Error(`Nombre ou label inconnu : ${text}`);
}
function encode(text: string, address: number, labels: Map<string, number>, unresolved: boolean): number[] {
  const constant = fixed.get(text); if (constant) return [...constant];
  const match = /^([A-Z]+)\s*(.*)$/.exec(text); if (!match) throw Error('Instruction invalide.');
  const op = match[1]!, args = match[2]!.split(',').map(value => value.trim());
  const value = (s: string, min: number, max: number) => { const n = number(s, labels, unresolved); if (!Number.isSafeInteger(n) || n < min || n > max) throw Error(`Opérande hors plage : ${s}`); return n; };
  const byte = (s: string) => value(s, 0, 255);
  const word = (s: string) => { const n = value(s, 0, 65535); return [n & 255, n >>> 8]; };
  const indirect = (s: string) => /^\((.+)\)$/.exec(s)?.[1];
  const indexed = (s: string): number[] | undefined => {
    const m = /^\((IX|IY)([+-])(.+)\)$/.exec(s); if (!m) return;
    const d = number(m[3]!, labels, unresolved) * (m[2] === '-' ? -1 : 1);
    if (!Number.isInteger(d) || d < -128 || d > 127) throw Error('Déplacement indexé hors plage.');
    return [m[1] === 'IX' ? 0xdd : 0xfd, d & 255];
  };
  if (op === 'DEFB' && args.length <= 256) return args.map(byte);
  if (['JP','CALL'].includes(op)) {
    const conditional = args.length === 2, condition = conditions.indexOf(args[0]!);
    if (args.length > 2 || conditional && condition < 0) throw Error('Condition invalide.');
    return [conditional ? (op === 'JP' ? 0xc2 : 0xc4) + condition * 8 : op === 'JP' ? 0xc3 : 0xcd, ...word(args.at(-1)!)];
  }
  if (op === 'JR' || op === 'DJNZ') {
    const condition = conditions.slice(0, 4).indexOf(args[0]!);
    if (args.length > 2 || args.length === 2 && (op !== 'JR' || condition < 0)) throw Error('Condition relative invalide.');
    const target = value(args.at(-1)!, 0, 65535);
    let delta = (target - ((address + 2) & 65535) + 65536) % 65536;
    if (delta > 32767) delta -= 65536;
    if (!unresolved && (delta < -128 || delta > 127)) throw Error('Saut relatif hors plage.');
    return [op === 'DJNZ' ? 0x10 : args.length === 1 ? 0x18 : 0x20 + condition * 8, delta & 255];
  }
  if (op === 'RST' && args.length === 1) { const n = byte(args[0]!); if (n > 56 || n % 8) throw Error('Vecteur RST invalide.'); return [0xc7 + n]; }
  if (op === 'LD' && args.length === 2) {
    const [a,b] = args as [string,string], r = registers.indexOf(a), pair = pairs.indexOf(a), ia = indexed(a), ib = indexed(b);
    if (ia) { const s = registers.indexOf(b); return s >= 0 && s !== 6 ? [ia[0]!, 0x70 + s, ia[1]!] : [ia[0]!, 0x36, ia[1]!, byte(b)]; }
    if (ib && r >= 0 && r !== 6) return [ib[0]!, 0x46 + r * 8, ib[1]!];
    const memB = indirect(b), memA = indirect(a);
    if (memB && ['A','BC','DE','HL','SP','IX','IY'].includes(a)) {
      if (a === 'A') return [0x3a, ...word(memB)];
      if (a === 'HL') return [0x2a, ...word(memB)];
      if (a === 'IX' || a === 'IY') return [a === 'IX' ? 0xdd : 0xfd, 0x2a, ...word(memB)];
      return [0xed, 0x4b + pairs.indexOf(a) * 16, ...word(memB)];
    }
    if (memA && ['A','BC','DE','HL','SP','IX','IY'].includes(b)) {
      if (b === 'A') return [0x32, ...word(memA)];
      if (b === 'HL') return [0x22, ...word(memA)];
      if (b === 'IX' || b === 'IY') return [b === 'IX' ? 0xdd : 0xfd, 0x22, ...word(memA)];
      return [0xed, 0x43 + pairs.indexOf(b) * 16, ...word(memA)];
    }
    if (r >= 0) return [0x06 + r * 8, byte(b)];
    if (pair >= 0) return [0x01 + pair * 16, ...word(b)];
    if (a === 'IX' || a === 'IY') return [a === 'IX' ? 0xdd : 0xfd, 0x21, ...word(b)];
  }
  const arithmetic = ['ADD','ADC','SUB','SBC','AND','XOR','OR','CP'].indexOf(op);
  if (arithmetic >= 0 && (args.length === 1 || args.length === 2 && args[0] === 'A')) {
    const operand = args.at(-1)!, i = indexed(operand);
    if (i) return [i[0]!, 0x86 + arithmetic * 8, i[1]!];
    return [0xc6 + arithmetic * 8, byte(operand)];
  }
  if (['INC','DEC'].includes(op) && args.length === 1) { const i = indexed(args[0]!); if (i) return [i[0]!, op === 'INC' ? 0x34 : 0x35, i[1]!]; }
  const rotate = ['RLC','RRC','RL','RR','SLA','SRA','SLL','SRL'].indexOf(op);
  if (rotate >= 0 && rotate !== 6 && args.length === 1) { const i = indexed(args[0]!); if (i) return [i[0]!, 0xcb, i[1]!, rotate * 8 + 6]; }
  const bitOp = ['BIT','RES','SET'].indexOf(op);
  if (bitOp >= 0 && args.length === 2) { const i = indexed(args[1]!); if (i) return [i[0]!, 0xcb, i[1]!, 0x40 + bitOp * 0x40 + value(args[0]!, 0, 7) * 8 + 6]; }
  if (op === 'IN' && args.length === 2 && args[0] === 'A' && indirect(args[1]!)) return [0xdb, byte(indirect(args[1]!)!)];
  if (op === 'OUT' && args.length === 2 && args[1] === 'A' && indirect(args[0]!)) return [0xd3, byte(indirect(args[0]!)!)];
  throw Error(`Instruction non prise en charge : ${text}`);
}
export function assembleZ80(source: string): { origin: number; bytes: Uint8Array } {
  if (typeof source !== 'string' || source.length > 1024 * 1024 || source.includes('\0')) throw Error('Listing Z80 limité à 1 Mio.');
  const lines = source.split(/\r?\n/); if (lines.length > 20000) throw Error('Trop de lignes assembleur.');
  const labels = new Map<string, number>(); let origin = -1, bytes: number[] = [];
  for (let pass = 0; pass < 2; pass++) {
    origin = -1; bytes = [];
    for (let index = 0; index < lines.length; index++) {
      try {
        let line = normalize(lines[index]!.split(';')[0]!); if (!line) continue;
        const label = /^([A-Z_][A-Z0-9_]*):\s*(.*)$/.exec(line);
        if (label) {
          if (origin < 0) throw Error('ORG requis avant un label.');
          if (pass === 0) { if (labels.has(label[1]!)) throw Error('Label dupliqué.'); labels.set(label[1]!, origin + bytes.length); }
          line = label[2]!; if (!line) continue;
        }
        if (/^ORG\s/.test(line)) {
          if (origin >= 0) throw Error('Une seule origine est autorisée.');
          origin = number(line.slice(4), new Map(), false);
          if (!Number.isInteger(origin) || origin < 0 || origin > 65535) throw Error('Origine invalide.');
          continue;
        }
        if (origin < 0) throw Error('ORG explicite requis.');
        bytes.push(...encode(line, origin + bytes.length, labels, pass === 0));
        if (bytes.length > 16384 || origin + bytes.length > 65536) throw Error('Plage limitée à 16 Kio sans débordement.');
      } catch (error) { throw Error(`Ligne ${index + 1} : ${error instanceof Error ? error.message : error}`); }
    }
  }
  if (origin < 0 || !bytes.length) throw Error('ORG et au moins un octet requis.');
  return { origin, bytes: Uint8Array.from(bytes) };
}
export function reassemblableListing(bytes: Uint8Array, origin: number, code: boolean): string {
  let listing = `; CPCeleste Z80 : ORG, labels, instructions documentees, DEFB\nORG $${origin.toString(16).toUpperCase()}\n`;
  const rows = code ? disassembleZ80(bytes, origin) : [...bytes].map((byte, i) => ({ address: origin + i, bytes: [byte], instruction: `DEFB $${byte.toString(16)}` }));
  for (const row of rows) {
    let instruction = row.instruction;
    try { const encoded = assembleZ80(`ORG $${row.address.toString(16)}\n${instruction}`); if (encoded.bytes.length !== row.bytes.length || encoded.bytes.some((b,i) => b !== row.bytes[i])) throw Error('alias'); }
    catch { instruction = 'DEFB ' + row.bytes.map(b => '$' + b.toString(16).padStart(2,'0')).join(','); }
    listing += `${instruction} ; $${row.address.toString(16).toUpperCase().padStart(4,'0')}\n`;
  }
  const back = assembleZ80(listing);
  if (back.bytes.length !== bytes.length || back.bytes.some((b,i) => b !== bytes[i])) throw Error('Aller-retour Z80 non identique.');
  return listing;
}
