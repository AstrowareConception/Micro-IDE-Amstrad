import {parentPort,workerData} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {executeProjectTest,captureProjectScreen} from '../../packages/emulator/src/project-test-runtime.ts';
import type {BasicTestCpc} from '../../packages/emulator/src/basic-test-runtime.ts';
import type {RunImage} from '../../packages/emulator/src/run.ts';
import type {ProjectScenario} from '../../packages/emulator/src/project-tests.ts';
const {root,image,scenario,mode}=workerData as {root:string;image:RunImage;scenario:ProjectScenario;mode:'test'|'capture'};
try{
 const {default:createCpc}=await import(pathToFileURL(join(root,'cpc.mjs')).href);
 const cpc=await createCpc({wasmBinary:await readFile(join(root,'cpc.wasm'))}) as BasicTestCpc;
 const result=mode==='capture'?await captureProjectScreen(cpc,image,scenario,async()=>{}):await executeProjectTest(cpc,image,scenario,async()=>{});
 parentPort!.postMessage({result});
}catch(error){parentPort!.postMessage({error:error instanceof Error?error.message.slice(0,1024):'Moteur CPC de test projet indisponible ; vérifiez le paquet installé.'});}
