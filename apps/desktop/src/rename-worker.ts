import { inspectVariableRename, planVariableRename, type RenamePosition } from '../../../packages/basic-language/src/rename-variable.ts';
self.onmessage=(event:MessageEvent<{id:number;source:string;position:RenamePosition;newStem?:string}>)=>{
 const {id,source,position,newStem}=event.data;
 try{self.postMessage(newStem===undefined?{id,target:inspectVariableRename(source,position)}:{id,plan:planVariableRename(source,position,newStem)});}
 catch(error){self.postMessage({id,error:error instanceof Error?error.message:'Renommage indisponible.'});}
};
