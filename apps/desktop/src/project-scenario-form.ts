import {parseProjectTests,type ProjectScenario} from '../../../packages/emulator/src/project-tests.ts';
import {parseProjectCapturePlan} from '../../../packages/emulator/src/project-screen-reference.ts';
export function capturePlanFromForm(s:ProjectScenario){
 return parseProjectCapturePlan({id:s.id,name:s.name,seconds:s.seconds,inputs:s.inputs.map(i=>({...i,text:unescapeScenarioText(i.text)}))});
}
/** Display control characters without losing CR/CRLF in HTML text controls. */
export function escapeScenarioText(text:string):string{return text.replace(/\\/g,'\\\\').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t');}
export function unescapeScenarioText(text:string):string{
 let result='';
 for(let i=0;i<text.length;i++){
  if(text[i]!=='\\'){result+=text[i];continue;}
  const next=text[++i],escape=next===undefined?undefined:({'\\':'\\',r:'\r',n:'\n',t:'\t'} as Record<string,string>)[next];
  if(escape===undefined)throw Error('Échappement inconnu : utilisez \\r, \\n, \\t ou \\\\.');result+=escape;
 }
 return result;
}
export function scenarioForForm(s:ProjectScenario):ProjectScenario{return {...s,inputs:s.inputs.map(i=>({...i,text:escapeScenarioText(i.text)})),checks:s.checks.map(c=>c.kind==='file'?{...c,text:escapeScenarioText(c.text)}:{...c})};}
export function scenariosFromForm(scenarios:ProjectScenario[]):ProjectScenario[]{return parseProjectTests({schemaVersion:1,scenarios:scenarios.map(s=>({...s,inputs:s.inputs.map(i=>({...i,text:unescapeScenarioText(i.text)})),checks:s.checks.map(c=>c.kind==='file'?{...c,text:unescapeScenarioText(c.text)}:c)}))}).scenarios;}
