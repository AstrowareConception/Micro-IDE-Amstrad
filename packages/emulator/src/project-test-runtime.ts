import {BASIC_TEST_FIRMWARE,BASIC_TEST_READY,basicTestHash,type BasicTestCpc} from './basic-test-runtime.ts';
import {parseProjectScenario,projectScenarioPlan,type ProjectScenario,type ProjectTestResult} from './project-tests.ts';
import {observeBasicScenario,readCpcScreen} from './scenario-observation.ts';
import {parseProjectCapturePlan,type ProjectCapturePlan,type ProjectScreenFrame} from './project-screen-reference.ts';
import {runCommand,type RunImage} from './run.ts';
/** One execution path for tests and human captures: identical boot, DSK, keys and final budget. */
async function executeProjectSession<T>(cpc:BasicTestCpc,image:RunImage,input:ProjectCapturePlan,yieldStep:()=>Promise<void>,observe:(put:(bytes:Uint8Array)=>number)=>Promise<T>):Promise<T>{
 const allocated:number[]=[];
 const check=(value:number)=>{if(value<0)throw Error('Opération du moteur CPC refusée.');return value;};
 const put=(bytes:Uint8Array)=>{const pointer=cpc._malloc(bytes.length);if(!pointer)throw Error('Mémoire WASM indisponible.');allocated.push(pointer);cpc.HEAPU8.set(bytes,pointer);return pointer;};
 try{
  const definition=parseProjectCapturePlan(input),command=runCommand(image.entry);
  if(!(image.disk instanceof Uint8Array)||image.disk.length!==194816)throw Error('Disquette DATA projet requise.');
  const digest=await basicTestHash(image.disk);if(digest!==image.sha256)throw Error('Empreinte du DSK projet incohérente.');
  for(const role of ['os','basic','amsdos'] as const){
   if(!(image.roms[role] instanceof Uint8Array)||image.roms[role].length!==16384||await basicTestHash(image.roms[role])!==BASIC_TEST_FIRMWARE[role]||image.firmware[role]!==BASIC_TEST_FIRMWARE[role])throw Error('Tests projet non qualifiés pour ces ROM ; jeu CPC 6128 anglais identifié requis.');
  }
  check(cpc._cpc_bridge_init(put(image.roms.os),16384,put(image.roms.basic),16384,put(image.roms.amsdos),16384));
  const step=async(count:number)=>{for(let i=0;i<count;i++){check(cpc._cpc_bridge_step(20000));if(i%5===4)await yieldStep();}};
  await step(250);
  const width=cpc._cpc_bridge_width(),stride=cpc._cpc_bridge_stride(),frame=cpc._cpc_bridge_frame();
  if(width!==768||stride<width||frame<1||frame+stride*108>cpc.HEAPU8.length)throw Error('Écran de démarrage hors profil.');
  const ready=new Uint8Array(width*108);for(let y=0;y<108;y++)ready.set(cpc.HEAPU8.subarray(frame+y*stride,frame+y*stride+width),y*width);
  if(await basicTestHash(ready)!==BASIC_TEST_READY)throw Error('Prompt Ready non reconnu ; aucun verdict automatique.');
  check(cpc._cpc_bridge_mount(put(image.disk),image.disk.length));
  for(const character of command){check(cpc._cpc_bridge_key(character.charCodeAt(0),1));await step(3);check(cpc._cpc_bridge_key(character.charCodeAt(0),0));await step(3);}
  const events=definition.inputs.flatMap(input=>[...input.text].flatMap((key,index)=>[
   {step:input.atMs/20+index*6,key:key.charCodeAt(0),down:1},
   {step:input.atMs/20+index*6+3,key:key.charCodeAt(0),down:0}
  ]));
  let next=0;
  for(let i=0;i<definition.seconds*50;i++){
   while(next<events.length&&events[next]!.step===i){const event=events[next++]!;check(cpc._cpc_bridge_key(event.key,event.down));}
   await step(1);if(i%5===4)await yieldStep();
  }
  cpc._cpc_bridge_release_keys();check(cpc._cpc_bridge_pause(1));
  return await observe(put);
 }finally{cpc._cpc_bridge_release_keys();cpc._cpc_bridge_dispose();for(const pointer of allocated)cpc._free(pointer);}
}
export async function executeProjectTest(cpc:BasicTestCpc,image:RunImage,input:ProjectScenario,yieldStep:()=>Promise<void>):Promise<ProjectTestResult>{
 const result:ProjectTestResult={outcome:'blocked',message:'',emulatedSeconds:0,observations:[]};
 try{
  const definition=parseProjectScenario(input),{checks:_checks,...plan}=definition;
  await executeProjectSession(cpc,image,plan,yieldStep,async put=>{
   result.diskSha256=image.sha256;result.firmware={...image.firmware};
   result.emulatedSeconds=Math.max(0,cpc._cpc_bridge_ticks()/4000000);
   result.observations=await observeBasicScenario(cpc,projectScenarioPlan(definition),put,undefined,'Zone RGBA comparée à la fin du budget du scénario de projet.');
   result.outcome=result.observations.every(o=>o.outcome==='passed')?'passed':'failed';
   result.message=result.outcome==='passed'?'Observations du projet réussies au terme du budget ; aucune preuve de terminaison ou de couverture de chaque fichier.':'Au moins une observation du projet diffère de son attente.';
  });
 }catch(error){result.outcome='blocked';result.observations=[];result.message=error instanceof Error?error.message.slice(0,1024):'Exécution du projet indisponible.';}
 return result;
}
/** A capture is raw evidence for human inspection, never a successful test or an adopted expectation. */
export async function captureProjectScreen(cpc:BasicTestCpc,image:RunImage,plan:ProjectCapturePlan,yieldStep:()=>Promise<void>):Promise<ProjectScreenFrame>{
 return executeProjectSession(cpc,image,plan,yieldStep,async()=>({width:768,height:272,
  rgba:readCpcScreen(cpc,{x:0,y:0,width:768,height:272}),diskSha256:image.sha256,firmware:{...image.firmware},
  emulatedSeconds:Math.max(0,cpc._cpc_bridge_ticks()/4000000)}));
}
