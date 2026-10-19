import type {ProjectTestReport} from '../../../packages/emulator/src/project-tests.ts';
import {escapeScenarioText} from './project-scenario-form.ts';
export const projectOutcome={passed:'Réussi',failed:'Échec',blocked:'Bloqué',cancelled:'Arrêté'} as const;
export function ProjectTestReportView({report:r,current,disabled,onExport}:{report:ProjectTestReport;current:boolean|undefined;disabled:boolean;onExport():void}){
 return <article className="project-test-report" aria-label="Rapport de test projet">
  <h4>{projectOutcome[r.result.outcome]} · {r.scenario.name}</h4>
  <p role="status">{current===undefined?'Révision actuelle non vérifiée. Actualisez pour comparer.':current?'Rapport correspondant au projet et aux attentes affichés.':'Rapport historique : le projet ou les attentes diffèrent.'}</p>
  <p>{r.result.message}</p><p>{new Date(r.createdAt).toLocaleString()} · {r.result.emulatedSeconds.toFixed(2)} s émulées · entrée {r.project.entry}</p>
  <p>Ce résultat porte sur les observations de ce scénario au terme de son budget. Il ne prouve ni la terminaison ni tous les parcours du programme.</p>
  <ul>{r.result.observations.map(o=><li key={`${o.kind}:${o.name}`}><strong>{o.name} : {projectOutcome[o.outcome]}</strong> — {o.message}<details><summary>Empreintes comparées</summary><p>Attendue : <code>{o.expectedSha256}</code></p><p>Observée : <code>{o.actualSha256??'Observation absente'}</code></p></details></li>)}</ul>
  <details><summary>Scénario exécuté et provenance</summary><p>Budget : {r.scenario.seconds} s</p><ul>{r.scenario.inputs.map((input,i)=><li key={i}>{input.atMs} ms : <code>{escapeScenarioText(input.text)}</code></li>)}{r.scenario.checks.map(c=><li key={`${c.kind}:${c.name}`}>{c.name} : {c.kind==='file'?<code>{escapeScenarioText(c.text)}</code>:`zone ${c.x}, ${c.y}, ${c.width} × ${c.height}`}</li>)}</ul>
   <dl><dt>Projet</dt><dd><code>{r.project.projectSha256}</code></dd><dt>DSK exécuté</dt><dd><code>{r.project.diskSha256}</code></dd><dt>Attentes enregistrées</dt><dd><code>{r.libraryRevision}</code></dd></dl>
   <ul>{[...r.project.sources,...r.project.assets].map(f=><li key={f.id}>{f.path} → {f.cpcName} : <code>{f.sha256}</code></li>)}</ul>
   {r.result.firmware&&<ul>{Object.entries(r.result.firmware).map(([role,sha])=><li key={role}>ROM {role} : <code>{sha}</code></li>)}</ul>}
  </details><button disabled={disabled} onClick={onExport}>Exporter ce rapport JSON</button>
 </article>;
}
