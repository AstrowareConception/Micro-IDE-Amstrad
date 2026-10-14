import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { basicTestPlan, type BasicTestSource } from '../../packages/emulator/src/basic-tests.ts';
import { executeBasicTests, type BasicTestCpc } from '../../packages/emulator/src/basic-test-runtime.ts';
import type { RunImage } from '../../packages/emulator/src/run.ts';
const {root,source,image,seconds}=workerData as {root:string;source:BasicTestSource;image:RunImage;seconds:number};
try {
 const {default:createCpc}=await import(pathToFileURL(join(root,'cpc.mjs')).href);
 const cpc=await createCpc({wasmBinary:await readFile(join(root,'cpc.wasm'))}) as BasicTestCpc;
 const result=await executeBasicTests(cpc,image,basicTestPlan(source),seconds,async()=>{});
 parentPort!.postMessage({result});
}catch{parentPort!.postMessage({error:'Moteur CPC de test indisponible ; vérifiez le paquet installé.'});}
