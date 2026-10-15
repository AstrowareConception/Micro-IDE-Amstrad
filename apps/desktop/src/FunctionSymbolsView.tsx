import { useMemo, useState } from 'react';
import { Button } from './Icon.tsx';
import type { SymbolIndex, SymbolLocation } from '../../../packages/basic-language/src/symbols.ts';
import { FN_METHOD, FN_BINDING_LABELS, FN_CALL_LABELS } from '../../../packages/basic-language/src/function-symbols.ts';
interface Props { sources: SymbolIndex[]; stale: boolean; onReveal(id:string,location:SymbolLocation):void }
export function FunctionSymbolsView({sources,stale,onReveal}:Props){
 const [query,setQuery]=useState(''),[selection,setSelection]=useState('');
 const definitions=useMemo(()=>sources.flatMap(source=>source.functions.definitions.map(definition=>({source,definition,key:JSON.stringify([source.id,definition.key])}))),[sources]);
 const byKey=useMemo(()=>new Map(definitions.map(item=>[item.key,item])),[definitions]);
 const needle=query.trim().toUpperCase();
 const matches=definitions.filter(({source,definition:d})=>`${source.name} ${d.name} ${d.parameters.map(p=>p.name).join(' ')} ${d.reads.map(r=>r.name).join(' ')}`.toUpperCase().includes(needle));
 const selected=matches.find(d=>d.key===selection)??matches[0];
 const calls=sources.flatMap(source=>source.functions.calls.map(call=>({source,call}))).filter(({source,call})=>`${source.name} ${call.name}`.toUpperCase().includes(needle));
 const reveal=(id:string,location:SymbolLocation)=>onReveal(id,location);
 return <section className="fn-symbols" aria-label="Fonctions FN et portées">
  <p className="muted">{FN_METHOD}</p>
  <label>Rechercher une fonction ou un paramètre<input aria-label="Rechercher une fonction ou un paramètre" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom FN, paramètre ou source"/></label>
  <div className="symbols-columns"><div><h3>Déclarations FN ({matches.length})</h3>
   <ul className="symbols-list">{matches.slice(0,200).map(item=><li key={item.key}><Button aria-pressed={selected?.key===item.key} onClick={()=>setSelection(item.key)}><strong>FN {item.definition.name}</strong><span>{item.definition.parameters.length} paramètre(s) · BASIC {item.definition.location.basicLine}</span><small>{item.source.name}</small></Button></li>)}</ul>
   {matches.length>200&&<p>200 déclarations affichées. Affinez la recherche ou consultez l’export.</p>}
   {!matches.length&&<p>Aucune déclaration couverte dans ce filtre. Consultez les limites de chaque source.</p>}
  </div><div>{selected&&<>
   <h3>FN {selected.definition.name} · paramètres et lectures</h3>
   <Button disabled={stale} onClick={()=>reveal(selected.source.id,selected.definition.location)}>Déclaration · {selected.source.name} · BASIC {selected.definition.location.basicLine}</Button>
   <h4>Paramètres propres à cette déclaration</h4>
   {!selected.definition.parameters.length&&<p>Aucun paramètre.</p>}
   <ul className="symbol-occurrences">{selected.definition.parameters.map(p=><li key={p.key}><Button disabled={stale} onClick={()=>reveal(selected.source.id,p.location)}>Paramètre {p.name} · BASIC {p.location.basicLine} · C{p.location.start+1}</Button></li>)}</ul>
   <h4>Lectures dans le corps ({selected.definition.reads.length})</h4>
   <ul className="symbol-occurrences">{selected.definition.reads.slice(0,200).map(r=><li key={`${r.location.line}:${r.location.start}`} className={r.binding==='ambiguous'?'warning':''}><Button disabled={stale} onClick={()=>reveal(selected.source.id,r.location)}>{r.name}{r.kind==='array'?'(…)':''} · {FN_BINDING_LABELS[r.binding]} · BASIC {r.location.basicLine} · C{r.location.start+1}</Button>{r.binding==='ambiguous'&&<small>Suffixes, types implicites ou paramètres homonymes : identité non résolue.</small>}</li>)}</ul>
   {selected.definition.reads.length>200&&<p>200 lectures affichées ; toutes les lectures conservées sont dans l’export.</p>}
  </>}</div></div>
  <h3>Appels FN ({calls.length})</h3><p className="muted">Une déclaration possible peut être sautée, remplacée ou incompatible avec les arguments. Aucun lien ne prouve qu’un appel réussira.</p>
  <ol className="symbol-occurrences fn-calls">{calls.slice(0,200).map(({source,call})=><li key={`${source.id}:${call.location.line}:${call.location.start}`}>
   <Button disabled={stale} onClick={()=>reveal(source.id,call.location)}>Appel FN {call.name} · {source.name} · BASIC {call.location.basicLine} · C{call.location.start+1}</Button>
   <p className={call.resolution==='candidate'?'muted':'warning'}>{call.arity} argument(s) · {FN_CALL_LABELS[call.resolution]}</p>
   <div className="quality-actions">{call.definitionKeys.slice(0,20).map(key=>{const candidate=byKey.get(JSON.stringify([source.id,key]));return candidate&&<Button key={key} disabled={stale} onClick={()=>{setSelection(candidate.key);reveal(source.id,candidate.definition.location);}}>Vers FN {candidate.definition.name} · BASIC {candidate.definition.location.basicLine}</Button>;})}</div>
   {call.definitionKeys.length>20&&<p>20 liens affichés sur {call.definitionKeys.length}. Consultez l’export.</p>}
  </li>)}</ol>{calls.length>200&&<p>200 appels affichés. Affinez la recherche ou consultez l’export.</p>}
 </section>;
}
