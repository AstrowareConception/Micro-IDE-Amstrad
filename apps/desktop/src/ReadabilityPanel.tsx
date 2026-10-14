import { useState } from 'react';
import { DEFAULT_READABILITY, readabilityMission, type ReadabilityOptions } from '../../../packages/agent/src/readability.ts';
import { Button } from './Icon.tsx';
export function ReadabilityPanel({disabled,onUse}:{disabled:boolean;onUse(text:string):void}){
 const [options,setOptions]=useState({...DEFAULT_READABILITY}),[focus,setFocus]=useState('Les sources BASIC du projet, en commençant par le point d’entrée'),[error,setError]=useState('');
 return <details className="readability-panel"><summary>Améliorer la lisibilité du code…</summary>
  <p>Préparez une mission pour rendre un programme historique plus facile à comprendre et à modifier. Aucun appel IA avant « Lancer l’agent ».</p>
  <fieldset disabled={disabled}><legend>Traitements à demander</legend>
  {([{key:'names',label:'Noms de variables explicites ; propositions pour les fonctions FN'},{key:'comments',label:'Commentaires utiles et explication des sous-programmes'},{key:'layout',label:'Mise en forme compatible BASIC CPC'},{key:'splitPlan',label:'Plan de découpage en fichiers (sans déplacement de code)'},{key:'document',label:'Compte rendu Markdown dans les connaissances'}] satisfies {key:keyof ReadabilityOptions;label:string}[]).map(({key,label})=><label key={key} className="document-consent"><input type="checkbox" checked={options[key]} onChange={e=>setOptions({...options,[key]:e.target.checked})}/>{label}</label>)}
  <label>Périmètre à améliorer<input value={focus} maxLength={1500} onChange={e=>setFocus(e.target.value)}/></label>
  <p className="muted">Suites CPC disponibles : essais avant/après sur les listings autonomes. Sans tests, la conservation du comportement reste à vérifier. Les cas ambigus sont laissés à la revue.</p>
  <Button onClick={()=>{try{onUse(readabilityMission(focus,options));setError('');}catch(e){setError(e instanceof Error?e.message:'Options invalides.');}}}>Préparer la mission de lisibilité</Button>
  </fieldset>{error&&<p role="alert">{error}</p>}
 </details>;
}
