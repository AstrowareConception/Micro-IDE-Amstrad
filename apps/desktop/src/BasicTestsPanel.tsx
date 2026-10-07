import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './Icon.tsx';
import { files } from './port.ts';
import { parseBasicTestReport, type BasicTestLibrary, type BasicTestReport, type BasicTestReportSource } from '../../../packages/emulator/src/basic-test-suites.ts';
import { BASIC_TEST_EXAMPLE, BASIC_TEST_LIMITS, basicTestPlan, basicTestsMarkdown, validBasicTestResult, type BasicTestSource, type BasicTestResult } from '../../../packages/emulator/src/basic-tests.ts';
interface Props { documents: BasicTestSource[]; activeId: string; scopeId: string; sessionId?: string | undefined; visible?: boolean; onConfigure(): void; onReveal?(id: string, line: number): void }
interface Snapshot { id: string; suiteId: string | null; suiteName: string | null; sources: BasicTestSource[]; metadata: BasicTestReportSource[]; results: BasicTestResult[]; createdAt: string; seconds: number; historicalMismatch?: boolean }
export const BasicTestsPanel = memo(function BasicTestsPanel({ documents, activeId, scopeId, sessionId, visible = true, onConfigure, onReveal }: Props) {
 const [scope, setScope] = useState('active'), [seconds, setSeconds] = useState(3), [running, setRunning] = useState(false), [error, setError] = useState(''), [snapshot, setSnapshot] = useState<Snapshot>();
 const [progress, setProgress] = useState('');
 const [library, setLibrary] = useState<BasicTestLibrary>(), [history, setHistory] = useState<BasicTestReport[]>([]);
 const [suiteId, setSuiteId] = useState(''), [suiteName, setSuiteName] = useState(''), [sourceIds, setSourceIds] = useState<string[]>([]), [suiteTarget, setSuiteTarget] = useState('all');
 const [libraryBusy, setLibraryBusy] = useState(false), [libraryError, setLibraryError] = useState(''), [archiveNotice, setArchiveNotice] = useState('');
 const libraryGeneration = useRef(0);
 const suite = library?.suites.find(item => item.id === suiteId);
 const persistent = !!sessionId && !!files.basicTestSuites;
 useEffect(() => {
  libraryGeneration.current++; setLibrary(undefined); setHistory([]); setSuiteId(''); setSuiteName(''); setSourceIds([]); setSuiteTarget('all'); setScope('active'); setLibraryBusy(false); setLibraryError(''); setArchiveNotice('');
 }, [scopeId]);
 async function refreshLibrary() {
  if (!sessionId || !files.basicTestSuites) return;
  const epoch = libraryGeneration.current; setLibraryBusy(true); setLibraryError('');
  try {
   const loaded = await files.basicTestSuites.load(sessionId);
   if (epoch !== libraryGeneration.current) return;
   if ('error' in loaded) throw new Error(loaded.error);
   setLibrary(loaded);
   const reports = await files.basicTestSuites.history(sessionId);
   if (epoch !== libraryGeneration.current) return;
   if ('error' in reports) throw new Error(reports.error);
   setHistory(reports);
  } catch (reason) { if (epoch === libraryGeneration.current) setLibraryError(reason instanceof Error ? reason.message : 'Lecture des suites impossible.'); }
  finally { if (epoch === libraryGeneration.current) setLibraryBusy(false); }
 }
 useEffect(() => { if (visible && persistent) void refreshLibrary(); return () => { libraryGeneration.current++; }; }, [scopeId, visible, sessionId]);
 function chooseSuite(id: string) {
  const selected = library?.suites.find(item => item.id === id);
  setSuiteId(id); setSuiteName(selected?.name ?? ''); setSourceIds(selected?.sourceIds ?? (documents.some(doc => doc.id === activeId) ? [activeId] : [])); setSuiteTarget('all');
  if (selected) { setSeconds(selected.seconds); setScope('suite'); } else setScope('active');
 }
 async function saveSuite(remove = false) {
  if (!sessionId || !files.basicTestSuites || !library) return;
  const epoch = libraryGeneration.current, id = suiteId || crypto.randomUUID();
  const next = library.suites.filter(item => item.id !== id);
  if (!remove) next.push({ id, name: suiteName.trim(), sourceIds, seconds });
  setLibraryBusy(true); setLibraryError('');
  try {
   const saved = await files.basicTestSuites.save(sessionId, library.revision, next);
   if (epoch !== libraryGeneration.current) return;
   if ('error' in saved) throw new Error(saved.error);
   setLibrary(saved); setSuiteId(remove ? '' : id); setScope(remove ? 'active' : 'suite'); setSuiteTarget('all');
   if (remove) { setSuiteName(''); setSourceIds([]); }
  } catch (reason) { if (epoch === libraryGeneration.current) setLibraryError(reason instanceof Error ? reason.message : 'Enregistrement de la suite impossible.'); }
  finally { if (epoch === libraryGeneration.current) setLibraryBusy(false); }
 }
 async function archive(value: Snapshot) {
  if (!sessionId || !files.basicTestSuites) return;
  const epoch = libraryGeneration.current; setLibraryBusy(true); setArchiveNotice('');
  try {
   const report = parseBasicTestReport({ schemaVersion: 1, id: value.id, createdAt: value.createdAt, suiteId: value.suiteId, suiteName: value.suiteName, seconds: value.seconds, sources: value.metadata, results: value.results });
   const saved = await files.basicTestSuites.record(sessionId, report);
   if (epoch !== libraryGeneration.current) return;
   if ('error' in saved) throw new Error(saved.error);
   setHistory(saved); setArchiveNotice('Rapport conservé dans l’historique local du projet.');
  } catch (reason) { if (epoch === libraryGeneration.current) setArchiveNotice(`Rapport non conservé : ${reason instanceof Error ? reason.message : 'écriture impossible'}. Vous pouvez l’exporter.`); }
  finally { if (epoch === libraryGeneration.current) setLibraryBusy(false); }
 }
 async function restoreReport(report: BasicTestReport) {
  const epoch = libraryGeneration.current; setLibraryBusy(true); setArchiveNotice('');
  const current = report.sources.map(source => documents.find(doc => doc.id === source.id));
  try {
   const matches = await Promise.all(current.map(async (doc, index) => !!doc && doc.name === report.sources[index]!.name && await digest(doc.source) === report.sources[index]!.sha256));
   if (epoch !== libraryGeneration.current) return;
   setSnapshot({ ...report, metadata: report.sources, sources: current.map((doc, index) => doc ? { ...doc } : { id: report.sources[index]!.id, name: report.sources[index]!.name, source: '' }), historicalMismatch: matches.some(value => !value) });
   setError(''); setArchiveNotice('Rapport historique chargé ; aucun test n’a été relancé.');
  } catch { if (epoch === libraryGeneration.current) setLibraryError('Comparaison des empreintes impossible.'); }
  finally { if (epoch === libraryGeneration.current) setLibraryBusy(false); }
 }

 const generation = useRef(0), pending = useRef<(() => void) | undefined>(undefined);
 const stop = useCallback(() => { generation.current++; pending.current?.(); pending.current = undefined; }, []);
 useEffect(() => { stop(); setRunning(false); setSnapshot(undefined); setError(''); setProgress(''); return stop; }, [scopeId, stop]);
 const stale = !!snapshot && (!!snapshot.historicalMismatch || snapshot.sources.some(before => !documents.some(now => now.id === before.id && now.name === before.name && now.source === before.source)));
 const blocked = (source: BasicTestSource, message: string): BasicTestResult => ({ sourceId: source.id, name: source.name, outcome: 'blocked', message, cases: [], emulatedSeconds: 0 });
 async function run() {
  stop(); setError(''); setSnapshot(undefined); setArchiveNotice('');
  const selected = scope === 'suite' ? suite?.sourceIds.filter(id => suiteTarget === 'all' || id === suiteTarget) : undefined;
  if (scope === 'suite' && (!selected?.length || selected.some(id => !documents.some(doc => doc.id === id)))) { setError('Une source de la suite est absente. Modifiez la suite ou restaurez sa source avant de la lancer.'); return; }
  const sources = (selected ? selected.map(id => documents.find(doc => doc.id === id)!) : documents.filter(doc => scope === 'active' ? doc.id === activeId : /^\s*\d+\s+REM\s+@CPCTEST\b/im.test(doc.source))).map(doc => ({ ...doc }));
  if (!sources.length || sources.length > BASIC_TEST_LIMITS.sources) { setError('Choisissez entre 1 et 8 listings de test déclarés.'); return; }
  try { sources.forEach(basicTestPlan); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Déclarations de tests invalides.'); return; }
  const id = generation.current, createdAt = new Date().toISOString(), results: BasicTestResult[] = [], budget = seconds;
  setRunning(true);
  let metadata: BasicTestReportSource[];
  try { metadata = await Promise.all(sources.map(async source => ({ id: source.id, name: source.name, sha256: await digest(source.source), cases: basicTestPlan(source).cases }))); }
  catch { if (id === generation.current) { setRunning(false); setError('Empreintes de sources indisponibles.'); } return; }
  if (id !== generation.current) return;
  const base: Snapshot = { id: crypto.randomUUID(), suiteId: scope === 'suite' ? suite!.id : null, suiteName: scope === 'suite' ? suite!.name : null, sources, metadata, results: [], createdAt, seconds: budget };
  setSnapshot(base);
  for (const source of sources) {
   if (id !== generation.current) return;
   setProgress(`${source.name} · ${results.length + 1}/${sources.length}`);
   const result = await new Promise<BasicTestResult | undefined>(resolve => {
    let worker: Worker | undefined, settled = false;
    const finish = (result?: BasicTestResult) => {
     if (settled) return; settled = true; clearTimeout(timeout);
     if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
     if (pending.current === cancel) pending.current = undefined;
     resolve(result);
    };
    const cancel = () => finish();
    const timeout = setTimeout(() => finish(blocked(source, 'Délai réel de 60 secondes atteint pendant la préparation ou l’exécution. Aucun verdict BASIC.')), 60_000);
    pending.current = cancel;
    void (async () => {
     if (!files.emulator) { finish(blocked(source, 'Tests disponibles dans l’application desktop avec les trois ROM locales.')); return; }
     const image = await files.emulator.prepare({ source: source.source });
     if (settled || id !== generation.current) return;
     if ('error' in image) { finish(blocked(source, image.error)); return; }
     worker = new Worker(new URL('./basic-test-worker.ts', import.meta.url), { type: 'module', name: 'CPC6128-tests' });
     worker.onerror = event => { event.preventDefault(); finish(blocked(source, 'Worker de tests interrompu. Réessayez.')); };
     worker.onmessage = event => {
      if (settled || id !== generation.current || event.data?.id !== `${id}:${source.id}`) return;
      const result: unknown = event.data.result;
      if (!validBasicTestResult(result, basicTestPlan(source))) { finish(blocked(source, typeof event.data.error === 'string' ? event.data.error : 'Réponse de tests invalide.')); return; }
      finish(result);
     };
     worker.postMessage({ id: `${id}:${source.id}`, source, image, seconds: budget });
    })().catch(() => finish(blocked(source, 'Préparation des tests impossible ; vérifiez les ROM et le build WASM.')));
   });
   if (id !== generation.current || !result) return;
   results.push(result); setSnapshot({ ...base, results: [...results] });
  }
  if (id === generation.current) { setRunning(false); setProgress(''); await archive({ ...base, results: [...results] }); }
 }
 function cancel() {
  stop(); setRunning(false); setError('Tests annulés ; les listings non terminés ne reçoivent aucun verdict.'); setProgress('');
  if (snapshot) {
   const completed = { ...snapshot, results: snapshot.sources.map(source => snapshot.results.find(result => result.sourceId === source.id) ?? { ...blocked(source, 'Annulé avant réception d’un résultat.'), outcome: 'cancelled' as const }) };
   setSnapshot(completed); void archive(completed);
  }
 }
 function download(format: 'json' | 'md') {
  if (!snapshot) return;
  const header = `Généré le ${snapshot.createdAt}. État à l’export : ${stale ? 'sources modifiées' : 'sources inchangées'}. Budget après RUN : ${snapshot.seconds} s par listing.\n\n`;
  const text = format === 'json' ? JSON.stringify({ schemaVersion: 1, id: snapshot.id, suiteId: snapshot.suiteId, suiteName: snapshot.suiteName, sources: snapshot.metadata, createdAt: snapshot.createdAt, stale, running, seconds: snapshot.seconds, results: snapshot.results, pending: snapshot.sources.filter(source => !snapshot.results.some(result => result.sourceId === source.id)).map(source => ({ id: source.id, name: source.name })) }, null, 2) : header + (running ? 'Rapport partiel : exécution en cours.\n\n' : '') + basicTestsMarkdown(snapshot.results);
  save(text, `cpceleste-tests.${format}`, format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8');
 }
 return <section className="quality-panel" aria-label="Tests BASIC" aria-busy={running}>
  <h2>Tests BASIC à la demande</h2>
  <p className="muted">Assertions exécutées par la ROM, sur une machine et un disque indépendants par listing. Les buffers ne sont ni modifiés ni sauvegardés. Aucun test pendant la frappe ; aucun appel IA.</p>
  <div className="quality-actions"><label>Listings à tester<select aria-label="Listings à tester" value={scope} disabled={running || libraryBusy} onChange={event => setScope(event.target.value)}><option value="active">Source active</option><option value="loaded">Listings déclarés parmi les sources chargées</option>{suite && <option value="suite">Suite : {suite.name}</option>}</select></label>
   <label>Budget émulé après RUN (secondes)<input type="number" aria-label="Budget émulé après RUN" min={1} max={15} value={seconds} disabled={running || libraryBusy} onChange={event => setSeconds(Number(event.target.value))} /></label>
   <Button disabled={running || libraryBusy || !Number.isInteger(seconds) || seconds < 1 || seconds > 15} onClick={() => void run()}>Exécuter les tests BASIC</Button>
   {running && <Button onClick={cancel}>Annuler les tests</Button>}
   <Button onClick={onConfigure}>Configurer les ROM</Button>
   <Button onClick={() => save(BASIC_TEST_EXAMPLE, 'tests-score.bas', 'text/plain;charset=utf-8')}>Télécharger un exemple de tests</Button>
   <Button disabled={!snapshot} onClick={() => download('md')}>Exporter Markdown</Button><Button disabled={!snapshot} onClick={() => download('json')}>Exporter JSON</Button>
  </div>
  {persistent ? <fieldset disabled={running || libraryBusy} className="basic-test-suites"><legend>Suites du projet</legend>
   <label>Suite enregistrée<select aria-label="Suite enregistrée" value={suiteId} onChange={event => chooseSuite(event.target.value)}><option value="">Nouvelle suite</option>{library?.suites.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   <Button onClick={() => void refreshLibrary()}>Actualiser les suites et l’historique</Button>
   <label>Nom de la suite<input aria-label="Nom de la suite" value={suiteName} maxLength={100} onChange={event => setSuiteName(event.target.value)} /></label>
   <details><summary>Choisir les listings de la suite ({sourceIds.length}/8)</summary>
    {documents.map(doc => <label key={doc.id} className="basic-test-source"><input type="checkbox" checked={sourceIds.includes(doc.id)} onChange={event => setSourceIds(before => event.target.checked ? [...before, doc.id] : before.filter(id => id !== doc.id))} />{doc.name}</label>)}
    {sourceIds.filter(id => !documents.some(doc => doc.id === id)).map(id => <p key={id}>Source absente : {id} <Button onClick={() => setSourceIds(before => before.filter(value => value !== id))}>Retirer {id}</Button></p>)}
   </details>
   <Button disabled={!library || !suiteName.trim() || sourceIds.length < 1 || sourceIds.length > 8 || !Number.isInteger(seconds) || seconds < 1 || seconds > 15} onClick={() => void saveSuite()}>Enregistrer la suite</Button>
   <Button disabled={!suite} onClick={() => { if (window.confirm('Supprimer cette suite ? Les listings et les rapports seront conservés.')) void saveSuite(true); }}>Supprimer la suite</Button>
   {suite && <label>Exécuter dans la suite<select aria-label="Exécuter dans la suite" value={suiteTarget} onChange={event => { setSuiteTarget(event.target.value); setScope('suite'); }}><option value="all">Tous les listings de la suite</option>{suite.sourceIds.map(id => <option key={id} value={id}>{documents.find(doc => doc.id === id)?.name ?? `Source absente : ${id}`}</option>)}</select></label>}
   <p className="muted">16 suites maximum. Les suites référencent les sources déclarées ; aucun listing n’est ajouté au disque de test d’un autre listing. Enregistrer une suite ne sauvegarde pas les buffers.</p>
  </fieldset> : <p className="muted">Ouvrez un projet desktop pour enregistrer des suites et conserver les dix derniers rapports.</p>}
  {libraryBusy && <p role="status">Lecture ou enregistrement des tests du projet…</p>}{libraryError && <p role="alert">{libraryError}</p>}
  {history.length > 0 && <label>Historique des tests<select aria-label="Historique des tests" value="" disabled={running || libraryBusy} onChange={event => { const report = history.find(item => item.id === event.target.value); if (report) void restoreReport(report); }}><option value="">Charger un des {history.length} derniers rapports</option>{history.map(report => <option key={report.id} value={report.id}>{report.createdAt} · {report.suiteName ?? 'Tests ponctuels'} · {report.results.map(result => labels[result.outcome]).join(', ')}</option>)}</select></label>}
  {archiveNotice && <p role="status">{archiveNotice}</p>}
  <details><summary>Écrire un test et connaître les limites</summary>
   <p>Chaque listing est un programme autonome, sans concaténation ni chargement implicite des autres sources. Déclarez chaque assertion avec une ligne REM @CPCTEST 1 Nom du test (slots 1 à 32). Réservez &amp;8000–&amp;8023 avec MEMORY &amp;7FFF ; écrivez 1 pour réussi ou 2 pour échoué à &amp;8003 + slot. Après toutes les assertions, écrivez la signature de fin : POKE &amp;8000,67:POKE &amp;8001,80:POKE &amp;8002,67:POKE &amp;8003,165. Consultez l’exemple ci-dessous.</p>
   <p>Jeu CPC 6128 anglais identifié uniquement. 8 listings de 16 Kio maximum, 32 assertions/listing, 1–15 s émulées après saisie de RUN et 60 s réelles de préparation/exécution par listing. Le banc ne fournit pas de clavier interactif, de lecture de variables, de couverture ou d’analyse automatique des erreurs à l’écran. Une signature absente donne un délai dépassé, jamais un succès. Les tests déclarés sont responsables de leurs assertions et de la zone mémoire réservée.</p>
   <pre>{BASIC_TEST_EXAMPLE}</pre>
  </details>
  {running && <p role="status">Tests en cours : {progress}</p>}{error && <p role="alert">{error}</p>}
  {!snapshot && !error && <p>Ouvrez un listing de test, puis lancez les tests explicitement.</p>}
  {snapshot && <><p role="status" className={stale ? 'warning' : 'muted'}>{stale ? 'Rapport obsolète : des sources ont changé.' : 'Snapshot de tests sur les sources inchangées.'} · {snapshot.createdAt} · {snapshot.results.length}/{snapshot.sources.length} listings terminés</p>
   {snapshot.results.map(result => <article className="basic-test-result" key={result.sourceId}><h3>{result.name} · {labels[result.outcome]}</h3><p>{result.message}</p><p>{result.emulatedSeconds.toFixed(3)} s émulées au total (boot et clavier compris)</p>
    {result.cases.length > 0 && <table><caption>Assertions · {result.name}</caption><thead><tr><th>Slot</th><th>Test</th><th>Résultat</th><th>Octet lu</th>{onReveal && <th>Source</th>}</tr></thead><tbody>{result.cases.map(test => <tr key={test.slot}><td>{test.slot}</td><th scope="row">{test.name}</th><td>{labels[test.outcome]}</td><td>{test.observed}</td>{onReveal && <td><Button disabled={stale} onClick={() => onReveal(result.sourceId, test.line)}>Voir ligne {test.line}</Button></td>}</tr>)}</tbody></table>}
    <details><summary>Provenance du test</summary><p>Source SHA-256 : {result.sourceSha256 ?? 'non préparée'}<br />DSK SHA-256 : {result.diskSha256 ?? 'non préparé'}</p>{result.firmware && Object.entries(result.firmware).map(([role, hash]) => <p key={role}>{role} : {hash}</p>)}</details>
   </article>)}
  </>}
 </section>;
});
const labels = { passed: 'Réussi', failed: 'Échoué', incomplete: 'Incomplet', timeout: 'Délai dépassé', blocked: 'Bloqué', cancelled: 'Annulé' };
function save(text: string, name: string, type: string) {
 const url = URL.createObjectURL(new Blob([text], { type })), anchor = document.createElement('a');
 anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function digest(source: string): Promise<string> { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))), value => value.toString(16).padStart(2, '0')).join(''); }
