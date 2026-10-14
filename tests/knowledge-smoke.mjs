import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore } from '../apps/desktop/project-store.ts';

export async function verifyKnowledge(browser) {
 const root=await mkdtemp(join(tmpdir(),'cpc-knowledge-ui-'));
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let project=await ProjectStore.create(root,'Mahjong · connaissances');
 const guard=async fn=>{try{return await fn();}catch(e){return {error:e.message};}};
 await page.exposeFunction('knowledgeOpen',async()=>{project=await ProjectStore.open(root);return project.snapshot;});
 await page.exposeFunction('knowledgeRead',id=>guard(()=>project.store.readDocument(id)));
 await page.exposeFunction('knowledgeWrite',request=>guard(()=>project.store.writeKnowledge(request)));
 await page.addInitScript(()=>{window.confirm=()=>true;window.desktop={setDirty(v){window.knowledgeDirty=v;},open:async()=>null,save:async()=>null,exportDisk:async()=>null,project:{open:()=>window.knowledgeOpen(),readDocument:(_s,id)=>window.knowledgeRead(id)},knowledge:{write:(_s,request)=>window.knowledgeWrite(request)}};});
 try{
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();
 await page.getByRole('button',{name:'Afficher Connaissances',exact:true}).click();
 const library=page.getByRole('region',{name:'Documents du projet',exact:true}),reader=page.getByRole('region',{name:'Document ouvert',exact:true});
 await library.getByText('Créer un document Markdown',{exact:true}).click();await library.getByRole('button',{name:'Roadmap',exact:true}).click();
 const source=reader.getByLabel('Texte du document',{exact:true});
 const md='# Projet Mahjong\n\n## Objectif\n\nUn jeu **lisible**, *soigné* et ~~inachevé~~.\n\n> Une étape à la fois.\n\n- [x] Définir les règles\n- [ ] Tester le démarrage\n\n| Mode | Encres |\n| --- | --- |\n| 1 | 4 |\n\n```basic\n10 MODE 1\n20 PRINT "MAHJONG"\n```\n\n[Objectif](#objectif) · [Référence](https://example.invalid)\n';
 await source.fill(md+'\n<script>window.injected=true</script>\n![Image externe](https://example.invalid/tracker.png)');await expect.poll(()=>page.evaluate(()=>window.knowledgeDirty)).toBe(true);
 await expect(reader.getByRole('heading',{name:'Projet Mahjong',exact:true})).toBeVisible();await expect(reader.getByRole('table')).toBeVisible();await expect(reader.locator('strong')).toContainText('lisible');await expect(reader.getByRole('checkbox').first()).toBeChecked();
 assert.equal(await page.evaluate(()=>window.injected),undefined);await expect(reader.locator('img')).toHaveCount(0);await source.fill(md);
 await reader.getByRole('button',{name:'Enregistrer le document',exact:true}).click();await expect(reader).toContainText('Version enregistrée');await expect.poll(()=>page.evaluate(()=>window.knowledgeDirty)).toBe(false);
 await expect(reader.getByRole('heading',{name:'Projet Mahjong',exact:true})).toBeVisible();await reader.getByRole('button',{name:'Référence',exact:true}).click();await expect(reader.getByLabel('Destination du lien')).toHaveValue('https://example.invalid');await reader.getByRole('button',{name:'Fermer le lien',exact:true}).click();
 await reader.getByText('Classement, accès IA et versions',{exact:true}).click();await reader.getByLabel('Accès IA',{exact:true}).selectOption('essential');await reader.getByRole('button',{name:'Enregistrer les réglages',exact:true}).click();await expect(reader).toContainText('Réglages conservés');
 await reader.getByRole('button',{name:'Édition',exact:true}).click();await source.fill(md+'\nVersion deux.');await page.keyboard.press('Control+s');await expect(reader).toContainText('Version enregistrée');
 await reader.getByRole('button',{name:/Restaurer la version 1/}).click();await expect(reader.getByRole('article',{name:'Lecture Markdown'})).not.toContainText('Version deux.');
 await reader.getByRole('button',{name:'Vue partagée',exact:true}).click();await expect(source).toHaveValue(md);
 await reader.getByText('Classement, accès IA et versions',{exact:true}).click();
 await page.locator('#knowledge-editor-host').evaluate(el=>{el.scrollTop=0;});
 await page.screenshot({path:'out/knowledge-markdown-alpha.png'});
 await source.fill(md+'\nBrouillon conservé.');await page.evaluate(()=>{window.confirm=()=>false;});await reader.getByRole('button',{name:'Revenir au code',exact:true}).click();await expect(source).toHaveValue(md+'\nBrouillon conservé.');await expect(reader).toBeVisible();
 await page.evaluate(()=>{window.confirm=()=>true;});await reader.getByRole('button',{name:'Abandonner les modifications',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();await page.getByRole('button',{name:'Afficher Connaissances',exact:true}).click();await library.getByRole('button',{name:'Roadmap.md',exact:true}).click();await expect(reader.getByRole('heading',{name:'Projet Mahjong',exact:true})).toBeVisible();
 await reader.getByText('Classement, accès IA et versions',{exact:true}).click();await expect(reader.getByLabel('Accès IA',{exact:true})).toHaveValue('essential');
 const manifest=JSON.parse(await readFile(join(root,'microide.project.json'),'utf8'));assert.equal(manifest.documents[0].knowledge.access,'essential');assert.equal(await readFile(join(root,manifest.documents[0].path),'utf8'),md);
 await page.setViewportSize({width:900,height:800});await expect.poll(()=>reader.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);assert.deepEqual(errors,[]);
 console.log('Knowledge: real store, Markdown, revisions, scope, dirty protection and reopen passed.');
 }catch(error){await page.screenshot({path:'out/knowledge-failure.png'});throw error;}finally{await context.close();await rm(root,{recursive:true,force:true});}
}

export async function verifyKnowledgeDesktop(page,desktop,parent) {
 const root=join(parent,'knowledge-project');const {mkdir}=await import('node:fs/promises');await mkdir(root);await ProjectStore.create(root,'Documentation native');
 await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});dialog.showMessageBox=async()=>({response:0});},root);
 await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();await expect(page.getByRole('button',{name:'Ouvrir',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Afficher Connaissances',exact:true}).click();const library=page.getByRole('region',{name:'Documents du projet',exact:true});
 await library.getByText('Créer un document Markdown',{exact:true}).click();await library.getByRole('button',{name:'Contexte du projet',exact:true}).click();const reader=page.getByRole('region',{name:'Document ouvert',exact:true});
 await reader.getByLabel('Texte du document',{exact:true}).fill('# Contexte natif\n\n**CPC 6128** : vérifier avant de conclure.');
 await page.getByRole('button',{name:/^Enregistrer Ctrl/}).click();await expect(reader.getByRole('heading',{name:'Contexte natif',exact:true})).toBeVisible();await expect(reader).toContainText('Version enregistrée');
 const manifest=JSON.parse(await readFile(join(root,'microide.project.json'),'utf8'));assert.equal(manifest.documents.length,1);assert.match(await readFile(join(root,manifest.documents[0].path),'utf8'),/Contexte natif/);
 const forbidden=await page.evaluate(()=>window.desktop.knowledge.write('stale-session',{action:'create',title:'x',source:'x',category:'design'}));assert.match(forbidden.error,/périmée/);
}
