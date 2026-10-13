import { useEffect, useState, useImperativeHandle, type Ref } from 'react';
import type { ProjectManifest } from '../../../packages/workspace/src/project.ts';
import type { BinaryAnalysis, BinaryFileView, BinaryRegion, BinaryComparison } from '../../../packages/z80/src/workbench.ts';
import { files } from './port.ts';
import { Button } from './Icon.tsx';
export function BinaryWorkbenchPanel({ sessionId, manifest, onDirty, onBusy, onRun, onAskAgent, locked, ref }: {
  ref?: Ref<{ save(): Promise<void>; adopt(analysis: BinaryAnalysis): void }>; sessionId: string; manifest: ProjectManifest; onDirty(dirty: boolean): void; onBusy(busy: boolean): void; onRun(revision: string): void; onAskAgent(id: string): void; locked: boolean;
}) {
  const [analysis, setAnalysis] = useState<BinaryAnalysis>({ revision: null, regions: [] });
  const [regions, setRegions] = useState<BinaryRegion[]>([]), [selected, setSelected] = useState('');
  const [assetId, setAssetId] = useState(manifest.entryPoint), [view, setView] = useState<BinaryFileView>();
  const [offset, setOffset] = useState('0'), [length, setLength] = useState('128'), [origin, setOrigin] = useState('');
  const [kind, setKind] = useState<'code' | 'data'>('code'), [message, setMessage] = useState('');
  const [ready, setReady] = useState(false), [localBusy, setBusy] = useState(false);
  const busy = localBusy || locked;
  const [rangeOpen, setRangeOpen] = useState(true);
  const [comparison, setComparison] = useState<BinaryComparison>();
  const dirty = JSON.stringify(regions) !== JSON.stringify(analysis.regions);
  const region = regions.find(item => item.id === selected);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    let canceled = false;
    void files.binary?.load(sessionId).then(result => {
      if (canceled) return;
      if ('error' in result) setMessage(result.error);
      else { setAnalysis(result); setRegions(result.regions); setRangeOpen(!result.regions.length); setReady(true); }
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
  useImperativeHandle(ref, () => ({ save, adopt: result => { setAnalysis(result); setRegions(result.regions); setRangeOpen(!result.regions.length); setReady(true); setComparison(undefined); setMessage('Analyse synchronisée avec la mission IA.'); } }));
  function edit(change: Partial<Pick<BinaryRegion, 'note' | 'listing'>>) {
    setComparison(undefined);
    setRegions(items => items.map(item => item.id === selected ? { ...item, ...change } : item));
  }
  return <section className="binary-workbench" aria-label="Atelier Z80">
    <div className="binary-content">
    <header className="binary-heading"><div><span className="binary-eyebrow">EXPLORER · COMPRENDRE · MODIFIER</span><h2>Atelier Z80 · {manifest.name}</h2></div><span className="binary-save-state">{locked ? 'Mission IA en cours' : dirty ? 'Modifications à enregistrer' : analysis.revision ? 'Analyse enregistrée' : 'Aucune analyse enregistrée'}</span></header>
    <div className="binary-summary"><span><strong>{manifest.assets.length}</strong> {manifest.assets.length > 1 ? 'ressources préservées' : 'ressource préservée'}</span><span><strong>{regions.length}</strong> {regions.length > 1 ? 'zones analysées' : 'zone analysée'}</span><span><strong>{regions.reduce((sum, item) => sum + item.length, 0).toLocaleString('fr-FR')}</strong> octets classés</span></div>
    <p>Les fichiers d’origine restent intacts. Classez les plages, annotez et éditez les copies assembleur. F5 lance les fichiers originaux reconstruits. « Tester la copie modifiée » applique les modifications enregistrées dans une session CPC isolée.</p>
    {!files.binary && <p role="alert">Atelier persistant disponible dans l’application desktop.</p>}
    <details className="binary-range-details" open={rangeOpen} onToggle={event => setRangeOpen(event.currentTarget.open)}><summary>Fichier et plage à étudier · {view?.name ?? "Chargement…"}</summary><fieldset disabled={busy || !ready}><legend>Définir une zone</legend>
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
        setRegions(items => [...items, row]); setSelected(row.id); setRangeOpen(false); setMessage('Zone générée : aller-retour identique vérifié avant édition. Enregistrez pour la conserver.');
      })}>Créer une zone et vérifier l’aller-retour</Button>
    </fieldset></details>
    {!regions.length && <div className="binary-empty"><h3>Commencez par une petite routine</h3><p>Choisissez le fichier et son adresse de chargement, puis créez une zone. Les octets seront vérifiés avant toute modification. Enregistrez-la pour la confier à l’agent.</p></div>}
    <nav aria-label="Zones analysées">{regions.map(item => <Button key={item.id} disabled={busy} aria-pressed={item.id === selected} onClick={() => setSelected(item.id)}>{manifest.assets.find(asset => asset.id === item.assetId)?.cpcName} · {item.kind === 'code' ? 'code' : 'données'} · {item.offset}+{item.length}</Button>)}</nav>
    {region && <fieldset disabled={busy}><legend>Zone sélectionnée · adresse {region.origin} · {region.length} octets</legend>
      <div className="binary-region-actions"><Button icon="spark" disabled={busy || dirty || !analysis.revision} onClick={() => onAskAgent(region.id)}>Expliquer cette zone avec l’IA</Button><span className="muted">{region.listing.split('\n').length} lignes · origine ${region.origin.toString(16).toUpperCase()} · taille fixe</span></div>
      <label>Notes et hypothèses<textarea aria-label="Annotations Z80" rows={3} maxLength={4000} value={region.note} onChange={e => edit({ note: e.target.value })} /></label>
      <label>Listing réassemblable<textarea className="binary-listing" aria-label="Source assembleur Z80" rows={Math.min(16, Math.max(6, region.listing.split('\n').length))} spellCheck={false} value={region.listing} onChange={e => edit({ listing: e.target.value })} /></label>
      <Button disabled={busy} onClick={() => { setComparison(undefined); setRegions(items => items.filter(item => item.id !== selected)); setSelected(''); }}>Retirer cette zone</Button>
    </fieldset>}
    <p>Dialecte CPCéleste : ORG unique, labels, instructions documentées prises en charge et DEFB. Taille et origine fixes ; pas de macros, de relocalisation ni de reconstruction des noms historiques. Les zones non classées restent inchangées.</p>
    {comparison && !dirty && <section className="binary-comparison" aria-label="Comparaison des octets"><h3>Comparaison avec les originaux</h3><p>{comparison.changedBytes} octet(s) modifié(s). {comparison.truncated ? 'Les 128 premières différences sont affichées.' : 'Toutes les différences sont affichées.'} Adresses proposées par vos zones ; aucun test comportemental effectué.</p>{comparison.changes?.length > 0 && <div className="binary-table-scroll"><table><thead><tr><th>Ressource</th><th>Décalage</th><th>Adresse</th><th>Original</th><th>Modifié</th></tr></thead><tbody>{comparison.changes.map(change => <tr key={`${change.assetId}:${change.offset}`}><td>{manifest.assets.find(asset => asset.id === change.assetId)?.cpcName}</td><td>{change.offset}</td><td>${change.address.toString(16).toUpperCase()}</td><td>{change.before.toString(16).toUpperCase().padStart(2,'0')}</td><td>{change.after.toString(16).toUpperCase().padStart(2,'0')}</td></tr>)}</tbody></table></div>}</section>}
    <p role="status">{dirty ? 'Analyse non enregistrée. ' : ''}{message}</p>
    </div>
    <div className="binary-actions">
      <Button disabled={busy || !ready || !dirty} onClick={() => void save()}>Enregistrer l’analyse</Button>
      <Button disabled={busy || !ready || dirty || !regions.length} onClick={() => void action(async () => { const result = await files.binary!.verify(sessionId, analysis.revision); if ('error' in result) throw Error(result.error); setComparison(result); setMessage(`Réassemblage vérifié : ${result.regions} zone(s), ${result.changedBytes} octet(s) modifié(s).`); })}>Vérifier le réassemblage</Button>
      <Button disabled={busy || !ready || dirty || !regions.length || !analysis.revision} onClick={() => void action(async () => { const result = await files.binary!.verify(sessionId, analysis.revision); if ('error' in result) throw Error(result.error); onRun(analysis.revision!); })}>Tester la copie modifiée</Button>
      <Button disabled={busy || !ready || dirty || !regions.length} onClick={() => void action(async () => { const result = await files.binary!.exportDisk(sessionId, analysis.revision); if (!result) return; if ('error' in result) throw Error(result.error); setMessage(`Disquette modifiée enregistrée : ${result.name}. Exécution à tester.`); })}>Exporter le DSK modifié…</Button>
    </div>
  </section>;
}
