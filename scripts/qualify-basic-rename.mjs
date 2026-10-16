import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import createCpc from '../out/cpc.mjs';
import { basicRenameCases } from '../tests/fixtures/basic-rename-cases.ts';
import { planSymbolRename } from '../packages/basic-language/src/rename-symbol.ts';
import { basicFnRenameCases } from '../tests/fixtures/basic-fn-rename-cases.ts';
import { buildListingDisk } from '../packages/basic-language/src/build.ts';
import { basicTestPlan, validBasicTestResult } from '../packages/emulator/src/basic-tests.ts';
import { BASIC_TEST_FIRMWARE, basicTestHash, executeBasicTests } from '../packages/emulator/src/basic-test-runtime.ts';
const example=await readFile('examples/symbols/rename-functions.bas');
assert.equal(example.toString('utf8'),basicFnRenameCases.find(c=>c.name==='parameter-nested-free').before+'\n','Exemple livré identique au témoin qualifié');
const root=process.env.CPC_TEST_ROM_DIR;
if(!root)throw new Error('CPC_TEST_ROM_DIR requis : ROM 6128 anglaises identifiées, hors dépôt.');
const roms=Object.fromEntries(await Promise.all(['os','basic','amsdos'].map(async role=>[role,new Uint8Array(await readFile(join(root,`cpc6128_${role}.bin`)))])));
const wasmBinary=await readFile('out/cpc.wasm');
const report={version:1,firmware:BASIC_TEST_FIRMWARE,engine:{wasmSha256:await basicTestHash(wasmBinary),chipsLock:JSON.parse(await readFile('packages/emulator/chips.lock.json','utf8'))},fixturesSha256:await basicTestHash(await readFile('tests/fixtures/basic-rename-cases.ts')),fnFixturesSha256:await basicTestHash(await readFile('tests/fixtures/basic-fn-rename-cases.ts')),exampleSha256:await basicTestHash(example),independentEmulator:false,physicalCpc:false,results:[]};
for(const specimen of [...basicRenameCases,...basicFnRenameCases]){
 const renamed=planSymbolRename(specimen.before,specimen,specimen.newStem);assert.equal(renamed.after,specimen.after,'Après indépendant : '+specimen.name);
 for(const [variant,body] of [['before',specimen.before],['after',renamed.after]]){
  // Add the observation harness only after planning: production rejects POKE/MEMORY.
  const source=`10 REM @CPCTEST 1 Rename ${specimen.name}\n20 MEMORY &7FFF\n${body}\n60000 IF result=${specimen.expected} THEN POKE &8004,1 ELSE POKE &8004,2\n60010 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165\n60020 GOTO 60020\n`;
  const disk=buildListingDisk(source),name=specimen.name+'-'+variant,plan=basicTestPlan({id:name,name,source});
  const image={disk,entry:'MAIN.BAS',label:name,sha256:await basicTestHash(disk),roms,firmware:BASIC_TEST_FIRMWARE};
  const cpc=await createCpc({wasmBinary}),result=await executeBasicTests(cpc,image,plan,3,async()=>{});
  assert.ok(validBasicTestResult(result,plan),name);assert.equal(result.sourceSha256,await basicTestHash(new TextEncoder().encode(source)));assert.equal(cpc._cpc_bridge_step(20000),-2,'Machine libérée');
  report.results.push({name,expected:specimen.expected,result});console.log(`${name}: ${result.outcome}`);
 }
}
await writeFile('out/basic-rename-qualification.json',JSON.stringify(report,null,2)+'\n');
assert.ok(report.results.every(item=>item.result.outcome==='passed'),'Renommage non qualifié : voir le rapport.');
console.log(`Renommage : ${report.results.length} recettes avant/après réussies.`);
