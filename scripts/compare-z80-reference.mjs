// Optional independent comparison. Explicit local checkout, never a runtime dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {disassembleZ80} from '../packages/z80/src/disassemble.ts';
const source=process.env.Z80_REFERENCE_DIR;if(!source)throw Error('Z80_REFERENCE_DIR requis (maziac/z80dismblr).');
const revision='2ff52822f0d706f9f39762e079f300f45cfd451d';
assert.equal(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),revision);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'cpc-z80-reference-'));
try{
 for(const file of fs.readdirSync(path.join(source,'src/disassembler')).filter(f=>f.endsWith('.ts')))fs.writeFileSync(path.join(temporary,file.replace('.ts','.js')),ts.transpile(fs.readFileSync(path.join(source,'src/disassembler',file),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}));
 const require=createRequire(import.meta.url),{Opcode}=require(path.join(temporary,'opcode.js')),{BaseMemory}=require(path.join(temporary,'basememory.js'));
 const norm=s=>s.toUpperCase().replace(/\b([0-9A-F]+)H\b/g,(_,n)=>String(parseInt(n,16))).replace(/\$([0-9A-F]+)/g,(_,n)=>String(parseInt(n,16))).replace(/\s+/g,'');
 const expected=new Set(['OTIR','OTDR','INC (IX+$12)','DEC (IX+$12)','INC (IY+$12)','DEC (IY+$12)']);let compared=0;const differences=[];
 for(const prefix of [[],[0xcb],[0xed],[0xdd],[0xfd],[0xdd,0xcb,0xfd],[0xfd,0xcb,2]])for(let op=0;op<256;op++){
  const bytes=Uint8Array.from([...prefix,op,0x12,0x34,0x56,0x78]),ours=disassembleZ80(bytes,0x8000)[0];if(ours.instruction.startsWith('DEFB'))continue;
  const theirs=Opcode.getOpcodeAt(new BaseMemory(0x8000,bytes),0x8000),mnemonic=theirs.disassemble().mnemonic;
  if(theirs.length!==ours.bytes.length||norm(mnemonic)!==norm(ours.instruction)){assert.ok(expected.has(ours.instruction),ours.instruction+' != '+mnemonic);differences.push({bytes:[...bytes],ours:ours.instruction,theirs:mnemonic,oursLength:ours.bytes.length,theirsLength:theirs.length});}
  compared++;
 }
 assert.equal(compared,699);assert.equal(differences.length,6);
 const report={reference:revision,compared,identical:compared-differences.length,differences,explanation:'OTIR/OTDR are Zilog names. INC/DEC (IX/IY+d) require the displacement byte per Zilog manual; the reference omits it.'};
 fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/z80-comparison.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
