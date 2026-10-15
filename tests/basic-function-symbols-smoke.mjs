import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
export async function verifyFunctionSymbols(browser,errors){
 const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const sources=[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS'},{id:'other',path:'src/other.bas',cpcName:'OTHER.BAS'}];
  const texts=['10 x=99\n20 DEF FNinner(y)=x+y\n30 DEF FNouter(x)=FNinner(2)+x\n40 result=FNouter(3)\n50 PRINT "PRIVATE_FN"','10 DEFINT x\n20 DEF FNvalue(x)=x+1\n30 DEF FNvalue(x)=x+2\n40 result=FNvalue(3):other=FNmissing'];
  window.fnRequests=0;const NativeWorker=window.Worker;window.Worker=new Proxy(NativeWorker,{construct(Target,args){const worker=new Target(...args);if(String(args[0]).includes('symbols-worker')){const post=worker.postMessage.bind(worker);worker.postMessage=(...values)=>{window.fnRequests++;post(...values);};}return worker;}});
  window.desktop={setDirty(){},project:{open:async()=>({sessionId:'fn-symbols',manifest:{name:'Fonctions FN',entryPoint:'main',sources,documents:[]},files:sources.map((s,i)=>({...s,source:texts[i]}))})}};
 });
 try{
  await page.goto('http://127.0.0.1:5173');await page.locator('.view-lines').first().waitFor();await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();
  await page.getByRole('navigation',{name:'Menus de l’atelier',exact:true}).getByRole('button',{name:'BASIC',exact:true}).click();await page.getByRole('menuitem',{name:'Symboles et usages BASIC…',exact:true}).click();
  const panel=page.getByRole('region',{name:'Symboles et usages BASIC',exact:true});await panel.getByLabel('Périmètre de l’index').selectOption('loaded');await panel.getByRole('button',{name:'Actualiser l’index',exact:true}).click();await expect(panel).toContainText('Index sur les sources inchangées.');
  await panel.getByRole('button',{name:'Fonctions FN et paramètres',exact:true}).click();const fn=panel.locator('.fn-symbols');
  await expect(fn).toContainText('Déclarations FN (4)');await expect(fn).toContainText('X · Variable libre (globale)');await expect(fn).toContainText('Y · Paramètre local');
  await fn.locator('.symbols-list button').filter({hasText:'FN OUTER'}).click();await expect(fn).toContainText('X · Paramètre local');
  await fn.getByRole('button',{name:'Paramètre X · BASIC 30 · C16',exact:true}).click();await expect(page.locator('footer')).toContainText('L3 · C17');
  await fn.getByRole('button',{name:'Appel FN INNER · src/main.bas · BASIC 30 · C21',exact:true}).click();await expect(page.locator('footer')).toContainText('L3 · C26');
  await fn.getByLabel('Rechercher une fonction ou un paramètre').fill('value');await expect(fn).toContainText('Déclarations FN (2)');await expect(fn).toContainText('Liaison ambiguë');await expect(fn).toContainText('Déclarations ou types ambigus');
  await fn.getByRole('button',{name:'Vers FN VALUE · BASIC 30',exact:true}).click();await expect(page.getByRole('tab',{name:/src\/other.bas/})).toHaveAttribute('aria-selected','true');await expect(page.locator('footer')).toContainText('L3 · C15');
  await fn.getByLabel('Rechercher une fonction ou un paramètre').fill('missing');await expect(fn).toContainText('Aucune déclaration couverte');
  const event=page.waitForEvent('download');await panel.getByRole('button',{name:'Exporter JSON',exact:true}).click();const chunks=[];for await(const c of await(await event).createReadStream())chunks.push(c);const exported=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.equal(exported.report.version,3);assert.equal(exported.report.sources[0].functions.definitions.length,2);assert.ok(!JSON.stringify(exported).includes('PRIVATE_FN'));
  await fn.getByLabel('Rechercher une fonction ou un paramètre').fill('');await fn.locator('.symbols-list button').filter({hasText:'FN OUTER'}).click();await page.getByRole('button',{name:'Agrandir les sorties',exact:true}).click();await page.setViewportSize({width:1440,height:2200});await panel.evaluate(el=>{for(let node=el;node;node=node.parentElement)node.scrollTop=0;});await fn.screenshot({path:'out/basic-fn-symbols.png'});await page.setViewportSize({width:1440,height:1100});await page.getByRole('button',{name:'Restaurer les sorties',exact:true}).click();
  const input=page.locator('.listing .monaco-editor textarea');await input.focus();await page.keyboard.press('Control+End');await page.keyboard.insertText('\n50 extra=1');await expect(panel).toContainText('Index obsolète');await expect(fn.locator('.fn-calls button').first()).toBeDisabled();await expect(fn.getByRole('button',{name:/^Paramètre X/})).toBeDisabled();assert.equal(await page.evaluate(()=>window.fnRequests),1);
  await page.setViewportSize({width:480,height:900});assert.ok(await fn.evaluate(el=>el.scrollWidth<=el.clientWidth+2));
  console.log('FN symbols: scopes, candidates, ambiguity, exact navigation, exports, stale links and narrow layout passed.');
 }finally{await page.close();}
}
