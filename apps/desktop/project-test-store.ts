import {lstat,mkdir,open,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {durableReplace} from './save-journal.ts';
import {PROJECT_TEST_LIMITS,parseProjectTests,parseProjectTestReport,type ProjectTestLibrary,type ProjectTestReport} from '../../packages/emulator/src/project-tests.ts';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
/** Agent reads expectations only; it can append reports to a fixed private destination. */
export class ProjectTestStore{
 private readonly root:string;private readonly projectId:string;
 constructor(root:string,projectId:string){this.root=root;this.projectId=projectId;}
 private async read(path:string,limit:number):Promise<Buffer|undefined>{
  let stat;try{stat=await lstat(path);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>limit)throw Error('Fichier de tests projet ordinaire et borné requis ; liens refusés.');
  const handle=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
   const current=await handle.stat();
   if(!current.isFile()||current.nlink!==1||current.dev!==stat.dev||current.ino!==stat.ino||current.size>limit)throw Error('Fichier de tests projet modifié pendant la lecture.');
   const buffer=Buffer.alloc(limit+1);let count=0;
   while(count<buffer.length){const read=await handle.read(buffer,count,buffer.length-count,count);if(!read.bytesRead)break;count+=read.bytesRead;}
   if(count>limit)throw Error('Fichier de tests projet trop volumineux.');return buffer.subarray(0,count);
  }finally{await handle.close();}
 }
 private decode(bytes:Buffer):unknown{return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));}
 async load():Promise<ProjectTestLibrary>{const bytes=await this.read(join(this.root,'microide.project-tests.json'),PROJECT_TEST_LIMITS.libraryBytes);return bytes?{revision:hash(bytes),scenarios:parseProjectTests(this.decode(bytes)).scenarios}:{revision:null,scenarios:[]};}
 private async historyPath(create=false):Promise<string|undefined>{
  const dir=join(this.root,'.microide');
  try{await lstat(dir);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;if(!create)return undefined;await mkdir(dir,{mode:0o700});}
  const stat=await lstat(dir),path=relative(this.root,await realpath(dir));
  if(!stat.isDirectory()||stat.isSymbolicLink()||path.startsWith('..')||isAbsolute(path))throw Error('Répertoire des rapports projet invalide.');
  return join(dir,'project-test-reports.json');
 }
 async history():Promise<ProjectTestReport[]>{
  const path=await this.historyPath();if(!path)return [];const bytes=await this.read(path,PROJECT_TEST_LIMITS.historyBytes);if(!bytes)return [];
  const data=this.decode(bytes) as {schemaVersion:number;projectId:string;reports:unknown[]};
  if(!data||typeof data!=='object'||Object.keys(data).sort().join()!=='projectId,reports,schemaVersion'||data.schemaVersion!==1||data.projectId!==this.projectId||!Array.isArray(data.reports)||data.reports.length>PROJECT_TEST_LIMITS.history)throw Error('Historique projet invalide ; données conservées.');
  const reports=data.reports.map(r=>parseProjectTestReport(r,hash));if(new Set(reports.map(r=>r.id)).size!==reports.length)throw Error('Rapports projet dupliqués.');return reports;
 }
 async record(value:unknown):Promise<void>{
  const report=parseProjectTestReport(value,hash),previous=await this.history(),old=previous.find(r=>r.id===report.id);
  if(old){if(JSON.stringify(old)!==JSON.stringify(report))throw Error('Identité de rapport réutilisée.');return;}
  const reports=[report,...previous].slice(0,PROJECT_TEST_LIMITS.history),bytes=Buffer.from(JSON.stringify({schemaVersion:1,projectId:this.projectId,reports},null,2)+'\n');
  if(bytes.length>PROJECT_TEST_LIMITS.historyBytes)throw Error('Historique projet limité à 2 Mio.');
  const path=(await this.historyPath(true))!;await this.read(path,PROJECT_TEST_LIMITS.historyBytes);await durableReplace(path,bytes);
 }
}
