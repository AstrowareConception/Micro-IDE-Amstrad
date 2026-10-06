import { Button } from './Icon.tsx';
import { useEffect, useState } from 'react';
import { ROM_ROLES } from '../../../packages/emulator/src/firmware.ts';
import type { FirmwareStatus, RomRole } from '../../../packages/emulator/src/firmware.ts';
import { files } from './port.ts';

const labels = { os: 'OS CPC', basic: 'BASIC 1.1', amsdos: 'AMSDOS' };
export function FirmwarePanel({ busy }: { busy: boolean }) {
  const [status, setStatus] = useState<FirmwareStatus>();
  const [message, setMessage] = useState(''), [pending, setPending] = useState(false);
  const port = files.firmware;
  useEffect(() => {
    if (!port) return;
    let disposed = false;
    void port.status().then(result => {
      if (disposed) return;
      if ('error' in result) setMessage(result.error); else setStatus(result);
    }).catch(() => { if (!disposed) setMessage('Lecture de la configuration ROM impossible.'); });
    return () => { disposed = true; };
  }, [port]);
  async function perform(role?: RomRole, clear = false) {
    if (!port || pending || busy) return;
    setPending(true);
    try {
      const result = clear ? await port.clear() : role ? await port.importRom(role) : await port.status();
      if (!result) { setMessage('Import annulé ; sélection conservée.'); return; }
      if ('error' in result) { setMessage(result.error); return; }
      setStatus(result); setMessage(clear ? 'Sélection retirée. Les fichiers du cache local sont conservés.' : role ? 'ROM importée localement. Compatibilité à qualifier.' : 'Empreintes ROM vérifiées.');
    } catch { setMessage('Opération ROM impossible.'); }
    finally { setPending(false); }
  }
  return <section className="panel firmware-panel" aria-label="Configuration ROM CPC">
    <h2>ROM du CPC 6128</h2>
    <p className="muted">Choisissez vos ROM locales séparées : 16 Kio chacune. Stockage hors projet, aucune transmission à l’agent. Après import, utilisez Exécuter/F5. Les jeux inconnus demandent une confirmation visuelle de Ready.</p>
    {ROM_ROLES.map(role => {
      const slot = status?.slots.find(item => item.role === role);
      return <div key={role}><h3>{labels[role]}</h3>
        <p>{slot?.state === 'available' ? 'Disponible' : slot?.state === 'invalid' ? 'Fichier absent ou corrompu' : 'Non configurée'}</p>
        {slot?.sha256 && <code className="rom-hash">SHA-256 : {slot.sha256}</code>}
        <Button disabled={!port || busy || pending} onClick={() => void perform(role)}>Importer {labels[role]}</Button>
      </div>;
    })}
    <p>{status?.complete ? 'Jeu complet · expérimental · prêt pour Exécuter/F5' : 'Jeu incomplet ou invalide'}</p>
    <Button disabled={!port || busy || pending} onClick={() => void perform()}>Vérifier les ROM</Button>
    <Button disabled={!port || busy || pending} onClick={() => void perform(undefined, true)}>Retirer la sélection ROM</Button>
    <p className="firmware-notice" aria-live="polite">{message}</p>
    {!port && <p className="muted">Import local disponible dans l’application desktop.</p>}
  </section>;
}
