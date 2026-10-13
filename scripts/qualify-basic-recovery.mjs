import {readFile,writeFile,mkdir,chmod,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DiskImportSession} from '../apps/desktop/disk-import.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {buildProjectDisk} from '../packages/workspace/src/project.ts';
import {encodeBasicFile} from '../packages/cpc-disk/src/basic-codec.ts';
import {encodeAmsdosBinary} from '../packages/cpc-disk/src/amsdos-binary.ts';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {distributionDisk} from '../packages/cpc-disk/src/distribution.ts';
import {createDataDisk,readDataDisk,decodeAsciiRecords} from '../packages/cpc-disk/src/data-disk.ts';
import {encodeBasicAscii} from '../packages/cpc-disk/src/basic-ascii.ts';
import {inspectDataDisk} from '../packages/cpc-disk/src/import-disk.ts';
const dir=process.env.CPC_TEST_ROM_DIR;if(!dir)throw Error('CPC_TEST_ROM_DIR requis.');
const hashes={os:'ce133ea170940147f6c73d6c9f9e7a05be81fc8ff9aae8386011c47e593852bf',basic:'58503070d553d7152a2dbce40976418281a8bf1f4a5a7ede75269f2e39275977',amsdos:'ea65e0fb44ee93ede4b6c507509b7e5ddf497fb7155023bea91ef229469fa04d'};
const paths=[];for(const [role,sha]of Object.entries(hashes)){const path=join(dir,`cpc6128_${role}.bin`);assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),sha);paths.push(path);}
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8'});if(r.status!==0)throw Error(r.error?.message??r.stdout+r.stderr);}
await mkdir('out',{recursive:true});const exe='out/native-basic-recovery';
run(process.env.CC||'gcc',['-std=c11','-Wall','-Wextra','-Werror','-O2','-I.cache/chips','tests/native_basic_recovery.c','-lm','-o',exe]);await chmod(exe,0o700);
const source='10 REM ORIGINAL PRIVATE\n20 DEFINT A-Z:total=0:FOR index=1 TO 4:total=total+index:NEXT index\n30 OPENOUT "RESULT":WRITE #9,total:CLOSEOUT\n40 END\n';
let baseline;const report=[];
for(const mode of ['clear','obfuscate','protected','combined']){
 const disk=mode==='clear'?createDataDisk([{name:'MAIN.BAS',bytes:encodeBasicAscii(source)}]):distributionDisk([{name:'MAIN.BAS',source}],{mode,rename:true,comments:true,renumber:false});
 const input=`out/recovery-${mode}.dsk`,output=`out/recovery-${mode}-after.dsk`;await writeFile(input,disk);run(exe,[...paths,input,output,mode==='clear'?'1':'0']);
 const after=await readFile(output),files=readDataDisk(after),result=files.find(f=>f.name==='RESULT');assert.ok(result,mode+' must execute and save RESULT');
 const observed=decodeAsciiRecords(result.records);
 if(mode==='clear')baseline=observed;else assert.deepEqual(observed,baseline,mode+' must keep observable result');
 if(mode==='clear'){const recovered=inspectDataDisk(after).files.find(f=>f.name==='ROUND.BAS');assert.ok(recovered?.source,JSON.stringify(recovered));assert.match(recovered.source,/ORIGINAL PRIVATE/);const ascii=inspectDataDisk(after).files.find(f=>f.name==='ASCII');assert.ok(ascii?.source,'firmware SAVE A with nonzero padding must import');}
 report.push({mode,resultSha256:createHash('sha256').update(observed).digest('hex')});
}
const importedSource='10 MEMORY &7FFF:LOAD "CODE.BIN",&8000:CALL &8000\n20 OPENOUT "RESULT":WRITE #9,PEEK(&9000):CLOSEOUT\n30 END\n';
const dependencyDisk=createDataDisk([{name:'MAIN.BAS',bytes:encodeBasicFile('MAIN.BAS',importedSource,true)},{name:'CODE.BIN',bytes:encodeAmsdosBinary('CODE.BIN',Uint8Array.from([0x3e,77,0x32,0,0x90,0xc9]),0x8000,0x8000)}]);
const folder=await mkdtemp(join(tmpdir(),'cpc-recovery-firmware-')),original=join(folder,'original.dsk');await writeFile(original,dependencyDisk);
const session=await DiskImportSession.prepare(original),entry=session.preview.files.find(f=>f.source);
const root=await session.create(folder,{id:session.preview.id,name:'Runtime recovery',sourceIds:[entry.id],entryId:entry.id});
const project=await ProjectStore.open(root),edited=project.snapshot.files.map(file=>({...file,source:file.source.replace('PEEK(&9000)','PEEK(&9000)+1')}));
await project.store.save(entry.id,edited[0].source);
await writeFile('out/recovery-resources.dsk',buildProjectDisk(project.store.manifest,edited,await project.store.readAssets()));
run(exe,[...paths,'out/recovery-resources.dsk','out/recovery-resources-after.dsk','0']);
const dependentResult=readDataDisk(await readFile('out/recovery-resources-after.dsk')).find(f=>f.name==='RESULT');assert.ok(dependentResult,'Imported BASIC must LOAD and CALL its preserved binary');
assert.equal(new TextDecoder().decode(decodeAsciiRecords(dependentResult.records)),'78\r\n\x1a');assert.deepEqual(await readFile(original),Buffer.from(dependencyDisk));
report.push({mode:'import-edit-binary-resource',result:78,originalUnchanged:true});
await writeFile('out/basic-recovery-qualification.json',JSON.stringify({profile:'CPC6128 English BASIC1.1',firmware:hashes,results:report,independentEmulator:false},null,2)+'\n');console.log(JSON.stringify(report));
