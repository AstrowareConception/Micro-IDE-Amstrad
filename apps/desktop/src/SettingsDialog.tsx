import { useEffect, useRef, useState } from 'react';
import { Button } from './Icon.tsx';
import { DEFAULT_PREFERENCES, parsePreferences, type Preferences } from './preferences.ts';

export function SettingsDialog({ preferences, onApply, onClose }: { preferences: Preferences; onApply(value: Preferences): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(preferences);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const number = (key: keyof Preferences, label: string, min: number, max: number, step = 1) => <label>{label}<input type="number" required min={min} max={max} step={step} value={Number(draft[key])} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.valueAsNumber }))} /></label>;
  const check = (key: keyof Preferences, label: string) => <label className="setting-check"><input type="checkbox" checked={Boolean(draft[key])} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.checked }))} />{label}</label>;
  return <dialog ref={dialog} className="command-dialog settings-dialog" aria-label="Paramètres de CPCéleste" onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
    <h2>Paramètres de CPCéleste</h2>
    <form onSubmit={event => { event.preventDefault(); onApply(parsePreferences(draft)); dialog.current?.close(); }}>
      <fieldset><legend>Apparence et disposition</legend>
        <label>Thème<select aria-label="Thème" autoFocus value={draft.theme} onChange={event => setDraft(previous => ({ ...previous, theme: event.target.value as Preferences['theme'] }))}><option value="dark">Sombre</option><option value="light">Clair</option><option value="system">Système</option></select></label>
        <label>Police du code<input required maxLength={200} value={draft.fontFamily} onChange={event => setDraft(previous => ({ ...previous, fontFamily: event.target.value }))} /></label>
        {number('fontSize', 'Taille du code (px)', 10, 32)}
        {number('sidebarWidth', 'Largeur des outils (px)', 180, 800)}{number('agentWidth', 'Largeur de l’assistant (px)', 240, 800)}{number('outputHeight', 'Hauteur des sorties (px)', 120, 1200)}
        <p className="muted">Glissez les séparateurs pour ajuster les dimensions. Les en-têtes permettent de détacher ou d’agrandir les panneaux ; Affichage permet de restaurer la disposition.</p>
      </fieldset>
      <fieldset><legend>Édition</legend>
        {number('tabSize', 'Taille d’indentation', 1, 8)}{check('insertSpaces', 'Indenter avec des espaces')}{check('autoIndent', 'Indentation automatique')}{check('wordWrap', 'Retour visuel à la ligne')}{check('autoClosingBrackets', 'Fermer automatiquement les parenthèses')}{check('minimap', 'Afficher la minimap')}
      </fieldset>
      <fieldset><legend>Enregistrement et BASIC</legend>
        {check('autoSave', 'Enregistrement automatique des sources du projet')}{number('autoSaveDelay', 'Délai d’enregistrement automatique (ms)', 1000, 60000, 100)}
        <p className="muted">Après une pause de saisie, les sources modifiées du projet sont enregistrées. Une mission IA, un terminal ou une opération disque suspend l’enregistrement. Les conflits externes restent contrôlés. Les listings isolés utilisent Ctrl S.</p>
        {number('renumberStart', 'Premier numéro de renumérotation par défaut', 1, 65535)}{number('renumberStep', 'Pas de renumérotation par défaut', 1, 65535)}
        <p className="muted">BASIC → Renuméroter calcule les nouvelles cibles avec aperçu avant application.</p>
      </fieldset>
      <div className="settings-actions"><Button type="button" icon="undo" onClick={() => setDraft({ ...DEFAULT_PREFERENCES })}>Valeurs par défaut</Button><Button type="button" icon="close" onClick={() => dialog.current?.close()}>Annuler</Button><Button type="submit" icon="save" className="primary">Appliquer les paramètres</Button></div>
    </form>
  </dialog>;
}
