import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { runDisk } from '../../packages/emulator/src/run.ts';
import type { BasicTestSource, BasicTestResult } from '../../packages/emulator/src/basic-tests.ts';
import type { FirmwareStore } from './firmware-store.ts';
/** Fixed bundled worker and engine, main-owned ROM store; no model-provided paths. */
export function agentTestRunner(firmware:Pick<FirmwareStore,'load'>,root:string){
 return async(source:BasicTestSource,seconds:number,signal:AbortSignal):Promise<BasicTestResult>=>{
  signal.throwIfAborted(); const roms=await firmware.load().catch(()=>{throw Error('ROM locales absentes ou invalides : ouvrir Configuration ROM.');});signal.throwIfAborted();
  const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
  const disk=runDisk({source:source.source});
  const image={...disk,label:source.name,sha256:hash(disk.disk),roms,firmware:Object.fromEntries(Object.entries(roms).map(([role,bytes])=>[role,hash(bytes)]))};
  const worker=new Worker(new URL(import.meta.url.endsWith('.ts')?'./agent-test-worker.ts':'./agent-test-worker.js',import.meta.url),{workerData:{root,source,image,seconds},execArgv:[],env:{},resourceLimits:{maxOldGenerationSizeMb:128,stackSizeMb:4}});
  try{return await new Promise<BasicTestResult>((resolve,reject)=>{
   const abort=()=>reject(Error('Tests CPC arrêtés.'));
   const timer=setTimeout(()=>reject(Error('Délai réel de tests CPC atteint.')),60_000);
   signal.addEventListener('abort',abort,{once:true});
   const clean=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);};
   worker.once('message',(message:{result?:BasicTestResult;error?:string})=>{clean();if(message.result)resolve(message.result);else reject(Error(message.error??'Résultat CPC absent.'));});
   worker.once('error',()=>{clean();reject(Error('Worker CPC interrompu.'));});
   worker.once('exit',()=>{clean();reject(Error('Worker CPC terminé sans résultat.'));});
   if(signal.aborted)abort();
  });}finally{await worker.terminate();}
 };
}
