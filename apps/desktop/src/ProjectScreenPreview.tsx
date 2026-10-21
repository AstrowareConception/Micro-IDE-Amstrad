import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {ProjectScenario} from '../../../packages/emulator/src/project-tests.ts';
import {parseScreenRegion,screenRegionPixels,type ProjectScreenPreview as Preview,type ScreenRegion} from '../../../packages/emulator/src/project-screen-reference.ts';

interface Props {preview:Preview;scenario:ProjectScenario;disabled:boolean;stale:boolean;onAdopt(region:ScreenRegion,target:number):void;onDiscard():void}
export function ProjectScreenPreview({preview,scenario,disabled,stale,onAdopt,onDiscard}:Props){
 const first=scenario.checks.findIndex(c=>c.kind==='screen'),initial=first<0?undefined:scenario.checks[first];
 const [target,setTarget]=useState(first),[region,setRegion]=useState<ScreenRegion>(()=>initial?.kind==='screen'?{name:initial.name,x:initial.x,y:initial.y,width:initial.width,height:initial.height}:{name:'screen',x:64,y:36,width:640,height:8});
 const frame=useRef<HTMLCanvasElement>(null),crop=useRef<HTMLCanvasElement>(null),drag=useRef<{x:number;y:number;pointerId:number}|undefined>(undefined);
 let invalid='';try{parseScreenRegion(region);}catch(reason){invalid=reason instanceof Error?reason.message:'Zone invalide.';}
 useEffect(()=>{const context=frame.current?.getContext('2d');if(context)context.putImageData(new ImageData(new Uint8ClampedArray(preview.rgba),768,272),0,0);},[preview]);
 useEffect(()=>{
  if(invalid||!crop.current)return;
  crop.current.width=region.width;crop.current.height=region.height;
  crop.current.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(screenRegionPixels(preview.rgba,region)),region.width,region.height),0,0);
 },[preview,region,invalid]);
 function point(event:PointerEvent<HTMLCanvasElement>){const box=event.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(767,Math.floor((event.clientX-box.left)*768/box.width))),y:Math.max(0,Math.min(271,Math.floor((event.clientY-box.top)*272/box.height)))};}
 function move(event:PointerEvent<HTMLCanvasElement>){
  if(!drag.current||disabled||stale||drag.current.pointerId!==event.pointerId)return;
  const current=point(event),start=drag.current;
  setRegion(previous=>({...previous,x:Math.min(start.x,current.x),y:Math.min(start.y,current.y),width:Math.abs(start.x-current.x)+1,height:Math.abs(start.y-current.y)+1}));
 }
 function choose(value:number){setTarget(value);const check=scenario.checks[value];if(check?.kind==='screen')setRegion({name:check.name,x:check.x,y:check.y,width:check.width,height:check.height});}
 const unavailable=disabled||stale;
 return <section className="project-screen-preview" aria-label="Aperçu de référence écran">
  <h4>Examiner la capture avant adoption</h4>
  <p>{preview.plan.name} · {preview.plan.seconds} secondes émulées après RUN · {new Date(preview.createdAt).toLocaleString()}. Capture temporaire, sans verdict de test.</p>
  <p>Tracez un rectangle sur l’image ou ajustez ses coordonnées. Vérifiez le contenu de la zone ; évitez le curseur clignotant et les éléments animés.</p>
  <div className="project-screen-stage">
   <canvas ref={frame} width={768} height={272} role="img" aria-label="Écran CPC capturé ; sélection possible avec les coordonnées ci-dessous" onPointerDown={event=>{if(unavailable||event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={...point(event),pointerId:event.pointerId};move(event);}} onPointerMove={move} onPointerUp={event=>{move(event);drag.current=undefined;}} onPointerCancel={()=>{drag.current=undefined;}}/>
   {[region.x,region.y,region.width,region.height].every(Number.isFinite)&&<span className="project-screen-selection" style={{left:`${region.x/768*100}%`,top:`${region.y/272*100}%`,width:`${region.width/768*100}%`,height:`${region.height/272*100}%`}}/>}
  </div>
  <fieldset disabled={unavailable}><legend>Zone à adopter</legend>
   <label>Destination de la référence<select aria-label="Destination de la référence" value={target} onChange={e=>choose(Number(e.target.value))}><option value={-1} disabled={scenario.checks.length>=8}>Nouvelle attente écran</option>{scenario.checks.map((c,i)=>c.kind==='screen'?<option key={i} value={i}>Remplacer {c.name} (attente {i+1})</option>:null)}</select></label>
   <label>Nom de la référence<input aria-label="Nom de la référence" value={region.name} maxLength={40} onChange={e=>setRegion({...region,name:e.target.value})}/></label>
   <div className="project-screen-rectangle">{(['x','y','width','height'] as const).map((key,i)=><label key={key}>{['X','Y','Largeur','Hauteur'][i]}<input aria-label={`Capture ${['X','Y','Largeur','Hauteur'][i]}`} type="number" min={i<2?0:1} max={i%2===0?768:272} step={1} value={Number.isFinite(region[key])?region[key]:''} onChange={e=>setRegion({...region,[key]:e.target.valueAsNumber})}/></label>)}</div>
  </fieldset>
  {invalid?<p role="alert" className="error">{invalid}</p>:<><p>Zone retenue : {region.width} × {region.height} pixels ({region.width*region.height} / 16 384 maximum).</p><div className="project-screen-crop"><canvas ref={crop} role="img" aria-label="Détail de la zone retenue" style={{width:region.width*2,height:region.height*2}}/></div></>}
  {stale&&<p role="alert">Capture périmée : capturez de nouveau après modification du projet, du scénario ou de ses saisies.</p>}
  <p>L’adoption {target<0?'ajoute une attente':'remplace l’attente choisie'} dans le brouillon. Enregistrez ensuite les scénarios, puis exécutez un essai pour vérifier la référence.</p>
  <div className="project-test-actions"><button disabled={unavailable||!!invalid||(target<0?scenario.checks.length>=8:scenario.checks[target]?.kind!=='screen')} onClick={()=>onAdopt(region,target)}>Adopter cette zone comme référence</button><button disabled={disabled} onClick={onDiscard}>Écarter la capture</button></div>
 </section>;
}
