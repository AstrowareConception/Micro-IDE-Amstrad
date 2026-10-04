import { useMemo, useState } from 'react';
import type { DocumentSnapshot, ProjectManifest } from '../../../packages/workspace/src/project.ts';
import { files } from './port.ts';

interface Props { sessionId: string; manifest: ProjectManifest; busy: boolean; onBusy(value: boolean): void; onManifest(manifest: ProjectManifest): void }
export function DocumentsPanel(props: Props) {
  const [preview, setPreview] = useState<DocumentSnapshot>(), [offset, setOffset] = useState(0), [notice, setNotice] = useState('');
  const port = files.project;
  async function importDocument(kind: 'text' | 'image' = 'text') {
    if (!port || props.busy) return; props.onBusy(true);
    try {
      const result = await port.importDocument(props.sessionId, kind);
      if (!result) setNotice('Import annulé.');
      else if ('error' in result) setNotice(result.error);
      else { props.onManifest(result); setNotice('Original copié et vérifié. Les buffers BASIC sont conservés.'); }
    } catch { setNotice('Import impossible.'); }
    finally { props.onBusy(false); }
  }
  async function read(id: string) {
    if (!port || props.busy) return; props.onBusy(true); setPreview(undefined); setOffset(0);
    try {
      const result = await port.readDocument(props.sessionId, id);
      if ('error' in result) setNotice(result.error);
      else { setPreview(result); setNotice('Lecture seule · original vérifié.'); }
    } catch { setNotice('Lecture impossible.'); }
    finally { props.onBusy(false); }
  }
  const previewText = preview && 'text' in preview ? preview.text : undefined;
  const lines = useMemo(() => previewText?.split('\n') ?? [], [previewText]);
  return <section className="panel documents-panel" aria-label="Documents du projet">
    <h2>Documents du projet ({props.manifest.documents.length})</h2>
    <p className="muted">TXT/Markdown UTF-8, PNG/JPEG · 1 Mio par fichier, 4 Mio et 10 documents par projet. Images jusqu’à 4 mégapixels. Copies locales en lecture seule, exclues du DSK. L’accès IA est activable dans la mission.</p>
    <button disabled={props.busy || !port || props.manifest.documents.length >= 10} onClick={() => void importDocument()}>Importer TXT / Markdown</button>
    <button disabled={props.busy || !port || props.manifest.documents.length >= 10} onClick={() => void importDocument('image')}>Importer image PNG / JPEG</button>
    <nav className="project-files" aria-label="Pièces jointes">{props.manifest.documents.map(item => <button key={item.id} disabled={props.busy} onClick={() => void read(item.id)} aria-current={preview?.id === item.id ? 'page' : undefined}>{item.originalName}</button>)}</nav>
    <p aria-live="polite" className="documents-notice">{notice}</p>
    {preview && <div className="document-preview"><h3>{preview.originalName}</h3>
      <p>{preview.bytes} octets · {preview.mediaType} · rôle {preview.role}</p><code className="rom-hash">{preview.sha256}</code>
      {'dataUrl' in preview ? <><img className="image-preview" src={preview.dataUrl} alt={`Aperçu de ${preview.originalName}`} /><p>{preview.width} × {preview.height} pixels · aperçu {preview.previewWidth} × {preview.previewHeight}, sans métadonnées. Orientation EXIF ignorée.</p></> : <>
      <p>Lignes {offset + 1}–{Math.min(offset + 200, lines.length)} sur {lines.length}. Markdown affiché comme texte.</p>
      <textarea aria-label="Texte du document" readOnly rows={10} value={lines.slice(offset, offset + 200).join('\n')} />
      <button disabled={props.busy || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 200))}>Lignes précédentes</button>
      <button disabled={props.busy || offset + 200 >= lines.length} onClick={() => setOffset(value => value + 200)}>Lignes suivantes</button>
      </>}
    </div>}
  </section>;
}
