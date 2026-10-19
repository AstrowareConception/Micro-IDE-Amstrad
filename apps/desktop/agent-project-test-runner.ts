import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import type {FirmwareStore} from './firmware-store.ts';
import type {AgentProjectTestPort} from '../../packages/agent/src/project-tests.ts';
import type {ProjectTestResult} from '../../packages/emulator/src/project-tests.ts';
/** Main owns firmware and the worker location; no renderer/model filesystem arguments. */
export function agentProjectTestRunner(firmware:Pick<FirmwareStore,'load'>,root:string):AgentProjectTestPort['run']{
 return async(snapshot,scenario,signal)=>{
  signal.throwIfAborted();const roms=await firmware.load().catch(()=>{throw Error('ROM locales absentes ou invalides : ouvrir Configuration ROM.');});signal.throwIfAborted();
  const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
  if(hash(snapshot.disk)!==snapshot.diskSha256)throw Error('Empreinte du DSK projet incohérente.');
  const image={disk:snapshot.disk,entry:snapshot.entry,label:scenario.name,sha256:snapshot.diskSha256,roms,firmware:Object.fromEntries(Object.entries(roms).map(([role,bytes])=>[role,hash(bytes)]))};
  const worker=new Worker(new URL(import.meta.url.endsWith('.ts')?'./agent-project-test-worker.ts':'./agent-project-test-worker.js',import.meta.url),{workerData:{root,image,scenario},execArgv:[],env:{},resourceLimits:{maxOldGenerationSizeMb:128,stackSizeMb:4}});
  let clean=()=>{};
  try{return await new Promise<ProjectTestResult>((resolve,reject)=>{
   const abort=()=>reject(Error('Essai CPC projet arrêté.')),timer=setTimeout(()=>reject(Error('Délai réel de l’essai projet atteint.')),60_000);
   signal.addEventListener('abort',abort,{once:true});clean=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);};
   worker.once('message',(message:{result?:ProjectTestResult;error?:string})=>{if(message.result)resolve(message.result);else reject(Error(message.error??'Résultat CPC projet absent.'));});
   worker.once('error',()=>reject(Error('Worker CPC projet interrompu.')));worker.once('exit',()=>reject(Error('Worker CPC projet terminé sans résultat.')));
   if(signal.aborted)abort();
  });}finally{clean();await worker.terminate();}
 };
}
