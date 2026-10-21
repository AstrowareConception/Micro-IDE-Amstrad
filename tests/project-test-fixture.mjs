import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {agentProjectTestRunner,projectScreenRunner} from '../apps/desktop/agent-project-test-runner.ts';
import {prepareProjectTest} from '../packages/agent/src/project-tests.ts';
import {newProject} from '../packages/workspace/src/project.ts';
import {BASIC_TEST_FIRMWARE} from '../packages/emulator/src/basic-test-runtime.ts';
import {digest as hash} from './multifile-fixture.ts';
export async function projectRunner(capture=false){
 const root=process.env.CPC_TEST_ROM_DIR;if(!root)throw Error('CPC_TEST_ROM_DIR requis ; ROM externes au dépôt.');
 const roms={};for(const role of ['os','basic','amsdos']){roms[role]=new Uint8Array(await readFile(join(root,`cpc6128_${role}.bin`)));assert.equal(hash(roms[role]),BASIC_TEST_FIRMWARE[role]);}
 return (capture?projectScreenRunner:agentProjectTestRunner)({load:async()=>roms},resolve('out'));
}
export const displayScenario=sha256=>({id:'display',name:'Score affiché',seconds:8,inputs:[],checks:[{kind:'screen',name:'score',x:64,y:36,width:640,height:8,sha256}]});
export async function literalOracle(runner,source){
 const manifest=newProject('Oracle littéral','647f023d-1272-4b66-8c47-b064b8de9512');
 const image=prepareProjectTest({sessionId:'oracle',manifest,files:[{...manifest.sources[0],source,saved:source}]},hash);
 const result=await runner(image,displayScenario('0'.repeat(64)),new AbortController().signal);
 assert.equal(result.outcome,'failed',result.message);assert.equal(result.observations.length,1);assert.match(result.observations[0].actualSha256,/^[a-f0-9]{64}$/);
 return {sourceSha256:hash(source),diskSha256:image.diskSha256,screenSha256:result.observations[0].actualSha256};
}
