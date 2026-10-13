import { BinaryWorkspaceTools } from '../packages/agent/src/binary-tools.ts';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DiskImportSession } from '../apps/desktop/disk-import.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { BinaryWorkbench } from '../apps/desktop/binary-workbench.ts';
import { createDataDisk, readDataDisk } from '../packages/cpc-disk/src/data-disk.ts';
import { encodeAmsdosBinary } from '../packages/cpc-disk/src/amsdos-binary.ts';
const dir = process.env.CPC_TEST_ROM_DIR; if (!dir) throw Error('CPC_TEST_ROM_DIR requis.');
const hashes = {os:'ce133ea170940147f6c73d6c9f9e7a05be81fc8ff9aae8386011c47e593852bf',basic:'58503070d553d7152a2dbce40976418281a8bf1f4a5a7ede75269f2e39275977',amsdos:'ea65e0fb44ee93ede4b6c507509b7e5ddf497fb7155023bea91ef229469fa04d'};
const roms=[];for(const [role, hash] of Object.entries(hashes)) {const path=join(dir,`cpc6128_${role}.bin`);assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash);roms.push(path);}
function run(command,args){const result=spawnSync(command,args,{encoding:'utf8',timeout:120000});if(result.error||result.status!==0)throw Error(result.error?.message??result.stdout+result.stderr);return result.stdout;}
await mkdir('out',{recursive:true});const exe='out/native-binary-workbench';
run(process.env.CC||'gcc',['-std=c11','-Wall','-Wextra','-Werror','-O2','-I.cache/chips','tests/native_disk_recovery.c','-lm','-o',exe]);await chmod(exe,0o700);
const parent=await mkdtemp(join(tmpdir(),'cpc-binary-firmware-')),path=join(parent,'original.dsk');
const original=createDataDisk([{name:'BOOT.BIN',bytes:encodeAmsdosBinary('BOOT.BIN',Uint8Array.of(0x3e,77,0x32,0,0x90,0x18,0xfe),0x8000,0x8000)}]);await writeFile(path,original);
const session=await DiskImportSession.prepare(path),entry=session.preview.files[0];
const root=await session.create(parent,{id:session.preview.id,name:'Binary firmware proof',sourceIds:[],entryId:entry.id,kind:'binary'});
const {store}=await ProjectStore.open(root),workbench=new BinaryWorkbench(store),asset=store.manifest.assets[0];
const {listing}=await workbench.generate(asset.id,0,7,0x8000,'code');
const region={id:'routine',assetId:asset.id,sha256:asset.sha256,offset:0,length:7,origin:0x8000,kind:'code',note:'Write an observable byte and stay in a loop',listing};
let analysis=await workbench.save(null,[region]);const reports=[];
for(const [name,expected] of [['unchanged',77],['edited',78]]) {
  if(name==='edited') {
    const tools=new BinaryWorkspaceTools(await store.agentState([]),state=>store.applyAgentState(state),value=>createHash('sha256').update(value).digest('hex'));
    const read=await tools.execute('binary_read_region',{id:region.id,startLine:1,endLine:200});await tools.execute('binary_dialect',{});
    await tools.execute('binary_replace_region',{id:region.id,expectedHash:read.hash,note:region.note+' — mutation par outil agent contrôlé',listing:listing.replace('LD A,$4D','LD A,$4E')});
    const build=await tools.execute('binary_build',{});assert.equal(build.changedBytes,1);analysis=tools.state.binaryAnalysis;
  }
  const compiled=await workbench.disk(analysis.revision),disk=`out/binary-${name}.dsk`;await writeFile(disk,compiled.disk);
  if(name==='unchanged')assert.deepEqual(readDataDisk(compiled.disk),readDataDisk(original));else assert.equal(compiled.changedBytes,1);
  const observations=run(exe,[...roms,disk,'BOOT.BIN',`out/binary-${name}`,'5','']).trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(observations.at(-1).peek9000,expected);reports.push({name,expected,observations});
}
assert.deepEqual(await readFile(path),Buffer.from(original));
await writeFile('out/binary-workbench-qualification.json',JSON.stringify({firmware:hashes,reports,originalUnchanged:true,mutationVia:"binary_replace_region",independentEmulator:false},null,2)+'\n');console.log(JSON.stringify(reports));
