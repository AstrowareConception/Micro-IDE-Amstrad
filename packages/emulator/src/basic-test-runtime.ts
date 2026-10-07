import { scenarioDisk, scenarioFileBytes, validateScenarioBudget, type BasicScenarioObservation, type BasicScenarioCapture } from './basic-test-scenario.ts';
// WASM adapter shared by the disposable browser worker and the firmware recipe.
import { BASIC_TEST_MAILBOX, completedBasicTests, BASIC_TEST_LIMITS, type BasicTestPlan, type BasicTestResult } from './basic-tests.ts';
import { runCommand, type RunImage } from './run.ts';
export const BASIC_TEST_FIRMWARE = {
 os: 'ce133ea170940147f6c73d6c9f9e7a05be81fc8ff9aae8386011c47e593852bf',
 basic: '58503070d553d7152a2dbce40976418281a8bf1f4a5a7ede75269f2e39275977',
 amsdos: 'ea65e0fb44ee93ede4b6c507509b7e5ddf497fb7155023bea91ef229469fa04d',
} as const;
export const BASIC_TEST_READY = '463daf9b810f7bc36fb0c570a970269051bd023c91c6db7935ea21c0add3b607';
export interface BasicTestCpc {
 HEAPU8: Uint8Array; _malloc(size: number): number; _free(pointer: number): void;
 _cpc_bridge_init(a: number, al: number, b: number, bl: number, c: number, cl: number): number;
 _cpc_bridge_mount(pointer: number, length: number): number; _cpc_bridge_step(us: number): number;
 _cpc_bridge_pause(paused: number): number; _cpc_bridge_key(key: number, down: number): number;
 _cpc_bridge_release_keys(): void; _cpc_bridge_dispose(): void;
 _cpc_bridge_register(index: number): number; _cpc_bridge_read_ram(address: number, pointer: number, length: number): number;
 _cpc_bridge_export(pointer: number, capacity: number): number; _cpc_bridge_palette(): number; _cpc_bridge_height(): number;
 _cpc_bridge_width(): number; _cpc_bridge_stride(): number; _cpc_bridge_frame(): number; _cpc_bridge_ticks(): number;
}
export async function basicTestHash(bytes: Uint8Array): Promise<string> {
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function executeBasicTests(cpc: BasicTestCpc, image: RunImage, plan: BasicTestPlan, seconds: number, yieldStep: () => Promise<void>, onCapture?: (capture: BasicScenarioCapture) => void): Promise<BasicTestResult> {
 const result: BasicTestResult = { sourceId: plan.source.id, name: plan.source.name, outcome: 'blocked', message: '', cases: [], emulatedSeconds: 0 };
 const allocated: number[] = [];
 const check = (value: number) => { if (value < 0) throw new Error('Opération du moteur CPC refusée.'); return value; };
 const put = (bytes: Uint8Array) => { const pointer = cpc._malloc(bytes.length); if (!pointer) throw new Error('Mémoire WASM indisponible.'); allocated.push(pointer); cpc.HEAPU8.set(bytes, pointer); return pointer; };
 let ticks = 0;
 try {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > BASIC_TEST_LIMITS.seconds) throw new Error('Budget émulé invalide (1–15 secondes).');
  validateScenarioBudget(plan.scenario, seconds);
  if (image.disk.length !== 194816 || image.entry !== 'MAIN.BAS') throw new Error('DSK de test indépendant requis.');
  result.diskSha256 = await basicTestHash(image.disk); result.sourceSha256 = await basicTestHash(new TextEncoder().encode(plan.source.source));
  result.firmware = { ...image.firmware };
  for (const role of ['os', 'basic', 'amsdos'] as const) {
   if (!(image.roms[role] instanceof Uint8Array) || image.roms[role].length !== 16384 || await basicTestHash(image.roms[role]) !== BASIC_TEST_FIRMWARE[role] || image.firmware[role] !== BASIC_TEST_FIRMWARE[role]) throw new Error('Tests automatiques non qualifiés pour ces ROM. Importez le jeu CPC 6128 anglais identifié.');
  }
  if (result.diskSha256 !== image.sha256) throw new Error('Empreinte DSK incohérente.');
  const disk = scenarioDisk(image.disk, plan.scenario?.fixtures ?? []);
  result.diskSha256 = await basicTestHash(disk);
  check(cpc._cpc_bridge_init(put(image.roms.os), 16384, put(image.roms.basic), 16384, put(image.roms.amsdos), 16384));
  const output = put(new Uint8Array(36));
  const step = async (count: number) => { for (let i = 0; i < count; i++) { check(cpc._cpc_bridge_step(20000)); if (i % 5 === 4) await yieldStep(); } };
  await step(250);
  const width = cpc._cpc_bridge_width(), stride = cpc._cpc_bridge_stride(), pointer = cpc._cpc_bridge_frame();
  if (width !== 768 || stride < width || pointer < 1 || pointer + stride * 108 > cpc.HEAPU8.length) throw new Error('Écran de démarrage hors profil.');
  const frame = new Uint8Array(width * 108);
  for (let y = 0; y < 108; y++) frame.set(cpc.HEAPU8.subarray(pointer + y * stride, pointer + y * stride + width), y * width);
  if (await basicTestHash(frame) !== BASIC_TEST_READY) throw new Error('Prompt Ready non reconnu ; aucun verdict automatique.');
  const mailbox = () => {
   check(cpc._cpc_bridge_pause(1));
   try {
    if ((check(cpc._cpc_bridge_register(12)) & 7) !== 0) throw new Error('Banque RAM modifiée : protocole de tests non qualifié.');
    if (check(cpc._cpc_bridge_read_ram(BASIC_TEST_MAILBOX, output, 36)) !== 36) throw new Error('Lecture de résultats incomplète.');
    return cpc.HEAPU8.slice(output, output + 36);
   } finally { check(cpc._cpc_bridge_pause(0)); }
  };
  if (mailbox().some(byte => byte !== 0)) throw new Error('Zone de résultats non vierge avant RUN ; test bloqué.');
  check(cpc._cpc_bridge_mount(put(disk), disk.length));
  for (const key of runCommand(image.entry)) {
   check(cpc._cpc_bridge_key(key.charCodeAt(0), 1)); await step(3);
   check(cpc._cpc_bridge_key(key.charCodeAt(0), 0)); await step(3);
  }
  const events = (plan.scenario?.inputs ?? []).flatMap(input => [...input.text].flatMap((key, index) => [
   { step: input.atMs / 20 + index * 6, key: key.charCodeAt(0), down: 1 },
   { step: input.atMs / 20 + index * 6 + 3, key: key.charCodeAt(0), down: 0 },
  ]));
  let eventIndex = 0;
  async function observe(): Promise<BasicScenarioObservation[]> {
   const checks = plan.scenario?.checks ?? [], observations: BasicScenarioObservation[] = [];
   let exported: Uint8Array | undefined;
   if (checks.some(item => item.kind === 'file')) {
    const pointer = put(new Uint8Array(194816));
    if (check(cpc._cpc_bridge_export(pointer, 194816)) !== 194816) throw new Error('Export DSK de scénario incomplet.');
    exported = cpc.HEAPU8.slice(pointer, pointer + 194816);
   }
   for (const assertion of checks) {
    let actual: Uint8Array | undefined, message = '';
    const expectedSha256 = assertion.kind === 'screen' ? assertion.sha256 : await basicTestHash(new TextEncoder().encode(assertion.text));
    if (assertion.kind === 'file') {
     try { actual = scenarioFileBytes(exported!, assertion.name); message = actual ? 'Contenu ASCII comparé après fermeture du fichier.' : 'Fichier absent du DSK final.'; }
     catch { message = 'Fichier ou DSK final hors du profil ASCII DATA qualifié.'; }
    } else {
     const width = cpc._cpc_bridge_width(), height = cpc._cpc_bridge_height(), stride = cpc._cpc_bridge_stride(), frame = cpc._cpc_bridge_frame(), palette = cpc._cpc_bridge_palette();
     if (width !== 768 || height !== 272 || stride < width || frame < 1 || frame + stride * height > cpc.HEAPU8.length || palette < 1 || palette + 32 * 4 > cpc.HEAPU8.length) throw new Error('Écran de scénario hors profil.');
     actual = new Uint8Array(assertion.width * assertion.height * 4);
     for (let y = 0; y < assertion.height; y++) for (let x = 0; x < assertion.width; x++) {
      const color = cpc.HEAPU8[frame + (assertion.y + y) * stride + assertion.x + x]!;
      if (color > 31) throw new Error('Indice de palette CPC hors profil.');
      const offset = (y * assertion.width + x) * 4;
      actual.set(cpc.HEAPU8.subarray(palette + color * 4, palette + color * 4 + 3), offset); actual[offset + 3] = 255;
     }
     onCapture?.({ name: assertion.name, line: assertion.line, width: assertion.width, height: assertion.height, rgba: actual.slice() });
     message = 'Zone RGBA comparée sur la première signature de fin observée.';
    }
    const actualSha256 = actual ? await basicTestHash(actual) : null;
    observations.push({ kind: assertion.kind, name: assertion.name, line: assertion.line, expectedSha256, actualSha256, outcome: actualSha256 === expectedSha256 ? 'passed' : 'failed', message });
   }
   return observations;
  }
  // The program may have finished while the final Return key was released.
  for (let i = 0; i <= seconds * 50; i++) {
   const completed = completedBasicTests(plan, mailbox());
   if (completed) {
    if (events.slice(eventIndex).some(event => event.down)) throw new Error('Fin BASIC reçue avant la fin des saisies prévues ; aucune touche supplémentaire envoyée.');
    cpc._cpc_bridge_release_keys();
    const observations = await observe();
    Object.assign(result, completed);
    if (observations.length) {
     result.observations = observations;
     if (observations.some(item => item.outcome === 'failed') && result.outcome === 'passed') result.outcome = 'failed';
     result.message += observations.every(item => item.outcome === 'passed') ? ' Observations du scénario réussies.' : ' Au moins une observation du scénario a échoué.';
    }
    return result;
   }
   while (eventIndex < events.length && events[eventIndex]!.step === i) {
    const event = events[eventIndex++]!; check(cpc._cpc_bridge_key(event.key, event.down));
   }
   if (i < seconds * 50) await step(1);
   if (i % 5 === 4) await yieldStep();
  }
  result.outcome = 'timeout'; result.message = 'Budget émulé atteint sans signature de fin. Boucle, attente INPUT, erreur BASIC ou protocole manquant possibles ; aucun succès déduit.';
  return result;
 } catch (error) {
  result.outcome = 'blocked'; result.message = error instanceof Error ? error.message : 'Exécution CPC indisponible.'; return result;
 } finally {
  ticks = cpc._cpc_bridge_ticks(); result.emulatedSeconds = Math.max(0, ticks / 4000000);
  cpc._cpc_bridge_release_keys(); cpc._cpc_bridge_dispose(); for (const pointer of allocated) cpc._free(pointer);
 }
}
