import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './Icon.tsx';
import { files } from './port.ts';
import { BASIC_TEST_EXAMPLE, BASIC_TEST_LIMITS, basicTestPlan, basicTestsMarkdown, validBasicTestResult, type BasicTestSource, type BasicTestResult } from '../../../packages/emulator/src/basic-tests.ts';
interface Props { documents: BasicTestSource[]; activeId: string; scopeId: string; onConfigure(): void }
interface Snapshot { sources: BasicTestSource[]; results: BasicTestResult[]; createdAt: string; seconds: number }
export const BasicTestsPanel = memo(function BasicTestsPanel({ documents, activeId, scopeId, onConfigure }: Props) {
 const [scope, setScope] = useState('active'), [seconds, setSeconds] = useState(3), [running, setRunning] = useState(false), [error, setError] = useState(''), [snapshot, setSnapshot] = useState<Snapshot>();
 const [progress, setProgress] = useState('');
 const generation = useRef(0), pending = useRef<(() => void) | undefined>(undefined);
 const stop = useCallback(() => { generation.current++; pending.current?.(); pending.current = undefined; }, []);
 useEffect(() => { stop(); setRunning(false); setSnapshot(undefined); setError(''); setProgress(''); return stop; }, [scopeId, stop]);
 const stale = !!snapshot && snapshot.sources.some(before => !documents.some(now => now.id === before.id && now.name === before.name && now.source === before.source));
 const blocked = (source: BasicTestSource, message: string): BasicTestResult => ({ sourceId: source.id, name: source.name, outcome: 'blocked', message, cases: [], emulatedSeconds: 0 });
 async function run() {
  stop(); setError(''); setSnapshot(undefined);
  const sources = documents.filter(doc => scope === 'active' ? doc.id === activeId : /^\s*\d+\s+REM\s+@CPCTEST\b/im.test(doc.source)).map(doc => ({ ...doc }));
  if (!sources.length || sources.length > BASIC_TEST_LIMITS.sources) { setError('Choisissez entre 1 et 8 listings de test déclarés.'); return; }
  try { sources.forEach(basicTestPlan); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Déclarations de tests invalides.'); return; }
  const id = generation.current, createdAt = new Date().toISOString(), results: BasicTestResult[] = [], budget = seconds;
  setRunning(true); setSnapshot({ sources, results: [], createdAt, seconds: budget });
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
   results.push(result); setSnapshot({ sources, results: [...results], createdAt, seconds: budget });
  }
  if (id === generation.current) { setRunning(false); setProgress(''); }
 }
 function cancel() {
  stop(); setRunning(false); setError('Tests annulés ; les listings non terminés ne reçoivent aucun verdict.'); setProgress('');
  setSnapshot(before => before ? { ...before, results: [...before.results, ...before.sources.filter(source => !before.results.some(result => result.sourceId === source.id)).map(source => ({ ...blocked(source, 'Annulé avant réception d’un résultat.'), outcome: 'cancelled' as const }))] } : before);
 }
 function download(format: 'json' | 'md') {
  if (!snapshot) return;
  const header = `Généré le ${snapshot.createdAt}. État à l’export : ${stale ? 'sources modifiées' : 'sources inchangées'}. Budget après RUN : ${snapshot.seconds} s par listing.\n\n`;
  const text = format === 'json' ? JSON.stringify({ createdAt: snapshot.createdAt, stale, running, seconds: snapshot.seconds, results: snapshot.results, pending: snapshot.sources.filter(source => !snapshot.results.some(result => result.sourceId === source.id)).map(source => ({ id: source.id, name: source.name })) }, null, 2) : header + (running ? 'Rapport partiel : exécution en cours.\n\n' : '') + basicTestsMarkdown(snapshot.results);
  save(text, `cpceleste-tests.${format}`, format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8');
 }
 return <section className="quality-panel" aria-label="Tests BASIC" aria-busy={running}>
  <h2>Tests BASIC à la demande</h2>
  <p className="muted">Assertions exécutées par la ROM, sur une machine et un disque indépendants par listing. Les buffers ne sont ni modifiés ni sauvegardés. Aucun test pendant la frappe ; aucun appel IA.</p>
  <div className="quality-actions"><label>Listings à tester<select aria-label="Listings à tester" value={scope} disabled={running} onChange={event => setScope(event.target.value)}><option value="active">Source active</option><option value="loaded">Listings déclarés parmi les sources chargées</option></select></label>
   <label>Budget émulé après RUN (secondes)<input type="number" aria-label="Budget émulé après RUN" min={1} max={15} value={seconds} disabled={running} onChange={event => setSeconds(Number(event.target.value))} /></label>
   <Button disabled={running || !Number.isInteger(seconds) || seconds < 1 || seconds > 15} onClick={() => void run()}>Exécuter les tests BASIC</Button>
   {running && <Button onClick={cancel}>Annuler les tests</Button>}
   <Button onClick={onConfigure}>Configurer les ROM</Button>
   <Button onClick={() => save(BASIC_TEST_EXAMPLE, 'tests-score.bas', 'text/plain;charset=utf-8')}>Télécharger un exemple de tests</Button>
   <Button disabled={!snapshot} onClick={() => download('md')}>Exporter Markdown</Button><Button disabled={!snapshot} onClick={() => download('json')}>Exporter JSON</Button>
  </div>
  <details><summary>Écrire un test et connaître les limites</summary>
   <p>Chaque listing est un programme autonome, sans concaténation ni chargement implicite des autres sources. Déclarez chaque assertion avec une ligne REM @CPCTEST 1 Nom du test (slots 1 à 32). Réservez &amp;8000–&amp;8023 avec MEMORY &amp;7FFF ; écrivez 1 pour réussi ou 2 pour échoué à &amp;8003 + slot. Après toutes les assertions, écrivez la signature de fin : POKE &amp;8000,67:POKE &amp;8001,80:POKE &amp;8002,67:POKE &amp;8003,165. Consultez l’exemple ci-dessous.</p>
   <p>Jeu CPC 6128 anglais identifié uniquement. 8 listings de 16 Kio maximum, 32 assertions/listing, 1–15 s émulées après saisie de RUN et 60 s réelles de préparation/exécution par listing. Le banc ne fournit pas de clavier interactif, de lecture de variables, de couverture ou d’analyse automatique des erreurs à l’écran. Une signature absente donne un délai dépassé, jamais un succès. Les tests déclarés sont responsables de leurs assertions et de la zone mémoire réservée.</p>
   <pre>{BASIC_TEST_EXAMPLE}</pre>
  </details>
  {running && <p role="status">Tests en cours : {progress}</p>}{error && <p role="alert">{error}</p>}
  {!snapshot && !error && <p>Ouvrez un listing de test, puis lancez les tests explicitement.</p>}
  {snapshot && <><p role="status" className={stale ? 'warning' : 'muted'}>{stale ? 'Rapport obsolète : des sources ont changé.' : 'Snapshot de tests sur les sources inchangées.'} · {snapshot.createdAt} · {snapshot.results.length}/{snapshot.sources.length} listings terminés</p>
   {snapshot.results.map(result => <article className="basic-test-result" key={result.sourceId}><h3>{result.name} · {labels[result.outcome]}</h3><p>{result.message}</p><p>{result.emulatedSeconds.toFixed(3)} s émulées au total (boot et clavier compris)</p>
    {result.cases.length > 0 && <table><caption>Assertions · {result.name}</caption><thead><tr><th>Slot</th><th>Test</th><th>Résultat</th><th>Octet lu</th></tr></thead><tbody>{result.cases.map(test => <tr key={test.slot}><td>{test.slot}</td><th scope="row">{test.name}</th><td>{labels[test.outcome]}</td><td>{test.observed}</td></tr>)}</tbody></table>}
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
