import {scenarioFileBytes,type BasicScenario,type BasicScenarioObservation,type BasicScenarioCapture} from './basic-test-scenario.ts';
import {basicTestHash,type BasicTestCpc} from './basic-test-runtime.ts';
export async function observeBasicScenario(cpc:BasicTestCpc,scenario:BasicScenario|undefined,put:(bytes:Uint8Array)=>number,onCapture?: (capture:BasicScenarioCapture)=>void,screenMessage="Zone RGBA comparée sur la première signature de fin observée."):Promise<BasicScenarioObservation[]> {
   const check=(value:number)=>{if(value<0)throw Error("Opération du moteur CPC refusée.");return value;};
   const checks = scenario?.checks ?? [], observations: BasicScenarioObservation[] = [];
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
     actual = readCpcScreen(cpc,assertion);
     onCapture?.({ name: assertion.name, line: assertion.line, width: assertion.width, height: assertion.height, rgba: actual.slice() });
     message = screenMessage;
    }
    const actualSha256 = actual ? await basicTestHash(actual) : null;
    observations.push({ kind: assertion.kind, name: assertion.name, line: assertion.line, expectedSha256, actualSha256, outcome: actualSha256 === expectedSha256 ? 'passed' : 'failed', message });
   }
   return observations;
  }

/** Read opaque RGBA pixels from the same indexed frame/palette used by assertions. */
export function readCpcScreen(cpc:BasicTestCpc,region:{x:number;y:number;width:number;height:number}):Uint8Array {
 if(![region.x,region.y,region.width,region.height].every(Number.isSafeInteger)||region.x<0||region.y<0||region.width<1||region.height<1||region.x+region.width>768||region.y+region.height>272)throw Error("Rectangle CPC invalide.");
 const width = cpc._cpc_bridge_width(), height = cpc._cpc_bridge_height(), stride = cpc._cpc_bridge_stride(), frame = cpc._cpc_bridge_frame(), palette = cpc._cpc_bridge_palette();
     if (width !== 768 || height !== 272 || stride < width || frame < 1 || frame + stride * height > cpc.HEAPU8.length || palette < 1 || palette + 32 * 4 > cpc.HEAPU8.length) throw new Error('Écran de scénario hors profil.');
     const actual = new Uint8Array(region.width * region.height * 4);
     for (let y = 0; y < region.height; y++) for (let x = 0; x < region.width; x++) {
      const color = cpc.HEAPU8[frame + (region.y + y) * stride + region.x + x]!;
      if (color > 31) throw new Error('Indice de palette CPC hors profil.');
      const offset = (y * region.width + x) * 4;
      actual.set(cpc.HEAPU8.subarray(palette + color * 4, palette + color * 4 + 3), offset); actual[offset + 3] = 255;
     }
 return actual;
}
