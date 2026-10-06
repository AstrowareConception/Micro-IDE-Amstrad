import type { Notify, NotificationLevel } from './notifications.ts';
import { Button } from './Icon.tsx';
import { useEffect, useRef, useState } from 'react';
import { files } from './port.ts';
import type { TerminalResult } from '../../../packages/workspace/src/terminal.ts';
interface Props { sessionId: string; busy: boolean; dirty: boolean; visible: boolean; onBusy(value: boolean): void; onNotify?: Notify }
export function TerminalPanel(props: Props) {
  const [command, setCommand] = useState('');
  const [result, setResult] = useState<TerminalResult>();
  const announcedResult = useRef('');
  const [notice, setNoticeText] = useState('Commande hôte dans le dossier du projet, confirmation native avant chaque exécution.');
  function setNotice(message: string, level: NotificationLevel = 'info') {
    setNoticeText(message); props.onNotify?.({ source: 'terminal', target: 'terminal', sessionId: props.sessionId, level, message: level === 'error' ? 'Commande système non confirmée. Consultez le terminal.' : message });
  }
  function completed(next: TerminalResult) {
    latest.current.onBusy(false);
    setNoticeText(next.reason || `Commande terminée · code ${next.exitCode ?? 'inconnu'}`);
    const revision = `${next.id}:${next.state}:${next.exitCode}`;
    if (announcedResult.current === revision) return;
    announcedResult.current = revision;
    latest.current.onNotify?.({ source: 'terminal', target: 'terminal', sessionId: props.sessionId, level: next.state === 'stopped' ? 'warning' : next.exitCode === 0 ? 'success' : 'error', message: next.state === 'stopped' ? 'Commande système arrêtée ou limite atteinte.' : `Commande système terminée · code ${next.exitCode ?? 'inconnu'}.` });
  }
  const latest = useRef(props); latest.current = props;
  useEffect(() => {
    if (result?.state !== 'running') return;
    let disposed = false, pending = false;
    const timer = setInterval(async () => {
      if (pending || !files.terminal) return; pending = true;
      try {
        const next = await files.terminal.status(props.sessionId, result.id);
        if (disposed) return;
        if ('error' in next) { setNotice(next.error, 'error'); return; }
        setResult(next);
        if (next.state !== 'running') { completed(next); }
      } catch { if (!disposed) setNotice('Lecture interrompue ; arrêter ou attendre la limite de durée.', 'error'); }
      finally { pending = false; }
    }, 250);
    return () => { disposed = true; clearInterval(timer); };
  }, [props.sessionId, result?.id, result?.state]);
  async function run() {
    if (props.busy || props.dirty || !files.terminal || !command.trim()) return;
    props.onBusy(true);
    try {
      const next = await files.terminal.run(props.sessionId, command);
      if (!next) { setNotice('Commande annulée.'); props.onBusy(false); }
      else if ('error' in next) { setNotice(next.error, 'error'); props.onBusy(false); }
      else { setResult(next); if (next.state !== 'running') completed(next); else setNotice('Commande système en cours…'); }
    } catch { setNotice('Démarrage impossible.', 'error'); props.onBusy(false); }
  }
  async function stop() {
    if (!result || !files.terminal) return;
    try { const next = await files.terminal.stop(props.sessionId, result.id); if ('error' in next) setNotice(next.error, 'error'); else { setResult(next); if (next.state !== 'running') completed(next); } }
    catch { setNotice('Arrêt non confirmé ; la limite de durée reste active.', 'error'); }
  }
  return <section className="panel terminal-panel" hidden={!props.visible} aria-label="Terminal du projet">
    <h2>Terminal · commandes hôte</h2><p className="muted">Sans entrée interactive ni PTY · 30 s / 64 Kio. Les commandes peuvent modifier des fichiers hors projet. Sortie locale, jamais transmise à l’agent. Après une modification externe, rouvrir le projet et arbitrer les conflits.</p>
    {props.dirty && <p>Enregistrez ou arbitrez les brouillons avant l’exécution.</p>}
    <form onSubmit={event => { event.preventDefault(); void run(); }}><label htmlFor="terminal-command">Commande système</label>
      <input id="terminal-command" value={command} maxLength={4096} disabled={props.busy} placeholder="git status --short" onChange={event => setCommand(event.target.value)} autoComplete="off" spellCheck={false} />
      <Button disabled={props.busy || props.dirty || !command.trim() || !files.terminal}>Exécuter la commande</Button>
    </form>
    <Button disabled={result?.state !== 'running'} onClick={() => void stop()}>Arrêter la commande</Button>
    <p aria-live="polite">{notice}</p>{result && <><code>{result.command}</code><pre aria-label="Sortie du terminal">{result.output || 'Aucune sortie.'}</pre></>}
  </section>;
}
