import { useId, useMemo, useState } from 'react';
import { Button } from './Icon.tsx';
import { FLOW_METHOD, FLOW_RETURN_LABELS, type FlowEdge, type FlowNode, type FlowReport } from '../../../packages/basic-language/src/control-flow.ts';

const EDGE_LABELS: Record<FlowEdge['kind'], string> = { next: 'Suite', true: 'Vrai', false: 'Faux', jump: 'Saut', case: 'Cas', call: 'Appel', resume: 'Retour possible', loop: 'Boucle', exit: 'Fin / retour', unknown: 'Inconnu' };
interface Props { name: string; report: FlowReport; stale: boolean; onReveal(node: FlowNode): void }
export function FlowPanel({ name, report, stale, onReveal }: Props) {
 const [expanded, setExpanded] = useState(false), [selected, setSelected] = useState<number | null>(report.entry), [query, setQuery] = useState('');
 const marker = `flow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
 const index = useMemo(() => new Map(report.nodes.map(node => [node.id, node])), [report]);
 const sorted = useMemo(() => [...report.nodes].sort((a, b) => a.line - b.line || a.start - b.start || a.id - b.id), [report]);
 const current = index.get(selected ?? -1), label = (id: number | null) => id === null ? 'Sortie / inconnu' : `BASIC ${index.get(id)?.basicLine} · ${index.get(id)?.operation}`;
 const choices = useMemo(() => sorted.filter(node => `${node.basicLine} ${node.operation}`.toLowerCase().includes(query.toLowerCase())), [sorted, query]);
 const incoming = useMemo(() => report.edges.filter(edge => edge.to === selected), [report, selected]);
 const outgoing = useMemo(() => report.edges.filter(edge => edge.from === selected), [report, selected]);
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
   <div className="flow-routines"><table><caption>Points d’entrée · blocs potentiellement partagés, aucun total</caption><thead><tr><th>Entrée</th><th>Instructions locales</th><th>Complexité de flux</th><th>Appels récursifs</th><th>Chemin vers RETURN</th></tr></thead><tbody>{report.entries.map(entry => <tr key={entry.node}><td><Button disabled={stale} onClick={() => onReveal(index.get(entry.node)!)}>{entry.kind === 'main' ? 'Début' : 'GOSUB'} · BASIC {index.get(entry.node)!.basicLine}</Button></td><td>{entry.nodes}</td><td>{entry.complexity ?? 'Indisponible'}</td><td>{entry.recursive ? 'Cycle repéré' : 'Non repérés'}</td><td>{FLOW_RETURN_LABELS[entry.returnStatus]}</td></tr>)}</tbody></table></div>
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
     {incoming.slice(0, 5).map((edge, i) => <g key={`in-edge-${i}`}><path className="flow-link" d={`M 208 ${56 + i * 60} L 318 174`} markerEnd={`url(#${marker})`} /><text className="flow-edge-label" x="216" y={48 + i * 60}>{EDGE_LABELS[edge.kind]}{edge.ordinal || ''}</text></g>)}
     {outgoing.slice(0, 5).map((edge, i) => <g key={`out-edge-${i}`}><path className="flow-link" d={`M 518 174 L 628 ${56 + i * 60}`} markerEnd={`url(#${marker})`} /><text className="flow-edge-label" x="526" y={48 + i * 60}>{EDGE_LABELS[edge.kind]}{edge.ordinal || ''}</text></g>)}
     {incoming.slice(0, 5).map((edge, i) => box(edge.from, 12, 34 + i * 60, false, `in-${i}`))}
     {box(current.id, 322, 152, true, 'current')}
     {outgoing.slice(0, 5).map((edge, i) => box(edge.to, 632, 34 + i * 60, false, `out-${i}`))}
    </svg></div>
    <p className="muted">{incoming.length} liaison(s) entrante(s), {outgoing.length} sortante(s) ; cinq par côté affichées. « Retour possible » reste une hypothèse structurelle. Sans chemin vers RETURN dans la cible, la suite du GOSUB est retirée. Un retour indéterminé la conserve ; aucune pile d’appels n’est simulée. Le graphe complet figure dans les exports.</p>
   </>}
   <details className="flow-calls"><summary>Relations d’appel GOSUB ({report.calls.length})</summary><ul>{report.calls.slice(0, 100).map((call, i) => <li key={i}><Button disabled={stale} onClick={() => onReveal(index.get(call.site)!)}>Entrée {index.get(call.caller)!.basicLine} → GOSUB {index.get(call.callee)!.basicLine} · appel à la ligne {index.get(call.site)!.basicLine}</Button></li>)}</ul>{report.calls.length > 100 && <p>100 relations affichées ; suite dans les exports.</p>}</details>
   <details><summary>Cycles de contrôle ({report.cycles.length})</summary><ul>{report.cycles.slice(0, 50).map((cycle, i) => <li key={i}><Button disabled={stale} onClick={() => onReveal(index.get(cycle.nodes[0]!)!)}>Cycle {i + 1} · BASIC {index.get(cycle.nodes[0]!)!.basicLine}</Button> · {cycle.nodes.length} nœuds · {cycle.hasExit ? 'sortie structurelle repérée' : 'aucune sortie structurelle repérée'} · {cycle.reachable ? 'chemin depuis le début' : 'hors des chemins connus'}</li>)}</ul><p className="muted">50 cycles maximum affichés. Les conditions, erreurs, interruptions et effets des appels ne sont pas évalués : aucune preuve de boucle infinie.</p></details>
  </div>}
 </details>;
}
