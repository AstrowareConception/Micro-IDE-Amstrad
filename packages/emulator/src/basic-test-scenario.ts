import { createDataDisk, readDataDisk, decodeAsciiRecords, validateCpcName } from '../../cpc-disk/src/data-disk.ts';
export interface BasicScenarioInput { atMs: number; text: string }
export interface BasicScenarioFixture { name: string; text: string }
export interface BasicScenarioCheckIdentity { kind: 'screen' | 'file'; name: string; line: number }
export type BasicScenarioCheck = BasicScenarioCheckIdentity & ({ kind: 'screen'; x: number; y: number; width: number; height: number; sha256: string } | { kind: 'file'; text: string });
export interface BasicScenario { inputs: BasicScenarioInput[]; fixtures: BasicScenarioFixture[]; checks: BasicScenarioCheck[] }
export interface BasicScenarioCapture { name: string; line: number; width: number; height: number; rgba: Uint8Array }
export interface BasicScenarioObservation extends BasicScenarioCheckIdentity { outcome: 'passed' | 'failed'; expectedSha256: string; actualSha256: string | null; message: string }
const HASH = /^[a-f0-9]{64}$/;
const ascii = (text: unknown, limit: number, keyboard = false): string => {
 if (typeof text !== 'string' || text.length > limit || (keyboard ? /[^\x20-\x7e\r]/ : /[^\x20-\x7e\t\r\n]/).test(text)) throw new Error('Texte de scénario ASCII hors limites.');
 return text;
};
function quoted(raw: string): unknown { try { return JSON.parse(raw); } catch { throw new Error('Chaîne JSON de scénario invalide ; utilisez les guillemets et les échappements JSON.'); } }
export function parseBasicScenario(source: string): BasicScenario | undefined {
 const scenario: BasicScenario = { inputs: [], fixtures: [], checks: [] };
 let directives = 0;
 for (const [index, line] of source.split(/\r?\n/).entries()) {
  const marker = /^\s*\d+\s+REM\s+@(CPCINPUT|CPCFIXTURE|CPCFILE|CPCSCREEN)\b(.*)$/i.exec(line);
  if (!marker) continue;
  directives++;
  const kind = marker[1]!.toUpperCase(), tail = marker[2]!.trim();
  if (kind === 'CPCINPUT') {
   const match = /^(\d+)\s+(".*")$/.exec(tail); if (!match) throw new Error(`@CPCINPUT invalide à la ligne ${index + 1}.`);
   const atMs = Number(match[1]), text = ascii(quoted(match[2]!), 64, true), last = scenario.inputs.at(-1);
   if (!text.length || !Number.isInteger(atMs) || atMs % 20 !== 0 || atMs < 0 || atMs + text.length * 120 > 15000 || last && atMs < last.atMs + last.text.length * 120) throw new Error('Saisies ordonnées, sans chevauchement, par pas de 20 ms et dans les 15 secondes.');
   scenario.inputs.push({ atMs, text });
  } else if (kind === 'CPCFIXTURE' || kind === 'CPCFILE') {
   const match = /^([A-Z0-9_.]+)\s+(".*")$/.exec(tail); if (!match) throw new Error(`@${kind} invalide à la ligne ${index + 1}.`);
   const name = match[1]!, text = ascii(quoted(match[2]!), 2048); validateCpcName(name);
   if (kind === 'CPCFIXTURE') { if (name === 'MAIN.BAS' || scenario.fixtures.some(item => item.name === name)) throw new Error('Fixture dupliquée ou MAIN.BAS réservé.'); scenario.fixtures.push({ name, text }); }
   else scenario.checks.push({ kind: 'file', name, text, line: index + 1 });
  } else {
   const match = /^([A-Za-z0-9_-]{1,40})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([a-f0-9]{64})$/.exec(tail);
   if (!match) throw new Error(`@CPCSCREEN invalide à la ligne ${index + 1}.`);
   const [x, y, width, height] = match.slice(2, 6).map(Number) as [number, number, number, number];
   if (width < 1 || height < 1 || width * height > 16384 || x + width > 768 || y + height > 272) throw new Error('Zone écran hors du cadre 768 × 272 ou supérieure à 16 384 pixels.');
   scenario.checks.push({ kind: 'screen', name: match[1]!, x, y, width, height, sha256: match[6]!, line: index + 1 });
  }
  if (scenario.inputs.length > 8 || scenario.inputs.reduce((sum, input) => sum + input.text.length, 0) > 64 || scenario.fixtures.length > 4 || scenario.fixtures.reduce((sum, item) => sum + item.text.length, 0) > 4096 || scenario.checks.length > 8) throw new Error('Scénario limité à 8 saisies/64 touches, 4 fixtures/4 Kio et 8 observations.');
 }
 if (new Set(scenario.checks.map(item => `${item.kind}:${item.name}`)).size !== scenario.checks.length) throw new Error('Observation de scénario dupliquée.');
 return directives ? scenario : undefined;
}
export function validateScenarioBudget(scenario: BasicScenario | undefined, seconds: number): void {
 if (scenario?.inputs.some(input => input.atMs + input.text.length * 120 > seconds * 1000)) throw new Error('Le budget doit couvrir la saisie entière (120 ms par touche, appui et relâchement).');
}
/** Copies a validated one-listing DATA image, injecting headerless ASCII fixtures only. */
export function scenarioDisk(disk: Uint8Array, fixtures: readonly BasicScenarioFixture[]): Uint8Array {
 if (!fixtures.length) return disk.slice();
 const original = readDataDisk(disk);
 if (original.length !== 1 || original[0]!.name !== 'MAIN.BAS') throw new Error('DSK de scénario autonome requis.');
 return createDataDisk([{ name: 'MAIN.BAS', bytes: original[0]!.records }, ...fixtures.map(item => ({ name: item.name, bytes: new TextEncoder().encode(item.text + '\x1a') }))]);
}
/** Only headerless ASCII with a logical EOF is qualified; binary/headered files are refused. */
export function scenarioFileBytes(disk: Uint8Array, name: string): Uint8Array | undefined {
 const file = readDataDisk(disk).find(item => item.name === name); if (!file) return undefined;
 const bytes = decodeAsciiRecords(file.records).slice(0, -1);
 if (bytes.some(value => value !== 9 && value !== 10 && value !== 13 && (value < 32 || value > 126))) throw new Error('Fichier produit hors du profil ASCII sans en-tête.');
 return bytes;
}
export function validScenarioObservations(value: unknown, expected: readonly BasicScenarioCheckIdentity[]): value is BasicScenarioObservation[] {
 if (!Array.isArray(value) || value.length !== expected.length || value.length > 8) return false;
 return value.every((raw, index) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const item = raw as BasicScenarioObservation, declaration = expected[index]!;
  return Object.keys(item).sort().join() === 'actualSha256,expectedSha256,kind,line,message,name,outcome'
   && item.kind === declaration.kind && item.name === declaration.name && item.line === declaration.line
   && typeof item.expectedSha256 === 'string' && HASH.test(item.expectedSha256)
   && (!('sha256' in declaration) || item.expectedSha256 === declaration.sha256)
   && (item.actualSha256 === null || typeof item.actualSha256 === 'string' && HASH.test(item.actualSha256))
   && typeof item.message === 'string' && item.message.length <= 512
   && item.outcome === (item.actualSha256 === item.expectedSha256 ? 'passed' : 'failed');
 });
}

export function validScenarioCaptures(value: unknown, scenario: BasicScenario | undefined): value is BasicScenarioCapture[] {
 if (!Array.isArray(value) || value.length > 8) return false;
 const screens = scenario?.checks.filter(item => item.kind === 'screen') ?? [];
 return value.length === screens.length && value.every((item, index) => {
  const check = screens[index]!;
  return item && typeof item === 'object' && check.kind === 'screen' && item.name === check.name && item.line === check.line && item.width === check.width && item.height === check.height && item.rgba instanceof Uint8Array && item.rgba.length === check.width * check.height * 4;
 });
}
