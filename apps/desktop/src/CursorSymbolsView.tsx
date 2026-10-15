import { Button } from './Icon.tsx';
import type { SymbolNavigationResult } from '../../../packages/basic-language/src/symbol-navigation.ts';
import type { SymbolLocation } from '../../../packages/basic-language/src/symbols.ts';

export function CursorSymbolsView({result,stale,onReveal}:{result:SymbolNavigationResult;stale:boolean;onReveal(id:string,location:SymbolLocation):void}){
 return <section className="cursor-symbols" aria-label="Résultats au curseur">
  <h3>{result.mode==='usages'?'Usages':'Déclarations / affectations possibles'}{result.name?` · ${result.name}`:''}</h3>
  <p>{result.sourceName} · L{result.line} · C{result.column+1}</p>
  {result.notes.map(note=><p key={note} className="muted">{note}</p>)}
  <p role="status">{result.total} résultat(s) couvert(s){stale?' · Index obsolète':''}.</p>
  {!result.total&&result.status==='found'&&<p>Aucune cible couverte pour cette demande. Cela ne prouve pas l’absence d’usages ou de déclarations dans les formes omises.</p>}
  <ol className="symbol-occurrences">{result.targets.map(target=><li key={`${target.location.line}:${target.location.start}`}>
   <Button disabled={stale} onClick={()=>onReveal(result.sourceId,target.location)}>{target.label} · BASIC {target.location.basicLine} · L{target.location.line} · C{target.location.start+1}</Button>
   {target.possible&&<small>Correspondance possible, à vérifier dans le code.</small>}
  </li>)}</ol>
  {result.total>result.targets.length&&<p>{result.targets.length} résultats affichés sur {result.total}. L’export de l’index contient les occurrences conservées.</p>}
  <p className="muted">Relancez F12 ou Maj+F12 depuis le code pour actualiser cette recherche.</p>
 </section>;
}
