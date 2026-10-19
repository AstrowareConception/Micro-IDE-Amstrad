import type {ProjectScenario,ProjectCheck} from '../../../packages/emulator/src/project-tests.ts';
interface Props {scenario:ProjectScenario;disabled:boolean;onChange(value:ProjectScenario):void}
export function ProjectScenarioEditor({scenario:s,disabled,onChange}:Props){
 const check=(index:number,value:ProjectCheck)=>onChange({...s,checks:s.checks.map((c,i)=>i===index?value:c)});
 return <fieldset disabled={disabled} className="project-scenario-editor"><legend>Préparation du scénario</legend>
  <label>Nom du scénario<input value={s.name} maxLength={100} onChange={e=>onChange({...s,name:e.target.value})}/></label>
  <label>Budget en secondes émulées<input type="number" min={1} max={15} step={1} value={Number.isFinite(s.seconds)?s.seconds:''} onChange={e=>onChange({...s,seconds:e.target.valueAsNumber})}/></label>
  <p>Les observations sont comparées au terme du budget. Le démarrage du CPC est ajouté automatiquement.</p>
  <h4>Saisies clavier</h4><p>ASCII ; <code>\r</code> pour Entrée, <code>\\</code> pour une barre oblique inverse. Délais par pas de 20 ms ; 120 ms par touche, sans chevauchement.</p>
  {s.inputs.map((input,index)=><fieldset key={index}><legend>Saisie {index+1}</legend>
   <label>Délai (ms)<input type="number" min={0} max={15000} step={20} value={Number.isFinite(input.atMs)?input.atMs:''} onChange={e=>onChange({...s,inputs:s.inputs.map((v,i)=>i===index?{...v,atMs:e.target.valueAsNumber}:v)})}/></label>
   <label>Touches<input value={input.text} onChange={e=>onChange({...s,inputs:s.inputs.map((v,i)=>i===index?{...v,text:e.target.value}:v)})}/></label>
   <button onClick={()=>onChange({...s,inputs:s.inputs.filter((_,i)=>i!==index)})}>Retirer la saisie {index+1}</button>
  </fieldset>)}
  <button disabled={s.inputs.length>=8} onClick={()=>onChange({...s,inputs:[...s.inputs,{atMs:4000,text:'\\r'}]})}>Ajouter une saisie</button>
  <h4>Attentes</h4><p>Définissez le résultat correct. Les essais et l’agent ne modifient jamais ces attentes.</p>
  {s.checks.map((c,index)=><fieldset key={index}><legend>Attente {index+1} · {c.kind==='file'?'fichier':'écran'}</legend>
   <label>{c.kind==='file'?'Nom CPC du fichier':'Nom de la zone'}<input value={c.name} maxLength={c.kind==='file'?12:40} onChange={e=>check(index,{...c,name:e.target.value})}/></label>
   {c.kind==='file'?<><label>Texte ASCII attendu<textarea aria-label="Texte ASCII attendu" rows={2} value={c.text} onChange={e=>check(index,{...c,text:e.target.value})}/></label><p><code>\r\n</code> pour une fin de ligne CPC, <code>\t</code> pour une tabulation, <code>\\</code> pour une barre oblique inverse. Maximum 2 048 caractères décodés.</p></>:<>
    <div className="project-screen-rectangle">{(['x','y','width','height'] as const).map((key,i)=><label key={key}>{['X','Y','Largeur','Hauteur'][i]}<input type="number" min={i<2?0:1} max={i%2===0?768:272} value={Number.isFinite(c[key])?c[key]:''} onChange={e=>check(index,{...c,[key]:e.target.valueAsNumber})}/></label>)}</div>
    <label>Empreinte SHA-256 attendue<input className="project-test-hash" value={c.sha256} maxLength={64} onChange={e=>check(index,{...c,sha256:e.target.value})}/></label>
    <p>Zone dans le cadre 768 × 272, maximum 16 384 pixels. Empreinte d’une référence écran vérifiée par vos soins ; aucune capture automatique de référence.</p>
   </>}
   <button onClick={()=>onChange({...s,checks:s.checks.filter((_,i)=>i!==index)})}>Retirer l’attente {index+1}</button>
  </fieldset>)}
  <div className="project-test-actions"><button disabled={s.checks.length>=8} onClick={()=>onChange({...s,checks:[...s.checks,{kind:'file',name:'OUT.TXT',text:''}]})}>Ajouter une attente fichier</button><button disabled={s.checks.length>=8} onClick={()=>onChange({...s,checks:[...s.checks,{kind:'screen',name:'screen',x:64,y:36,width:640,height:8,sha256:''}]})}>Ajouter une attente écran</button></div>
 </fieldset>;
}
