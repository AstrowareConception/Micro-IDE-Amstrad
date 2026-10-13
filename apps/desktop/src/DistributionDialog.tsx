import { useEffect, useRef, useState } from 'react';
import { prepareDistribution, type DistributionOptions } from '../../../packages/cpc-disk/src/distribution.ts';
import { files } from './port.ts';
import { Button } from './Icon.tsx';
export function DistributionDialog({ sources, sessionId, onClose }: { sources: { id: string; name: string; source: string }[]; sessionId?: string | undefined; onClose(): void }) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [options,setOptions]=useState<DistributionOptions>({ mode:'combined',rename:true,comments:true,renumber:false });
  const [preview,setPreview]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{ dialog.current?.showModal(); },[]);
  const change=(next:DistributionOptions)=>{setOptions(next);setPreview('');setMessage('');};
  return <dialog ref={dialog} className="command-dialog disk-import-dialog" aria-label="Exporter avec protection" onClose={onClose} onCancel={event=>{if(busy)event.preventDefault();}}>
    <h2>Préparer une copie de distribution</h2>
    <p>Les sources claires du projet restent intactes. La protection BASIC historique peut être retirée ; le mode combiné ne restitue alors que le listing obfusqué.</p>
    <label>Mode d’export<select aria-label="Mode d’export" disabled={busy} value={options.mode} onChange={e=>change({...options,mode:e.target.value as DistributionOptions['mode']})}>
      <option value="obfuscate">Obfuscation seule</option><option value="protected">BASIC protégé seul</option><option value="combined">Obfuscation + BASIC protégé</option>
    </select></label>
    <fieldset disabled={busy || options.mode==='protected'}><legend>Transformations</legend>
      {(['rename','comments','renumber'] as const).map((key,i)=><label className="distribution-option" key={key}><input type="checkbox" checked={options[key]} onChange={e=>change({...options,[key]:e.target.checked})}/>{['Renommer les variables (types conservés)','Retirer le texte des commentaires','Renuméroter les lignes et leurs références'][i]}</label>)}
    </fieldset>
    <p className="muted">Obfuscation : programme autonome, formes analysables uniquement. Les accès mémoire, les chargements externes et les ambiguïtés sont refusés. Profil visé : CPC 6128, Locomotive BASIC 1.1. Testez la copie distribuée avant publication.</p>
    <Button disabled={busy} onClick={()=>{try{const result=prepareDistribution(sources,options);setPreview(result.map(file=>`; ${file.name}\n${file.source}`).join('\n'));setMessage('Aperçu prêt. Seuls les fichiers de distribution et les ressources autorisées seront placés dans le DSK.');}catch(e){setMessage(String(e));setPreview('');}}}>Prévisualiser</Button>
    {preview && <pre className="disk-source-preview" aria-label="Listing distribué">{preview}</pre>}
    {message && <p role="status">{message}</p>}
    <Button disabled={busy || !preview || !files.distribution} onClick={async()=>{setBusy(true);try{const result=await files.distribution!.export({sessionId,sources:sources.map(({id,source})=>({id,source})),options});if(result && 'error' in result)setMessage(result.error);else setMessage(result?`Disquette enregistrée : ${result.name}`:'Export annulé.');}catch(e){setMessage(String(e));}finally{setBusy(false);}}}>Enregistrer le DSK de distribution…</Button>
    <Button disabled={busy} onClick={onClose}>Fermer</Button>
  </dialog>;
}
