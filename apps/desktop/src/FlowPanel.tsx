import { ERROR_SITE_LABELS, ERROR_FLOW_METHOD, ERROR_FLOW_STATUS_LABELS, ERROR_TRANSFER_LABELS, type ErrorStackFrame } from '../../../packages/basic-language/src/error-flow.ts';
import { FLOW_EVENT_LABELS, FLOW_EVENT_ACTION_LABELS } from '../../../packages/basic-language/src/flow-events.ts';
import { useId, useMemo, useState } from 'react';
import { Button } from './Icon.tsx';
import { FLOW_METHOD, FLOW_RETURN_LABELS, type FlowEdge, type FlowNode, type FlowReport } from '../../../packages/basic-language/src/control-flow.ts';

const EDGE_LABELS: Record<FlowEdge['kind'], string> = { next: 'Suite', true: 'Vrai', false: 'Faux', jump: 'Saut', case: 'Cas', call: 'Appel', resume: 'Retour possible', loop: 'Boucle', exit: 'Fin / retour', unknown: 'Inconnu', handler: 'Déclaration', recovery: 'Reprise erreur' };
interface Props { name: string; report: FlowReport; stale: boolean; onReveal(node: FlowNode): void }
export function FlowPanel({ name, report, stale, onReveal }: Props) {
 const [expanded, setExpanded] = useState(false), [selected, setSelected] = useState<number | null>(report.entry), [query, setQuery] = useState('');
 const marker = `flow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
 const index = useMemo(() => new Map(report.nodes.map(node => [node.id, node])), [report]);
 const errorSites = useMemo(() => new Map(report.errorFlow.sites.map(site => [site.node, site.kind])), [report]);
 const sorted = useMemo(() => [...report.nodes].sort((a, b) => a.line - b.line || a.start - b.start || a.id - b.id), [report]);
 const current = index.get(selected ?? -1), label = (id: number | null) => id === null ? 'Sortie / inconnu' : `BASIC ${index.get(id)?.basicLine} · ${index.get(id)?.operation}`;
 const choices = useMemo(() => sorted.filter(node => `${node.basicLine} ${node.operation}`.toLowerCase().includes(query.toLowerCase())), [sorted, query]);
 const incoming = useMemo(() => report.edges.filter(edge => edge.to === selected), [report, selected]);
 const outgoing = useMemo(() => report.edges.filter(edge => edge.from === selected), [report, selected]);
 function controlStack(stack: ErrorStackFrame[]) {
  if (!stack.length) return <span className="muted"> · pile vide</span>;
  const calls = stack.filter(frame => frame.kind === 'call').length, loops = stack.length - calls;
  return <details className="flow-call-stack"><summary>Pile : {calls} appel(s){loops > 0 && ` · ${loops} boucle(s)`}</summary>
   <p className="muted">Appels et boucles, du plus ancien au plus récent ; état avant le transfert.</p>
   <ol>{stack.map((frame, position) => <li key={position}><Button disabled={stale} onClick={() => onReveal(index.get(frame.node)!)}>{frame.kind === 'call' ? 'Appel' : `Boucle ${frame.kind.toUpperCase()}`} {position + 1} · BASIC {index.get(frame.node)!.basicLine} · C{index.get(frame.node)!.start + 1}</Button></li>)}</ol>
  </details>;
 }
 function box(id: number | null, x: number, y: number, active = false, key = '') {
  const node = id === null ? undefined : index.get(id);
  const choose = () => { if (node) setSelected(node.id); };
  return <g key={key} className={`flow-node${active ? ' flow-node-active' : ''}`} role={node ? 'button' : undefined} tabIndex={node ? 0 : undefined} aria-label={node ? `Explorer BASIC ${node.basicLine}, ${node.operation}, colonne ${node.start + 1}` : undefined} onClick={choose} onKeyDown={event => { if (node && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(); } }}>
   <rect x={x} y={y} width="196" height="44" rx="7" />
   <text x={x + 10} y={y + 18}>{node ? `BASIC ${node.basicLine} · C${node.start + 1}` : 'Sortie / inconnu'}</text>
   <text x={x + 10} y={y + 34}>{node?.operation ?? 'Fin du chemin connu'}</text>
  </g>;
 }
 return <details className="flow-details" onToggle={event => setExpanded(event.currentTarget.open)}>
  <summary>Flux BASIC · {name} · {report.complete ? 'formes couvertes' : 'analyse partielle'}</summary>
  {expanded && <div className="flow-content">
   <p className="muted">{report.nodes.length} nœuds · {report.edges.length} liaisons · {report.entries.length} points d’entrée · {report.cycles.length} cycles · {report.complete ? `${report.unreachable.length} instruction(s) sans chemin depuis le début` : 'inaccessibilité et complexité non conclues'}</p>
   <details><summary>Lire les résultats avec leurs limites</summary><p>{FLOW_METHOD}</p></details>
   {report.reasons.length > 0 && <div className="warning"><p>Les formes suivantes empêchent une conclusion globale :</p><ul>{report.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>{report.omittedReasons > 0 && <p>{report.omittedReasons} autres limites non affichées.</p>}</div>}
   <div className="flow-routines"><table><caption>Points d’entrée · blocs potentiellement partagés, aucun total</caption><thead><tr><th>Entrée</th><th>Instructions locales</th><th>Complexité de flux</th><th>Appels récursifs</th><th>Chemin vers RETURN</th></tr></thead><tbody>{report.entries.map(entry => <tr key={entry.node}><td><Button disabled={stale} onClick={() => onReveal(index.get(entry.node)!)}>{entry.kind === 'main' ? 'Début' : entry.kind === 'handler' ? 'Gestionnaire' : 'GOSUB'} · BASIC {index.get(entry.node)!.basicLine}</Button></td><td>{entry.nodes}</td><td>{entry.complexity ?? 'Indisponible'}</td><td>{entry.recursive ? 'Cycle repéré' : 'Non repérés'}</td><td>{FLOW_RETURN_LABELS[entry.returnStatus]}</td></tr>)}</tbody></table></div>
   {current && <>
    <div className="flow-controls"><label>Filtrer les nœuds<input aria-label={`Filtrer les nœuds — ${name}`} placeholder="Numéro BASIC ou instruction" value={query} onChange={event => setQuery(event.target.value)} /></label>
     <label>Nœud à explorer<select aria-label={`Nœud à explorer — ${name}`} value={current.id} onChange={event => setSelected(Number(event.target.value))}>
      <option value={current.id}>{label(current.id)} · C{current.start + 1}</option>
      {choices.filter(n => n.id !== current.id).slice(0, 100).map(node => <option key={node.id} value={node.id}>{label(node.id)} · C{node.start + 1}</option>)}
     </select></label><Button disabled={stale} onClick={() => onReveal(current)}>Voir cette instruction dans le code</Button></div>
    <p className="muted">{choices.length} nœud(s) correspondent au filtre ; 100 choix maximum. Cliquez un nœud ou utilisez Entrée pour explorer son voisinage.</p>
    <div className="flow-diagram"><svg viewBox="0 0 840 350" role="group" aria-label={`Graphe de contrôle — ${name}`}>
     <title>Voisinage de {label(current.id)}</title><defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
     <text x="12" y="16" className="flow-column-label">PRÉDÉCESSEURS</text><text x="322" y="16" className="flow-column-label">INSTRUCTION SÉLECTIONNÉE</text><text x="632" y="16" className="flow-column-label">SUCCESSEURS</text>
     {incoming.slice(0, 5).map((edge, i) => <g key={`in-edge-${i}`}><path className="flow-link" strokeDasharray={edge.kind === 'handler' ? '5 4' : undefined} d={`M 208 ${56 + i * 60} L 318 174`} markerEnd={`url(#${marker})`} /><text className="flow-edge-label" x="216" y={48 + i * 60}>{EDGE_LABELS[edge.kind]}{edge.ordinal || ''}</text></g>)}
     {outgoing.slice(0, 5).map((edge, i) => <g key={`out-edge-${i}`}><path className="flow-link" strokeDasharray={edge.kind === 'handler' ? '5 4' : undefined} d={`M 518 174 L 628 ${56 + i * 60}`} markerEnd={`url(#${marker})`} /><text className="flow-edge-label" x="526" y={48 + i * 60}>{EDGE_LABELS[edge.kind]}{edge.ordinal || ''}</text></g>)}
     {incoming.slice(0, 5).map((edge, i) => box(edge.from, 12, 34 + i * 60, false, `in-${i}`))}
     {box(current.id, 322, 152, true, 'current')}
     {outgoing.slice(0, 5).map((edge, i) => box(edge.to, 632, 34 + i * 60, false, `out-${i}`))}
    </svg></div>
    <p className="muted">{incoming.length} liaison(s) entrante(s), {outgoing.length} sortante(s) ; cinq par côté affichées. « Retour possible » reste une hypothèse structurelle. Sans chemin vers RETURN dans la cible, la suite du GOSUB est retirée. Un retour indéterminé la conserve ; le graphe structurel ne suit pas la pile. Le modèle contextuel ci-dessous la suit dans son périmètre borné. Une liaison « Déclaration » en pointillés désigne un gestionnaire, sans saut immédiat ni preuve de déclenchement. Le graphe complet figure dans les exports.</p>
   </>}
   {report.errorFlow.status !== 'not-needed' && <details className="flow-error-contexts"><summary>Contextes d’erreur · {ERROR_FLOW_STATUS_LABELS[report.errorFlow.status]}</summary>
    <p>{ERROR_FLOW_METHOD}</p><p>{report.errorFlow.states} états explorés.{report.errorFlow.reason && ` ${report.errorFlow.reason}`}</p>
    {report.errorFlow.status === 'covered' && <>
     <h4>Origines couvertes par ce modèle</h4>
     <ul className="flow-error-sites">{report.errorFlow.sites.slice(0, 100).map(site => <li key={site.node}>
      {ERROR_SITE_LABELS[site.kind]}{site.operator && ` (${site.operator})`} · <Button disabled={stale} onClick={() => onReveal(index.get(site.node)!)}>Origine BASIC {index.get(site.node)!.basicLine} · C{index.get(site.node)!.start + 1}</Button>
     </li>)}</ul>{report.errorFlow.sites.length > 100 && <p>100 origines affichées ; suite dans les exports.</p>}
     <h4>Gestionnaires possibles avant les instructions suivies</h4>
     <ul className="flow-error-states">{report.errorFlow.contexts.slice(0, 100).map((context, i) => <li key={i}>
      <Button disabled={stale} onClick={() => onReveal(index.get(context.node)!)}>Instruction BASIC {index.get(context.node)!.basicLine} · C{index.get(context.node)!.start + 1}</Button>
      {context.handler === null ? ' · piège désactivé' : <> · <Button disabled={stale} onClick={() => onReveal(index.get(context.handler!)!)}>Gestionnaire possible BASIC {index.get(context.handler)!.basicLine}</Button></>}
      {context.fault === null ? ' · aucune erreur en traitement' : <> · <Button disabled={stale} onClick={() => onReveal(index.get(context.fault!)!)}>Instruction interrompue BASIC {index.get(context.fault)!.basicLine} · C{index.get(context.fault)!.start + 1}</Button></>}
      {controlStack(context.stack)}
     </li>)}</ul>{report.errorFlow.contexts.length > 100 && <p>100 contextes affichés ; suite dans les exports.</p>}
     <h4>Déclenchements et reprises dans ce modèle</h4>
     <ul className="flow-error-transfers">{report.errorFlow.transfers.slice(0, 100).map((transfer, i) => <li key={i}>
      {ERROR_TRANSFER_LABELS[transfer.kind]}{errorSites.get(transfer.kind === 'nested' ? transfer.node : transfer.fault ?? transfer.node) === 'division-zero' && ' (division par zéro possible)'} · <Button disabled={stale} onClick={() => onReveal(index.get(transfer.node)!)}>Départ BASIC {index.get(transfer.node)!.basicLine} · C{index.get(transfer.node)!.start + 1}</Button>
      {transfer.to === null ? ' → arrêt du chemin' : <> → <Button disabled={stale} onClick={() => onReveal(index.get(transfer.to!)!)}>Destination BASIC {index.get(transfer.to)!.basicLine} · C{index.get(transfer.to)!.start + 1}</Button></>}
      {transfer.fault !== null && <> · <Button disabled={stale} onClick={() => onReveal(index.get(transfer.fault!)!)}>Instruction interrompue BASIC {index.get(transfer.fault)!.basicLine} · C{index.get(transfer.fault)!.start + 1}</Button></>}
      {controlStack(transfer.stack)}
     </li>)}</ul>{report.errorFlow.transfers.length > 100 && <p>100 transferts affichés ; suite dans les exports.</p>}
    </>}
   </details>}
   {report.handlers.length > 0 && <details className="flow-handlers"><summary>Erreurs et événements ({report.handlers.length})</summary>
    <p>Déclarations et changements de mode repérés dans le source, y compris hors des chemins connus. Ce tableau ne décrit pas les gestionnaires actifs ; priorités, temporisation, DI/EI et REMAIN ne sont pas simulés.</p>
    <ul>{report.handlers.slice(0, 100).map(handler => <li key={handler.site}>
     <Button disabled={stale} onClick={() => onReveal(index.get(handler.site)!)}>{FLOW_EVENT_LABELS[handler.event]} · {FLOW_EVENT_ACTION_LABELS[handler.action]} · BASIC {index.get(handler.site)!.basicLine}</Button>
     {handler.target !== null ? <> → <Button disabled={stale} onClick={() => onReveal(index.get(handler.target!)!)}>Gestionnaire BASIC {index.get(handler.target)!.basicLine}</Button></> : handler.targetLine !== null ? ` → cible BASIC ${handler.targetLine} absente` : ' · sans cible'}
    </li>)}</ul>{report.handlers.length > 100 && <p>100 déclarations affichées ; suite dans les exports.</p>}
   </details>}
   <details className="flow-calls"><summary>Relations d’appel GOSUB ({report.calls.length})</summary><ul>{report.calls.slice(0, 100).map((call, i) => <li key={i}><Button disabled={stale} onClick={() => onReveal(index.get(call.site)!)}>Entrée {index.get(call.caller)!.basicLine} → GOSUB {index.get(call.callee)!.basicLine} · appel à la ligne {index.get(call.site)!.basicLine}</Button></li>)}</ul>{report.calls.length > 100 && <p>100 relations affichées ; suite dans les exports.</p>}</details>
   <details><summary>Cycles de contrôle ({report.cycles.length})</summary><ul>{report.cycles.slice(0, 50).map((cycle, i) => <li key={i}><Button disabled={stale} onClick={() => onReveal(index.get(cycle.nodes[0]!)!)}>Cycle {i + 1} · BASIC {index.get(cycle.nodes[0]!)!.basicLine}</Button> · {cycle.nodes.length} nœuds · {cycle.hasExit ? 'sortie structurelle repérée' : 'aucune sortie structurelle repérée'} · {cycle.reachable ? 'chemin depuis le début' : 'hors des chemins connus'}</li>)}</ul><p className="muted">50 cycles maximum affichés. Les conditions, erreurs, interruptions et effets des appels ne sont pas évalués : aucune preuve de boucle infinie.</p></details>
  </div>}
 </details>;
}
