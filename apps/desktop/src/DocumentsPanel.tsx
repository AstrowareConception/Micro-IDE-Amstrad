import { Button } from './Icon.tsx';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DocumentSnapshot, ProjectManifest } from '../../../packages/workspace/src/project.ts';
import { KNOWLEDGE_CATEGORIES, type KnowledgeAccess, type KnowledgeCategory, type KnowledgeRequest } from '../../../packages/workspace/src/knowledge.ts';
import { MarkdownView } from './MarkdownView.tsx';
import { files } from './port.ts';

interface Props { sessionId: string; manifest: ProjectManifest; busy: boolean; requested?: { id: string; nonce: string } | undefined; onBusy(value: boolean): void; onManifest(manifest: ProjectManifest): void; onDirty?(value: boolean): void; onView?(value: boolean): void; onReference?(): void; onAskAgent?(instruction:string):void; onSaveReady?(save: (()=>Promise<boolean>) | undefined): void }
const templates = {
  blank: { title: 'Nouvelle note', text: '# Nouvelle note\n\n' },
  brief: { title: 'Contexte du projet', text: '# Contexte du projet\n\n## Objectif\nÀ préciser.\n\n## Contraintes CPC\n- CPC 6128, Locomotive BASIC 1.1\n\n## Décisions validées\n\n## Hypothèses à vérifier\n' },
  roadmap: { title: 'Roadmap', text: '# Roadmap\n\n## Prochaines étapes\n- [ ] Définir le résultat attendu\n- [ ] Réaliser une première version\n- [ ] Vérifier dans le CPC\n\n## Critères de réussite\n\n## Terminé et vérifié\n' },
  journal: { title: 'Journal de développement', text: '# Journal de développement\n\n## Évolution\n\n### Changements\n\n### Vérifications exécutées\n\n### Limites et prochaine étape\n' },
};
export function DocumentsPanel(props: Props) {
  const [preview,setPreview] = useState<DocumentSnapshot>(), [draft,setDraft] = useState(''), [saved,setSaved] = useState('');
  const [notice,setNotice] = useState(''), [query,setQuery] = useState(''), [categoryFilter,setCategoryFilter] = useState('all');
  const [category,setCategory] = useState<KnowledgeCategory>('design'), [access,setAccess] = useState<KnowledgeAccess>('excluded');
  const [title,setTitle] = useState(''), [creating,setCreating] = useState(false), [visible,setVisible] = useState(false);
  const [mode,setMode] = useState<'read'|'edit'|'split'>('read'), [page,setPage] = useState(0), [offset,setOffset] = useState(0), [link,setLink] = useState('');
  const rendered = useDeferredValue(draft);
  const dirty = creating || draft !== saved;
  const port = files.project, writer = files.knowledge;
  useEffect(()=>{ props.onDirty?.(dirty); },[dirty]);
  useEffect(()=>{ props.onView?.(visible); },[visible]);
  useEffect(()=>()=>{ props.onDirty?.(false); props.onView?.(false); },[]);
  function leave() { return !dirty || window.confirm('Abandonner le brouillon documentaire non enregistré ?'); }
  function adopt(document: DocumentSnapshot) {
    setPreview(document); const text = 'text' in document ? document.text : '';
    setDraft(text);setSaved(text);setCreating(false);setTitle(document.originalName);setPage(0);setOffset(0);setMode('read');setVisible(true);props.onView?.(true);setLink('');
    setCategory(document.knowledge?.category ?? 'resource');setAccess(document.knowledge?.access ?? 'excluded');
  }
  async function read(id: string) {
    if (!port || props.busy || !leave()) return; props.onBusy(true);
    try { const result = await port.readDocument(props.sessionId,id); if ('error' in result) setNotice(result.error); else { adopt(result);setNotice(result.knowledge?.editable ? 'Note du projet · version vérifiée.' : 'Référence importée · original conservé.'); } }
    catch { setNotice('Lecture impossible ; le brouillon reste disponible.'); } finally { props.onBusy(false); }
  }
  async function importDocument(kind:'text'|'image'|'pdf'='text') {
    if (!port || props.busy || !leave()) return;props.onBusy(true);
    try { const result = await port.importDocument(props.sessionId,kind);if(!result)setNotice('Import annulé.');else if('error' in result)setNotice(result.error);else {props.onManifest(result);setNotice('Original copié et vérifié. Les buffers BASIC sont conservés.');} }
    catch { setNotice('Import impossible.'); }finally{props.onBusy(false);}
  }
  async function write(request:KnowledgeRequest): Promise<boolean> {
    if(!writer || props.busy)return false;props.onBusy(true);
    try { const result = await writer.write(props.sessionId,request);if('error' in result){setNotice(result.error);return false;}else{props.onManifest(result.manifest);adopt(result.document);setNotice(request.action==='configure'?'Réglages conservés pour les prochaines missions.':'Version enregistrée. Les versions précédentes restent restaurables.');return true;} }
    catch{setNotice('Enregistrement non confirmé ; brouillon conservé.');return false;}finally{props.onBusy(false);}
  }
  async function saveCurrent() {
    if (!dirty) return true;
    if (!editable || props.busy || !title.trim()) return false;
    return write(creating?{action:'create',title,source:draft,category}:{action:'save',id:preview!.id,revision:preview!.revision!,source:draft});
  }
  useEffect(()=>{props.onSaveReady?.(saveCurrent);return()=>props.onSaveReady?.(undefined);});
  function create(template:keyof typeof templates, copy=false) {
    if(props.busy || !leave())return;
    const item=templates[template], text=copy?draft:item.text;
    setTitle(copy?`Copie de ${preview?.originalName ?? 'note'}`:item.title);setDraft(text);setSaved('');setCreating(true);setPreview(undefined);setVisible(true);props.onView?.(true);setMode('split');setCategory(template==='roadmap'||template==='journal'?'progress':'design');setAccess('available');setNotice('Nouveau document : il sera consultable par l’agent après enregistrement.');
  }
  useEffect(()=>{if(props.requested && props.manifest.documents.some(d=>d.id===props.requested!.id))void read(props.requested.id);},[props.requested]);
  const currentPath=preview ? props.manifest.documents.find(d=>d.id===preview.id)?.path : undefined;
  useEffect(()=>{
    if(!preview || creating || dirty || props.busy || currentPath===preview.path) return;
    if(!currentPath){setPreview(undefined);setVisible(false);setNotice('Note retirée du corpus par restauration du checkpoint. Les versions restent conservées sur disque.');return;}
    let cancelled=false;
    void port?.readDocument(props.sessionId,preview.id).then(result=>{
      if(cancelled)return;
      if('error' in result){setNotice(result.error);return;}
      setPreview(result);const text='text' in result?result.text:'';setDraft(text);setSaved(text);setNotice('Version du projet actualisée après la mission.');
    }).catch(()=>{if(!cancelled)setNotice('Actualisation impossible ; rouvrez le document.');});
    return()=>{cancelled=true;};
  },[currentPath,preview?.path,creating,dirty,props.busy]);
  const matches=useMemo(()=>props.manifest.documents.filter(d=>(categoryFilter==='all'||(d.knowledge?.category??'resource')===categoryFilter)&&`${d.originalName} ${d.role}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))),[props.manifest.documents,query,categoryFilter]);
  const pdf=preview && 'pages' in preview?preview:undefined;
  const text=pdf?.pages[page]?.text ?? draft;
  const markdown=creating || preview?.mediaType==='text/markdown';
  const editable=creating || !!preview?.knowledge?.editable;
  const lines=text.split('\n');
  function navigate(href:string) {
    if(href.startsWith('#')) { let name='';try{name=decodeURIComponent(href.slice(1)).toLocaleLowerCase();}catch{return;}const headings=document.querySelectorAll('.markdown-reading h1,.markdown-reading h2,.markdown-reading h3,.markdown-reading h4,.markdown-reading h5,.markdown-reading h6');const target=Array.from(headings).find(h=>(h.textContent??'').toLocaleLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s+/g,'-')===name);const anchor=document.getElementById(href.slice(1));if(anchor?.closest('.markdown-reading')){anchor.scrollIntoView({block:'start'});return;}if(target){target.scrollIntoView({block:'start'});return;} }
    let path='';try{path=decodeURIComponent(href.split('#')[0]??'').replace(/^\.\//,'');}catch{}
    const item=props.manifest.documents.find(d=>d.path===path || d.originalName===path);
    if(item){void read(item.id);return;}
    setLink(href || 'Lien non pris en charge.');
  }
  const host=document.getElementById('knowledge-editor-host');
  const reader=visible && <section className="knowledge-reader" aria-label="Document ouvert" onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();event.stopPropagation();if(editable && !props.busy)void write(creating?{action:'create',title,source:draft,category}:{action:'save',id:preview!.id,revision:preview!.revision!,source:draft});}}}>
    <header className="knowledge-heading"><div><small>CONNAISSANCES · {creating?'NOUVEAU DOCUMENT':editable?'NOTE DU PROJET':'RÉFÉRENCE'}</small><h2>{title}{dirty?' • modifié':''}</h2></div><Button icon="close" disabled={props.busy} onClick={()=>{if(leave()){setDraft(saved);setCreating(false);setVisible(false);}}}>Revenir au code</Button></header>
    <div className="knowledge-toolbar">{markdown && <nav aria-label="Affichage Markdown">{(['read','edit','split'] as const).map(value=><Button key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{value==='read'?'Lecture':value==='edit'?'Édition':'Vue partagée'}</Button>)}</nav>}
      {editable && <Button icon="save" className="primary" disabled={props.busy || !writer || !dirty || !title.trim()} onClick={()=>void write(creating?{action:'create',title,source:draft,category}:{action:'save',id:preview!.id,revision:preview!.revision!,source:draft})}>Enregistrer le document</Button>}
      {!editable && preview && 'text' in preview && <Button icon="file" disabled={props.busy || !writer || draft.length>65536} onClick={()=>create('blank',true)}>Créer une copie modifiable</Button>}
      {dirty && !creating && <Button disabled={props.busy} onClick={()=>{if(leave())setDraft(saved);}}>Abandonner les modifications</Button>}
    </div>
    <p className="knowledge-notice" role="status">{notice}</p>
    {creating && <label>Titre du document<input aria-label="Titre du document" maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} /></label>}
    <details className="knowledge-settings"><summary>Classement, accès IA et versions</summary>
      {preview && !preview.knowledge && <p className="muted">Accès actuel : autorisation par mission. Les choix ci-dessous prennent effet après « Enregistrer les réglages ».</p>}
      <label>Catégorie<select aria-label="Catégorie" value={category} disabled={props.busy} onChange={e=>setCategory(e.target.value as KnowledgeCategory)}>{Object.entries(KNOWLEDGE_CATEGORIES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      {!creating && <><label>Accès IA<select aria-label="Accès IA" value={access} disabled={props.busy} onChange={e=>setAccess(e.target.value as KnowledgeAccess)}><option value="excluded">Exclu de l’IA</option><option value="available">Accessible à chaque mission</option>{preview && 'text' in preview && <option value="essential">Essentiel · extrait au démarrage</option>}</select></label><Button disabled={props.busy || dirty || !writer || !preview?.revision} onClick={()=>void write({action:'configure',id:preview!.id,revision:preview!.revision!,category,access})}>Enregistrer les réglages</Button></>}
      <p className="muted">Les contenus accessibles peuvent être transmis à OpenAI. Essentiel : jusqu’à 4 000 caractères par document, 12 000 au total ; le reste est consultable. Les réglages prennent effet à la prochaine mission. Une note éditable accessible peut aussi être révisée par l’agent ; une référence importée reste en lecture seule.</p>
      {preview?.knowledge?.versions.map((version,index)=><Button key={version.path} disabled={props.busy || dirty} onClick={()=>void write({action:'restore',id:preview.id,revision:preview.revision!,path:version.path})}>Restaurer la version {index+1} · {new Date(version.savedAt).toLocaleString('fr-FR')}</Button>)}
      {preview && <p className="muted">{preview.path} · {preview.bytes} octets<br/>SHA-256 : {preview.sha256}</p>}
    </details>
    {link && <div className="knowledge-link"><p>Destination du lien (à copier dans votre navigateur si externe) :</p><input aria-label="Destination du lien" readOnly value={link}/><Button onClick={()=>setLink('')}>Fermer le lien</Button></div>}
    {preview && 'dataUrl' in preview ? <><img className="image-preview" src={preview.dataUrl} alt={`Aperçu de ${preview.originalName}`}/><p>{preview.width} × {preview.height} pixels · aperçu {preview.previewWidth} × {preview.previewHeight}, sans métadonnées.</p></> : <>
      {pdf && <div className="knowledge-toolbar"><p>Page {page+1} sur {pdf.pageCount} · PDF texte, sans OCR.</p><Button disabled={page===0} onClick={()=>{setPage(p=>p-1);setOffset(0);}}>Page précédente</Button><Button disabled={page+1>=pdf.pageCount} onClick={()=>{setPage(p=>p+1);setOffset(0);}}>Page suivante</Button></div>}
      {markdown ? <div className={`knowledge-content ${mode==='split'?'split':''}`}>
        {mode!=='read' && <div className="knowledge-source"><label htmlFor="knowledge-markdown">{editable?'Source Markdown':'Source Markdown · lecture seule'}</label><textarea id="knowledge-markdown" aria-label="Texte du document" readOnly={!editable} disabled={props.busy} value={draft} maxLength={65536} spellCheck={false} onChange={e=>setDraft(e.target.value)}/><p className="muted"># titre · **gras** · [lien](document.md) · listes - [ ] · tableaux · blocs de code ```</p></div>}
        {mode!=='edit' && (draft.length<=65536?<MarkdownView source={rendered} onLink={navigate}/>:<p>Ce document dépasse 64 K caractères. Utilisez Édition pour consulter sa source ; le rendu est limité pour préserver la réactivité.</p>)}
      </div> : <div className="knowledge-plain"><p>Lignes {offset+1}–{Math.min(offset+200,lines.length)} sur {lines.length}</p><textarea aria-label="Texte du document" readOnly rows={20} value={lines.slice(offset,offset+200).join('\n')}/><Button disabled={offset===0} onClick={()=>setOffset(v=>Math.max(0,v-200))}>Lignes précédentes</Button><Button disabled={offset+200>=lines.length} onClick={()=>setOffset(v=>v+200)}>Lignes suivantes</Button></div>}
    </>}
  </section>;
  return <section className="panel documents-panel" aria-label="Documents du projet"><h2>Connaissances</h2><p className="muted">La mémoire de votre projet · {props.manifest.documents.length}/10 documents · hors DSK.</p>
    <label htmlFor="knowledge-search">Rechercher un document</label><input id="knowledge-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Titre du document…"/>
    <label htmlFor="knowledge-category">Filtrer les connaissances</label><select id="knowledge-category" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="all">Toutes les catégories</option>{Object.entries(KNOWLEDGE_CATEGORIES).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select>
    <details className="knowledge-create"><summary>Créer un document Markdown</summary>{Object.entries(templates).map(([id,item])=><Button key={id} icon="file" disabled={props.busy || !writer || props.manifest.documents.length>=10} onClick={()=>create(id as keyof typeof templates)}>{item.title}</Button>)}</details>
    <details><summary>Importer des références</summary><Button disabled={props.busy || !port || props.manifest.documents.length>=10} onClick={()=>void importDocument()}>Importer TXT / Markdown</Button><Button disabled={props.busy || !port || props.manifest.documents.length>=10} onClick={()=>void importDocument('image')}>Importer image PNG / JPEG</Button><Button disabled={props.busy || !port || props.manifest.documents.length>=10} onClick={()=>void importDocument('pdf')}>Importer PDF</Button><p className="muted">Copies conservées · 1 Mio par fichier, 4 Mio au total. PDF texte jusqu’à 20 pages.</p></details>
    {props.onAskAgent && <Button icon="file" disabled={props.busy || dirty} onClick={()=>props.onAskAgent?.('Documente ce projet dans Connaissances. Consulte les sources ou zones enregistrées et les documents autorisés. Crée ou complète une note de contexte et une roadmap Markdown, en préservant les décisions humaines. Distingue faits vérifiés, hypothèses et essais à faire ; ne coche aucun test non exécuté. Ne modifie pas le code. Utilise les outils documentaires avec révision, puis effectue la construction structurelle et indique ses limites.')}>Documenter avec l’IA</Button>}
    <nav className="knowledge-tree" aria-label="Pièces jointes">{Object.entries(KNOWLEDGE_CATEGORIES).map(([category,label])=>{const items=matches.filter(d=>(d.knowledge?.category??'resource')===category);return items.length>0 && <div key={category}><h3>{label}</h3>{items.map(item=><Button key={item.id} aria-label={item.originalName} icon="file" disabled={props.busy} aria-current={visible&&preview?.id===item.id?'page':undefined} onClick={()=>void read(item.id)}><span>{item.originalName}<small>{item.knowledge?.editable?'Modifiable':'Référence'} · {item.knowledge?.access==='essential'?'Essentiel':item.knowledge?.access==='available'?'IA accessible':item.knowledge?.access==='excluded'?'IA exclu':'Accès par mission'}</small></span></Button>)}</div>})}{!matches.length && <p className="muted">Aucun document. Créez une note ou importez une référence.</p>}</nav>
    {props.onReference && <Button icon="book" onClick={props.onReference}>Références BASIC intégrées</Button>}
    <p role="status">{notice}</p>{host?createPortal(reader,host):reader}
  </section>;
}
