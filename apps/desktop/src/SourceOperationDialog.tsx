import { useEffect, useRef, useState } from 'react';
import { Button } from './Icon.tsx';
import { files } from './port.ts';
import type { ProjectManifest, ProjectSource } from '../../../packages/workspace/src/project.ts';
import type { SourceOperation, SourcePlan, SourceMutationResult } from '../../../packages/workspace/src/source-operations.ts';
interface Props {
  sessionId: string; manifest: ProjectManifest; source: ProjectSource; buffer: string; dirty: boolean;
  action: SourceOperation['action']; onBusy(busy: boolean): void; onResult(result: SourceMutationResult): void; onClose(): void;
}
const labels = { rename: 'Renommer la source', move: 'Déplacer la source', delete: 'Supprimer la source' };
export function SourceOperationDialog(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null), mounted = useRef(true);
  const [value, setValue] = useState(props.action === 'rename' ? props.source.cpcName.slice(0, -4) : props.action === 'move' ? props.source.path : props.source.id !== props.manifest.entryPoint ? props.manifest.entryPoint : props.manifest.sources.find(source => source.id !== props.source.id)?.id ?? '');
  const [plan, setPlan] = useState<SourcePlan>(), [pending, setPending] = useState(false), [message, setMessage] = useState('');
  useEffect(() => { mounted.current = true; dialog.current?.showModal(); return () => { mounted.current = false; }; }, []);
  async function perform(apply = false) {
    const port = files.sourceOperations; if (!port || pending) return;
    setPending(true); props.onBusy(true); setMessage('');
    try {
      if (apply && plan) {
        const result = await port.apply(props.sessionId, plan.id, props.buffer);
        if (!mounted.current) return;
        if (!result) { setMessage('Opération annulée.'); return; }
        if ('error' in result) { setMessage(result.error); setPlan(undefined); return; }
        props.onResult(result); props.onClose();
      } else {
        const request: SourceOperation = props.action === 'rename' ? { action: 'rename', id: props.source.id, name: value } : props.action === 'move' ? { action: 'move', id: props.source.id, path: value } : { action: 'delete', id: props.source.id, entryPoint: value };
        const result = await port.prepare(props.sessionId, request);
        if (!mounted.current) return;
        if ('error' in result) setMessage(result.error); else setPlan(result);
      }
    } catch { if (mounted.current) { setMessage('Opération impossible ; préparez de nouveau l’aperçu.'); setPlan(undefined); } }
    finally { props.onBusy(false); if (mounted.current) setPending(false); }
  }
  return <dialog ref={dialog} className="command-dialog source-operation-dialog" aria-label={labels[props.action]} onCancel={event => { if (pending) event.preventDefault(); }} onClose={props.onClose}>
    <h2>{labels[props.action]}</h2><p>{props.source.path} · {props.source.cpcName}</p>
    <form onSubmit={event => { event.preventDefault(); void perform(); }}>
      {props.action === 'delete' ? <label>Source d’entrée après suppression<select autoFocus disabled={pending} value={value} onChange={event => { setValue(event.target.value); setPlan(undefined); }}>
        {props.manifest.sources.filter(source => source.id !== props.source.id).map(source => <option key={source.id} value={source.id}>{source.path} · {source.cpcName}</option>)}
      </select></label> : <label>{props.action === 'rename' ? 'Nouveau nom CPC (sans .BAS)' : 'Nouveau chemin sous src/'}<input autoFocus required maxLength={props.action === 'rename' ? 8 : 240} value={value} disabled={pending} onChange={event => { setValue(event.target.value); setPlan(undefined); }} /></label>}
      {props.action === 'move' && <p className="muted">Le dossier de destination doit déjà exister. Le nom CPC reste identique.</p>}
      {props.action === 'delete' && props.dirty && <p>Ce brouillon est modifié. La confirmation vous proposera de le conserver dans l’historique, de l’enregistrer puis supprimer, ou d’annuler.</p>}
      <Button type="submit" disabled={pending || !value}>Préparer l’aperçu</Button>
    </form>
    {plan && <><table><thead><tr><th scope="col">Élément</th><th scope="col">Avant</th><th scope="col">Après</th></tr></thead><tbody>
      <tr><th scope="row">Chemin</th><td>{plan.source.path}</td><td>{plan.destination?.path ?? 'Source retirée'}</td></tr>
      <tr><th scope="row">Nom CPC</th><td>{plan.source.cpcName}</td><td>{plan.destination?.cpcName ?? 'Retiré du DSK'}</td></tr>
      <tr><th scope="row">Entrée</th><td>{props.manifest.sources.find(source => source.id === props.manifest.entryPoint)?.cpcName}</td><td>{plan.destination?.id === plan.entryPoint ? plan.destination.cpcName : props.manifest.sources.find(source => source.id === plan.entryPoint)?.cpcName}</td></tr>
    </tbody></table><p>Les noms de fichiers présents dans le BASIC restent à vérifier. Les autres brouillons sont conservés. La dernière organisation pourra être rétablie tant que le disque correspond.</p>
      <Button disabled={pending} onClick={() => void perform(true)}>{pending ? 'Opération en cours…' : 'Appliquer après confirmation'}</Button></>}
    <p role="status">{message}</p><Button disabled={pending} onClick={props.onClose}>Annuler</Button>
  </dialog>;
}

export function SourceDraftDialog({ path, source, onClose }: { path: string; source: string; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="explorer-preview-dialog" aria-label="Brouillon conservé" onClose={onClose}>
    <h2>Brouillon conservé · {path}</h2><p>Copie en lecture seule. Vous pouvez sélectionner et copier ce texte, même si la dernière organisation ne peut plus être rétablie.</p>
    <textarea aria-label="Texte du brouillon conservé" readOnly value={source} rows={18} autoFocus />
    <Button onClick={onClose}>Fermer la copie</Button>
  </dialog>;
}
