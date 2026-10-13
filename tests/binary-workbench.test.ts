import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assembleZ80, reassemblableListing } from '../packages/z80/src/assemble.ts';
import { validateRegions } from '../packages/z80/src/workbench.ts';
import { createDataDisk, readDataDisk } from '../packages/cpc-disk/src/data-disk.ts';
import { encodeAmsdosBinary } from '../packages/cpc-disk/src/amsdos-binary.ts';
import { DiskImportSession } from '../apps/desktop/disk-import.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { BinaryWorkbench } from '../apps/desktop/binary-workbench.ts';
import { runDisk } from '../packages/emulator/src/run.ts';
import { parseProject } from '../packages/workspace/src/project.ts';

test('Z80 assembler encodes known independent instruction vectors and labels', () => {
  const pairs: [string, number[]][] = [
    ['LD A,$2A', [0x3e,0x2a]], ['LD ($9000),A', [0x32,0,0x90]], ['LD BC,$1234', [1,0x34,0x12]],
    ['LD IX,$1234', [0xdd,0x21,0x34,0x12]], ['LD (IY-$02),$AB', [0xfd,0x36,0xfe,0xab]],
    ['BIT 3,(IX+$01)', [0xdd,0xcb,1,0x5e]], ['SBC HL,DE', [0xed,0x52]],
    ['LD DE,($1234)', [0xed,0x5b,0x34,0x12]], ['OUT ($7F),A', [0xd3,0x7f]],
    ['JR $8000', [0x18,0xfe]], ['CALL NZ,$1234', [0xc4,0x34,0x12]], ['OTIR',[0xed,0xb3]],
  ];
  for (const [source, bytes] of pairs) assert.deepEqual([...assembleZ80('ORG $8000\n'+source).bytes], bytes, source);
  assert.deepEqual([...assembleZ80('ORG $8000\nJR end\nstart: LD A,1\nend: DJNZ start\nRET').bytes],[0x18,2,0x3e,1,0x10,0xfc,0xc9]);
});
test('reassemblable output preserves prefixes, aliases, truncations and arbitrary data', () => {
  for (const prefix of [[],[0xcb],[0xed],[0xdd],[0xfd],[0xdd,0xcb],[0xfd,0xcb]])
    for (let op=0;op<256;op++) {
      const bytes=Uint8Array.from([...prefix,op,0x35,0x46,0x57,0xff]);
      assert.deepEqual(assembleZ80(reassemblableListing(bytes,0x8000,true)).bytes,bytes);
    }
  for (const bytes of [Uint8Array.of(0xdd),Uint8Array.of(0xed,0x6b,0,0x90),Uint8Array.of(0xfd,0xcb,0xfe)])
    assert.deepEqual(assembleZ80(reassemblableListing(bytes,0x8000,true)).bytes,bytes);
  const data=Uint8Array.from({length:256},(_,i)=>i);assert.deepEqual(assembleZ80(reassemblableListing(data,0,false)).bytes,data);
});
test('assembler refuses overflow, relocation, unknown syntax and unresolved/duplicate labels', () => {
  for (const source of ['ORG 65535\nLD A,1','ORG 0\nJR $8000','ORG 0\nLD (IX+128),A','ORG 0\nDEFB 256','ORG 0\nCALL missing','ORG 0\nx:NOP\nx:RET','ORG 0\nINCLUDE "evil"','ORG 0\nORG 1\nNOP','ORG 0\nLD A,1+2','LD A,1']) assert.throws(()=>assembleZ80(source),source);
});
async function fixture() {
  const parent=await mkdtemp(join(tmpdir(),'cpc-binary-project-')),path=join(parent,'game.dsk');
  const disk=createDataDisk([{name:'BOOT.BIN',bytes:encodeAmsdosBinary('BOOT.BIN',Uint8Array.of(0x3e,77,0x32,0,0x90,0xc9),0x8000,0x8000)},{name:'DATA.BIN',bytes:Uint8Array.of(9,8,7)}]);await writeFile(path,disk);
  const session=await DiskImportSession.prepare(path),entry=session.preview.files.find(file=>file.name==='BOOT.BIN')!;
  const root=await session.create(parent,{id:session.preview.id,name:'Binaire',sourceIds:[],entryId:entry.id,kind:'binary'});
  const project=await ProjectStore.open(root),workbench=new BinaryWorkbench(project.store);
  const view=await workbench.inspect(entry.id),generated=await workbench.generate(entry.id,0,6,0x8000,'code');
  const region={id:'routine',assetId:entry.id,sha256:view.sha256,offset:0,length:6,origin:0x8000,kind:'code' as const,note:'hypothèse utilisateur',listing:generated.listing};
  return {parent,path,disk,root,project,workbench,region};
}
test('binary-only project persists annotations, checks revisions and exports exact then edited copies', async () => {
  const {path,disk,root,project,workbench,region}=await fixture();
  assert.equal(project.snapshot.files.length,0);assert.equal(project.store.manifest.kind,'binary');
  assert.equal(runDisk({sessionId:project.store.sessionId,sources:[]},project.store.manifest,await project.store.readAssets()).entry,'BOOT.BIN');
  const saved=await workbench.save(null,[region]);
  const again=new BinaryWorkbench((await ProjectStore.open(root)).store);assert.deepEqual(await again.load(),saved);
  assert.deepEqual(readDataDisk((await again.disk(saved.revision)).disk),readDataDisk(disk));
  const edited=await again.save(saved.revision,[{...region,listing:region.listing.replace('LD A,$4D','LD A,$4E')}]);
  assert.equal((await again.compile(edited.revision)).changedBytes,1);
  const output=readDataDisk((await again.disk(edited.revision)).disk);assert.equal(output.find(f=>f.name==='BOOT.BIN')!.records[129],78);
  assert.deepEqual(output.find(f=>f.name==='DATA.BIN'),readDataDisk(disk).find(f=>f.name==='DATA.BIN'));
  assert.deepEqual(await readFile(path),Buffer.from(disk));assert.equal((await project.store.readAssets())[0]!.bytes[129],77);
  await assert.rejects(workbench.save(saved.revision,[region]),/modifiée/);
  assert.deepEqual((await project.store.agentState([])).binaryAnalysis, edited);
  assert.throws(()=>parseProject({...project.store.manifest,kind:undefined}));
});
test('workbench refuses overlapping regions, forged hashes, shifted sizes and changed original assets', async () => {
  const {root,project,workbench,region}=await fixture();
  assert.throws(()=>validateRegions([region,{...region,id:'other',offset:1}],project.store.manifest.assets),/superposées/);
  assert.throws(()=>validateRegions([{...region,sha256:'0'.repeat(64)}],project.store.manifest.assets),/périmée/);
  await assert.rejects(workbench.generate(region.assetId,0,7,0x8000,'code'),/Plage/);
  const saved=await workbench.save(null,[{...region,listing:region.listing+'NOP\n'}]);
  await assert.rejects(workbench.compile(saved.revision),/taille/);
  await writeFile(join(root,project.store.manifest.assets[0]!.path),Uint8Array.of(1));
  await assert.rejects(workbench.load(),/changé/);
});
test('analysis path symlinks and foreign project records are rejected', async () => {
  const {root,parent,workbench,region}=await fixture();
  await writeFile(join(root,'binary-z80.json'),JSON.stringify({version:1,projectId:'other',regions:[region]}));
  await assert.rejects(workbench.load(),/incompatible/);
  if(process.platform!=='win32') {
    const {root:other,workbench:second}=await fixture();
    await symlink(join(root,'binary-z80.json'),join(other,'binary-z80.json'));await assert.rejects(second.load(),/ordinaire/);
  }
});
