import assert from 'node:assert/strict';
import {join} from 'node:path';
import {AgentController} from '../apps/desktop/agent-controller.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {readabilityMission,DEFAULT_READABILITY} from '../packages/agent/src/readability.ts';
import {createReadabilityTransport} from './readability-pipeline-transport.mjs';
const specimen=(name,body,output)=>({name,source:'10 MODE 1\n20 CLS\n30   s%=0   \n80 REM Passage au calcul\n90 GOTO 100\n'+body.replace('110 ', '105 REM Calcul documente\n110 ')+'\n300 END\n310 REM Listing termine\n',screenRows:1,
 oracle:'10 MODE 1\n20 CLS\n30 PRINT "'+output+'"\n40 END\n'});
export const readabilityWitnesses=[
 specimen('expression','100 s%=(3+2)*2\n110 PRINT "SCORE";s%','SCORE 10 '),
 ...[0,1].map(n=>specimen('condition-'+n,`100 IF ${n}=1 THEN s%=7 ELSE s%=2\n110 PRINT "SCORE";s%`,'SCORE '+(n?7:2)+' ')),
 ...[0,3].map(n=>specimen('for-'+n,`100 FOR i%=1 TO ${n}\n110 s%=s%+i%\n120 NEXT i%\n130 PRINT "SCORE";s%;"I";i%`,'SCORE '+(n?6:0)+' I '+(n?4:1)+' ')),
 specimen('while-3','100 i%=3\n110 WHILE i%>0\n120 s%=s%+i%\n130 i%=i%-1\n140 WEND\n150 PRINT "SCORE";s%;"I";i%','SCORE 6 I 0 ')
];
export async function runReadabilityMission(root){
 const {store,snapshot}=await ProjectStore.open(root);
 const controller=new AgentController(join(root,'checkpoints'),'knowledge/locomotive-basic',createReadabilityTransport(),async()=>assert.fail("No registered suite should run in this controlled mission."));
 controller.configure('sk-fixture-not-real','gpt-5.6-luna');
 const {taskId}=await controller.start(store,readabilityMission('src/main.bas',{...DEFAULT_READABILITY,splitPlan:true}),snapshot.files,false,{maxTurns:25,maxCalls:40,maxTokens:10000});
 const deadline=Date.now()+15000;
 while(controller.running&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(controller.running,false);
 const view=controller.status(taskId);
 assert.equal(view.status,'completed',JSON.stringify(view.events));
 assert.deepEqual(view.events.filter(event=>event.kind==='tool-result'&&!event.success),[]);
 assert.ok(view.buildVerified);
 assert.equal(view.renameOperations[0].status,'applied');assert.equal(view.formatOperations[0].status,'applied');assert.equal(view.commentOperations[0].status,'applied');
 assert.ok(view.formatOperations[0].changedLines>0);
 assert.equal(view.extractionSimulations.at(-1).record.status,'applied');
 assert.equal(view.extractionSimulations.at(-1).record.profile,'terminal-commented-chain-merge-v5');
 assert.equal(view.documentChanges.length,1);
 return {controller,taskId,view,snapshot,store};
}
