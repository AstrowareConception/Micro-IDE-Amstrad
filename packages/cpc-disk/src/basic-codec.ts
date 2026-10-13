import { BasicTokenizer } from '../vendor/cpcbasic/BasicTokenizer.ts';
import { BasicLexer } from '../vendor/cpcbasic/BasicLexer.ts';
import { BasicParser } from '../vendor/cpcbasic/BasicParser.ts';
import { CodeGeneratorToken } from '../vendor/cpcbasic/CodeGeneratorToken.ts';
import { encodeBasicAscii } from './basic-ascii.ts';
import { encodeAmsdosBinary } from './amsdos-binary.ts';

/** AMSDOS SAVE ,P transform; symmetric, reset at each 128-byte record. Not encryption. */
export function protectBasic(bytes: Uint8Array): Uint8Array {
  const a = [0xe2,0x9d,0xdb,0x1a,0x42,0x29,0x39,0xc6,0xb3,0xc6,0x90,0x45,0x8a];
  const b = [0x49,0xb1,0x36,0xf0,0x2e,0x1e,0x06,0x2a,0x28,0x19,0xea];
  return bytes.map((byte, i) => byte ^ a[(i & 127) % 13]! ^ b[(i & 127) % 11]!);
}
/** Validate every boundary before entering the third-party decoder. Never decode memory pointers. */
export function validateTokenized(bytes: Uint8Array): void {
  if (bytes.length < 2 || bytes.length > 65535) throw new Error('Longueur BASIC tokenisé invalide.');
  const word = (p: number) => bytes[p]! + 256 * bytes[p + 1]!;
  let p = 0, previous = 0;
  while (p + 2 <= bytes.length) {
    const length = word(p);
    if (length === 0) {
      if (p + 2 !== bytes.length) throw new Error('Octets après la fin du programme BASIC.');
      return;
    }
    const end = p + length - 1, line = word(p + 2);
    if (length < 5 || end >= bytes.length || bytes[end] !== 0 || line <= previous) throw new Error('Ligne BASIC tronquée ou numérotation invalide.');
    previous = line; p += 4;
    const take = (n: number) => { if (p + n > end) throw new Error('Token BASIC tronqué.'); p += n; };
    while (p < end) {
      const token = bytes[p++]!;
      if (token === 0xc0 || token === 0xc5) { p = end; break; }
      if (token === 0x8c) { let quoted=false; while(p<end) { if(bytes[p]===34)quoted=!quoted; if(bytes[p]===1&&!quoted)break; p++; } continue; }
      if (token === 0x22) { while (p < end && bytes[p] !== 0x22) p++; if (p < end) p++; continue; }
      if ([2,3,4,11,12,13,0x7c].includes(token)) {
        take(token === 0x7c ? 1 : 2);
        const start = p;
        while (p < end && bytes[p]! < 128) p++;
        if (p >= end || p - start > 40 || p === start && (bytes[p]! & 127) < 65) throw new Error('Nom BASIC non terminé ou invalide.');
        p++; continue;
      }
      if (token === 0x19) take(1);
      else if ([0x1a,0x1b,0x1c,0x1e].includes(token)) take(2);
      else if (token === 0x1f) take(5);
      else if (token === 0xff) {
        take(1); const extension = bytes[p - 1]!;
        if (!(extension <= 0x1d || extension >= 0x40 && extension <= 0x49 || extension >= 0x71 && extension <= 0x7f)) throw new Error('Token étendu inconnu.');
      } else if (token === 0x1d) throw new Error('Pointeur BASIC en mémoire : adresse de programme requise, conversion refusée.');
      else if (token === 0 || token >= 5 && token <= 10 || [0x7d,0x7e,0x7f,0xe2,0xe8,0xe9].includes(token)) throw new Error('Token BASIC inconnu.');
    }
    p = end + 1;
  }
  throw new Error('Fin de programme BASIC absente.');
}
function binaryString(bytes: Uint8Array): string { let result = ''; for (const byte of bytes) result += String.fromCharCode(byte); return result; }
export function detokenizeBasic(bytes: Uint8Array): string {
  validateTokenized(bytes);
  const result = new BasicTokenizer().decode(binaryString(bytes));
  // Never silently turn CPC control/graphic bytes into unrelated Unicode characters.
  if (/[^\x20-\x7e\n]/.test(result)) throw new Error('Caractères CPC graphiques/contrôles non convertibles en listing ASCII ; original conservé.');
  encodeBasicAscii(result);
  return result;
}
export function tokenizeBasic(source: string): Uint8Array {
  if (source.length > 65535 || source.split('\n').some(line => line.length > 255)) throw new Error('Export tokenisé limité à 64 Kio et 255 caractères par ligne.');
  encodeBasicAscii(source);
  const parser = new BasicParser({ quiet: true, keepTokens: true, keepBrackets: true, keepColons: true, keepDataComma: true });
  const lexer = new BasicLexer({ keywords: parser.getKeywords(), keepWhiteSpace: true, quiet: true });
  const output = new CodeGeneratorToken({ parser, lexer, quiet: true }).generate(source);
  if (output.error) throw new Error(output.error.message);
  const bytes = Uint8Array.from(output.text, char => char.charCodeAt(0));
  validateTokenized(bytes); return bytes;
}
export function encodeBasicFile(name: string, source: string, protectedMode = false): Uint8Array {
  const tokens = tokenizeBasic(source);
  const file = encodeAmsdosBinary(name, protectedMode ? protectBasic(tokens) : tokens, 0x170);
  file[18] = protectedMode ? 1 : 0;
  const checksum = file.subarray(0,67).reduce((sum, byte) => sum + byte, 0);
  file[67] = checksum & 255; file[68] = checksum >>> 8;
  return file;
}
