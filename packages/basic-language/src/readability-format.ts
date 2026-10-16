import { tokenize } from './language.ts';
import { validateListing } from './rename-variable.ts';

export const FORMAT_METHOD = 'Mise en forme explicite et conservatrice : alignement de l’espace après les numéros, réduction des espaces horizontaux et séparation visuelle des deux-points, seulement sur les lignes lexicalement simples. Aucun commentaire, chaîne, DATA, branche ou FN n’est réécrit. Le comportement, la mémoire et la temporisation ne sont pas déclarés équivalents sur tout CPC.';
export interface BasicFormatEdit { line:number; basicLine:number; before:string; after:string }
export interface BasicFormatPlan {
 before:string; after:string; edits:BasicFormatEdit[]; skipped:number; inspected:number;
 method:string; warnings:string[];
}
const UNSAFE = new Set(['IF','THEN','ELSE','ON','DEF','FN','DEFINT','DEFSTR','DEFREAL','REM','DATA','CALL','CHAIN','RUN','GOTO','GOSUB','RETURN','AFTER','EVERY','WHILE','WEND','FOR','NEXT','READ','RESTORE','PRINT','INPUT','LINE','OPENIN','OPENOUT','CLOSEIN','CLOSEOUT']);
const signature=(line:string)=>JSON.stringify(tokenize(line).map(token=>[token.kind,token.text]));

/** This is not a BASIC optimizer. Never infer semantics from a tolerant lexer. */
export function planBasicReadabilityFormat(source:string):BasicFormatPlan {
 if(source.includes('\r'))throw Error('Formatage agent refusé : fins de ligne CRLF non prises en charge dans ce profil de sauvegarde.');
 validateListing(source);
 if(source.split('\n').some(line=>tokenize(line).some(token=>token.kind==='string' && (token.text.length<2||!token.text.endsWith('"')))))throw Error('Formatage refusé : chaîne non terminée, vérification manuelle nécessaire.');
 const lines=source.split('\n'),edits:BasicFormatEdit[]=[];
 let skipped=0,inspected=0;
 for(let i=0;i<lines.length;i++){
  const line=lines[i]!;
  if(!line.trim())continue;
  inspected++;
  const numbered=/^(\d+)([ \t]+)(.*)$/.exec(line);
  if(!numbered){skipped++;continue;}
  const tokens=tokenize(line);
  if(tokens.some(token=>['string','comment','data'].includes(token.kind) ||
    token.kind==='keyword' && UNSAFE.has(token.text.toUpperCase()) ||
    token.kind==='identifier' && /^FN/i.test(token.text))){skipped++;continue;}
  const body=numbered[3]!;
  if(!body.trim()){skipped++;continue;}
  const compact=body.replace(/[ \t]*:[ \t]*/g,' : ').replace(/[ \t]{2,}/g,' ').trimEnd();
  const after=numbered[1]+' '+compact;
  if(after===line)continue;
  if(after.length>255 || signature(line)!==signature(after)){skipped++;continue;}
  edits.push({line:i+1,basicLine:Number(numbered[1]),before:line,after});
  lines[i]=after;
 }
 const after=lines.join('\n');
 if(edits.length)validateListing(after);
 return {before:source,after,edits,skipped,inspected,method:FORMAT_METHOD,warnings:[
  'Le formateur ne change ni numérotation, ni chaînes, ni DATA, ni commentaires, ni structures de contrôle détectées.',
  'Les lignes opaques et les formes sensibles restent intactes ; le nombre de lignes ignorées est explicite.',
  'Conservation lexicale des tokens vérifiée sur chaque ligne modifiée ; ce test ne démontre pas une équivalence ROM, mémoire ou timing.',
  'Reconstruction DSK et essais CPC sur les vraies sources modifiées restent nécessaires.'
 ]};
}
