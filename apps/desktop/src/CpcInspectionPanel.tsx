import { useState } from 'react';
import { CPC_REGISTER_NAMES, parseRamAddress, ramRows, type CpcInspection } from '../../../packages/emulator/src/inspection.ts';
export function CpcInspectionPanel({ paused, snapshot, onRead }: { paused: boolean; snapshot: CpcInspection | undefined; onRead(address: number): void }) {
  const [address, setAddress] = useState('8000');
  const parsed = parseRamAddress(address);
  return <details className="cpc-inspection"><summary>Inspection CPC en pause</summary>
    <p className="muted">Registres Z80 et RAM derrière les ROM, selon les banques actives. Lecture à la demande ; le compteur PC peut être au milieu d’une instruction machine.</p>
    <label>Adresse RAM hexadécimale<input aria-label="Adresse RAM hexadécimale" value={address} maxLength={6} onChange={event => setAddress(event.target.value)} /></label>
    <button disabled={!paused || parsed === undefined} onClick={() => { if (parsed !== undefined) onRead(parsed); }}>Lire les registres et la RAM</button>
    {!paused && <p>Mettez le CPC en pause pour obtenir une lecture stable.</p>}
    {parsed === undefined && <p role="alert">Adresse attendue : 0000 à FFFF, avec préfixe &amp; ou 0x facultatif.</p>}
    {paused && snapshot && <div role="region" aria-label="État CPC inspecté">
      <p>Instant de lecture : {snapshot.ticks.toLocaleString('fr-FR')} ticks émulés.</p>
      <dl>{CPC_REGISTER_NAMES.map((name, i) => <div key={name}><dt>{name}</dt><dd>&amp;{snapshot.registers[i]!.toString(16).toUpperCase().padStart(4, '0')}</dd></div>)}</dl>
      <table><caption>RAM logique · lecture seule</caption><thead><tr><th>Adresse</th><th>Octets hexadécimaux</th><th>ASCII</th></tr></thead>
        <tbody>{ramRows(snapshot).map(row => <tr key={row.address}><th scope="row">&amp;{row.address}</th><td><code>{row.hex}</code></td><td><code>{row.text}</code></td></tr>)}</tbody></table>
    </div>}
  </details>;
}
