import { analyzeControlFlow, FLOW_LIMITS, FLOW_METHOD, FLOW_RETURN_LABELS, type FlowReport } from './control-flow.ts';
import { tokenize, type Token } from './language.ts';

export const QUALITY_LIMITS = Object.freeze({ sources: 100, totalCharacters: 4_194_304, characters: 1_048_576, lines: 10_000, lineCharacters: 8192, tokens: 2048, findings: 500 });
export const QUALITY_THRESHOLDS = Object.freeze({ lineLength: 120, statementsPerLine: 4, ifsPerLine: 2, duplicateTokens: 12 });
export interface QualitySource { id: string; name: string; source: string }
export interface QualityLocation { line: number; basicLine: number; start: number; end: number }
export interface QualityFinding extends QualityLocation {
 code: 'long-line' | 'dense-line' | 'conditional-density' | 'duplicate-block' | 'unreachable-tail' | 'unreachable-flow';
 message: string; suggestion: string; confidence: 'observation' | 'heuristic'; related: QualityLocation[];
}
export interface QualityMetrics {
 characters: number; physicalLines: number; inspectedLines: number; codeLines: number; commentLines: number; blankLines: number;
 statements: number; maxLineLength: number; averageCodeLineLength: number; ifs: number; fors: number; whiles: number;
 selectorBranches: number; gotos: number; gosubs: number; estimatedCyclomatic: number;
}
export interface SourceQuality {
 id: string; name: string; metrics: QualityMetrics | null; findings: QualityFinding[]; flow: FlowReport;
 coverage: { limited: boolean; skippedLines: number; omittedFindings: number; reasons: string[] };
}
export interface QualityReport { version: 2; method: string; thresholds: typeof QUALITY_THRESHOLDS; sources: SourceQuality[] }
export const QUALITY_METHOD = 'Longueurs du texte source en unités UTF-16 ; segments séparés par deux-points hors chaînes, REM et DATA. Estimation lexicale par listing : 1 + IF + FOR + WHILE + cibles des ON sélecteurs. Ce comptage lexical reste distinct de l’analyse de flux par point d’entrée. AND/OR, GOTO simples et gestionnaires d’événements ne sont pas des décisions ajoutées. CALL/RSX, événements, erreurs, RUN/CHAIN, sauts calculés et syntaxe invalide peuvent changer les chemins réels. Les remarques sont des pistes de revue, pas des erreurs ni des corrections automatiques.';

