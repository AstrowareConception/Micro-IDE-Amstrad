import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SymbolsWorker from './symbols-worker.ts?worker';
import { Button } from './Icon.tsx';
import { SYMBOL_LIMITS, SYMBOL_ROLE_LABELS, symbolTypeLabel, symbolsMarkdown, type SymbolSource, type SymbolReport, type SymbolLocation, type SymbolRole } from '../../../packages/basic-language/src/symbols.ts';
interface Props { documents: SymbolSource[]; activeId: string; scopeId: string; onReveal(id: string, occurrence: SymbolLocation): void }
interface Snapshot { report: SymbolReport; documents: SymbolSource[]; scopeId: string; createdAt: string }
export const SymbolsPanel = memo(function SymbolsPanel({documents,activeId,scopeId,onReveal}:Props) {
 const [scope,setScope]=useState('active'), [snapshot,setSnapshot]=useState<Snapshot>(), [running,setRunning]=useState(false), [error,setError]=useState(''), [query,setQuery]=useState(''), [selection,setSelection]=useState(''), [role,setRole]=useState('all');
 const sequence=useRef(0), job=useRef<{worker:Worker;timeout:ReturnType<typeof setTimeout>;id:number} | undefined>(undefined);
 const stop=useCallback(()=>{const current=job.current;job.current=undefined;if(current){clearTimeout(current.timeout);current.worker.onmessage=null;current.worker.onerror=null;current.worker.terminate();}},[]);
 useEffect(()=>{stop();setRunning(false);setSnapshot(undefined);setError('');setSelection('');return stop;},[scopeId,stop]);
 const current=useMemo(()=>new Map(documents.map(doc=>[doc.id,doc])),[documents]);
 const stale=!!snapshot && (snapshot.scopeId!==scopeId || snapshot.documents.some(doc=>current.get(doc.id)?.source!==doc.source || current.get(doc.id)?.name!==doc.name));
 const matches=useMemo(()=>{
  const needle=query.trim().toUpperCase();
  return snapshot?.report.sources.flatMap(source=>source.symbols.map(symbol=>({source,symbol,key:JSON.stringify([source.id,symbol.key])}))).filter(item=>`${item.source.name} ${item.symbol.name}`.toUpperCase().includes(needle)) ?? [];
 },[snapshot,query]);
 const declarations=useMemo(()=>snapshot?.report.sources.flatMap(source=>source.typeDeclarations.map(declaration=>({source,declaration}))) ?? [],[snapshot]);
 const selected=matches.find(item=>item.key===selection) ?? matches[0];
 const occurrences=selected?.symbol.occurrences.filter(item=>role==='all'||item.role===role) ?? [];
 function run() {
  stop();setSnapshot(undefined);setError('');setSelection('');
  const sources=documents.filter(doc=>scope==='loaded'||doc.id===activeId).map(({id,name,source})=>({id,name,source}));
  if(!sources.length || sources.length>SYMBOL_LIMITS.sources || sources.reduce((n,s)=>n+s.source.length,0)>SYMBOL_LIMITS.totalCharacters){setRunning(false);setError('Choisissez entre 1 et 100 sources, avec au plus 4 Mio de caractères.');return;}
  const id=++sequence.current, createdAt=new Date().toISOString();setRunning(true);
  const fail=(message:string)=>{if(job.current?.id!==id)return;stop();setRunning(false);setError(message);};
  try {
   const worker=new SymbolsWorker(), timeout=setTimeout(()=>fail('Indexation interrompue après 15 secondes. Réessayez sur la source active.'),15000);job.current={worker,timeout,id};
   worker.onmessage=(event:MessageEvent<{id:number;report?:SymbolReport;error?:string}>)=>{
    if(job.current?.id!==id||event.data.id!==id)return;
    if(event.data.error||!event.data.report){fail(event.data.error??'Index indisponible.');return;}
    stop();setRunning(false);setSnapshot({report:event.data.report,documents:sources,scopeId,createdAt});
   };
   worker.onerror=event=>{event.preventDefault();fail('Indexation indisponible. Réessayez.');};worker.postMessage({id,sources});
  } catch {stop();setRunning(false);setError('Impossible de démarrer l’indexation. Réessayez.');}
 }
 function reveal(id:string,occurrence:SymbolLocation){
  const before=snapshot?.documents.find(doc=>doc.id===id),now=current.get(id);
  if(!before||!now||snapshot?.scopeId!==scopeId||before.source!==now.source||before.name!==now.name){setError('Source modifiée : actualisez l’index pour naviguer.');return;}
  onReveal(id,occurrence);
 }
 function download(format:'json'|'md'){
  if(!snapshot)return;
  const contents=format==='json'?JSON.stringify({createdAt:snapshot.createdAt,stale,report:snapshot.report},null,2):`État : ${stale?'obsolète':'sources inchangées'}. Généré le ${snapshot.createdAt}.\n\n${symbolsMarkdown(snapshot.report)}`;
  const url=URL.createObjectURL(new Blob([contents],{type:format==='json'?'application/json':'text/markdown;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download=`cpceleste-symboles.${format}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="symbols-panel" aria-label="Symboles et usages BASIC" aria-busy={running}>
  <h2>Symboles et usages BASIC</h2><p className="muted">Retrouvez les variables, tableaux et leurs occurrences dans vos buffers. Index local à la demande, sans analyse supplémentaire pendant la frappe.</p>
  <div className="quality-actions"><label>Périmètre de l’index<select aria-label="Périmètre de l’index" value={scope} disabled={running} onChange={e=>setScope(e.target.value)}><option value="active">Source active</option><option value="loaded">Sources chargées ({documents.length})</option></select></label><Button disabled={running} onClick={run}>Actualiser l’index</Button>{running&&<Button onClick={()=>{stop();setRunning(false);setError('Indexation annulée.');}}>Annuler l’indexation</Button>}<Button disabled={!snapshot} onClick={()=>download('md')}>Exporter Markdown</Button><Button disabled={!snapshot} onClick={()=>download('json')}>Exporter JSON</Button></div>
  {running&&<p role="status">Indexation en cours…</p>}{error&&<p role="alert">{error}</p>}
  {!snapshot&&!running&&!error&&<p>Choisissez le périmètre puis actualisez l’index.</p>}
  {snapshot&&<><p role="status" className={stale?'warning':'muted'}>{stale?'Index obsolète : des sources ont changé. Actualisez pour naviguer.':'Index sur les sources inchangées.'}</p>
   <details><summary>Périmètre, types et limites</summary><p>{snapshot.report.method}</p></details>
   <p className="muted">Les exports incluent les noms des variables et des sources. Aucun rapprochement entre programmes ni renommage automatique.</p>
   {snapshot.report.sources.map(source=><details key={source.id} className={source.status==='indexed'?'muted':'warning'}><summary>{source.name} · {source.symbols.length} symbole(s) · {source.status==='indexed'?'segments couverts':source.status==='limited'?'budget atteint — index retiré':'index partiel'}</summary><p>{source.skippedStatements} segment(s) omis.</p><ul>{source.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>{source.omittedReasons>0&&<p>{source.omittedReasons} autres limites omises.</p>}</details>)}
   {declarations.length>0&&<details className="symbol-type-declarations"><summary>Déclarations de type</summary><p className="muted">Plages alphabétiques relevées, sans présumer leur exécution. La navigation sélectionne la déclaration entière.</p><ul>{declarations.slice(0,200).map(({source,declaration})=><li key={`${source.id}:${declaration.location.line}:${declaration.location.start}`}><Button disabled={stale} onClick={()=>reveal(source.id,declaration.location)}>{source.name} · {declaration.command} · {declaration.letters} · BASIC {declaration.location.basicLine}</Button></li>)}</ul>{declarations.length>200&&<p>200 déclarations affichées sur {declarations.length}. Choisissez la source active ou consultez l’export.</p>}</details>}
   <div className="symbols-columns"><div><label>Rechercher un symbole<input aria-label="Rechercher un symbole" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom de variable ou de source"/></label><p>{matches.length} symbole(s) trouvé(s).</p>
    <ul className="symbols-list">{matches.slice(0,200).map(item=><li key={item.key}><Button aria-pressed={selected?.key===item.key} onClick={()=>setSelection(item.key)}><strong>{item.symbol.name}{item.symbol.kind==='array'?'(…)':''}</strong><span>{item.symbol.kind==='array'?'Tableau':'Scalaire'} · {item.symbol.occurrences.length} occurrence(s)</span><small>{item.source.name} · {symbolTypeLabel(item.symbol.type)}</small></Button></li>)}</ul>{matches.length>200&&<p>200 symboles affichés. Affinez la recherche ou consultez l’export.</p>}
   </div><div>{selected?<><h3>{selected.symbol.name}{selected.symbol.kind==='array'?'(…)':''} · usages</h3><p>{selected.source.name}</p><p className="symbol-type">{symbolTypeLabel(selected.symbol.type)}</p>{selected.symbol.type.basis==='declarations'&&<p className="muted">Le réel initial reste possible. Les déclarations peuvent être conditionnelles, sautées ou exécutées après un retour : leur ordre dans le listing ne fixe pas le type à cet usage.</p>}{selected.symbol.type.basis==='unknown'&&<p className="muted">Des segments omis ou des accès machine empêchent de borner le type implicite. Les suffixes explicites restent lisibles.</p>}<label>Filtrer les usages<select aria-label="Filtrer les usages" value={role} onChange={e=>setRole(e.target.value)}><option value="all">Tous les usages</option>{(Object.keys(SYMBOL_ROLE_LABELS) as SymbolRole[]).map(key=><option key={key} value={key}>{SYMBOL_ROLE_LABELS[key]}</option>)}</select></label><p>{occurrences.length} occurrence(s) dans ce filtre.</p>
    <ol className="symbol-occurrences">{occurrences.slice(0,200).map(item=><li key={`${item.line}:${item.start}`}><Button disabled={stale} onClick={()=>reveal(selected.source.id,item)}>{SYMBOL_ROLE_LABELS[item.role]} · BASIC {item.basicLine} · L{item.line} · C{item.start+1}</Button></li>)}</ol>{occurrences.length>200&&<p>200 occurrences affichées. L’export contient toutes les occurrences conservées.</p>}
   </>:<p>Aucun symbole dans ce filtre. Cela ne prouve pas l’absence de variables dans les segments omis.</p>}</div></div>
  </>}
 </section>;
});
