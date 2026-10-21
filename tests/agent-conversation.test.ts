import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AgentController} from '../apps/desktop/agent-controller.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {runAgent} from '../packages/agent/src/runner.ts';

const call=(id:string,name:string,args:unknown)=>({type:'function_call',call_id:id,name,arguments:JSON.stringify(args)});
const message=(text:string)=>({type:'message',content:[{type:'output_text',text}]});
async function settle(controller:AgentController,id:string){const end=Date.now()+10000;while(controller.running&&Date.now()<end)await new Promise(r=>setTimeout(r,5));assert.equal(controller.running,false);return controller.status(id);}
async function fixture(t:import('node:test').TestContext,transport:typeof fetch){
 const root=await mkdtemp(join(tmpdir(),'cpc-chat-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const {store,snapshot}=await ProjectStore.create(root,'Conversation');
 const controller=new AgentController(join(root,'checkpoints'),join(process.cwd(),'knowledge/locomotive-basic'),transport);
 controller.configure('sk-chat-fixture-not-real','gpt-5.6-luna');
 return {root,store,snapshot,controller};
}
test('follow-up preserves messages, task, original checkpoint and cumulative usage; stale edits and another project are refused',async t=>{
 let turn=0;const requests:Record<string,unknown>[][]=[];
 const {root,store,snapshot,controller}=await fixture(t,async(_url,init)=>{
  const body=JSON.parse(String(init?.body));requests.push(body.input);turn++;
  return Response.json({status:'completed',output:turn%2?[call('build-'+turn,'build_project',{})]:[message(turn===2?'Première réponse':'Réponse à la retouche')],usage:{total_tokens:10}});
 });
 const {taskId}=await controller.start(store,'Prépare le projet',snapshot.files);const first=await settle(controller,taskId);
 assert.equal(first.status,'completed');assert.equal(first.followUpAllowed,true);
 await assert.rejects(controller.followUp(taskId,'Retouche',store,[{id:'main',source:snapshot.files[0]!.source+'999 REM HUMAIN\n'}]),/stale-read/);
 const other=await ProjectStore.open(root);await assert.rejects(controller.followUp(taskId,'Retouche',other.store,snapshot.files),/conversation/);
 await assert.rejects(controller.followUp(taskId,' ',store,snapshot.files),/Message requis/);
 await controller.followUp(taskId,'Ajoute une retouche',store,snapshot.files);const final=await settle(controller,taskId);
 assert.equal(final.taskId,taskId);assert.equal(final.tokens,40);assert.equal(final.turns,4);
 assert.match(JSON.stringify(requests[2]),/Première réponse/);assert.equal(requests[2]!.at(-1)!.content,'Ajoute une retouche');
 assert.deepEqual(final.events.filter(e=>e.role==='user').map(e=>e.text),['Prépare le projet','Ajoute une retouche']);
 const checkpoint=JSON.parse(await readFile(join(root,'checkpoints',taskId,'checkpoint.json'),'utf8'));
 assert.deepEqual(checkpoint.initial.files.map((f:{source:string})=>f.source),snapshot.files.map(f=>f.source));
 await controller.restore(taskId,snapshot.files);assert.equal(controller.status(taskId).followUpAllowed,false);
 await assert.rejects(controller.followUp(taskId,'Retouche',store,snapshot.files),/conversation/);
});
test('attachment selection includes only selected legacy files plus project knowledge; exclusions and unknown ids remain enforced',async t=>{
 let body:any;
 const {root,store,snapshot,controller}=await fixture(t,async(_url,init)=>{body=JSON.parse(String(init?.body));return Response.json({status:'completed',output:[message('Documents disponibles')],usage:{total_tokens:1}});});
 const a=join(root,'A.md'),b=join(root,'B.md');await writeFile(a,'# Piece jointe A');await writeFile(b,'# Pas sélectionné');
 await store.importDocument(a);await store.importDocument(b);
 const auto=await store.writeKnowledge({action:'create',title:'Contexte',category:'design',source:'# Contexte'});
 const excluded=await store.writeKnowledge({action:'create',title:'Prive',category:'design',source:'PRIVATE_NEVER_SEND'});
 await store.writeKnowledge({action:'configure',id:excluded.document.id,revision:excluded.document.revision!,category:'design',access:'excluded'});
 const selected=store.manifest.documents.find(d=>d.originalName==='A.md')!.id;
 for(const ids of [[excluded.document.id],['unknown'],[selected,selected]])await assert.rejects(controller.start(store,'Lis les pièces',snapshot.files,false,undefined,ids),/Fichier joint/);
 const {taskId}=await controller.start(store,'Lis les pièces',snapshot.files,false,undefined,[selected]);await settle(controller,taskId);
 const context=JSON.parse(body.input[0].content).project;
 assert.deepEqual(context.documents.map((d:{id:string})=>d.id).sort(),[selected,auto.document.id].sort());
 assert.ok(!JSON.stringify(body).includes('PRIVATE_NEVER_SEND'));assert.ok(!JSON.stringify(body).includes('Piece jointe A'),'Metadata does not claim the attachment has been read');
 controller.configure('','');assert.equal(controller.status(taskId).followUpAllowed,false);
});
test('a paused mission accepts a clarification on resume, with the same task and budget',async t=>{
 let turn=0,lastInput='';
 const {store,snapshot,controller}=await fixture(t,async(_url,init)=>{lastInput=String(init?.body);return Response.json({status:'completed',output:++turn===1?[call('build','build_project',{})]:[message('Précision prise en compte')],usage:{total_tokens:1}});});
 const {taskId}=await controller.start(store,'Prépare',snapshot.files,false,{maxTurns:1,maxCalls:5,maxTokens:1000});assert.equal((await settle(controller,taskId)).resumable,true);
 await controller.resume(taskId,store,snapshot.files,'Palette bleue et ivoire');const final=await settle(controller,taskId);
 assert.equal(final.status,'completed');assert.match(lastInput,/Palette bleue et ivoire/);assert.equal(final.events.filter(e=>e.role==='user').length,2);
});
test('a precision arriving during a final response is consumed before completion, including at the turn budget',async()=>{
 for(const maxTurns of [1,3]){
  const queue:string[]=[];let turns=0;
  const result=await runAgent({objective:'Titre',context:{},signal:new AbortController().signal,emit:()=>{},takeSteering:()=>queue.splice(0),maxTurns,
   tools:{definitions:[],execute:async()=>assert.fail()},model:{respond:async input=>{turns++;if(turns===1)queue.push('En bleu');else assert.equal(input.at(-1)!.content,'En bleu');return {tokens:1,output:[message('Réponse '+turns)]};}}});
  assert.equal(result.status,maxTurns===1?'paused-limit':'completed');assert.equal(turns,maxTurns===1?1:2);assert.equal(queue.length,0);
 }
});
