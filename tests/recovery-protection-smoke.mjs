import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DiskImportSession} from '../apps/desktop/disk-import.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {createDataDisk} from '../packages/cpc-disk/src/data-disk.ts';
import {encodeBasicFile} from '../packages/cpc-disk/src/basic-codec.ts';
import {encodeAmsdosBinary} from '../packages/cpc-disk/src/amsdos-binary.ts';
import {distributionDisk} from '../packages/cpc-disk/src/distribution.ts';
import {inspectDataDisk} from '../packages/cpc-disk/src/import-disk.ts';
export async function verifyRecoveryProtection(browser){
 const dir=await mkdtemp(join(tmpdir(),'cpc-protection-ui-')),path=join(dir,'recover.dsk');
 const source='10 REM SECRET COMMENT\n20 count=7:PRINT count\n30 END\n';
 await writeFile(path,createDataDisk([{name:'MAIN.BAS',bytes:encodeBasicFile('MAIN.BAS',source,true)},{name:'CODE.BIN',bytes:encodeAmsdosBinary('CODE.BIN',Uint8Array.from([0x3e,42,0xc9]),0x8000,0x8000)}]));
 const session=await DiskImportSession.prepare(path);let project, exported=0;
 const page=await browser.newPage({viewport:{width:1360,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('recoveryInspect',()=>session.preview);
 await page.exposeFunction('recoveryCreate',async request=>{const root=await session.create(dir,request);project=await ProjectStore.open(root);return project.snapshot;});
 await page.exposeFunction('recoveryDisassemble',request=>({listing:session.disassemble(request)}));
 await page.exposeFunction('recoveryExtract',async request=>{assert.match(request.listing,/LD A,\$2A/);await writeFile(join(dir,'recovered.asm'),request.listing);return {name:'recovered.asm'};});
 await page.exposeFunction('protectionExport',async request=>{const disk=distributionDisk(request.sources.map(s=>({name:project.store.manifest.sources.find(f=>f.id===s.id).cpcName,source:s.source})),request.options,(await project.store.readAssets()).map(a=>({name:project.store.manifest.assets.find(f=>f.id===a.id).cpcName,bytes:a.bytes})));await writeFile(join(dir,`mode-${request.options.mode}.dsk`),disk);const listing=inspectDataDisk(disk).files.find(f=>f.name==='MAIN.BAS');assert.ok(listing.source);assert.equal(listing.source.includes('SECRET COMMENT'),request.options.mode==='protected');exported++;return {name:`mode-${request.options.mode}.dsk`};});
 await page.addInitScript(()=>{window.confirm=()=>true;window.desktop={setDirty(){},open:async()=>null,save:async()=>null,exportDisk:async()=>null,diskImport:{inspect:()=>window.recoveryInspect(),create:r=>window.recoveryCreate(r),disassemble:r=>window.recoveryDisassemble(r),extract:r=>window.recoveryExtract(r)},distribution:{export:r=>window.protectionExport(r)}};});
 try{
 await page.goto('http://127.0.0.1:5173');await page.locator('.monaco-editor .view-line').first().waitFor();
 const menu=async name=>{await page.getByRole('navigation',{name:'Menus de l’atelier',exact:true}).getByRole('button',{name:'Fichier',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();};
 await menu('Importer une disquette DSK…');const dialog=page.getByRole('dialog',{name:'Importer une disquette DSK',exact:true});
 await expect(dialog.getByLabel('Importer MAIN.BAS',{exact:true})).toBeChecked();await dialog.getByRole('button',{name:'Examiner CODE.BIN',exact:true}).click();
 await expect(dialog.getByLabel('Origine Z80',{exact:true})).toHaveValue('32768');await dialog.getByRole('button',{name:'Désassembler la plage Z80',exact:true}).click();await expect(dialog.getByLabel('Listing Z80',{exact:true})).toContainText('LD A,$2A');
 await dialog.getByRole('button',{name:'Enregistrer le listing .asm…',exact:true}).click();await expect(dialog).toContainText('Enregistré : recovered.asm');
 await dialog.getByRole('button',{name:'Choisir le dossier parent et importer',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.view-lines')).toContainText('SECRET COMMENT');
 await menu('Exporter avec protection…');const distribution=page.getByRole('dialog',{name:'Exporter avec protection',exact:true});
 for(const mode of ['obfuscate','protected','combined']){await distribution.getByLabel('Mode d’export',{exact:true}).selectOption(mode);await distribution.getByRole('button',{name:'Prévisualiser',exact:true}).click();await expect(distribution.getByLabel('Listing distribué',{exact:true})).toBeVisible();await distribution.getByRole('button',{name:'Enregistrer le DSK de distribution…',exact:true}).click();await expect(distribution).toContainText(`Disquette enregistrée : mode-${mode}.dsk`);}
 await page.screenshot({path:'out/protection-alpha.png'});assert.equal(exported,3);assert.equal(await readFile(join(project.store.root,project.store.manifest.sources[0].path),'utf8'),source);assert.deepEqual(errors,[]);
 }finally{await page.close();}
}
