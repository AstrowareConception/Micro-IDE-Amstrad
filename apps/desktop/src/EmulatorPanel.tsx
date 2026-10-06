import type { Notify } from './notifications.ts';
import { Button } from './Icon.tsx';
import { useEffect, useRef, useState } from 'react';
import type { RunRequest } from '../../../packages/emulator/src/run.ts';
import { files } from './port.ts';
import { CpcInspectionPanel } from './CpcInspectionPanel.tsx';
import { validInspection, type CpcInspection } from '../../../packages/emulator/src/inspection.ts';
export interface EmulatorLaunch { id: string; request: RunRequest }
const specials: Record<string, number> = { Enter: 13, Escape: 3, Backspace: 1, Delete: 12, ArrowLeft: 8, ArrowRight: 9, ArrowDown: 10, ArrowUp: 11 };
export function EmulatorPanel({ launch, onClose, onConfigure, onNotify }: { launch: EmulatorLaunch; onClose(): void; onConfigure(): void; onNotify?: Notify }) {
  const latestNotify = useRef(onNotify); latestNotify.current = onNotify;
  const viewport = useRef<HTMLDivElement>(null);
  const [screenSize, setScreenSize] = useState({ width: 400, height: 200 });
  const [zoom, setZoom] = useState('fit');
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setScreenSize({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const scale = zoom === 'fit' ? Math.max(.01, Math.min((screenSize.width - 16) / 768, (screenSize.height - 16) / 544)) : Number(zoom);
  const canvas = useRef<HTMLCanvasElement>(null), worker = useRef<Worker | undefined>(undefined);
  const [message, setMessage] = useState('Construction et vérification des ROM…'), [phase, setPhase] = useState('preparing'), [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0), [provenance, setProvenance] = useState(''), [sound, setSound] = useState(false);
  const soundEnabled = useRef(false), audio = useRef<AudioContext | undefined>(undefined), nodes = useRef(new Set<AudioBufferSourceNode>()), nextAudio = useRef(0);
  const physical = useRef(new Map<string, number>());
  const inspectionSequence = useRef(0);
  const [inspection, setInspection] = useState<CpcInspection>();
  const send = (value: Record<string, unknown>) => worker.current?.postMessage({ ...value, id: launch.id });
  function clearAudio() { for (const node of nodes.current) { try { node.stop(); node.disconnect(); } catch { /* Already ended. */ } } nodes.current.clear(); nextAudio.current = 0; }
  function release() { physical.current.clear(); send({ type: 'release' }); }
  useEffect(() => {
    let cancelled = false, timer: ReturnType<typeof setTimeout> | undefined;
    inspectionSequence.current++; setInspection(undefined); setPaused(false);
    const currentNodes = nodes.current;
    const fail = (message: string) => { if (!cancelled) { setMessage(message); setPhase('error'); latestNotify.current?.({ source: 'emulator', target: 'emulator', sessionId: launch.request.sessionId, level: 'error', message: 'Exécution CPC interrompue. Consultez les détails et vérifiez les ROM.' }); worker.current?.terminate(); worker.current = undefined; } };
    void (async () => {
      if (!files.emulator) { fail('Exécution disponible dans l’application desktop.'); return; }
      const result = await files.emulator.prepare(launch.request);
      if (cancelled) return;
      if ('error' in result) { fail(result.error); return; }
      setProvenance(`${result.label} · ${result.entry} · DSK SHA-256 ${result.sha256}`);
      const current = new Worker(new URL('./emulator-worker.ts', import.meta.url), { type: 'module', name: 'CPC6128' }); worker.current = current;
      timer = setTimeout(() => fail('Démarrage du moteur trop long ; arrêtez puis relancez.'), 30000);
      current.onerror = () => fail('Worker CPC interrompu ; arrêtez puis relancez le moteur.');
      current.onmessage = event => {
        if (cancelled || worker.current !== current || event.data.id !== launch.id) return;
        const value = event.data;
        if (value.type === 'state') { clearTimeout(timer); setPhase(value.phase); setMessage(value.message); latestNotify.current?.({ source: 'emulator', target: 'emulator', sessionId: launch.request.sessionId, level: 'info', message: value.phase === 'running' ? 'Commande RUN envoyée au CPC. Résultat visible à l’écran.' : 'CPC démarré. Vérifiez Ready à l’écran.' }); }
        else if (value.type === 'error') fail(value.message);
        else if (value.type === 'frame' && value.pixels instanceof Uint8ClampedArray && value.width <= 1024 && value.height <= 1024 && value.pixels.length === value.width * value.height * 4) {
          const screen = canvas.current;
          if (screen) { screen.width = value.width; screen.height = value.height; screen.getContext('2d')?.putImageData(new ImageData(value.pixels, value.width, value.height), 0, 0); }
          setSeconds(value.seconds); setPaused(value.paused); if (!value.paused) setInspection(undefined); current.postMessage({ type: 'frame-ack', id: launch.id });
        } else if (value.type === 'inspection' && value.sequence === inspectionSequence.current && validInspection(value.snapshot)) {
          setInspection(value.snapshot);
        } else if (value.type === 'audio' && value.samples instanceof Float32Array && value.samples.length <= 4096 && soundEnabled.current && audio.current?.state === 'running' && currentNodes.size < 16) {
          const context = audio.current; if (nextAudio.current > context.currentTime + .2) return;
          const buffer = context.createBuffer(1, value.samples.length, 44100); buffer.copyToChannel(value.samples, 0);
          const node = context.createBufferSource(); node.buffer = buffer; node.connect(context.destination); currentNodes.add(node);
          node.onended = () => { currentNodes.delete(node); node.disconnect(); };
          const when = Math.max(context.currentTime + .015, nextAudio.current); node.start(when); nextAudio.current = when + buffer.duration;
        } else if (value.type === 'disk' && value.disk instanceof Uint8Array && value.disk.length === 194816) {
          if (files.emulator?.exportDisk) {
            void files.emulator.exportDisk(value.disk, launch.request.sessionId).then(result => {
              if (!cancelled) setMessage(result === null ? 'Export annulé.' : 'error' in result ? result.error : `Disquette de session exportée : ${result.name}.`);
            }).catch(() => { if (!cancelled) setMessage('Export de la disquette impossible.'); });
          } else {
            const url = URL.createObjectURL(new Blob([value.disk])); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'session-cpc.dsk'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage('Disquette de session exportée, y compris les écritures du CPC.');
          }
        }
      };
      current.postMessage({ type: 'start', id: launch.id, image: result });
    })().catch(() => fail('Préparation CPC impossible ; vérifiez les ROM et relancez.'));
    const blur = () => { worker.current?.postMessage({ type: 'pause', paused: true, id: launch.id }); clearAudio(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); worker.current?.terminate(); worker.current = undefined; for (const node of currentNodes) { try { node.stop(); node.disconnect(); } catch { /* Already ended. */ } } currentNodes.clear(); void audio.current?.close(); };
  }, [launch]);
  async function toggleSound() {
    try { audio.current ??= new AudioContext({ sampleRate: 44100 }); soundEnabled.current = !soundEnabled.current; clearAudio(); if (soundEnabled.current) await audio.current.resume(); else await audio.current.suspend(); setSound(soundEnabled.current); }
    catch { soundEnabled.current = false; setSound(false); setMessage('Audio indisponible ; le CPC continue en mode muet.'); }
  }
  const active = phase === 'manual' || phase === 'running';
  return <section className="emulator-window" role="dialog" aria-label="Émulateur CPC 6128">
    <div className="emulator-command-column">
    <h2>CPC 6128 · Exécution</h2>
    <div className="emulator-controls">
      <Button icon="stop" onClick={onClose}>Arrêter et fermer le CPC</Button>
      {phase === 'manual' && <Button disabled={paused} onClick={() => send({ type: 'ready' })}>Ready est visible : lancer le programme</Button>}
      <Button disabled={!active} onClick={() => { inspectionSequence.current++; setInspection(undefined); release(); clearAudio(); send({ type: 'pause', paused: !paused }); }}>{paused ? 'Reprendre le CPC' : 'Pause CPC'}</Button>
      <Button disabled={!active || paused} onClick={() => send({ type: 'break' })}>Interrompre BASIC (ESC)</Button>
      <Button disabled={!active} onClick={() => void toggleSound()}>{sound ? 'Couper le son CPC' : 'Activer le son CPC'}</Button>
      <Button disabled={!active} onClick={() => send({ type: 'export' })}>Exporter la disquette de session</Button>
      <Button onClick={() => { onClose(); onConfigure(); }}>Configurer les ROM</Button>
    </div>
    <label className="emulator-zoom">Taille de l’écran CPC<select aria-label="Taille de l’écran CPC" value={zoom} onChange={event => setZoom(event.target.value)}>
      <option value="fit">Ajuster au panneau</option><option value="1">100 %</option><option value="1.5">150 %</option><option value="2">200 %</option><option value="3">300 %</option>
    </select></label>
    <p role="status">{message}</p>
    <p>{seconds.toFixed(2)} s émulées · {paused ? 'En pause' : active ? 'Machine active' : 'Préparation'}</p>
    <details><summary>Informations de session</summary><p className="muted">{provenance || 'Les buffers courants sont utilisés ; aucune sauvegarde automatique.'}</p><p className="muted">Relancez avec Exécuter pour une machine propre et les dernières modifications. Le programme d’entrée du projet est lancé ; les autres sources restent des fichiers séparés sur le disque. Firmware inconnu : confirmation manuelle de Ready. Compatibilité matérielle complète en cours de qualification.</p></details>
    </div>
    <div className="emulator-screen-column"><div ref={viewport} className="emulator-viewport"><div className="emulator-screen-content" style={{ minWidth: scale * 768 + 16, minHeight: scale * 544 + 16 }}>
    <canvas ref={canvas} style={{ width: scale * 768, height: scale * 544 }} width={768} height={272} tabIndex={0} aria-label="Écran et clavier du CPC" onBlur={release} onKeyDown={event => {
      if (!active || paused || event.ctrlKey || event.metaKey || event.repeat) return;
      const key = specials[event.key] ?? (event.key.length === 1 && /^[\x20-\x7d]$/.test(event.key) ? event.key.charCodeAt(0) : undefined);
      if (key !== undefined) { event.preventDefault(); physical.current.set(event.code, key); send({ type: 'key', key, down: true }); }
    }} onKeyUp={event => { const key = physical.current.get(event.code); if (key !== undefined) { event.preventDefault(); physical.current.delete(event.code); send({ type: 'key', key, down: false }); } }} />
    </div></div><p className="emulator-keyboard-hint">Cliquez dans l’écran pour utiliser le clavier CPC.</p>
    <CpcInspectionPanel paused={active && paused} snapshot={inspection} onRead={address => { setInspection(undefined); send({ type: 'inspect', address, sequence: ++inspectionSequence.current }); }} />
    </div>
  </section>;
}
