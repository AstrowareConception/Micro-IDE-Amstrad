import { useEffect, useRef, useState } from 'react';
import { Button } from './Icon.tsx';
import { exportProfile, importProfile, loadProfiles, saveProfiles, profilesRevision, profileName, PROFILE_BYTES, PROFILE_LIMIT } from './personalization-profiles.ts';
import type { Preferences } from './preferences.ts';
export function PersonalizationProfiles({ draft, onLoad }: { draft: Preferences; onLoad(value: Preferences): void }) {
  const [profiles, setProfiles] = useState(loadProfiles), [name, setName] = useState('Mon atelier'), [selected, setSelected] = useState(''), [message, setMessage] = useState('');
  const alive = useRef(true);
  const revision = useRef(profilesRevision());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function change(next: typeof profiles, message: string) { if (!saveProfiles(next, revision.current)) { setMessage('Profils modifiés ailleurs, version inconnue ou conservation indisponible ; profils existants préservés. Rouvrez les paramètres pour les relire.'); return; } revision.current = profilesRevision(); setProfiles(next); setMessage(message); }
  return <fieldset><legend>Profils personnels</legend>
    <p className="muted">Un profil contient l’apparence, les options du code, les raccourcis et l’auto-save. Charger ou importer prépare les réglages ; Appliquer les paramètres les active. La sauvegarde d’un profil est immédiate.</p>
    <label>Profil enregistré<select aria-label="Profil enregistré" value={selected} onChange={event => { setSelected(event.target.value); if (event.target.value) setName(event.target.value); }}><option value="">Choisir un profil…</option>{profiles.map(profile => <option key={profile.name}>{profile.name}</option>)}</select></label>
    <label>Nom du profil<input maxLength={60} value={name} onChange={event => setName(event.target.value)} /></label>
    <div className="settings-profile-actions"><Button type="button" disabled={!selected} onClick={() => { const profile = profiles.find(profile => profile.name === selected); if (profile) { onLoad(profile.preferences); setMessage('Profil chargé dans l’aperçu des réglages.'); } }}>Charger le profil</Button>
      <Button type="button" onClick={() => { try { const valid = profileName(name); if (profiles.some(profile => profile.name.toLocaleLowerCase('fr') === valid.toLocaleLowerCase('fr'))) throw new Error('Nom déjà utilisé ; choisissez un nouveau nom ou mettez à jour le profil sélectionné.'); if (profiles.length >= PROFILE_LIMIT) throw new Error('Douze profils au maximum.'); change([...profiles, { name: valid, preferences: draft }], 'Profil enregistré.'); } catch (error) { setMessage(String((error as Error).message)); } }}>Enregistrer un nouveau profil</Button>
      <Button type="button" disabled={!selected} onClick={() => change(profiles.map(profile => profile.name === selected ? { name: selected, preferences: draft } : profile), 'Profil mis à jour.')}>Mettre à jour le profil</Button>
      <Button type="button" disabled={!selected} onClick={() => { change(profiles.filter(profile => profile.name !== selected), 'Profil supprimé.'); setSelected(''); }}>Supprimer le profil</Button>
      <Button type="button" onClick={() => { try { const bytes = exportProfile(name, draft), url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' })), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'cpceleste-profil.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Profil exporté.'); } catch (error) { setMessage((error as Error).message); } }}>Exporter ces réglages</Button></div>
    <label className="settings-wide">Importer un profil JSON<input type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > PROFILE_BYTES) { setMessage('Profil limité à 64 Kio.'); return; } void file.text().then(text => { if (!alive.current) return; try { const profile = importProfile(text); onLoad(profile.preferences); setName(profile.name); setMessage('Profil importé dans les réglages ; vérifiez-le avant application.'); } catch (error) { setMessage((error as Error).message); } }).catch(() => { if (alive.current) setMessage('Lecture du profil impossible.'); }); }} /></label>
    <p role="status">{message}</p>
  </fieldset>;
}
