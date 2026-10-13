import { useEffect, useState, useImperativeHandle, type Ref } from 'react';
import type { ProjectManifest } from '../../../packages/workspace/src/project.ts';
import type { BinaryAnalysis, BinaryFileView, BinaryRegion } from '../../../packages/z80/src/workbench.ts';
import { files } from './port.ts';
import { Button } from './Icon.tsx';
export function BinaryWorkbenchPanel({ sessionId, manifest, onDirty, onBusy, onRun, ref }: {
  ref?: Ref<{ save(): Promise<void> }>; sessionId: string; manifest: ProjectManifest; onDirty(dirty: boolean): void; onBusy(busy: boolean): void; onRun(revision: string): void;
}) {
  const [analysis, setAnalysis] = useState<BinaryAnalysis>({ revision: null, regions: [] });
  const [regions, setRegions] = useState<BinaryRegion[]>([]), [selected, setSelected] = useState('');
  const [assetId, setAssetId] = useState(manifest.entryPoint), [view, setView] = useState<BinaryFileView>();
  const [offset, setOffset] = useState('0'), [length, setLength] = useState('128'), [origin, setOrigin] = useState('');
  const [kind, setKind] = useState<'code' | 'data'>('code'), [message, setMessage] = useState('');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(regions) !== JSON.stringify(analysis.regions);
  const region = regions.find(item => item.id === selected);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    let canceled = false;
    void files.binary?.load(sessionId).then(result => {
      if (canceled) return;
      if ('error' in result) setMessage(result.error);
      else { setAnalysis(result); setRegions(result.regions); setReady(true); }
    }).catch(error => { if (!canceled) setMessage(String(error)); });
    return () => { canceled = true; onDirty(false); };
  }, [sessionId, onDirty]);
  useEffect(() => {
    let canceled = false; setView(undefined); setOrigin('');
    void files.binary?.inspect(sessionId, assetId).then(result => {
      if (canceled) return;
      if ('error' in result) setMessage(result.error);
      else { setView(result); setOffset('0'); setLength(String(Math.min(128, result.payloadBytes))); setOrigin(result.loadAddress?.toString() ?? ''); }
    }).catch(error => { if (!canceled) setMessage(String(error)); });
    return () => { canceled = true; };
  }, [sessionId, assetId]);
  async function action(fn: () => Promise<void>) {
    if (busy) return; setBusy(true); onBusy(true);
    try { await fn(); } catch (error) { setMessage(String(error)); } finally { setBusy(false); onBusy(false); }
  }
  async function save() {
    if (!dirty || !ready || busy) return;
    await action(async () => { const result = await files.binary!.save(sessionId, analysis.revision, regions); if ('error' in result) throw Error(result.error); setAnalysis(result); setRegions(result.regions); setMessage('Analyse enregistrée dans le projet.'); });
  }
  useImperativeHandle(ref, () => ({ save }));
  function edit(change: Partial<Pick<BinaryRegion, 'note' | 'listing'>>) {
    setRegions(items => items.map(item => item.id === selected ? { ...item, ...change } : item));
  }
  return <section className="binary-workbench" aria-label="Atelier Z80">
    <h2>Atelier Z80 · {manifest.name}</h2>
    <p>Les fichiers d’origine restent intacts. Classez les plages, annotez et éditez les copies assembleur. F5 lance les fichiers originaux reconstruits. « Tester la copie modifiée » applique les modifications enregistrées dans une session CPC isolée.</p>
    {!files.binary && <p role="alert">Atelier persistant disponible dans l’application desktop.</p>}
    <fieldset disabled={busy || !ready}><legend>Fichier et plage à étudier</legend>
      <label>Fichier binaire<select aria-label="Fichier binaire" value={assetId} onChange={e => setAssetId(e.target.value)}>{manifest.assets.map(asset => <option key={asset.id} value={asset.id}>{asset.cpcName}</option>)}</select></label>
      {view && <><p>{view.size} octets · charge utile {view.payloadBytes} octets · SHA-256 {view.sha256.slice(0,16)}…</p><details><summary>Aperçu hexadécimal (256 premiers octets)</summary><pre>{view.hex}</pre></details></>}
      <div className="binary-range">
        <label>Décalage charge utile<input aria-label="Décalage de zone" value={offset} onChange={e => setOffset(e.target.value)} /></label>
        <label>Longueur (1–16384)<input aria-label="Longueur de zone" value={length} onChange={e => setLength(e.target.value)} /></label>
        <label>Adresse du premier octet<input aria-label="Origine de zone" value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Décimal ou 0x…" /></label>
        <label>Interprétation<select aria-label="Type de zone" value={kind} onChange={e => setKind(e.target.value as 'code' | 'data')}><option value="code">Code Z80 présumé</option><option value="data">Données brutes</option></select></label>
      </div>
      <Button disabled={!view || !origin.trim()} onClick={() => void action(async () => {
        const result = await files.binary!.generate(sessionId, assetId, Number(offset), Number(length), Number(origin), kind);
        if ('error' in result) throw Error(result.error);
        const row: BinaryRegion = { id: crypto.randomUUID(), assetId, sha256: view!.sha256, offset: Number(offset), length: Number(length), origin: Number(origin), kind, note: '', listing: result.listing };
        if (regions.some(item => item.assetId === row.assetId && row.offset < item.offset + item.length && item.offset < row.offset + row.length)) throw Error('Zone superposée à une annotation existante.');
        setRegions(items => [...items, row]); setSelected(row.id); setMessage('Zone générée : aller-retour identique vérifié avant édition. Enregistrez pour la conserver.');
      })}>Créer une zone et vérifier l’aller-retour</Button>
    </fieldset>
    <nav aria-label="Zones analysées">{regions.map(item => <Button key={item.id} disabled={busy} aria-pressed={item.id === selected} onClick={() => setSelected(item.id)}>{manifest.assets.find(asset => asset.id === item.assetId)?.cpcName} · {item.kind === 'code' ? 'code' : 'données'} · {item.offset}+{item.length}</Button>)}</nav>
    {region && <fieldset disabled={busy}><legend>Zone sélectionnée · adresse {region.origin} · {region.length} octets</legend>
      <label>Notes et hypothèses<textarea aria-label="Annotations Z80" rows={3} maxLength={4000} value={region.note} onChange={e => edit({ note: e.target.value })} /></label>
      <label>Listing réassemblable<textarea className="binary-listing" aria-label="Source assembleur Z80" rows={16} spellCheck={false} value={region.listing} onChange={e => edit({ listing: e.target.value })} /></label>
      <Button onClick={() => { setRegions(items => items.filter(item => item.id !== selected)); setSelected(''); }}>Retirer cette zone</Button>
    </fieldset>}
    <p>Dialecte CPCéleste : ORG unique, labels, instructions documentées prises en charge et DEFB. Taille et origine fixes ; pas de macros, de relocalisation ni de reconstruction des noms historiques. Les zones non classées restent inchangées.</p>
    <div className="binary-actions">
      <Button disabled={busy || !ready || !dirty} onClick={() => void save()}>Enregistrer l’analyse</Button>
      <Button disabled={busy || !ready || dirty || !regions.length} onClick={() => void action(async () => { const result = await files.binary!.verify(sessionId, analysis.revision); if ('error' in result) throw Error(result.error); setMessage(`Réassemblage vérifié : ${result.regions} zone(s), ${result.changedBytes} octet(s) modifié(s).`); })}>Vérifier le réassemblage</Button>
      <Button disabled={busy || !ready || dirty || !regions.length || !analysis.revision} onClick={() => void action(async () => { const result = await files.binary!.verify(sessionId, analysis.revision); if ('error' in result) throw Error(result.error); onRun(analysis.revision!); })}>Tester la copie modifiée</Button>
      <Button disabled={busy || !ready || dirty || !regions.length} onClick={() => void action(async () => { const result = await files.binary!.exportDisk(sessionId, analysis.revision); if (!result) return; if ('error' in result) throw Error(result.error); setMessage(`Disquette modifiée enregistrée : ${result.name}. Exécution à tester.`); })}>Exporter le DSK modifié…</Button>
    </div>
    <p role="status">{dirty ? 'Analyse non enregistrée. ' : ''}{message}</p>
  </section>;
}
