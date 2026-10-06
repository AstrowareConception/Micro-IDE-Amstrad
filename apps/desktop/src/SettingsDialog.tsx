import { useEffect, useRef, useState } from 'react';
import { Button } from './Icon.tsx';
import { DEFAULT_PREFERENCES, parsePreferences, type Preferences } from './preferences.ts';
import { DEFAULT_KEYMAP, keymapErrors, keymapPreset, shortcutFromEvent, shortcutLabel, type Keymap } from './keymap.ts';
import { PersonalizationProfiles } from './PersonalizationProfiles.tsx';
import type { WorkbenchCommand } from './CommandPalette.tsx';
const categories = [['all', 'Tous les réglages'], ['appearance', 'Apparence'], ['editor', 'Éditeur'], ['save', 'Enregistrement et BASIC'], ['keymap', 'Raccourcis'], ['profiles', 'Profils'], ['notifications', 'Notifications']] as const;
export function SettingsDialog({ preferences, commands, onApply, onClose }: { preferences: Preferences; commands: WorkbenchCommand[]; onApply(value: Preferences): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => parsePreferences(preferences)), [query, setQuery] = useState(''), [category, setCategory] = useState('all');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const errors = keymapErrors(draft.keymap);
  const visible = (id: string, terms: string) => (category === 'all' || category === id) && terms.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'));
  const number = (key: keyof Preferences, label: string, min: number, max: number, step = 1) => <label>{label}<input type="number" required min={min} max={max} step={step} value={Number.isNaN(Number(draft[key])) ? '' : Number(draft[key])} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.valueAsNumber }))} /></label>;
  const check = (key: keyof Preferences, label: string) => <label className="setting-check"><input type="checkbox" checked={Boolean(draft[key])} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.checked }))} />{label}</label>;
  const select = (key: keyof Preferences, label: string, values: readonly (readonly [string, string])[]) => <label>{label}<select aria-label={label} value={String(draft[key])} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.value }))}>{values.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>;
  const sections = {
    appearance: visible('appearance', 'apparence disposition thème sombre clair système couleur accent cyan ambre violet vert rose densité compact confortable police taille code outils assistant sorties'),
    editor: visible('editor', 'éditeur édition indentation espaces parenthèses retour ligne minimap interligne numéros relatifs caractères invisibles curseur clignotement ligatures guides couleurs parenthèses règle colonne'),
    save: visible('save', 'enregistrement sauvegarde auto-save automatique délai BASIC renumérotation premier numéro pas'),
    keymap: visible('keymap', 'raccourcis clavier keymap JetBrains VS Code ' + commands.filter(command => Object.hasOwn(DEFAULT_KEYMAP, command.id)).map(command => command.label).join(' ')),
    notifications: visible('notifications', 'notifications messages aperçus erreurs historique silence'),
    profiles: visible('profiles', 'profils personnels importer exporter enregistrer charger supprimer atelier JSON'),
  };
  return <dialog ref={dialog} className="command-dialog settings-dialog advanced-settings" aria-label="Paramètres de CPCéleste" onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
    <h2>Paramètres de CPCéleste</h2>
    <input autoFocus aria-label="Rechercher un réglage" placeholder="Thème, curseur, profil, raccourci…" value={query} onChange={event => { setQuery(event.target.value); setCategory('all'); }} />
    <nav className="settings-categories" aria-label="Catégories de réglages">{categories.map(([id, label]) => <Button key={id} type="button" aria-pressed={category === id} onClick={() => { setCategory(id); setQuery(''); }}>{label}</Button>)}</nav>
    <form onSubmit={event => { event.preventDefault(); if (errors.length) return; onApply(parsePreferences(draft)); dialog.current?.close(); }}>
      <div hidden={!sections.appearance}><fieldset><legend>Apparence et disposition</legend>
        {select('theme', 'Thème', [['dark', 'Sombre'], ['light', 'Clair'], ['system', 'Système']])}
        {select('accent', 'Couleur d’accent', [['cyan', 'Cyan céleste'], ['amber', 'Ambre'], ['violet', 'Violet'], ['green', 'Vert'], ['rose', 'Rose']])}
        {select('density', 'Densité de l’interface', [['comfortable', 'Confortable'], ['compact', 'Compacte']])}
        <label>Police du code<input required maxLength={200} value={draft.fontFamily} onChange={event => setDraft(previous => ({ ...previous, fontFamily: event.target.value }))} /></label>
        {number('fontSize', 'Taille du code (px)', 10, 32)}
        {number('sidebarWidth', 'Largeur des outils (px)', 180, 800)}{number('agentWidth', 'Largeur de l’assistant (px)', 240, 800)}{number('outputHeight', 'Hauteur des sorties (px)', 120, 1200)}
        <p className="muted">Affichage propose les dispositions Édition, Exécution et Agent et le mode Concentration. Les dimensions et panneaux flottants restent ajustables.</p>
      </fieldset></div>
      <div hidden={!sections.editor}><fieldset><legend>Édition et lecture du code</legend>
        {number('tabSize', 'Taille d’indentation', 1, 8)}{number('lineHeight', 'Interligne du code (px, 0 = automatique)', 0, 60)}
        {select('lineNumbers', 'Numéros de lignes physiques', [['on', 'Absolus'], ['relative', 'Relatifs'], ['off', 'Masqués']])}
        {select('whitespace', 'Caractères invisibles', [['none', 'Masqués'], ['selection', 'Dans la sélection'], ['all', 'Tous']])}
        {select('cursorStyle', 'Forme du curseur', [['line', 'Trait'], ['block', 'Bloc'], ['underline', 'Souligné']])}
        {select('cursorBlinking', 'Clignotement du curseur', [['blink', 'Clignotant'], ['solid', 'Fixe']])}{number('ruler', 'Règle de colonne (0 = masquée)', 0, 240)}
        {check('insertSpaces', 'Indenter avec des espaces')}{check('autoIndent', 'Indentation automatique')}{check('wordWrap', 'Retour visuel à la ligne')}{check('autoClosingBrackets', 'Fermer automatiquement les parenthèses')}{check('minimap', 'Afficher la minimap')}{check('fontLigatures', 'Ligatures de la police du code')}{check('indentGuides', 'Afficher les guides d’indentation')}{check('bracketColors', 'Colorer les paires de parenthèses')}
        <p className="muted">Ces options changent la lecture du code ; les numéros BASIC et le texte restent inchangés. Les ligatures dépendent de la police installée.</p>
      </fieldset></div>
      <div hidden={!sections.save}><fieldset><legend>Enregistrement et BASIC</legend>
        {check('autoSave', 'Enregistrement automatique des sources du projet')}{number('autoSaveDelay', 'Délai d’enregistrement automatique (ms)', 1000, 60000, 100)}
        <p className="muted">Après une pause de saisie, les sources modifiées du projet sont enregistrées. Une mission IA, un terminal ou une opération disque suspend l’enregistrement. Les conflits externes restent contrôlés. Les listings isolés utilisent la commande Enregistrer.</p>
        {number('renumberStart', 'Premier numéro de renumérotation par défaut', 1, 65535)}{number('renumberStep', 'Pas de renumérotation par défaut', 1, 65535)}
        <p className="muted">BASIC → Renuméroter calcule les nouvelles cibles avec aperçu avant application.</p>
      </fieldset></div>
      <div hidden={!sections.keymap}><fieldset><legend>Raccourcis de l’atelier</legend>
        <label>Base de raccourcis<select aria-label="Base de raccourcis" defaultValue="" onChange={event => { if (event.target.value) setDraft(previous => ({ ...previous, keymap: keymapPreset(event.target.value) })); }}><option value="">Choisir une base…</option><option value="cpceleste">CPCéleste / inspiré VS Code</option><option value="jetbrains">Inspiré JetBrains</option></select></label>
        <p className="muted">Cliquez dans une combinaison puis pressez les touches. Retour arrière ou Suppr retire la combinaison. Ctrl devient Cmd sur macOS. Annuler/rétablir, recherche et gestes Monaco restent réservés ; les bases portent sur les commandes de l’atelier.</p>
        {commands.filter(command => Object.hasOwn(DEFAULT_KEYMAP, command.id)).map(command => <label key={command.id}>{command.label}<input aria-label={`Raccourci : ${command.label}`} readOnly value={shortcutLabel(draft.keymap[command.id as keyof Keymap])} placeholder="Non attribué" onKeyDown={event => { if (event.key === 'Tab') return; event.preventDefault(); event.stopPropagation(); if (event.nativeEvent.getModifierState('AltGraph')) return; const value = ['Backspace', 'Delete'].includes(event.key) ? '' : shortcutFromEvent(event.nativeEvent); if (value !== undefined) setDraft(previous => ({ ...previous, keymap: { ...previous.keymap, [command.id]: value } })); }} /></label>)}
        {errors.length > 0 && <div className="settings-wide" role="alert"><p>Corrigez les raccourcis avant application.</p><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
      </fieldset></div>
      <div hidden={!sections.notifications}><fieldset><legend>Notifications de session</legend>{select('notificationPopups', 'Aperçus des notifications', [['all', 'Tous les messages'], ['errors', 'Erreurs seulement'], ['off', 'Aucun aperçu']])}<p className="muted">Le centre reste consultable depuis Affichage, la cloche et la palette. Les messages ne sont pas conservés au redémarrage.</p></fieldset></div>
      <div hidden={!sections.profiles}>{!errors.length ? <PersonalizationProfiles draft={draft} onLoad={value => setDraft(parsePreferences(value))} /> : <p>Corrigez les raccourcis avant de gérer les profils.</p>}</div>
      {!Object.values(sections).some(Boolean) && <p role="status">Aucun groupe de réglages ne correspond à cette recherche.</p>}
      <div className="settings-actions"><Button type="button" icon="undo" onClick={() => setDraft(parsePreferences(DEFAULT_PREFERENCES))}>Valeurs par défaut</Button><Button type="button" icon="close" onClick={() => dialog.current?.close()}>Annuler</Button><Button type="submit" icon="save" className="primary" disabled={errors.length > 0}>Appliquer les paramètres</Button></div>
    </form>
  </dialog>;
}
