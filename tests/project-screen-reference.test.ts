import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,digest as hash} from './multifile-fixture.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {ProjectTestStore} from '../apps/desktop/project-test-store.ts';
import {ProjectTestsController} from '../apps/desktop/project-tests-controller.ts';
import {BASIC_TEST_FIRMWARE} from '../packages/emulator/src/basic-test-runtime.ts';
import {parseProjectCapturePlan,parseScreenRegion,screenReference,screenRegionPixels,validateProjectScreenFrame,type ProjectScreenRunner} from '../packages/emulator/src/project-screen-reference.ts';
import {capturePlanFromForm} from '../apps/desktop/src/project-scenario-form.ts';
const plan={id:'capture',name:'Première référence',seconds:8,inputs:[{atMs:4000,text:'CPC\r'}]};
const region={name:'score',x:64,y:36,width:640,height:8};
const blocked=async()=>({outcome:'blocked' as const,message:'No CPC in unit fixture.',emulatedSeconds:0,observations:[]});
const fake:ProjectScreenRunner=async(image,p)=>{
 const rgba=new Uint8Array(768*272*4);for(let i=0;i<rgba.length;i+=4){rgba[i]=(i/4)%251;rgba[i+1]=Math.floor(i/3072)%251;rgba[i+3]=255;}
 return {width:768,height:272,rgba,diskSha256:image.diskSha256,firmware:{...BASIC_TEST_FIRMWARE},emulatedSeconds:p.seconds+6};
};
async function finished(controller:ProjectTestsController,sessionId:string,id:string){const deadline=Date.now()+5000;while(controller.running&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(controller.running,false);return controller.status(sessionId,id);}
test('capture preparation accepts a draft without checks and preserves keyboard bytes',()=>{
 assert.deepEqual(capturePlanFromForm({...plan,inputs:[{atMs:4000,text:'CPC\\r'}],checks:[]}),plan);
 assert.throws(()=>parseProjectCapturePlan({...plan,checks:[]}),/invalide/);
 assert.throws(()=>parseProjectCapturePlan({...plan,seconds:4}),/budget/);
 assert.throws(()=>parseProjectCapturePlan({...plan,inputs:[{atMs:4000,text:'é'}]}),/ASCII/);
 for(const bad of [{...region,x:-1},{...region,width:768},{...region,width:640,height:26},{...region,width:0},{...region,x:1.5},{...region,name:'bad name'}])assert.throws(()=>parseScreenRegion(bad));
});
test('main crops exact row-major RGBA bytes and hashes only the selected rectangle',()=>{
 const rgba=new Uint8Array(768*272*4).map((_,i)=>i%251),r={name:'edge',x:766,y:270,width:2,height:2};
 const expected=Uint8Array.from([...rgba.slice((270*768+766)*4,(270*768+768)*4),...rgba.slice((271*768+766)*4)]);
 assert.deepEqual(screenRegionPixels(rgba,r),expected);
 const frame={width:768 as const,height:272 as const,rgba,diskSha256:'a'.repeat(64),firmware:{...BASIC_TEST_FIRMWARE},emulatedSeconds:14};
 assert.equal(screenReference(frame,r,hash).sha256,hash(expected));assert.throws(()=>screenRegionPixels(rgba.subarray(4),r),/incomplète/);
 assert.throws(()=>validateProjectScreenFrame(frame,frame.diskSha256,8),/opaque/);
});
test('first capture never saves expectations or a report; explicit adoption returns main-owned pixels',async()=>{
 const f=await fixture();try{
  const {store,snapshot}=await ProjectStore.open(f.root),controller=new ProjectTestsController(blocked,fake),view=await controller.inspect(store,snapshot.files);
  const job=await controller.capture(store,snapshot.files,plan,null,view.projectSha256),done=await finished(controller,store.sessionId,job.id);
  assert.ok(done.preview);assert.equal(done.report,undefined);assert.equal((await controller.inspect(store,snapshot.files)).reports.length,0);
  await assert.rejects(readFile(join(f.root,'microide.project-tests.json')),{code:'ENOENT'});
  const reference=await controller.adopt(store,snapshot.files,job.id,plan,null,region);
  assert.equal(reference.sha256,screenReference(done.preview,region,hash).sha256);
  done.preview.rgba.fill(1);assert.deepEqual(await controller.adopt(store,snapshot.files,job.id,plan,null,region),reference);
  assert.throws(()=>controller.status('other',job.id),/session/);await assert.rejects(controller.adopt(store,snapshot.files,'wrong',plan,null,region),/session/);
  const storage=new ProjectTestStore(f.root,store.manifest.projectId);await storage.save(null,[{...plan,checks:[reference]}]);
  await assert.rejects(controller.adopt(store,snapshot.files,job.id,plan,null,region),/périmée/);
  const reopened=await ProjectStore.open(f.root);assert.deepEqual((await new ProjectTestStore(f.root,reopened.store.manifest.projectId).load()).scenarios[0]!.checks,[reference]);
  assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('capture adoption rejects altered buffers, execution plan, session and external definitions',async()=>{
 const f=await fixture();try{
  const {store,snapshot}=await ProjectStore.open(f.root),controller=new ProjectTestsController(blocked,fake),view=await controller.inspect(store,snapshot.files);
  const {id}=await controller.capture(store,snapshot.files,plan,null,view.projectSha256);await finished(controller,store.sessionId,id);
  const changed=snapshot.files.map(file=>({...file,source:file.source+'500 REM modified\n'}));
  for(const [buffers,input] of [[changed,plan],[snapshot.files,{...plan,seconds:9}],[snapshot.files,{...plan,inputs:[]}]] as const)await assert.rejects(controller.adopt(store,[...buffers],id,input,null,region),/périmée/);
  const reopened=await ProjectStore.open(f.root);await assert.rejects(controller.adopt(reopened.store,reopened.snapshot.files,id,plan,null,region),/session/);
  await writeFile(join(f.root,'microide.project-tests.json'),JSON.stringify({schemaVersion:1,scenarios:[]}));
  await assert.rejects(controller.adopt(store,snapshot.files,id,plan,null,region),/périmée/);
  const stale=await controller.capture(store,snapshot.files,plan,null,view.projectSha256);assert.match((await finished(controller,store.sessionId,stale.id)).error!,/changé/);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('capture cancellation and worker failures leave no adoptable candidate or report',async()=>{
 const f=await fixture();try{
  const {store,snapshot}=await ProjectStore.open(f.root),controller=new ProjectTestsController(blocked,async(_image,_plan,signal)=>new Promise((_resolve,reject)=>{if(signal.aborted)reject(Error('stopped'));else signal.addEventListener('abort',()=>reject(Error('stopped')),{once:true});})),view=await controller.inspect(store,snapshot.files);
  const {id}=await controller.capture(store,snapshot.files,plan,null,view.projectSha256);
  await assert.rejects(controller.capture(store,snapshot.files,plan,null,view.projectSha256),/actif/);
  await assert.rejects(controller.start(store,snapshot.files,'capture',null,view.projectSha256),/actif/);
  controller.cancel(store.sessionId,id);const done=await finished(controller,store.sessionId,id);assert.match(done.error!,/arrêtée/);assert.equal(done.preview,undefined);assert.equal(done.report,undefined);
  await assert.rejects(controller.adopt(store,snapshot.files,id,plan,null,region),/absent/);
  const wrong=new ProjectTestsController(blocked,async(image,p,signal)=>({...await fake(image,p,signal),diskSha256:'f'.repeat(64)}));
  const job=await wrong.capture(store,snapshot.files,plan,null,view.projectSha256);assert.match((await finished(wrong,store.sessionId,job.id)).error!,/provenance/);
  assert.equal((await controller.inspect(store,snapshot.files)).reports.length,0);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
