import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tokenizeBasic,detokenizeBasic,protectBasic,encodeBasicFile,validateTokenized } from '../packages/cpc-disk/src/basic-codec.ts';
import { inspectDataDisk } from '../packages/cpc-disk/src/import-disk.ts';
import { createDataDisk,readDataDisk } from '../packages/cpc-disk/src/data-disk.ts';
import { distributionDisk } from '../packages/cpc-disk/src/distribution.ts';
import { obfuscateBasic } from '../packages/basic-language/src/obfuscate.ts';
import { DiskImportSession } from '../apps/desktop/disk-import.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { buildProjectDisk } from '../packages/workspace/src/project.ts';
import { disassembleZ80 } from '../packages/z80/src/disassemble.ts';
const source='10 REM PRIVATE COMMENT\n20 DEFINT A-Z:total=3:FOR index=1 TO total:PRINT index:NEXT index\n30 END\n';
const options={rename:true,comments:true,renumber:false};
test('known BASIC bytes, numbers, strings, DATA, RSX and comments decode without extension guessing',()=>{
  assert.deepEqual([...tokenizeBasic('10 PRINT "HI"\n')],[11,0,10,0,191,32,34,72,73,34,0,0,0]);
  for(const source of ['10 PRINT -1.5,65535,&FFFF,&X101\n','10 DEF FNf(x)=x+1:PRINT FNf(2)\n', '10 |DISC:REM X\n', '10 DATA "A:B",abc|def,42:READ a$,b$,n\n']) {
    const bytes=tokenizeBasic(source),listing=detokenizeBasic(bytes);assert.deepEqual(tokenizeBasic(listing),bytes);
  }
  const bytes=encodeBasicFile('OLD.BIN',source,true),file=inspectDataDisk(createDataDisk([{name:'OLD.BIN',bytes}])).files[0]!;
  assert.equal(file.kind,'basic-protected');assert.match(file.source!,/PRIVATE COMMENT/);
});
test('truncated tokens, unresolved memory pointers, bad terminators and unsupported glyphs fail closed',()=>{
  const b=tokenizeBasic('10 PRINT 1234\n');
  for(let end=0;end<b.length;end++) assert.throws(()=>validateTokenized(b.slice(0,end)));
  const pointer=b.slice();pointer[6]=0x1d;assert.throws(()=>validateTokenized(pointer),/Pointeur/);
  const variable=Uint8Array.from([9,0,10,0,13,0,0,65,0,0,0]);assert.throws(()=>validateTokenized(variable));
  const glyph=tokenizeBasic('10 PRINT "X"\n');glyph[7]=200;assert.throws(()=>detokenizeBasic(glyph),/Caractères/);
});
test('protection restarts at 128 bytes and is symmetric over every byte value',()=>{
  const b=Uint8Array.from({length:512},(_,i)=>i&255),p=protectBasic(b);assert.equal(p[0],0xab);assert.equal(p[128],0x80^0xab);assert.deepEqual(protectBasic(p),b);
});
test('three distribution modes preserve clear source, conceal comments/names and respect first-letter types',()=>{
  const transformed=obfuscateBasic(source,options);assert.ok(!transformed.source.includes('PRIVATE'));assert.ok(!transformed.source.includes('total'));assert.match(transformed.source,/TZ[0-9]/);assert.match(transformed.source,/DEFINT A-Z/);
  for(const mode of ['obfuscate','protected','combined'] as const){
    const disk=distributionDisk([{name:'MAIN.BAS',source}],{...options,mode});const file=inspectDataDisk(disk).files[0]!;
    assert.ok(file.source);assert.equal(file.kind,mode==='obfuscate'?'basic-ascii':'basic-protected');assert.equal(file.source.includes('PRIVATE'),mode==='protected');
    assert.equal(readDataDisk(disk).length,1);
  }
  assert.match(source,/PRIVATE/);
  assert.equal(inspectDataDisk(createDataDisk([{name:'ASCII.BAS',bytes:new TextEncoder().encode('10 END\x1aSTALE PADDING')}])).files[0]!.source,'10 END\n');
  for(const unsafe of ['10 POKE &8000,1\n','10 CALL &8000\n','10 |DISC\n','10 DEF FNf(x)=x\n'])assert.throws(()=>obfuscateBasic(unsafe,options));
  assert.throws(()=>distributionDisk([{name:'MAIN.BAS',source}],{...options,mode:'combined'},[{name:'CLEAR.BAS',bytes:encodeBasicFile('CLEAR.BAS',source)}]),/Ressource BASIC/);
});
test('Extended DATA and SYSTEM extraction; damaged sector fails rather than producing partial source',()=>{
  const standard=createDataDisk([{name:'MAIN.BAS',bytes:encodeBasicFile('MAIN.BAS',source)}]);
  const extended=standard.slice();extended.fill(0,0,256);extended.set(new TextEncoder().encode('EXTENDED CPC DSK File\r\nDisk-Info\r\n'));extended[48]=40;extended[49]=1;extended.fill(19,52,92);
  for(let t=0;t<40;t++)for(let n=0;n<9;n++){const d=256+t*4864+24+n*8;extended[d+6]=0;extended[d+7]=2;}
  assert.match(inspectDataDisk(extended).profile,/extended-data/);assert.equal(inspectDataDisk(extended).files[0]!.source,source);
  const system=standard.slice();for(let t=39;t>=2;t--)system.set(standard.subarray(256+(t-2)*4864,256+(t-1)*4864),256+t*4864);
  for(let t=0;t<40;t++){const p=256+t*4864;system[p+16]=t;for(let n=0;n<9;n++){const d=p+24+n*8;system[d]=t;system[d+2]=0x41+n;}}
  assert.match(inspectDataDisk(system).profile,/system/);assert.equal(inspectDataDisk(system).files[0]!.source,source);
  extended[256+24+4]=1;assert.throws(()=>inspectDataDisk(extended),/Secteurs/);
});
test('standalone protected BIN creates editable project; resources survive build and tampering blocks it',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'recovery-')),path=join(dir,'OLD.BIN');await writeFile(path,encodeBasicFile('OLD.BIN',source,true));
  const session=await DiskImportSession.prepareFile(path);const root=await session.create(dir,{id:session.preview.id,name:'Recovered',sourceIds:['file-0'],entryId:'file-0'});
  const opened=await ProjectStore.open(root);assert.match(opened.snapshot.files[0]!.source,/DEFINT/);assert.deepEqual(await readFile(path),await readFile(join(root,'.microide/imports/original.bin')));
  const diskpath=join(dir,'old.dsk');const resource=Uint8Array.from([3,9,4,8]);await writeFile(diskpath,createDataDisk([{name:'MAIN.BAS',bytes:encodeBasicFile('MAIN.BAS',source)},{name:'PIC.SCR',bytes:resource}]));
  const diskSession=await DiskImportSession.prepare(diskpath),entry=diskSession.preview.files.find(f=>f.source)!;
  const diskRoot=await diskSession.create(dir,{id:diskSession.preview.id,name:'Resources',sourceIds:[entry.id],entryId:entry.id});const project=await ProjectStore.open(diskRoot);
  const rebuilt=readDataDisk(buildProjectDisk(project.store.manifest,project.snapshot.files,await project.store.readAssets()));assert.deepEqual(rebuilt.find(f=>f.name==='PIC.SCR')!.records.subarray(0,4),resource);
  await writeFile(join(diskRoot,project.store.manifest.assets[0]!.path),new Uint8Array(128));await assert.rejects(project.store.readAssets(),/changé/);
});
test('Z80 base, CB, ED, IX/IY, indexed CB, relative targets and truncations preserve every original byte',()=>{
  const b=Uint8Array.from([0x3e,0x2a,0x32,0,0x80,0x18,0xf9,0xcb,0x7e,0xed,0xb0,0xdd,0x21,0,0x90,0xfd,0x36,0xfe,0xaa,0xdd,0xcb,1,0x46,0xc9,0xcd]);
  const rows=disassembleZ80(b,0x8000);assert.deepEqual(rows.flatMap(r=>r.bytes),[...b]);
  assert.deepEqual(rows.slice(0,4).map(r=>r.instruction),['LD A,$2A','LD ($8000),A','JR $8000','BIT 7,(HL)']);
  assert.ok(rows.some(r=>r.instruction==='LD (IY-$02),$AA'));assert.ok(rows.some(r=>r.instruction==='BIT 0,(IX+$01)'));assert.match(rows.at(-1)!.instruction,/DEFB/);
  for(const prefix of [[],[0xcb],[0xed],[0xdd],[0xfd],[0xdd,0xcb,0],[0xfd,0xcb,0]])for(let op=0;op<256;op++) {const b=Uint8Array.from([...prefix,op,0,0,0]);assert.deepEqual(disassembleZ80(b,0).flatMap(r=>r.bytes),[...b]);}
  assert.throws(()=>disassembleZ80(new Uint8Array(2),65535));
});
