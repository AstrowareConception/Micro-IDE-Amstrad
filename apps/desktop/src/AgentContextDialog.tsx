import {useEffect,useRef,useState} from 'react';
import type {ProjectDocument,ProjectManifest} from '../../../packages/workspace/src/project.ts';
import {files} from './port.ts';
import {Button} from './Icon.tsx';

interface Props {
 sessionId:string|undefined;documents:ProjectDocument[];selected:string[];includeAll:boolean;locked:boolean;
 onSelect(ids:string[]):void;onIncludeAll(value:boolean):void;onManifest(manifest:ProjectManifest):void;
 onBusy(value:boolean):void;onDocument:((id:string)=>void)|undefined;onClose():void;
}
export function AgentContextDialog(props:Props) {
 const dialog=useRef<HTMLDialogElement>(null),[notice,setNotice]=useState(''),[importing,setImporting]=useState(false);
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>{if(el?.open)el.close();};},[]);
 async function importFile(){
  if(props.locked||importing||!props.sessionId||!files.project)return;
  setImporting(true);props.onBusy(true);
  try {
   const result=await files.project.importDocument(props.sessionId,'any');
   if(!result)setNotice('Import annulé.');
   else if('error' in result)setNotice(result.error);
   else {
    const added=result.documents.filter(d=>!props.documents.some(old=>old.id===d.id));
    props.onManifest(result);props.onSelect([...new Set([...props.selected,...added.map(d=>d.id)])]);
    setNotice(added.length?'Fichier ajouté au contexte. Son contenu sera accessible à l’agent après l’envoi de votre message.':'Ce fichier est déjà dans le projet. Sélectionnez-le ci-dessous.');
   }
  }catch{setNotice('Import impossible. Votre message est conservé.');}
  finally{setImporting(false);props.onBusy(false);}
 }
 return <dialog ref={dialog} className="command-dialog agent-context-dialog" aria-label="Fichiers et contexte IA" onClose={props.onClose} onCancel={e=>{if(importing)e.preventDefault();}}>
  <h2>Fichiers et contexte</h2><p>Les sources du projet et les références BASIC sont déjà accessibles à l’agent.</p>
  <Button icon="upload" className="primary" disabled={props.locked||importing||!files.project||props.documents.length>=10} onClick={()=>void importFile()}>Importer un fichier…</Button>
  <p className="muted">TXT, Markdown, PNG, JPEG, PDF · 1 Mio par fichier, 4 Mio au total, 10 documents maximum. Une copie reste dans Connaissances, hors du DSK.</p>
  {props.locked&&<p>Le contexte est fixé pour cette conversation. Pour joindre d’autres fichiers, ouvrez une nouvelle conversation après la mission et l’enregistrement de vos brouillons.</p>}
  <div className="agent-context-list">{props.documents.map(d=>{
   const automatic=!!d.knowledge&&d.knowledge.access!=='excluded',excluded=d.knowledge?.access==='excluded';
   return <div key={d.id}><label><input type="checkbox" aria-label={`Joindre ${d.originalName}`} checked={!excluded&&(automatic||props.includeAll||props.selected.includes(d.id))} disabled={props.locked||importing||automatic||excluded||props.includeAll} onChange={e=>props.onSelect(e.target.checked?[...props.selected,d.id]:props.selected.filter(id=>id!==d.id))}/><span>{d.originalName}<small>{excluded?'Exclu de l’IA dans Connaissances':automatic?'Connaissance autorisée par le projet':'Disponible pour cette conversation'}</small></span></label><Button icon="eye" aria-label={`Lire ${d.originalName}`} disabled={props.locked||importing} onClick={()=>{props.onDocument?.(d.id);props.onClose();}}/></div>;
  })}{!props.documents.length&&<p className="muted">Ajoutez une consigne, une image de référence ou un document pour guider l’agent.</p>}</div>
  <details><summary>Accès avancé et données transmises</summary><label className="document-consent"><input type="checkbox" checked={props.includeAll} disabled={props.locked||importing||!props.documents.length} onChange={e=>props.onIncludeAll(e.target.checked)}/>Autoriser les documents du projet pour cette mission ({props.documents.length})</label><p className="muted">Les exclusions définies dans Connaissances restent prioritaires. Les noms, extraits et images consultés sont transmis à OpenAI. Les connaissances essentielles fournissent un extrait dès le démarrage. Les PDF sont lus comme texte, sans OCR ; les images demandent un modèle compatible vision. Les références importées restent intactes.</p></details>
  <p role="status">{notice}</p><div className="settings-actions"><Button disabled={importing} onClick={()=>dialog.current?.close()}>Terminé</Button></div>
 </dialog>;
}
