import assert from 'node:assert/strict';
import {cp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,digest as hash} from '../tests/multifile-fixture.ts';
import {projectRunner} from '../tests/project-test-fixture.mjs';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {ProjectTestStore} from '../apps/desktop/project-test-store.ts';
import {ProjectTestsController} from '../apps/desktop/project-tests-controller.ts';
const f=await fixture(),reports=[];
try{
 await cp('examples/project-tests',f.root,{recursive:true});
 const {store,snapshot}=await ProjectStore.open(f.root),storage=new ProjectTestStore(f.root,store.manifest.projectId);
 const definition=await storage.load(),expected=structuredClone(definition.scenarios);await rm(join(f.root,'microide.project-tests.json'));
 await storage.save(null,expected);const bytes=await readFile(join(f.root,'microide.project-tests.json'));
 const controller=new ProjectTestsController(await projectRunner());
 async function run(buffers){
  const view=await controller.inspect(store,buffers),{id}=await controller.start(store,buffers,'io',view.library.revision,view.projectSha256);
  const deadline=Date.now()+65000;while(controller.running&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(controller.running,false);
  const result=controller.status(store.sessionId,id);assert.ok(result.report,JSON.stringify(result));assert.ok(!result.archiveError);reports.push(result.report);return result.report;
 }
 assert.equal((await run(snapshot.files)).result.outcome,'passed');
 const changed=snapshot.files.map(file=>({...file,source:file.cpcName==='PART.BAS'?file.source.replace('a$+" "+b$','a$+" WRONG "+b$'):file.source}));assert.notDeepEqual(changed,snapshot.files);
 assert.equal((await run(changed)).result.outcome,'failed');assert.notEqual(reports[0].project.projectSha256,reports[1].project.projectSha256);
 assert.equal((await run(snapshot.files)).result.outcome,'passed');
 assert.deepEqual(await readFile(join(f.root,'microide.project-tests.json')),bytes);assert.deepEqual(await readFile(join(f.root,'src/part.bas')),await readFile('examples/project-tests/src/part.bas'));
 assert.deepEqual(await readFile(join(f.root,'assets/input.bin')),await readFile('examples/project-tests/assets/input.bin'));await assert.rejects(readFile(join(f.root,'OUT.TXT')),{code:'ENOENT'});
 const reopened=await ProjectStore.open(f.root),history=await controller.inspect(reopened.store,reopened.snapshot.files);assert.equal(history.reports.length,3);assert.equal(history.projectSha256,reports[0].project.projectSha256);
 await writeFile('out/project-scenarios-qualification.json',JSON.stringify({schemaVersion:1,qualified:true,realWorker:true,apiProvider:false,physicalCpc:false,independentEmulator:false,engineSha256:hash(await readFile('out/cpc.wasm')),reports},null,2)+'\n');
 console.log('Human scenarios: three real CPC executions (pass, altered unsaved PART rejected, restored pass), unchanged expectations/assets/host sources and reopen history qualified.');
}finally{await rm(f.root,{recursive:true,force:true});}
