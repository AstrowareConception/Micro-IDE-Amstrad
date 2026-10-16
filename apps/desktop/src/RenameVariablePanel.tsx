import { useEffect, useRef, useState } from 'react';
import { Button } from './Icon.tsx';
import RenameWorker from './rename-worker.ts?worker';
import type { RenameTarget, VariableRenamePlan } from '../../../packages/basic-language/src/rename-variable.ts';
export interface VariableRenameRequest { nonce:string; documentId:string; documentName:string; scopeId:string; source:string; line:number; column:number; version:number; modelUri:string }
interface Props { request:VariableRenameRequest; stale:boolean; busy:boolean; onApply(plan:VariableRenamePlan):void; onClose():void }
export function RenameVariablePanel({request,stale,busy,onApply,onClose}:Props){
 const [target,setTarget]=useState<RenameTarget>(),[newStem,setNewStem]=useState(''),[plan,setPlan]=useState<VariableRenamePlan>(),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 const panel=useRef<HTMLElement>(null),input=useRef<HTMLInputElement>(null),sequence=useRef(0),job=useRef<{id:number;worker:Worker;timer:ReturnType<typeof setTimeout>}|undefined>(undefined);
 function stop(){const current=job.current;job.current=undefined;if(current){clearTimeout(current.timer);current.worker.onmessage=null;current.worker.onerror=null;current.worker.terminate();}}
 function run(preview=false){
  stop();setPlan(undefined);setMessage('');if(stale||busy)return;
  const id=++sequence.current;setPending(true);
  const fail=(text:string)=>{if(job.current?.id!==id)return;stop();setPending(false);setMessage(text);};
  try{const worker=new RenameWorker(),timer=setTimeout(()=>fail('Calcul interrompu après 15 secondes. Fermez puis relancez F2.'),15000);job.current={id,worker,timer};
   worker.onmessage=(event:MessageEvent<{id:number;target?:RenameTarget;plan?:VariableRenamePlan;error?:string}>)=>{
    if(job.current?.id!==id||event.data.id!==id)return;
    if(event.data.error){fail(event.data.error);return;}stop();setPending(false);
    if(event.data.target){setTarget(event.data.target);setNewStem(event.data.target.stem);requestAnimationFrame(()=>{input.current?.focus();input.current?.select();});}
    else if(event.data.plan){setPlan(event.data.plan);setMessage(`${event.data.plan.edits.length} substitution(s) préparée(s). Vérifiez l’aperçu.`);}
    else setMessage('Réponse de renommage indisponible.');
   };
   worker.onerror=event=>{event.preventDefault();fail('Analyse indisponible. Fermez puis relancez F2.');};
   worker.postMessage({id,source:request.source,position:{line:request.line,column:request.column},...(preview?{newStem}:{} )});
  }catch{stop();setPending(false);setMessage('Impossible de démarrer le calcul de renommage.');}
 }
 useEffect(()=>{panel.current?.focus();run();return stop;},[]);
 useEffect(()=>{if(stale){stop();setPending(false);}},[stale]);
 return <section ref={panel} tabIndex={-1} className="panel rename-variable-panel" aria-label="Renommer un symbole BASIC" aria-busy={pending} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}}}>
  <header><h2>Renommer un symbole</h2><Button onClick={onClose} aria-label="Fermer le renommage">Fermer</Button></header>
  <p>{request.documentName} · L{request.line} · C{request.column+1}</p>
  <p className="muted">Fichier autonome : variables simples ou FN à définitions initiales, sans types dynamiques ni accès machine/externe. Seul ce buffer sera modifié. Annulation avec Ctrl+Z.</p>
  {stale&&<p role="alert">Aperçu périmé : document ou révision modifié. Fermez puis relancez F2 depuis le code.</p>}
  {target&&<><p><strong>{target.name}</strong> · {{array:'tableau',scalar:'scalaire',function:'fonction FN',parameter:'paramètre FN'}[target.kind]} · {target.occurrences} occurrence(s) · suffixe conservé : {target.suffix||'aucun (réel par défaut)'}</p>
   {target.scope&&<p className="rename-scope">{target.scope} · Préfixe FN et suffixe de type conservés.</p>}
   <form onSubmit={event=>{event.preventDefault();run(true);}}><label>Nouveau nom sans suffixe<input ref={input} autoComplete="off" spellCheck={false} maxLength={40} value={newStem} disabled={stale||busy} onChange={event=>{stop();setPending(false);setNewStem(event.target.value);setPlan(undefined);setMessage('');}}/></label>
   <Button type="submit" disabled={stale||busy||pending||!newStem}>Prévisualiser le renommage</Button></form></>}
  {pending&&<p role="status">{target?'Préparation de l’aperçu…':'Analyse du symbole…'} <Button onClick={()=>{stop();setPending(false);setMessage('Calcul annulé.');}}>Annuler le calcul</Button></p>}
  {!target&&!pending&&!stale&&<Button disabled={busy} onClick={()=>run()}>Réessayer l’analyse</Button>}
  <p role="status">{message}</p>
  {plan&&<><h3>{plan.target.name} → {plan.newName}</h3><ul>{plan.warnings.map(w=><li key={w}>{w}</li>)}</ul>
   <div className="rename-edits"><table><caption>{plan.edits.length} substitution(s) · 100 premières positions affichées</caption><thead><tr><th>BASIC</th><th>Position</th><th>Avant</th><th>Après</th></tr></thead><tbody>{plan.edits.slice(0,100).map(edit=><tr key={`${edit.line}:${edit.start}`}><td>{edit.basicLine}</td><td>L{edit.line} · C{edit.start+1}</td><td>{edit.before}</td><td>{edit.after}</td></tr>)}</tbody></table></div>
   <div className="rename-comparison"><label>Avant<textarea readOnly value={plan.before} rows={8}/></label><label>Après<textarea readOnly value={plan.after} rows={8}/></label></div>
   <Button disabled={stale||busy||pending} onClick={()=>{try{onApply(plan);onClose();}catch(error){setMessage(error instanceof Error?error.message:'Application impossible.');setPlan(undefined);}}}>Appliquer au buffer</Button>
  </>}
 </section>;
}
