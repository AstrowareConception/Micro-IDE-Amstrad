import { useEffect, useRef, useState } from 'react';
import { composeMission, MISSION_LIMIT, MISSION_RECIPES, PERSONAL_MISSION_LIMIT, type MissionKind, type MissionParameters, type PersonalMission } from '../../../packages/agent/src/missions.ts';
import { readMissions, saveMissions } from './mission-storage.ts';
import { Button } from './Icon.tsx';

interface Props { kind: MissionKind; objective: string; onUse(text: string): void; onClose(): void }
function loadLibrary() {
  try { return { ...readMissions(localStorage), error: '' }; }
  catch { return { raw: null, missions: [] as PersonalMission[], error: 'Les modèles personnels ne peuvent pas être lus. Les modèles intégrés restent disponibles ; les données enregistrées sont conservées.' }; }
}
export function MissionLibraryDialog({ kind, objective, onUse, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const first = MISSION_RECIPES.find(item => item.kind === kind)!;
  const [selected, setSelected] = useState(first.id);
  const [parameters, setParameters] = useState<MissionParameters>({ focus: first.focus, goal: first.goal });
  const [preview, setPreview] = useState(() => composeMission(first, first));
  const [pendingParameters, setPendingParameters] = useState(false);
  const [query, setQuery] = useState(''), [category, setCategory] = useState('Toutes');
  const [library, setLibrary] = useState(loadLibrary), [notice, setNotice] = useState('');
  const [title, setTitle] = useState(''), [removed, setRemoved] = useState<PersonalMission>();
  const recipe = MISSION_RECIPES.find(item => item.id === selected);
  const personal = library.missions.find(item => item.id === selected);
  const eligible = MISSION_RECIPES.filter(item => item.kind === kind);
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  const matches = (text: string) => normalize(text).includes(normalize(query.trim()));
  const recipes = eligible.filter(item => (category === 'Toutes' || category === item.category) && matches(`${item.title} ${item.description}`));
  const customs = library.missions.filter(item => item.kind === kind && (category === 'Toutes' || category === 'Mes modèles') && matches(item.title));
  const valid = !!preview.trim() && preview.length <= MISSION_LIMIT && !pendingParameters;
  useEffect(() => { const element = dialog.current; element?.showModal(); search.current?.focus(); return () => { if (element?.open) element.close(); }; }, []);
  function select(id: string) {
    const item = MISSION_RECIPES.find(value => value.id === id);
    const saved = library.missions.find(value => value.id === id);
    setSelected(id); setPendingParameters(false); setNotice('');
    if (item) { setParameters({ focus: item.focus, goal: item.goal }); setPreview(composeMission(item, item)); setTitle(''); }
    else if (saved) { setPreview(saved.prompt); setTitle(saved.title); }
  }
  function persist(missions: PersonalMission[]): boolean {
    try {
      if (library.error) throw Error(library.error);
      const raw = saveMissions(localStorage, library.raw, missions);
      setLibrary({ raw, missions, error: '' }); return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Enregistrement local impossible. Votre aperçu reste disponible.'); return false; }
  }
  function saveCopy() {
    const mission: PersonalMission = { id: `user-${crypto.randomUUID()}`, kind, title: title.trim(), prompt: preview };
    if (persist([...library.missions, mission])) { setSelected(mission.id); setTitle(mission.title); setNotice('Modèle enregistré sur cet ordinateur.'); }
  }
  function use(append: boolean) {
    const text = append ? `${objective.trimEnd()}\n\n${preview}` : preview;
    if (text.length > MISSION_LIMIT) { setNotice('Le texte combiné dépasse 20 000 caractères. Réduisez l’aperçu ou remplacez la mission.'); return; }
    onUse(text); dialog.current?.close();
  }
  return <dialog ref={dialog} className="command-dialog mission-library" aria-labelledby="mission-library-title" onClose={onClose}>
    <div className="mission-library-heading"><div><p className="mission-eyebrow">ATELIER IA · {kind === 'basic' ? 'BASIC' : 'Z80'}</p><h2 id="mission-library-title">Bibliothèque de missions</h2></div><Button icon="close" onClick={() => dialog.current?.close()}>Fermer</Button></div>
    <p className="muted">Choisissez une intention, précisez votre objectif, puis préparez la mission. Aucun appel IA avant « Lancer l’agent ».</p>
    <div className="mission-library-layout">
      <div className="mission-library-browser">
        <label htmlFor="mission-search">Rechercher un modèle</label><input ref={search} id="mission-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Routine, titre, optimisation…" />
        <label htmlFor="mission-category">Catégorie</label><select id="mission-category" value={category} onChange={event => setCategory(event.target.value)}>{['Toutes', ...new Set(eligible.map(item => item.category)), 'Mes modèles'].map(value => <option key={value}>{value}</option>)}</select>
        <div className="mission-recipe-list" aria-label="Modèles compatibles">
          {recipes.map(item => <button type="button" className="mission-recipe" key={item.id} aria-pressed={selected === item.id} onClick={() => select(item.id)}><small>{item.category} · v{item.version}</small><strong>{item.title}</strong><span>{item.description}</span></button>)}
          {customs.map(item => <button type="button" className="mission-recipe" key={item.id} aria-pressed={selected === item.id} onClick={() => select(item.id)}><small>Mon modèle · {kind === 'basic' ? 'BASIC' : 'Z80'}</small><strong>{item.title}</strong></button>)}
          {!recipes.length && !customs.length && <p role="status">Aucun modèle ne correspond à cette recherche.</p>}
        </div>
        <Button disabled={!objective.trim()} onClick={() => { setSelected('current'); setPreview(objective); setTitle(''); setPendingParameters(false); setNotice('Mission actuelle copiée dans l’aperçu.'); }}>Partir de ma mission actuelle</Button>
        <p className="muted mission-credit">Méthode inspirée de Portage_Opti, par bfggamepassion. Modèles adaptés à CPCéleste ; crédits et périmètre dans le guide utilisateur.</p>
      </div>
      <div className="mission-library-editor">
        <h3>{recipe?.title ?? personal?.title ?? 'Ma mission personnalisée'}</h3>
        {recipe && <><div className="mission-outcome"><strong>Résultat attendu</strong><p>{recipe.outcome}</p><p className="muted">{recipe.limit}</p></div>
          <label htmlFor="mission-focus">Périmètre</label><input id="mission-focus" value={parameters.focus} maxLength={1500} onChange={event => { setParameters({ ...parameters, focus: event.target.value }); setPendingParameters(true); }} />
          <label htmlFor="mission-goal">Objectif et contraintes</label><textarea id="mission-goal" rows={3} value={parameters.goal} maxLength={3000} onChange={event => { setParameters({ ...parameters, goal: event.target.value }); setPendingParameters(true); }} />
          <Button disabled={!parameters.focus.trim() || !parameters.goal.trim()} onClick={() => { setPreview(composeMission(recipe, parameters)); setPendingParameters(false); setNotice('Aperçu régénéré avec vos paramètres.'); }}>Générer l’aperçu</Button>
          {pendingParameters && <p role="status">Générez l’aperçu pour prendre en compte les nouveaux paramètres.</p>}
        </>}
        <label htmlFor="mission-preview">Aperçu modifiable</label><textarea id="mission-preview" className="mission-preview" rows={10} maxLength={MISSION_LIMIT} value={preview} onChange={event => setPreview(event.target.value)} aria-describedby="mission-preview-help" />
        <p id="mission-preview-help" className="muted">{preview.length.toLocaleString('fr-FR')} / 20 000 caractères. Seul ce texte sera inséré dans la mission. Les modèles n’ajoutent aucun outil à l’agent.</p>
        <details className="mission-personal"><summary>Conserver comme modèle personnel</summary><p className="muted">Sur cet ordinateur, pour les projets {kind === 'basic' ? 'BASIC' : 'Z80'}. Seuls le titre et cet aperçu sont enregistrés, pas les fichiers du projet. Évitez d’y placer des secrets. {library.missions.length}/{PERSONAL_MISSION_LIMIT} modèles.</p>
          <label htmlFor="mission-name">Nom du modèle</label><input id="mission-name" maxLength={80} value={title} onChange={event => setTitle(event.target.value)} />
          <div className="mission-personal-actions"><Button icon="save" disabled={!valid || !title.trim() || !!library.error || library.missions.length >= PERSONAL_MISSION_LIMIT} onClick={saveCopy}>Enregistrer une copie</Button>
            {personal && <Button icon="save" disabled={!valid || !title.trim() || !!library.error} onClick={() => { if (persist(library.missions.map(item => item.id === personal.id ? { ...item, title: title.trim(), prompt: preview } : item))) setNotice('Modèle mis à jour sur cet ordinateur.'); }}>Mettre à jour ce modèle</Button>}
            {personal && <Button icon="trash" disabled={!!library.error} onClick={() => { if (persist(library.missions.filter(item => item.id !== personal.id))) { setRemoved(personal); setSelected('current'); setNotice('Modèle supprimé ; le texte reste dans l’aperçu.'); } }}>Supprimer ce modèle</Button>}
            {removed && <Button icon="undo" onClick={() => { if (persist([...library.missions, removed])) { setRemoved(undefined); setNotice('Modèle rétabli.'); } }}>Rétablir le modèle supprimé</Button>}
          </div>
        </details>
        {library.error && <p role="alert">{library.error}</p>}{notice && <p role="status">{notice}</p>}
      </div>
    </div>
    <div className="mission-library-actions">{objective.trim() && <p>Une mission est déjà saisie. Choisissez de la compléter ou de la remplacer.</p>}<Button icon="close" onClick={() => dialog.current?.close()}>Annuler</Button>{objective.trim() && <Button disabled={!valid || objective.trimEnd().length + preview.length + 2 > MISSION_LIMIT} onClick={() => use(true)}>Ajouter à ma mission</Button>}<Button className="primary" disabled={!valid} onClick={() => use(false)}>{objective.trim() ? 'Remplacer ma mission' : 'Utiliser cette mission'}</Button></div>
  </dialog>;
}
