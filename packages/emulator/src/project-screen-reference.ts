import {parseProjectScenario,type ProjectScenario,type ProjectTestIdentity,type TestHash} from './project-tests.ts';
import {BASIC_TEST_FIRMWARE} from './basic-test-runtime.ts';

export const PROJECT_SCREEN={width:768,height:272,maxPixels:16384} as const;
export type ProjectCapturePlan=Pick<ProjectScenario,'id'|'name'|'seconds'|'inputs'>;
export interface ScreenRegion {name:string;x:number;y:number;width:number;height:number}
export interface ProjectScreenFrame {width:768;height:272;rgba:Uint8Array;diskSha256:string;firmware:Record<'os'|'basic'|'amsdos',string>;emulatedSeconds:number}
export interface ProjectScreenPreview extends ProjectScreenFrame {id:string;createdAt:string;plan:ProjectCapturePlan;libraryRevision:string|null;project:ProjectTestIdentity}
export type ProjectScreenRunner=(image:import('./project-tests.ts').ProjectTestImage,plan:ProjectCapturePlan,signal:AbortSignal)=>Promise<ProjectScreenFrame>;

// Reuse the qualified keyboard/budget grammar without requiring an existing screen expectation.
// This synthetic check is validation-only: never run, saved or presented as a result.
export function parseProjectCapturePlan(value:unknown):ProjectCapturePlan {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='id,inputs,name,seconds')throw Error('Plan de capture invalide.');
 const {checks:_checks,...plan}=parseProjectScenario({...value,checks:[{kind:'screen',name:'capture',x:0,y:0,width:1,height:1,sha256:'0'.repeat(64)}]});
 return plan;
}
export function parseScreenRegion(value:unknown):ScreenRegion {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='height,name,width,x,y')throw Error('Zone de référence invalide.');
 const check=parseProjectScenario({id:'capture',name:'Capture',seconds:1,inputs:[],checks:[{...value,kind:'screen',sha256:'0'.repeat(64)}]}).checks[0]!;
 if(check.kind!=='screen')throw Error('Zone écran requise.');
 const {kind:_kind,sha256:_sha,...region}=check;return region;
}
export function screenRegionPixels(rgba:Uint8Array,region:ScreenRegion):Uint8Array {
 const valid=parseScreenRegion(region);
 if(!(rgba instanceof Uint8Array)||rgba.length!==PROJECT_SCREEN.width*PROJECT_SCREEN.height*4)throw Error('Capture RGBA incomplète.');
 const result=new Uint8Array(valid.width*valid.height*4);
 for(let y=0;y<valid.height;y++){
  const start=((valid.y+y)*PROJECT_SCREEN.width+valid.x)*4;
  result.set(rgba.subarray(start,start+valid.width*4),y*valid.width*4);
 }
 return result;
}
export function screenReference(frame:ProjectScreenFrame,region:ScreenRegion,hash:TestHash){
 return {...parseScreenRegion(region),kind:'screen' as const,sha256:hash(screenRegionPixels(frame.rgba,region))};
}
export function validateProjectScreenFrame(frame:ProjectScreenFrame,diskSha256:string,seconds:number):void {
 if(!frame||frame.width!==768||frame.height!==272||!(frame.rgba instanceof Uint8Array)||frame.rgba.length!==768*272*4||frame.diskSha256!==diskSha256||!Number.isFinite(frame.emulatedSeconds)||frame.emulatedSeconds<seconds+5||frame.emulatedSeconds>30||!frame.firmware||Object.entries(BASIC_TEST_FIRMWARE).some(([key,value])=>frame.firmware[key as keyof typeof BASIC_TEST_FIRMWARE]!==value))throw Error('Capture CPC invalide ou provenance incohérente.');
 for(let i=3;i<frame.rgba.length;i+=4)if(frame.rgba[i]!==255)throw Error('Capture CPC RGBA opaque requise.');
}
