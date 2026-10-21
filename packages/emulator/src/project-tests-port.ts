import type {ProjectScenario,ProjectTestLibrary,ProjectTestReport} from './project-tests.ts';
import type {ProjectCapturePlan,ProjectScreenPreview,ScreenRegion} from './project-screen-reference.ts';
export interface ProjectTestsSnapshot {
 library:ProjectTestLibrary;
 projectSha256:string;
 reports:ProjectTestReport[];
 historyError?:string;
}
export interface ProjectTestJob {id:string;running:boolean;kind?:'test'|'capture';preview?:ProjectScreenPreview;report?:ProjectTestReport;archiveError?:string;error?:string}
type Failure={error:string};
type Buffers={id:string;source:string}[];
/** Human desktop actions. The agent receives only the separate read/run port. */
export interface ProjectTestsPort {
 inspect(sessionId:string,buffers:Buffers):Promise<ProjectTestsSnapshot|Failure>;
 save(sessionId:string,revision:string|null,scenarios:ProjectScenario[]):Promise<ProjectTestLibrary|Failure>;
 start(sessionId:string,buffers:Buffers,scenarioId:string,revision:string,projectSha256:string):Promise<{id:string}|Failure>;
 capture(sessionId:string,buffers:Buffers,plan:ProjectCapturePlan,revision:string|null,projectSha256:string):Promise<{id:string}|Failure>;
 adopt(sessionId:string,buffers:Buffers,id:string,plan:ProjectCapturePlan,revision:string|null,region:ScreenRegion):Promise<Extract<import('./project-tests.ts').ProjectCheck,{kind:'screen'}>|Failure>;
 export(sessionId:string,reportId:string):Promise<{name:string}|Failure|null>;
 status(sessionId:string,id:string):Promise<ProjectTestJob|Failure>;
 cancel(sessionId:string,id:string):Promise<{stopped:boolean}|Failure>;
}
