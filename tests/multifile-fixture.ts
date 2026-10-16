import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {newProject} from '../packages/workspace/src/project.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {WorkspaceTools} from '../packages/agent/src/workspace-tools.ts';
export const SOURCE='10 MEMORY &7FFF\n20 score%=42\n30 POKE &8000,11\n40 GOTO 100\n100 POKE &8001,score%\n110 POKE &8002,24\n120 END\n';
export const digest=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
export async function fixture(source=SOURCE.replace(/\n/g,'\r\n')) {
 const root=await mkdtemp(join(tmpdir(),'cpceleste-extraction-'));
 await mkdir(join(root,'src'));
 const manifest=Buffer.from(JSON.stringify(newProject('Découpage durable',randomUUID()),null,2)+'\n');
 await writeFile(join(root,'microide.project.json'),manifest);await writeFile(join(root,'src/main.bas'),source);
 return {root,manifest,original:Buffer.from(source)};
}
export async function prepare(root:string) {
 const {store,snapshot}=await ProjectStore.open(root),initial=await store.agentState(snapshot.files);
 const tools=new WorkspaceTools(initial,(candidate,expected)=>store.applyAgentState(candidate,expected),digest,[]);
 const preview=await tools.execute('language_extraction_simulate',{id:'main',expectedHash:digest(initial.files[0]!.source),entryLine:100,newFileName:'PART'}) as {previewId:string;proposedDiskSha256:string};
 await tools.execute('reference_read_many',{names:['MEMORY','POKE','END','CHAIN','MERGE']});
 const apply=()=>tools.execute('language_extraction_apply',{id:'main',expectedHash:digest(initial.files[0]!.source),previewId:preview.previewId});
 return {store,snapshot,initial,tools,preview,apply};
}
