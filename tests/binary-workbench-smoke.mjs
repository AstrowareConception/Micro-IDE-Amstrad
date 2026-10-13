import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDataDisk, readDataDisk } from '../packages/cpc-disk/src/data-disk.ts';
import { encodeAmsdosBinary } from '../packages/cpc-disk/src/amsdos-binary.ts';
import { DiskImportSession } from '../apps/desktop/disk-import.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { runDisk } from '../packages/emulator/src/run.ts';
import { BinaryWorkbench } from '../apps/desktop/binary-workbench.ts';
const bytes=()=>createDataDisk([{name:'BOOT.BIN',bytes:encodeAmsdosBinary('BOOT.BIN',Uint8Array.of(0x3e,77,0x32,0,0x90,0xc9),0x8000,0x8000)}]);
export async function verifyBinaryWorkbench(browser) {
  const parent=await mkdtemp(join(tmpdir(),'cpc-z80-ui-')),path=join(parent,'binary.dsk');await writeFile(path,bytes());
  let session,project,workbench,root,prepared=false;
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const open=async()=>{project=await ProjectStore.open(root);workbench=new BinaryWorkbench(project.store);return project.snapshot;};
  await page.exposeFunction('binaryInspect',async()=>{session=await DiskImportSession.prepare(path);return session.preview;});
  await page.exposeFunction('binaryCreate',async request=>{root=await session.create(parent,request);return open();});
  await page.exposeFunction('binaryOpen',open);
  await page.exposeFunction('binaryRun',async request=>{const {binaryRevision,...base}=request;const compiled=await workbench.compile(binaryRevision);const image=runDisk(base,project.store.manifest,compiled.assets);assert.equal(readDataDisk(image.disk)[0].records[129],78);prepared=true;return {error:'ROM volontairement absentes de cette recette UI'};});
  await page.exposeFunction('binaryCall',async(method,args)=>{
    try {if(method==='exportDisk'){const result=await workbench.disk(args[0]);await writeFile(join(parent,'modified.dsk'),result.disk);return {name:'modified.dsk'};}return await workbench[method](...args);}catch(e){return {error:e.message};}
  });
  await page.addInitScript(()=>{window.confirm=()=>true;window.desktop={setDirty(){},open:async()=>null,save:async()=>null,exportDisk:async()=>null,
    emulator:{prepare:r=>window.binaryRun(r)},project:{open:()=>window.binaryOpen()},diskImport:{inspect:()=>window.binaryInspect(),create:r=>window.binaryCreate(r)},
    binary:Object.fromEntries(['load','inspect','generate','save','verify','exportDisk'].map(method=>[method,(_session,...args)=>window.binaryCall(method==='verify'?'compile':method,args)]))};});
  const menu=async name=>{await page.getByRole('navigation',{name:'Menus de l’atelier',exact:true}).getByRole('button',{name:'Fichier',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();};
  try {
    await page.goto('http://127.0.0.1:5173');await page.locator('.monaco-editor .view-line').first().waitFor();
    await menu('Importer une disquette DSK…');const dialog=page.getByRole('dialog',{name:'Importer une disquette DSK',exact:true});
    await expect(dialog.getByLabel('Projet binaire',{exact:true})).toBeChecked();
    await dialog.getByRole('button',{name:'Choisir le dossier parent et importer',exact:true}).click();
    const panel=page.getByRole('region',{name:'Atelier Z80',exact:true});await expect(panel).toBeVisible();
    await expect(panel.getByLabel('Origine de zone',{exact:true})).toHaveValue('32768');
    await panel.getByRole('button',{name:'Créer une zone et vérifier l’aller-retour',exact:true}).click();
    const listing=panel.getByLabel('Source assembleur Z80',{exact:true});await expect(listing).toContainText('LD A,$4D');
    await panel.getByLabel('Annotations Z80',{exact:true}).fill('Routine témoin : valeur observée à 9000.');
    await panel.getByRole('button',{name:'Enregistrer l’analyse',exact:true}).click();await expect(panel).toContainText('Analyse enregistrée');
    await panel.getByRole('button',{name:'Vérifier le réassemblage',exact:true}).click();await expect(panel).toContainText('0 octet(s) modifié(s)');
    await listing.fill((await listing.inputValue()).replace('LD A,$4D','LD A,$4E'));await expect(panel.getByRole('button',{name:'Exporter le DSK modifié…',exact:true})).toBeDisabled();
    await page.keyboard.press('Control+s');await expect(panel.getByRole('button',{name:'Enregistrer l’analyse',exact:true})).toBeDisabled();
    await panel.getByRole('button',{name:'Vérifier le réassemblage',exact:true}).click();await expect(panel).toContainText('1 octet(s) modifié(s)');
    await panel.getByRole('button',{name:'Exporter le DSK modifié…',exact:true}).click();await expect(panel).toContainText('modified.dsk');
    assert.equal(readDataDisk(await readFile(join(parent,'modified.dsk')))[0].records[129],78);
    await panel.getByRole('button',{name:'Tester la copie modifiée',exact:true}).click();await expect.poll(()=>prepared).toBe(true);
    await page.reload();await page.locator('.monaco-editor .view-line').first().waitFor();
    await menu('Ouvrir un projet');await expect(panel).toBeVisible();await panel.getByRole('navigation',{name:'Zones analysées',exact:true}).getByRole('button').first().click();
    await expect(panel.getByLabel('Annotations Z80',{exact:true})).toHaveValue('Routine témoin : valeur observée à 9000.');await expect(listing).toContainText('LD A,$4E');
    await page.screenshot({path:'out/binary-workbench-alpha.png'});assert.deepEqual(await readFile(path),Buffer.from(bytes()));assert.deepEqual(errors,[]);
  }finally{await page.close();}
}
export async function verifyBinaryWorkbenchDesktop(page,desktop,parent) {
  const path=join(parent,'native-binary.dsk');await writeFile(path,bytes());
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},path);
  const preview=await page.evaluate(()=>window.desktop.diskImport.inspect());assert.ok(preview.id,JSON.stringify(preview));
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},parent);
  const project=await page.evaluate(p=>window.desktop.diskImport.create({id:p.id,name:'Native binary',kind:'binary',sourceIds:[],entryId:p.files[0].id}),preview);
  assert.equal(project.manifest.kind,'binary');assert.deepEqual(project.files,[]);
  const id=project.manifest.assets[0].id;
  const initial=await page.evaluate(async({sessionId,id})=>Promise.all([window.desktop.binary.load(sessionId),window.desktop.binary.inspect(sessionId,id)]),{sessionId:project.sessionId,id});
  assert.equal(initial[0].revision,null);assert.equal(initial[1].loadAddress,0x8000);
  const generated=await page.evaluate(({sessionId,id})=>window.desktop.binary.generate(sessionId,id,0,6,0x8000,'code'),{sessionId:project.sessionId,id});assert.ok(generated.listing,JSON.stringify(generated));
  const region={id:'routine',assetId:id,sha256:initial[1].sha256,offset:0,length:6,origin:0x8000,kind:'code',note:'native IPC',listing:generated.listing.replace('LD A,$4D','LD A,$4E')};
  const saved=await page.evaluate(({sessionId,region})=>window.desktop.binary.save(sessionId,null,[region]),{sessionId:project.sessionId,region});assert.ok(saved.revision,JSON.stringify(saved));
  const result=await page.evaluate(({sessionId,revision})=>window.desktop.binary.verify(sessionId,revision),{sessionId:project.sessionId,revision:saved.revision});assert.equal(result.changedBytes,1);
  const stale=await page.evaluate(sessionId=>window.desktop.emulator.prepare({sessionId,sources:[],binaryRevision:'0'.repeat(64)}),project.sessionId);assert.match(stale.error,/périmée/);
  const output=join(parent,'native-binary-edited.dsk');await desktop.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});},output);
  const exported=await page.evaluate(({sessionId,revision})=>window.desktop.binary.exportDisk(sessionId,revision),{sessionId:project.sessionId,revision:saved.revision});assert.ok(exported.name,JSON.stringify(exported));
  assert.equal(readDataDisk(await readFile(output))[0].records[129],78);assert.deepEqual(await readFile(path),Buffer.from(bytes()));
}
