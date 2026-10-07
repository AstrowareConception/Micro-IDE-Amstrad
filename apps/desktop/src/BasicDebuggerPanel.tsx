import { useMemo, useState } from 'react';
import { parseBreakpointLines, type BasicDebugSnapshot } from '../../../packages/emulator/src/basic-debug.ts';

export function BasicDebuggerPanel({
  active, available, paused, snapshot, onConfigure, onStep, onContinue,
}: {
  active: boolean;
  available: boolean;
  paused: boolean;
  snapshot: BasicDebugSnapshot | undefined;
  onConfigure(lines: number[]): void;
  onStep(): void;
  onContinue(): void;
}) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseBreakpointLines(text), [text]);
  return <details className="cpc-inspection" open={Boolean(snapshot)}>
    <summary>Debugger BASIC</summary>
    {!available && <p className="muted">Debugger indisponible pour ce firmware. L’exécution CPC reste possible ; aucun point d’arrêt n’est simulé.</p>}
    {available && <>
      <p className="muted">Instrumentation réelle du Locomotive BASIC 1.1 qualifié. Les points d’arrêt portent sur les numéros de ligne exécutés ; les variables et la pile GOSUB ne sont pas encore interprétées.</p>
      <label>Points d’arrêt BASIC
        <input aria-label="Points d’arrêt BASIC" value={text} placeholder="10, 100, 250" onChange={event => setText(event.target.value)} />
      </label>
      {parsed === undefined && <p role="alert">Entrez jusqu’à 64 numéros de ligne entre 1 et 65535, séparés par des espaces, virgules ou points-virgules.</p>}
      <div className="emulator-controls">
        <button disabled={!active || parsed === undefined} onClick={() => { if (parsed) onConfigure(parsed); }}>
          {parsed?.length ? 'Appliquer les points d’arrêt' : 'Désactiver les points d’arrêt'}
        </button>
        <button disabled={!active} onClick={onStep}>Pas BASIC suivant</button>
        <button disabled={!active || !paused} onClick={onContinue}>Continuer</button>
      </div>
      {snapshot && <div role="region" aria-label="Arrêt debugger BASIC">
        <p><strong>Ligne BASIC {snapshot.line}</strong> · {snapshot.reason === 'breakpoint' ? 'point d’arrêt' : snapshot.reason === 'step' ? 'pas suivant' : 'budget de sécurité atteint'}</p>
        <dl>
          <div><dt>Pointeur ligne</dt><dd>&amp;{snapshot.linePointer.toString(16).toUpperCase().padStart(4, '0')}</dd></div>
          <div><dt>Pointeur statement</dt><dd>&amp;{snapshot.statementPointer.toString(16).toUpperCase().padStart(4, '0')}</dd></div>
          <div><dt>Ticks</dt><dd>{snapshot.ticks.toLocaleString('fr-FR')}</dd></div>
        </dl>
      </div>}
    </>}
  </details>;
}
