import { analyze, tokenize } from './language.ts';
import { validateListing } from './rename-variable.ts';

export const COMMENT_LIMITS = Object.freeze({characters:96, maxLines:2000});
export interface BasicCommentPlan {
 before:string; after:string; comment:string; basicLine:number; beforeBasicLine:number;
 physicalLine:number; warnings:string[]; method:'insert-numbered-rem-v1';
}
const OPAQUE=new Set(['RUN','CHAIN','MERGE','RESUME','ERL','ON','AFTER','EVERY','ERROR','AUTO','DELETE','RENUM','EDIT','NEW','LOAD','CALL','POKE','PEEK','MEMORY','HIMEM','CLEAR','FRE']);
/** A narrow insertion profile: original BASIC lines must be byte-for-byte identical. */
export function planBasicCommentInsert(source:string,beforeBasicLine:number,comment:string):BasicCommentPlan {
 if(source.includes('\r'))throw Error('Insertion REM refusée : fins de ligne CRLF à normaliser avant la mission.');
 if(typeof comment!=='string'||comment.length<3||comment.length>COMMENT_LIMITS.characters||comment.trim()!==comment||
   !/^[A-Za-z0-9][A-Za-z0-9 ,.;()/_!?+\-=]*$/.test(comment))throw Error('Commentaire REM invalide : 3 à 96 caractères ASCII simples, sans retour ligne, accent, guillemet ni deux-points.');
 if(!Number.isInteger(beforeBasicLine)||beforeBasicLine<1||beforeBasicLine>65535)throw Error('Numéro BASIC cible invalide.');
 validateListing(source);
 const raw=source.split('\n'),lines=raw.filter(line=>line.trim());
 if(lines.length>COMMENT_LIMITS.maxLines)throw Error('Insertion limitée à 2000 lignes BASIC.');
 if(!lines.length)throw Error('Source BASIC vide : aucune ligne où insérer un commentaire.');
 const numbers:number[]=[],positions:number[]=[];
 for(let i=0;i<raw.length;i++){
  if(!raw[i]!.trim())continue;
  const match=/^(\d+)(?=\s|[A-Za-z?'&]|$)/.exec(raw[i]!);
  if(!match)throw Error('Listing partiellement numéroté : insertion de commentaire refusée.');
  numbers.push(Number(match[1]));positions.push(i);
  const tokens=tokenize(raw[i]!);
  if(tokens.some(token=>token.kind==='string'&&(token.text.length<2||!token.text.endsWith('"'))))throw Error('Insertion REM refusée : chaîne BASIC non terminée.');
  if(tokens.some(token=>token.kind==='operator'&&['|','@'].includes(token.text)||
    token.kind==='keyword'&&OPAQUE.has(token.text.toUpperCase()) ||
    token.kind==='identifier'&&/^FN/i.test(token.text) && /^(?:FN)(?:RUN|GOTO)/i.test(token.text)))throw Error('Contrôle du flux ou de la machine non qualifié : commentaires refusés dans ce programme.');
  // Computed branches can hit an inserted previously missing line.
  for(let j=0;j<tokens.length;j++){
   const token=tokens[j]!;
   if(token.kind!=='keyword'||!['GOTO','GOSUB','RESTORE'].includes(token.text.toUpperCase()))continue;
   const next=tokens[j+1];
   if(!next||next.kind!=='number'||!/^\d+$/.test(next.text))throw Error('Cible de branchement calculée ou RESTORE implicite : insertion refusée.');
  }
 }
 const index=numbers.indexOf(beforeBasicLine);
 if(index<1)throw Error('Choisir une ligne existante après la première ligne : le point d’entrée RUN ne doit pas changer.');
 const preceding=numbers[index-1]!;
 if(beforeBasicLine-preceding<2)throw Error('Aucun numéro BASIC disponible avant cette ligne sans renumérotation. Insertion refusée.');
 const inserted=beforeBasicLine-1;
 const diagnostic=analyze(source);
 if(diagnostic.diagnostics.some(item=>item.severity==='error'))throw Error('Diagnostics BASIC présents : insertion refusée tant que le listing n’est pas corrigé.');
 if(diagnostic.references.some(item=>item.number===inserted))throw Error('Le numéro libre est déjà cité par un saut : insertion refusée.');
 const physical=positions[index]!;
 const line=inserted+' REM '+comment;
 if(line.length>255)throw Error('Longueur du commentaire incompatible avec le budget BASIC.');
 const output=[...raw];output.splice(physical,0,line);
 const after=output.join('\n');
 validateListing(after);
 if(after.split('\n').filter(x=>x.trim()).length!==lines.length+1||
   lines.some((original,i)=>after.split('\n').filter(x=>x.trim())[i+(i>=index?1:0)]!==original))throw Error('Conservation des lignes BASIC originales non vérifiée.');
 return {before:source,after,comment,basicLine:inserted,beforeBasicLine,physicalLine:physical+1,
  warnings:[
   'Le texte du commentaire provient de l’agent : sa pertinence métier exige une revue humaine.',
   'Aucun numéro BASIC existant ni aucune ligne d’instruction n’est modifié ; ajout d’une ligne REM indépendante.',
   'Le programme occupe davantage de mémoire, et son timing peut être affecté. Exécuter la suite CPC et reconstruire le DSK.',
   'Flux dynamiques, modifications mémoire et points d’entrée inhabituels refusés : pas de garantie universelle.'
  ],method:'insert-numbered-rem-v1'};
}
