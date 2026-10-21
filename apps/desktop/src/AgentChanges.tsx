import type {AgentView} from '../../../packages/agent/src/types.ts';
import {Button} from './Icon.tsx';
interface Props {busy:boolean;documentDirty?:boolean;sessionId?:string|undefined;onDocument?(id:string):void}
export function AgentChanges({view,props,requesting}:{view:AgentView;props:Props;requesting:boolean}) {
 return <>      <details><summary>Changements ({view.changed.length})</summary>{view.workspace.binaryAnalysis ? view.workspace.binaryAnalysis.regions.filter(region => JSON.stringify(region) !== JSON.stringify(view.binaryBefore?.regions.find(old => old.id === region.id))).map(region => { const before = view.binaryBefore?.regions.find(old => old.id === region.id); return <div key={region.id}><h3>Zone {region.id}</h3><p>Avant la mission</p><pre>{`${before?.note ?? ''}\n${before?.listing ?? ''}`.slice(0,16384)}</pre><p>Après la mission</p><pre>{`${region.note}\n${region.listing}`.slice(0,16384)}</pre><p className="muted">Aperçus limités à 16 384 caractères par version. La comparaison des octets reste disponible dans l’atelier.</p></div>; }) : view.changed.filter(path=>view.workspace.files.some(file=>file.path===path)).map(path => {
        const current = view.workspace.files.find(file => file.path === path);
        const before = view.before.find(file => file.id === current?.id);
        return <div key={path}><h3>{path}</h3><p>Avant</p><pre>{before?.source ?? 'Nouveau fichier'}</pre><p>Après</p><pre>{current?.source}</pre></div>;
      })}</details>
      {!!view.documentChanges?.length && <section className="agent-document-changes" aria-label="Documents rédigés par l’agent">
        <h3>Mémoire du projet · {view.documentChanges.length} note(s)</h3>
        <p className="muted">Versions enregistrées dans Connaissances. Le checkpoint initial restaure aussi ces documents.</p>
        {view.documentChanges.map(note=><div className="agent-document-card" key={note.id}>
          <div><strong>{note.title}</strong><span className="agent-document-badge">{note.created?'Créée':'Révisée'}</span></div>
          <Button icon="file" disabled={props.busy || requesting || props.documentDirty || props.sessionId !== view.workspace.sessionId} onClick={()=>props.onDocument?.(note.id)}>Lire {note.title}</Button>
          <details><summary>Comparer le Markdown</summary><p>Avant la mission</p><pre>{note.before??'Nouvelle note'}</pre><p>Après la mission</p><pre>{note.after}</pre>{note.truncated && <p>Aperçus limités à 16 384 caractères. Ouvrez la note pour lire la suite.</p>}</details>
        </div>)}
      </section>}
</>;
}