const upper = (token: Token | undefined) => token?.text.toUpperCase();
const canonical = (tokens: Token[]) => JSON.stringify(tokens.map(t => [t.kind, t.kind === 'string' ? t.text : t.text.toUpperCase()]));
const segments = (tokens: Token[]) => {
 const result: Token[][] = [[]];
 for (const token of tokens) { if (token.text === ':' && token.kind === 'operator') result.push([]); else result.at(-1)!.push(token); }
 return result.filter(part => part.length);
};
function inspectSource(input: QualitySource, flow: FlowReport): SourceQuality {
 const coverage: SourceQuality['coverage'] = { limited: false, skippedLines: 0, omittedFindings: 0, reasons: [] };
 const result: SourceQuality = { id: input.id, name: input.name, metrics: null, findings: [], coverage, flow };
 const reason = (text: string) => { if (!coverage.reasons.includes(text)) coverage.reasons.push(text); };
 if (input.source.length > QUALITY_LIMITS.characters) { coverage.limited = true; reason('Source supérieure à 1 Mio de caractères : non analysée.'); return result; }
 const lines = input.source ? input.source.split('\n') : [];
 if (lines.at(-1) === '') lines.pop();
 const m: QualityMetrics = { characters: input.source.length, physicalLines: lines.length, inspectedLines: 0, codeLines: 0, commentLines: 0, blankLines: 0, statements: 0, maxLineLength: 0, averageCodeLineLength: 0, ifs: 0, fors: 0, whiles: 0, selectorBranches: 0, gotos: 0, gosubs: 0, estimatedCyclomatic: 0 };
 result.metrics = m;
 let codeLength = 0, previousNumber = 0;
 let previous: { key: string; tokens: number; location: QualityLocation } | undefined;
 const blocks = new Map<string, { first: QualityLocation; finding: QualityFinding | undefined }>();
 const add = (location: QualityLocation, code: QualityFinding['code'], message: string, suggestion: string, confidence: QualityFinding['confidence'] = 'heuristic') => {
  if (result.findings.length >= QUALITY_LIMITS.findings) { coverage.omittedFindings++; coverage.limited = true; return undefined; }
  const finding: QualityFinding = { ...location, code, message, suggestion, confidence, related: [] }; result.findings.push(finding); return finding;
 };
 for (let index = 0; index < Math.min(lines.length, QUALITY_LIMITS.lines); index++) {
  const line = lines[index]!.replace(/\r$/, '');
  if (line.length > QUALITY_LIMITS.lineCharacters) { coverage.skippedLines++; previous = undefined; reason('Lignes de plus de 8192 caractères ignorées.'); continue; }
  const tokens = tokenize(line, QUALITY_LIMITS.tokens + 1);
  if (tokens.length > QUALITY_LIMITS.tokens) { coverage.skippedLines++; previous = undefined; reason('Lignes de plus de 2048 tokens ignorées.'); continue; }
  m.inspectedLines++; m.maxLineLength = Math.max(m.maxLineLength, line.length);
  if (!line.trim()) { m.blankLines++; previous = undefined; continue; }
  const prefix = /^\s*(\d+)(?=\s|[a-zA-Z?'&]|$)/.exec(line);
  const basicLine = Number(prefix?.[1]);
  if (!prefix || basicLine < 1 || basicLine > 65535 || basicLine <= previousNumber) {
   coverage.skippedLines++; previous = undefined; reason('Numérotation absente, invalide ou non croissante : lignes concernées ignorées.'); continue;
  }
  previousNumber = basicLine;
  const body = tokens.filter(token => token.start >= prefix[0].length);
  if (body[0]?.kind === 'comment') { m.commentLines++; previous = undefined; continue; }
  const code = body.filter(token => token.kind !== 'comment');
  if (!code.length) { previous = undefined; continue; }
  if (code.some(t => t.kind === 'string' && (t.text.length < 2 || !t.text.endsWith('"')))) {
   coverage.skippedLines++; previous = undefined; reason('Chaînes non terminées : lignes concernées ignorées.'); continue;
  }
  const parts = segments(code), location: QualityLocation = { line: index + 1, basicLine, start: code[0]!.start, end: code.at(-1)!.end };
  m.codeLines++; codeLength += line.length; m.statements += parts.length;
  const count = (name: string) => code.filter(t => t.kind === 'keyword' && upper(t) === name).length;
  const ifs = count('IF'); m.ifs += ifs; m.fors += count('FOR'); m.whiles += count('WHILE'); m.gotos += count('GOTO'); m.gosubs += count('GOSUB');
  for (const part of parts) {
   if (upper(part[0]) !== 'ON') { if (part.some(t => t.kind === 'keyword' && upper(t) === 'ON')) reason('ON dans une branche composée : contribution de complexité omise.'); continue; }
   if (['ERROR', 'BREAK', 'SQ'].includes(upper(part[1]) ?? '')) continue;
   const jump = part.findIndex(t => t.kind === 'keyword' && ['GOTO', 'GOSUB'].includes(upper(t)!));
   if (jump < 0) { reason('ON sélecteur non reconnu : contribution de complexité omise.'); continue; }
   const targets = part.slice(jump + 1);
   if (!targets.length || targets.some((t, i) => i % 2 === 0 ? t.kind !== 'number' || !/^\d+$/.test(t.text) : t.text !== ',') || targets.length % 2 === 0) {
    reason('Liste de cibles ON partielle ou calculée : contribution de complexité omise.'); continue;
   }
   // N targets plus the out-of-range fall-through outcome: N additional branches.
   m.selectorBranches += (targets.length + 1) / 2;
  }
  if (line.length > QUALITY_THRESHOLDS.lineLength) add(location, 'long-line', `${line.length} caractères sur une ligne (repère : ${QUALITY_THRESHOLDS.lineLength}).`, 'Envisager de répartir le code ; vérifier la portée de IF/THEN/ELSE avant de déplacer une instruction.', 'observation');
  if (parts.length > QUALITY_THRESHOLDS.statementsPerLine) add(location, 'dense-line', `${parts.length} segments d’instructions sur la même ligne.`, 'Séparer les responsabilités si la compacité n’est pas nécessaire ; préserver les branches conditionnelles.', 'observation');
  if (ifs > QUALITY_THRESHOLDS.ifsPerLine) add(location, 'conditional-density', `${ifs} IF sur la même ligne.`, 'Revoir la lisibilité des conditions et l’association des ELSE ; un GOSUB peut isoler une responsabilité.');
  // A deliberately small proof: literal unconditional GOTO or bare RETURN before a colon.
  // END/STOP can be continued; IF/ON bodies and event flow are excluded from this rule.
  if (!code.some(t => t.kind === 'keyword' && ['IF', 'ON', 'ELSE', 'THEN'].includes(upper(t)!))) {
   const transfer = parts.findIndex(part => upper(part[0]) === 'RETURN' && part.length === 1 || upper(part[0]) === 'GOTO' && part.length === 2 && part[1]!.kind === 'number' && /^\d+$/.test(part[1]!.text));
   const tail = parts[transfer + 1];
   if (transfer >= 0 && tail && !tail.some(t => upper(t) === 'DATA')) add({ ...location, start: tail[0]!.start }, 'unreachable-tail', 'Instructions après un transfert inconditionnel sur la même ligne.', 'Vérifier ce code dans le flux normal ; déplacer ou retirer seulement après revue des appels et événements.');
  }
  if (code.some(t => t.kind === 'data' || upper(t) === 'DATA')) { previous = undefined; continue; }
  const current = { key: canonical(code), tokens: code.length, location };
  if (previous && previous.tokens + current.tokens >= QUALITY_THRESHOLDS.duplicateTokens) {
   const key = previous.key + '\n' + current.key, existing = blocks.get(key);
   if (!existing) blocks.set(key, { first: previous.location, finding: undefined });
   else {
    if (!existing.finding) existing.finding = add(existing.first, 'duplicate-block', 'Bloc identique de deux lignes trouvé à plusieurs endroits.', 'Comparer les responsabilités ; envisager un GOSUB si l’extraction conserve les variables, les cibles et l’ordre des effets.');
    if (existing.finding && existing.finding.related.length < 20) existing.finding.related.push(previous.location);
    else { coverage.omittedFindings++; coverage.limited = true; }
   }
  }
  previous = current;
 }
 coverage.skippedLines += Math.max(0, lines.length - QUALITY_LIMITS.lines);
 if (lines.length > QUALITY_LIMITS.lines) reason('Analyse limitée aux 10000 premières lignes physiques.');
 coverage.limited ||= coverage.skippedLines > 0 || coverage.reasons.length > 0;
 m.averageCodeLineLength = m.codeLines ? Math.round(codeLength / m.codeLines * 10) / 10 : 0;
 m.estimatedCyclomatic = m.codeLines ? 1 + m.ifs + m.fors + m.whiles + m.selectorBranches : 0;
 for (const id of flow.unreachable) {
  const { line, basicLine, start, end } = flow.nodes[id]!;
  add({ line, basicLine, start, end }, 'unreachable-flow', 'Aucun chemin structurel depuis la première ligne du listing.', 'Examiner les sauts et les points d’entrée avant toute suppression. CONT, RUN avec une autre ligne et les accès READ aux DATA sont hors de cette conclusion.');
 }
 result.findings.sort((a, b) => a.line - b.line || a.start - b.start || a.code.localeCompare(b.code));
 return result;
}
export function analyzeQuality(sources: QualitySource[]): QualityReport {
 if (sources.length > QUALITY_LIMITS.sources || sources.reduce((sum, s) => sum + s.source.length, 0) > QUALITY_LIMITS.totalCharacters) throw new Error('Rapport limité à 100 sources et 4 Mio de caractères au total.');
 let nodeBudget = FLOW_LIMITS.totalNodes;
 const results = sources.map(source => { const flow = analyzeControlFlow(source.source, nodeBudget); nodeBudget -= flow.nodes.length; return inspectSource(source, flow); });
 return { version: 2, method: QUALITY_METHOD + ' ' + FLOW_METHOD, thresholds: QUALITY_THRESHOLDS, sources: results };
}
export function qualityMarkdown(report: QualityReport): string {
 const escape = (value: string) => value.replace(/[\\`*_{}[\]<>#|]/g, '\\$&').replace(/[\r\n]/g, ' ');
 const lines = ['# Rapport de qualité BASIC', '', report.method, '', `Repères : ligne > ${report.thresholds.lineLength} caractères ; > ${report.thresholds.statementsPerLine} segments ; > ${report.thresholds.ifsPerLine} IF par ligne ; duplication de deux lignes ≥ ${report.thresholds.duplicateTokens} tokens.`, ''];
 for (const source of report.sources) {
  lines.push(`## ${escape(source.name)}`, '');
  const m = source.metrics;
  if (m) lines.push(`Lignes physiques : ${m.physicalLines} ; inspectées : ${m.inspectedLines} ; code : ${m.codeLines} ; commentaires seuls : ${m.commentLines} ; vides : ${m.blankLines}.`, '', `Caractères : ${m.characters} ; longueur maximale inspectée : ${m.maxLineLength} ; moyenne des lignes de code : ${m.averageCodeLineLength} ; segments : ${m.statements}.`, '', `Complexité cyclomatique estimée : ${m.estimatedCyclomatic} (IF ${m.ifs}, FOR ${m.fors}, WHILE ${m.whiles}, branches ON ${m.selectorBranches}). GOTO ${m.gotos} ; GOSUB ${m.gosubs}.`, '');
  const flow = source.flow;
  lines.push(`### Flux structurel — ${flow.complete ? 'formes couvertes' : 'partiel'}`, '', `${flow.nodes.length} nœuds ; ${flow.edges.length} liaisons ; ${flow.entries.length} points d’entrée ; ${flow.cycles.length} cycles.`, '');
  for (const reason of flow.reasons) lines.push(`- Limite de flux : ${escape(reason)}`);
  if (flow.omittedReasons) lines.push(`- ${flow.omittedReasons} autres limites omises.`);
  for (const entry of flow.entries) lines.push(`- ${entry.kind === 'main' ? 'Programme principal' : 'Entrée GOSUB'} BASIC ${flow.nodes[entry.node]!.basicLine} : ${entry.nodes} instructions locales ; complexité ${entry.complexity ?? 'indisponible'}${entry.recursive ? ' ; appels récursifs' : ''} ; chemin vers RETURN : ${FLOW_RETURN_LABELS[entry.returnStatus]}.`);
  for (const call of flow.calls) lines.push(`- Appel : entrée BASIC ${flow.nodes[call.caller]!.basicLine} → BASIC ${flow.nodes[call.callee]!.basicLine}, site L${flow.nodes[call.site]!.line}/C${flow.nodes[call.site]!.start + 1}.`);
  for (const cycle of flow.cycles) lines.push(`- Cycle : ${cycle.nodes.map(id => `n${id}`).join(', ')} ; ${cycle.hasExit ? 'sortie structurelle présente' : 'sans sortie structurelle repérée'} ; ${cycle.reachable ? 'atteignable dans le graphe' : 'hors des chemins connus'}.`);
  lines.push('', 'Nœuds et liaisons (sans extraits de source) :', '');
  for (const node of flow.nodes) lines.push(`- n${node.id} · L${node.line}/C${node.start + 1} · BASIC ${node.basicLine} · ${node.operation}`);
  for (const edge of flow.edges) lines.push(`- n${edge.from} → ${edge.to === null ? (edge.kind === 'unknown' ? 'inconnu' : 'sortie') : `n${edge.to}`} · ${edge.kind}${edge.ordinal ? ` ${edge.ordinal}` : ''}`);
  lines.push('');
  if (source.coverage.limited) lines.push(`Rapport partiel : ${source.coverage.skippedLines} ligne(s) ignorée(s), ${source.coverage.omittedFindings} remarque(s)/occurrence(s) omise(s).`, '');
  for (const reason of source.coverage.reasons) lines.push(`- Couverture : ${escape(reason)}`);
  lines.push('');
  for (const f of source.findings) lines.push(`- L${f.line}, C${f.start + 1}–${f.end + 1}, BASIC ${f.basicLine} · ${f.code} · ${f.confidence === 'observation' ? 'observation' : 'piste de revue'} : ${escape(f.message)} ${escape(f.suggestion)}${f.related.length ? ` Autres occurrences : ${f.related.map(r => `L${r.line}/BASIC ${r.basicLine}`).join(', ')}.` : ''}`);
  if (!source.findings.length) lines.push('Aucune remarque produite par ces règles ; cela ne garantit pas la qualité du programme.');
  lines.push('');
 }
 return lines.join('\n');
}
