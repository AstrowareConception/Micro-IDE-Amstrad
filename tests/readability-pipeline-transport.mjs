// Controlled provider transcript, shared by Node and native Electron recipes.
// Self-contained so Electron can install it in the main process without imports.
export function createReadabilityTransport(_electron,install=false){
 let step=0;const model='gpt-5.6-luna';
 const transport=async(url,init)=>{
  if(String(url).endsWith('/models'))return Response.json({data:[{id:model,created:100,owned_by:'openai'}]});
  if(String(url).endsWith(`/${model}.md`))return new Response('Model ID: `gpt-5.6-luna`\n\n## Pricing\n\n| Input | $0.2 | 1M tokens |\n| Cached input | $0.02 | 1M tokens |\n| Output | $1.2 | 1M tokens |\n\n## Endpoints\n');
  if(!String(url).endsWith('/responses'))throw Error('Unexpected endpoint');
  const body=JSON.parse(init.body),call=(id,name,args)=>({type:'function_call',call_id:id,name,arguments:JSON.stringify(args)});
  const result=id=>{
   const item=body.input.find(x=>x.type==='function_call_output'&&x.call_id===id);
   if(!item)throw Error('Missing result '+id);
   const output=JSON.parse(item.output);if(output.error)throw Error(JSON.stringify(output));return output;
  };
  if(!body.input.some(x=>x.type==='function_call_output'))step=0; // A new mission starts a new transcript.
  const read=id=>call(id,'project_read_file',{id:'main',startLine:1,endLine:200});
  const preview=(kind,from,extra={})=>call(kind+'-preview','language_'+kind+'_preview',{id:'main',expectedHash:result(from).hash,...extra});
  const apply=(kind,from)=>call(kind+'-apply','language_'+kind+'_apply',{id:'main',expectedHash:result(from).hash,previewId:result(kind+'-preview').previewId});
  let output;
  switch(++step){
   case 1:output=[read('initial'),call('suites-before','basic_tests_list',{}),call('audit','language_readability_review',{id:'main'})];break;
   case 2:output=[call('refs','reference_read_many',{names:['MODE','CLS','PRINT','REM','GOTO','END','IF','FOR','NEXT','WHILE','WEND','CHAIN','MERGE']})];break;
   case 3:output=[preview('rename','initial',{line:3,column:5,newStem:'score'})];break;
   case 4:output=[apply('rename','initial')];break;
   case 5:output=[read('renamed')];break;
   case 6:output=[preview('format','renamed')];break;
   case 7:output=[apply('format','renamed')];break;
   case 8:output=[read('formatted')];break;
   case 9:output=[preview('comment','formatted',{beforeBasicLine:100,comment:'Suite du calcul puis affichage du score'})];break;
   case 10:output=[apply('comment','formatted')];break;
   case 11:output=[read('commented')];break;
   case 12:output=[call('extraction-preview','language_extraction_simulate',{id:'main',expectedHash:result('commented').hash,entryLine:100,newFileName:'PART'})];break;
   // The note precedes the final preview: documentation mutations invalidate plans too.
   case 13:output=[call('note','documents_create_note',{title:'Bilan lisibilite',category:'progress',source:'# Lisibilité\n\nRenommage s% → score%, espaces normalisés et REM ajouté. Découpage terminal prévu dans PART.BAS.\n\nAucune suite CPC enregistrée pour ces témoins. Construction DSK structurelle seulement ; aucun test CPC de projet multifichier dans cette mission. Le banc firmware externe doit comparer les vrais projets.\n'})];break;
   case 14:output=[call('final-preview','language_extraction_simulate',{id:'main',expectedHash:result('commented').hash,entryLine:100,newFileName:'PART'})];break;
   case 15:output=[call('extraction-apply','language_extraction_apply',{id:'main',expectedHash:result('commented').hash,previewId:result('final-preview').previewId})];break;
   case 16:output=[call('suites-after','basic_tests_list',{}),call('build','build_project',{})];break;
   default:
    result('extraction-apply');result('build');
    output=[{type:'message',content:[{type:'output_text',text:'Renommage, espaces, commentaire et découpage enregistrés ; note de préparation conservée. DSK construit. Aucune suite CPC disponible : comportement du projet multifichier non testé dans la mission.'}]}];
  }
  return Response.json({model,status:'completed',output,usage:{input_tokens:100,output_tokens:20,total_tokens:120}});
 };
 if(install)globalThis.fetch=transport;
 return transport;
}
