import type {AgentProjectTestRun,ProjectTestAssessment} from '../../../packages/agent/src/project-tests.ts';

const outcomes={passed:'réussi',failed:'échec',blocked:'bloqué',cancelled:'arrêté'};
export function ProjectTestResults({runs,assessment}:{runs:AgentProjectTestRun[];assessment:ProjectTestAssessment|undefined}){
 if(!runs.length)return null;
 return <section aria-label="Tests du projet CPC">
  <h3>Vrai projet CPC — avant / après</h3>
  <p className="muted">La disquette complète est lancée depuis l’entrée du projet. Les observations portent sur l’écran ou les fichiers à la fin du budget, sans garantir la terminaison ni tous les chemins du programme.</p>
  {assessment?.attempted && <p>{assessment.message}</p>}
  {runs.map((run,index)=><details key={run.report.id}>
   <summary>Essai {index+1} · {run.report.scenario.name} · {outcomes[run.report.result.outcome]} · {run.definitionStale?'attentes modifiées':run.stale?'révision antérieure':'révision courante'}</summary>
   <p>{run.report.result.message}</p>
   <p>Entrée : {run.report.project.entry} · budget : {run.report.scenario.seconds} s émulées après lancement.</p>
   {run.archiveError && <p role="alert">{run.archiveError}</p>}
   <ul>{run.report.result.observations.map(o=><li key={o.line}>{o.name} : {o.outcome==='passed'?'conforme':'différent'} · {o.message}</li>)}</ul>
   <details><summary>Empreintes et fichiers embarqués</summary>
    <p className="muted">Un fichier embarqué n’est pas nécessairement exécuté par ce scénario.</p>
    <p>Projet SHA-256 : {run.report.project.projectSha256}</p>
    <p>DSK SHA-256 : {run.report.project.diskSha256}</p>
    <p>Scénario SHA-256 : {run.report.scenarioSha256}</p>
    <ul>{[...run.report.project.sources,...run.report.project.assets].map(file=><li key={file.id}>{file.path} → {file.cpcName} · {file.sha256}</li>)}</ul>
   </details>
  </details>)}
 </section>;
}
