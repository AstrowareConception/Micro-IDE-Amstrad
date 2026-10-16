import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
const original='10 score%=1:DIM score%(2)\n20 score%(1)=7\n30 score%=score%+1\n40 PRINT score%;score%(1);"score%"\n50 other%=9\n60 REM score%';
const expected='10 pointsJoueur%=1:DIM score%(2)\n20 score%(1)=7\n30 pointsJoueur%=pointsJoueur%+1\n40 PRINT pointsJoueur%;score%(1);"score%"\n50 other%=9\n60 REM score%';
export async function verifyVariableRename(browser,errors){
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({original})=>{
  const sources=[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS'},{id:'other',path:'src/other.bas',cpcName:'OTHER.BAS'}];
  window.renameRequests=[];window.renameWorkers=[];window.renameScope='rename';
  const NativeWorker=window.Worker;window.Worker=new Proxy(NativeWorker,{construct(Target,args){const worker=new Target(...args);if(String(args[0]).includes('rename-worker')){window.renameWorkers.push(worker);const post=worker.postMessage.bind(worker);worker.postMessage=data=>{window.renameRequests.push(data);if(!window.holdRename)post(data);};}return worker;}});
  window.desktop={setDirty(){},project:{open:async()=>({sessionId:window.renameScope,manifest:{name:'Renommage BASIC',entryPoint:'main',sources,documents:[]},files:sources.map((s,i)=>({...s,source:i?'10 score%=99':original}))}),exportDisk:async(_id,sources)=>{window.exportedSources=sources;return {name:'rename.dsk'};}}};
 },{original});
 try{
  await page.goto('http://127.0.0.1:5173');await page.locator('.view-lines').first().waitFor();await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();
  const editor=page.locator('.listing .monaco-editor textarea'),panel=page.getByRole('region',{name:'Renommer un symbole BASIC',exact:true}),name=panel.getByRole('textbox',{name:'Nouveau nom sans suffixe',exact:true}),preview=panel.getByRole('button',{name:'Prévisualiser le renommage',exact:true}),apply=panel.getByRole('button',{name:'Appliquer au buffer',exact:true});
  async function cursor(){await editor.focus();await page.keyboard.press('Control+Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');}
  async function open(){await cursor();await page.keyboard.press('F2');await expect(name).toBeVisible();await expect(panel).toContainText('4 occurrence(s)');}
  async function prepare(){await name.fill('pointsJoueur');await preview.click();await expect(apply).toBeEnabled();await expect(panel.getByRole('textbox',{name:'Après',exact:true})).toHaveValue(expected);}
  async function exported(){await page.getByRole('button',{name:'Exporter DSK',exact:true}).click();await expect(page.getByRole('button',{name:'Exporter DSK',exact:true})).toBeEnabled();return page.evaluate(()=>window.exportedSources);}
  await open();await name.fill('other');await preview.click();await expect(panel).toContainText('Collision');await expect(apply).toHaveCount(0);
  await prepare();await expect(panel.getByRole('textbox',{name:'Avant',exact:true})).toHaveValue(original);await panel.screenshot({path:'out/basic-variable-rename.png'});
  await page.setViewportSize({width:480,height:900});assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+2));await page.setViewportSize({width:1440,height:1100});
  const requests=await page.evaluate(()=>window.renameRequests.length);await name.fill('points');await expect(apply).toHaveCount(0);assert.equal(await page.evaluate(()=>window.renameRequests.length),requests,'Typing does not launch analysis');await prepare();await apply.click();await expect(panel).toHaveCount(0);
  assert.deepEqual(await exported(),[{id:'main',source:expected},{id:'other',source:'10 score%=99'}]);
  await editor.focus();await page.keyboard.press('Control+z');assert.equal((await exported())[0].source,original);await editor.focus();await page.keyboard.press('Control+y');assert.equal((await exported())[0].source,expected);await editor.focus();await page.keyboard.press('Control+z');
  // Edit then undo returns the same bytes but must not revive the older preview.
  await open();await prepare();await editor.focus();await page.keyboard.press('Control+End');await page.keyboard.insertText('x');await expect(panel).toContainText('Aperçu périmé');await page.keyboard.press('Control+z');await expect(apply).toBeDisabled();await panel.getByRole('button',{name:'Fermer le renommage'}).click();assert.equal((await exported())[0].source,original);
  await open();await prepare();await page.getByRole('tab',{name:/src\/other.bas/}).click();await expect(apply).toBeDisabled();await expect(panel).toContainText('Aperçu périmé');await panel.getByRole('button',{name:'Fermer le renommage'}).click();await page.getByRole('tab',{name:/src\/main.bas/}).click();
  // A cancelled worker callback cannot populate a plan, even if delivered late.
  await open();await name.fill('pointsJoueur');await page.evaluate(()=>{window.holdRename=true;});await preview.click();await expect(panel).toContainText('Préparation de l’aperçu');await page.evaluate(()=>{window.oldRenameReply=window.renameWorkers.at(-1).onmessage;window.oldRenameId=window.renameRequests.at(-1).id;});await panel.getByRole('button',{name:'Annuler le calcul',exact:true}).click();await page.evaluate(()=>{window.oldRenameReply({data:{id:window.oldRenameId,error:'LATE RESPONSE'}});window.holdRename=false;});await expect(panel).toContainText('Calcul annulé');await expect(panel).not.toContainText('LATE RESPONSE');await expect(apply).toHaveCount(0);await prepare();await panel.getByRole('button',{name:'Fermer le renommage'}).click();
  await cursor();await page.getByRole('navigation',{name:'Menus de l’atelier',exact:true}).getByRole('button',{name:'BASIC',exact:true}).click();await page.getByRole('menuitem',{name:'Renommer le symbole…',exact:true}).click();await expect(name).toBeVisible();await prepare();await page.evaluate(()=>{window.renameScope='rename-new';});await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();await expect(apply).toBeDisabled();await expect(panel).toContainText('Aperçu périmé');await panel.getByRole('button',{name:'Fermer le renommage'}).click();
  // Unsupported FN listing remains editable but is never offered as a rename plan.
  await editor.focus();await page.keyboard.press('Control+a');await page.keyboard.insertText('10 score=1\n20 DEF FNx(y)=score+y');await cursor();await page.keyboard.press('F2');await expect(panel).toContainText('définitions requises au début');await expect(apply).toHaveCount(0);await page.keyboard.press('Escape');
  console.log('Variable rename: F2/menu, collision, suffix/scalar-array separation, exact preview, buffer-only apply, one undo/redo, stale revision including ABA/project, cancellation/late reply and narrow panel passed.');
 }finally{await page.close();}
}
