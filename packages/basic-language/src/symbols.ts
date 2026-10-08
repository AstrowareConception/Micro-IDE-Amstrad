import { tokenize, type Token } from './language.ts';

export const SYMBOL_LIMITS = Object.freeze({ sources: 100, totalCharacters: 4_194_304, characters: 1_048_576, lines: 10_000, lineCharacters: 8192, tokens: 2048, symbols: 4096, occurrences: 20_000, totalOccurrences: 50_000, reasons: 100 });
export type SymbolRole = 'read' | 'write' | 'read-write' | 'dimension' | 'erase';
export interface SymbolOccurrence { line: number; basicLine: number; start: number; end: number; role: SymbolRole }
export interface BasicSymbol { key: string; name: string; kind: 'scalar' | 'array'; suffix: '' | '$' | '%' | '!'; occurrences: SymbolOccurrence[] }
export interface SymbolSource { id: string; name: string; source: string }
export interface SymbolIndex { id: string; name: string; status: 'indexed' | 'partial' | 'limited'; symbols: BasicSymbol[]; inspectedOccurrences: number; skippedStatements: number; reasons: string[]; omittedReasons: number }
export interface SymbolReport { version: 1; method: string; sources: SymbolIndex[] }
export const SYMBOL_ROLE_LABELS: Record<SymbolRole, string> = { read: 'Lecture', write: 'Écriture', 'read-write': 'Lecture/écriture', dimension: 'Dimensionnement', erase: 'Suppression' };
export const SYMBOL_METHOD = 'Index textuel des variables et tableaux, séparé pour chaque source. La casse est ignorée ; les suffixes $, % et ! sont conservés. Un nom sans suffixe reste de type non résolu : A et A! ne sont pas fusionnés, même s’ils peuvent désigner la même variable à l’exécution. Les indices d’un tableau sont des lectures distinctes de son accès. Les rôles décrivent la syntaxe, pas les chemins réellement exécutés ni une preuve de définition ou d’initialisation. Chaînes, DATA et commentaires sont exclus. DEF FN/appels FN, RSX, CALL, adresses, MID$ en écriture et commandes non couvertes sont signalés comme omis. DEFINT/DEFREAL/DEFSTR ne résolvent pas les types. Aucun renommage ou modification du code. Les exports contiennent les noms des symboles et des sources, mais pas les lignes de code ni leurs valeurs.';
const upper = (token: Token | undefined) => token?.text.toUpperCase() ?? '';
const readCommands = new Set('PRINT WRITE IF WHILE ON AFTER EVERY MODE MEMORY ERROR BORDER INK LOCATE MOVE MOVER DRAW DRAWR PLOT PLOTR POKE OUT ORIGIN SOUND WAIT KEY OPENIN OPENOUT RANDOMIZE FILL WIDTH ZONE RELEASE SYMBOL SPEED'.split(' '));
const emptyCommands = new Set('END STOP RETURN WEND TRON TROFF FRAME DI EI DEG RAD NEW CAT CONT CLOSEIN CLOSEOUT CLEAR GOTO GOSUB RESTORE RUN RESUME'.split(' '));
function split(items: Token[], separators: Set<string>): Token[][] {
 const groups: Token[][] = [[]]; let depth = 0;
 for (const token of items) {
  if (token.text === '(') depth++; else if (token.text === ')') depth--;
  if (depth === 0 && separators.has(upper(token))) groups.push([]); else groups.at(-1)!.push(token);
 }
 return groups;
}
function target(items: Token[]): { token: Token; array: boolean; indices: Token[] } | null {
 if (items[0]?.kind !== 'identifier') return null;
 if (items.length === 1) return { token: items[0], array: false, indices: [] };
 if (items[1]?.text !== '(' || items.at(-1)?.text !== ')' || items.length < 4) return null;
 let depth = 0;
 for (let i=1;i<items.length;i++) { if(items[i]!.text==='(') depth++; else if(items[i]!.text===')') depth--; if(depth===0 && i<items.length-1) return null; }
 return { token: items[0], array: true, indices: items.slice(2,-1) };
}
export function indexSymbols(input: SymbolSource, occurrenceBudget: number = SYMBOL_LIMITS.occurrences): SymbolIndex {
 const result: SymbolIndex = { id: input.id, name: input.name, status: 'indexed', symbols: [], inspectedOccurrences: 0, skippedStatements: 0, reasons: [], omittedReasons: 0 };
 const isLimited=()=>result.status==='limited';
 const symbols = new Map<string, BasicSymbol>(), reasons = new Set<string>();
 const budget = Math.max(0,Math.min(SYMBOL_LIMITS.occurrences,Math.floor(occurrenceBudget)||0));
 function reason(text: string, limited = false) { if(limited) result.status='limited'; else if(!isLimited()) result.status='partial'; if(reasons.has(text)) return; reasons.add(text); if(result.reasons.length<SYMBOL_LIMITS.reasons) result.reasons.push(text); else result.omittedReasons++; }
 if (input.source.length > SYMBOL_LIMITS.characters) { reason('Source supérieure à 1 Mio de caractères : index retiré.',true);return result; }
 const lines=input.source.split('\n');if(lines.length>SYMBOL_LIMITS.lines) { reason('Plus de 10 000 lignes : index retiré.',true);return result; }
 let previous=0;
 for (let line=1;line<=lines.length && !isLimited();line++) {
  const text=lines[line-1]!;if(!text.trim()) continue;
  const prefix=/^\s*(\d+)(?=\s|[a-zA-Z?'&]|$)/.exec(text), basicLine=Number(prefix?.[1]);
  const omit=(message:string) => { result.skippedStatements++;reason(`L${line} : ${message}`); };
  if(!prefix || basicLine<1 || basicLine>65535 || basicLine<=previous) { omit('numérotation BASIC absente, invalide ou non croissante.');continue; } previous=basicLine;
  if(text.length>SYMBOL_LIMITS.lineCharacters) { omit('ligne supérieure à 8192 caractères.');continue; }
  const tokens=tokenize(text,SYMBOL_LIMITS.tokens+1);if(tokens.length>SYMBOL_LIMITS.tokens) { omit('plus de 2048 tokens sur cette ligne.');continue; }
  const comment=tokens.findIndex(t=>t.kind==='comment');
  const code=(comment<0?tokens:tokens.slice(0,comment)).filter(t=>t.start>=prefix[0].length);
  function add(token:Token,array:boolean,role:SymbolRole) {
   if(isLimited())return;
   const name=token.text.toUpperCase(), suffix=(/[$%!]/.test(name.at(-1)!)?name.at(-1)!:'') as BasicSymbol['suffix'];
   const key=`${array?'array':'scalar'}:${name}`;
   let symbol=symbols.get(key);
   if(result.inspectedOccurrences>=budget || !symbol && symbols.size>=SYMBOL_LIMITS.symbols) { reason(`Budget atteint (${budget} occurrences ou 4096 symboles) : index de cette source retiré.`,true);return; }
   if(!symbol) { symbol={key,name,kind:array?'array':'scalar',suffix,occurrences:[]};symbols.set(key,symbol); }
   symbol.occurrences.push({line,basicLine,start:token.start,end:token.end,role});result.inspectedOccurrences++;
  }
  function reads(items:Token[]) { items.forEach((token,i)=>{ if(token.kind==='identifier')add(token,items[i+1]?.text==='(','read'); }); }
  const statements=split(code,new Set([':', 'THEN', 'ELSE']));
  for(const items of statements) {
   if(!items.length || isLimited())continue;
   const command=upper(items[0]), args=items.slice(1);
   const skip=(message:string)=>omit(message);
   if(command==='DATA')continue;
   let depth=0, invalid=false;
   for(const token of items) { if(token.text==='(')depth++;else if(token.text===')')depth--;if(depth<0 || depth>64)invalid=true; }
   if(depth || invalid || items.some(t=>t.kind==='string' && (t.text.length<2 || !t.text.endsWith('"')))) { skip('parenthèses ou chaîne non fermées : segment omis.');continue; }
   if(items.some(t=>t.text==='@' || upper(t)==='FN' || t.kind==='identifier' && /^FN/i.test(t.text))) { skip('FN ou adresse : portée/effets non qualifiés, segment omis.');continue; }
   if(items.some(t=>t.kind==='identifier' && t.text.replace(/[$%!]$/,'').length>40)) { skip('identifiant supérieur à 40 caractères : segment omis.');continue; }
   if(['DEFINT','DEFREAL','DEFSTR','DEF'].includes(command)) { skip('déclaration de type ou fonction : résolution sémantique non réalisée.');continue; }
   const assignment=command==='LET'?args:items;
   if(assignment[0]?.kind==='identifier') {
    let nesting=0;const equals=assignment.findIndex(t=>{if(t.text==='(')nesting++;else if(t.text===')')nesting--;return !nesting && t.text==='=';});
    const left=equals>0?target(assignment.slice(0,equals)):null;
    if(!left || equals===assignment.length-1) { skip('affectation ou commande non reconnue.');continue; }
    add(left.token,left.array,'write');reads(left.indices);reads(assignment.slice(equals+1));continue;
   }
   if(command==='FOR') {
    if(args[0]?.kind!=='identifier' || args[1]?.text!=='=' || !args.some(t=>upper(t)==='TO')) { skip('FOR non reconnu.');continue; }
    add(args[0],false,'write');reads(args.slice(2));continue;
   }
   if(['DIM','READ','NEXT','ERASE','INPUT','LINE'].includes(command)) {
    let list=args;
    if(command==='LINE') { if(upper(list[0])!=='INPUT') { skip('commande LINE non reconnue.');continue; } list=list.slice(1); }
    if(command==='INPUT' || command==='LINE') {
     if(list[0]?.text===';')list=list.slice(1);
     if(list[0]?.kind==='string' && [';',','].includes(list[1]?.text ?? ''))list=list.slice(2);
     if(list.some(t=>t.text==='#')) { skip('INPUT avec flux : segment omis.');continue; }
    }
    if(command==='NEXT' && !list.length)continue;
    const targets=split(list,new Set([','])).map(target);
    if(!targets.length || targets.some(t=>!t || command==='DIM' && !t.array || ['NEXT','ERASE'].includes(command) && t.array)) { skip(`${command} : liste de cibles non reconnue.`);continue; }
    for(const t of targets) { add(t!.token,command==='ERASE'||t!.array,command==='DIM'?'dimension':command==='ERASE'?'erase':command==='NEXT'?'read-write':'write');reads(t!.indices); }continue;
   }
   if(readCommands.has(command)) { reads(args);continue; }
   if(emptyCommands.has(command) && !args.some(t=>t.kind==='identifier') || items.length===1 && items[0]!.kind==='number')continue;
   skip('commande hors du périmètre des usages : segment omis.');
  }
 }
 if(!isLimited()) result.symbols=[...symbols.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.kind.localeCompare(b.kind));
 return result;
}
export function analyzeSymbols(inputs:SymbolSource[]):SymbolReport {
 if(inputs.length>SYMBOL_LIMITS.sources || inputs.reduce((n,s)=>n+s.source.length,0)>SYMBOL_LIMITS.totalCharacters) throw new Error('Index limité à 100 sources et 4 Mio de caractères au total. Choisissez la source active.');
 let remaining=SYMBOL_LIMITS.totalOccurrences;
 return {version:1,method:SYMBOL_METHOD,sources:inputs.map(input=>{const result=indexSymbols(input,remaining);remaining-=result.inspectedOccurrences;return result;})};
}
export function symbolsMarkdown(report:SymbolReport):string {
 const escape=(text:string)=>text.replace(/[\\`*_[\]<>#|]/g,'\\$&').replace(/[\r\n]/g,' ');
 const lines=['# Symboles et usages BASIC','',report.method,''];
 for(const source of report.sources) {
  lines.push(`## ${escape(source.name)}`, '', `État : ${source.status} ; ${source.symbols.length} symboles ; ${source.skippedStatements} segments omis.`, ...source.reasons.map(r=>`- ${r}`));
  if(source.omittedReasons)lines.push(`- ${source.omittedReasons} autres limites omises.`);
  for(const symbol of source.symbols) { lines.push('',`### ${escape(symbol.name)} · ${symbol.kind==='array'?'tableau':'scalaire'}`); for(const use of symbol.occurrences)lines.push(`- ${SYMBOL_ROLE_LABELS[use.role]} · BASIC ${use.basicLine} · L${use.line} · C${use.start+1}–${use.end+1}`); }
 }
 return lines.join('\n')+'\n';
}
