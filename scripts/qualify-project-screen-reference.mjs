import assert from 'node:assert/strict';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,digest as hash} from '../tests/multifile-fixture.ts';
import {projectRunner,literalOracle} from '../tests/project-test-fixture.mjs';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {ProjectTestStore} from '../apps/desktop/project-test-store.ts';
import {ProjectTestsController} from '../apps/desktop/project-tests-controller.ts';
const source='10 MODE 1\n20 PRINT "REFERENCE CPC"\n30 END\n',f=await fixture(source),reports=[];
const plan={id:'screen',name:'Référence visuelle',seconds:8,inputs:[]},region={name:'title',x:64,y:36,width:640,height:8};
try{
 const run=await projectRunner(),controller=new ProjectTestsController(run,await projectRunner(true)),{store,snapshot}=await ProjectStore.open(f.root),storage=new ProjectTestStore(f.root,store.manifest.projectId);
 async function done(id){const deadline=Date.now()+65000;while(controller.running&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(controller.running,false);const result=controller.status(store.sessionId,id);assert.ok(!result.error,JSON.stringify(result));return result;}
 const view=await controller.inspect(store,snapshot.files),capture=await controller.capture(store,snapshot.files,plan,null,view.projectSha256),preview=(await done(capture.id)).preview;
 assert.ok(preview);assert.equal(preview.rgba.length,768*272*4);assert.equal((await controller.inspect(store,snapshot.files)).reports.length,0);await assert.rejects(readFile(join(f.root,'microide.project-tests.json')),{code:'ENOENT'});
 const reference=await controller.adopt(store,snapshot.files,capture.id,plan,null,region);
 // Independent assertion execution observes the same rectangle; capture is not used as a verdict.
 const oracle=await literalOracle(run,source);assert.equal(reference.sha256,oracle.screenSha256);
 await storage.save(null,[{...plan,checks:[reference]}]);const bytes=await readFile(join(f.root,'microide.project-tests.json'));
 async function execute(buffers){const v=await controller.inspect(store,buffers),job=await controller.start(store,buffers,plan.id,v.library.revision,v.projectSha256),report=(await done(job.id)).report;assert.ok(report);reports.push(report);return report.result.outcome;}
 assert.equal(await execute(snapshot.files),'passed');
 const changed=snapshot.files.map(file=>({...file,source:file.source.replace('REFERENCE CPC','AUTRE IMAGE')}));assert.equal(await execute(changed),'failed');
 assert.equal(await execute(snapshot.files),'passed');
 const reopened=await ProjectStore.open(f.root);assert.equal((await controller.inspect(reopened.store,reopened.snapshot.files)).reports.length,3);assert.deepEqual(await storage.load(),await new ProjectTestStore(f.root,reopened.store.manifest.projectId).load());
 assert.deepEqual(await readFile(join(f.root,'microide.project-tests.json')),bytes);assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
 const {rgba,...provenance}=preview;
 await writeFile('out/project-screen-reference-qualification.json',JSON.stringify({qualified:true,realWorker:true,physicalCpc:false,independentEmulator:false,engineSha256:hash(await readFile('out/cpc.wasm')),capture:{...provenance,rgbaSha256:hash(rgba)},reference,oracle,reports},null,2)+'\n');
 await writeFile('out/project-screen-reference.rgba',rgba);
 console.log('Screen reference: real CPC capture, no implicit save/report, explicit adoption, independent assertion agreement, pass/altered buffer failure/restored pass, unchanged host source and reopened reference/history passed.');
}finally{await rm(f.root,{recursive:true,force:true});}
