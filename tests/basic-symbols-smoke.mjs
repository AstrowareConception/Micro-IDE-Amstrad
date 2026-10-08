import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
export async function verifyBasicSymbols(browser,errors) {
 const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const sources=[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS'},{id:'util',path:'src/util.bas',cpcName:'UTIL.BAS'}];
  const texts=['10 DIM score(3):score=0\n20 FOR i=1 TO 3:score(i)=i:score=score+score(i):NEXT i\n30 PRINT "PRIVATE_TEXT";score\n40 DATA HIDDEN\n50 END','10 score=1\n20 PRINT score\n30 DEFINT a-z\n40 alpha=2:alpha%=3'];
  window.symbolScope='symbols';window.desktop={setDirty(){},project:{open:async()=>({sessionId:window.symbolScope,manifest:{name:'Symbols',entryPoint:'main',sources,documents:[]},files:sources.map((s,i)=>({...s,source:texts[i]}))})}};
  window.symbolRequests=0;window.symbolStops=0;window.symbolWorkers=[];const NativeWorker=window.Worker, timeout=window.setTimeout;
  window.setTimeout=(fn,delay,...args)=>timeout(fn,window.symbolTimeout&&delay===15000?0:delay,...args);
  window.Worker=new Proxy(NativeWorker,{construct(Target,args){const worker=new Target(...args);if(String(args[0]).includes('symbols-worker')){window.symbolWorkers.push(worker);const post=worker.postMessage.bind(worker),terminate=worker.terminate.bind(worker);worker.postMessage=(...values)=>{window.symbolRequests++;if(!window.holdSymbols)post(...values);};worker.terminate=()=>{window.symbolStops++;terminate();};}return worker;}});
 });
 try{
  await page.goto('http://127.0.0.1:5173');await page.locator('.view-lines').first().waitFor();await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();
  const menus=page.getByRole('navigation',{name:'Menus de l’atelier',exact:true});await menus.getByRole('button',{name:'BASIC',exact:true}).click();await page.getByRole('menuitem',{name:'Symboles et usages BASIC…',exact:true}).click();
  const panel=page.getByRole('region',{name:'Symboles et usages BASIC',exact:true});await expect(panel).toContainText('Choisissez le périmètre');assert.equal(await page.evaluate(()=>window.symbolRequests),0);
  await panel.getByLabel('Périmètre de l’index').selectOption('loaded');await panel.getByRole('button',{name:'Actualiser l’index',exact:true}).click();
  await expect(panel).toContainText('Index sur les sources inchangées.');await expect(panel).toContainText('index partiel');assert.equal(await page.evaluate(()=>window.symbolRequests),1);assert.equal(await page.evaluate(()=>window.symbolStops),1);
  await panel.getByLabel('Rechercher un symbole').fill('score');await expect(panel.locator('.symbols-list > li')).toHaveCount(3);
  const array=panel.locator('.symbols-list button').filter({hasText:'Tableau'});await array.click();await expect(panel.locator('.symbol-occurrences > li')).toHaveCount(3);
  await panel.getByLabel('Filtrer les usages').selectOption('write');await expect(panel.locator('.symbol-occurrences > li')).toHaveCount(1);
  await panel.locator('.symbol-occurrences button').click();await expect(page.locator('footer')).toContainText('L2 · C');
  const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Exporter JSON',exact:true}).click();const chunks=[];for await(const chunk of await(await download).createReadStream())chunks.push(chunk);
  const exported=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.equal(exported.report.version,1);assert.equal(exported.stale,false);assert.equal(exported.report.sources.length,2);assert.ok(!JSON.stringify(exported).includes('PRIVATE_TEXT'));assert.ok(!JSON.stringify(exported).includes('HIDDEN'));
  await panel.getByLabel('Filtrer les usages').selectOption('all');await page.getByRole('button',{name:'Agrandir les sorties',exact:true}).click();await panel.scrollIntoViewIfNeeded();await panel.locator('.symbols-columns').screenshot({path:'out/basic-symbols-browser.png'});await page.getByRole('button',{name:'Restaurer les sorties',exact:true}).click();
  await page.getByRole('button',{name:'Fermer l’onglet src/util.bas',exact:true}).click();await panel.locator('.symbols-list button').filter({hasText:'src/util.bas'}).click();await panel.getByRole('button',{name:'Lecture · BASIC 20 · L2 · C10',exact:true}).click();await expect(page.getByRole('tab',{name:/src\/util.bas/})).toHaveAttribute('aria-selected','true');
  const input=page.locator('.listing .monaco-editor textarea');await input.focus();await page.keyboard.press('Control+End');await page.keyboard.insertText('\n50 score=99');
  await expect(panel).toContainText('Index obsolète');await expect(panel.locator('.symbol-occurrences button').first()).toBeDisabled();assert.equal(await page.evaluate(()=>window.symbolRequests),1,'No indexing on typing');
  const md=page.waitForEvent('download');await panel.getByRole('button',{name:'Exporter Markdown',exact:true}).click();const mdChunks=[];for await(const chunk of await(await md).createReadStream())mdChunks.push(chunk);assert.match(Buffer.concat(mdChunks).toString('utf8'),/obsolète/);
  await page.evaluate(()=>{window.holdSymbols=true;});await panel.getByRole('button',{name:'Actualiser l’index',exact:true}).click();await page.evaluate(()=>{window.oldSymbolHandler=window.symbolWorkers.at(-1).onmessage;});await panel.getByRole('button',{name:'Annuler l’indexation',exact:true}).click();await expect(panel).toContainText('Indexation annulée.');
  await panel.getByRole('button',{name:'Actualiser l’index',exact:true}).click();await page.evaluate(()=>window.oldSymbolHandler({data:{id:2,report:{sources:[]}}}));await expect(panel).toContainText('Indexation en cours…');
  await page.evaluate(()=>window.symbolWorkers.at(-1).dispatchEvent(new ErrorEvent('error',{message:'test'})));await expect(panel).toContainText('Indexation indisponible.');
  await page.evaluate(()=>{window.holdSymbols=false;});await panel.getByLabel('Périmètre de l’index').selectOption('active');await panel.getByRole('button',{name:'Actualiser l’index',exact:true}).click();await expect(panel).toContainText('Index sur les sources inchangées.');
  await page.getByRole('button',{name:/^Problèmes \d/}).click();await page.getByRole('navigation',{name:'Panneaux de sortie',exact:true}).getByRole('button',{name:'Symboles',exact:true}).click();assert.equal(await page.evaluate(()=>window.symbolRequests),4);
  await page.evaluate(()=>{window.holdSymbols=true;window.symbolTimeout=true;});await panel.getByRole('button',{name:'Actualiser l’index',exact:true}).click();await expect(panel).toContainText('Indexation interrompue après 15 secondes.');
  await page.evaluate(()=>{window.symbolTimeout=false;});await panel.getByRole('button',{name:'Actualiser l’index',exact:true}).click();
  await input.focus();await page.keyboard.press('Control+a');await page.keyboard.insertText('10 score=1\n20 PRINT score\n30 DEFINT a-z\n40 alpha=2:alpha%=3');await page.evaluate(()=>{window.symbolScope='symbols-next';});await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();await expect(panel).toContainText('Choisissez le périmètre');assert.equal(await page.evaluate(()=>window.symbolStops),6);
  console.log('BASIC symbols: worker on demand, separate source identities, roles, exports, navigation, stale guard, cancellation, late reply, failure, timeout and project replacement passed.');
 }finally{await page.close();}
}
