import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { analyze } from '../../../packages/basic-language/src/language.ts';
import { COMMANDS, type CommandCard } from '../../../packages/basic-language/src/catalog.ts';
import { files, type Failure, type FileResult } from './port.ts';
import { Editor, type EditorWorkspace } from './Editor.tsx';
import { SearchPanel } from './SearchPanel.tsx';
import type { SearchMatch } from '../../../packages/workspace/src/search.ts';
import { monaco, provenance } from './monaco-language.ts';
import type { ProjectManifest, ProjectSnapshot } from '../../../packages/workspace/src/project.ts';
import type { AgentWorkspaceState } from '../../../packages/agent/src/types.ts';
import { AgentPanel } from './AgentPanel.tsx';
import { FirmwarePanel } from './FirmwarePanel.tsx';
import { DocumentsPanel } from './DocumentsPanel.tsx';
import { GitPanel } from './GitPanel.tsx';
import { RenumberPanel } from './RenumberPanel.tsx';
import type { RenumberRequest } from './RenumberPanel.tsx';
import { applyRenumber } from '../../../packages/basic-language/src/renumber.ts';
import { CommandPalette, type WorkbenchCommand } from './CommandPalette.tsx';
import { TerminalPanel } from './TerminalPanel.tsx';

const SAMPLE = '10 REM MICRO IDE AMSTRAD\n20 MODE 1\n30 INK 0,0:INK 1,24\n40 PEN 1\n50 PRINT "BONJOUR CPC 6128 !"\n60 FOR I=1 TO 5\n70 PRINT "LOCOMOTIVE BASIC";I\n80 NEXT I\n90 END\n';
interface Document { id: string; sourceId: string; name: string; source: string; saved: string }

export function App() {
  const [documents, setDocuments] = useState<Document[]>([{ id: 'initial', sourceId: 'main', name: 'MAIN.bas', source: SAMPLE, saved: SAMPLE }]);
  const [activeId, setActiveId] = useState('initial');
  const [project, setProject] = useState<{ sessionId: string; manifest: ProjectManifest } | undefined>();
  const [projectName, setProjectName] = useState('Mon projet CPC');
  const [sourceName, setSourceName] = useState('');
  const active = documents.find(document => document.id === activeId)!;
  const { source } = active;
  const [status, setStatus] = useState('Prêt. Écrivez du BASIC, sans ROM ni connexion.');
  const [fileBusy, setBusy] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [renumberOpen, setRenumberOpen] = useState(false);
  const [palette, setPalette] = useState<'all' | 'sources' | undefined>();
  const [contextSource, setContextSource] = useState<string>();
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navigation, setNavigation] = useState<SearchMatch>();
  const editorWorkspace = useRef<EditorWorkspace | undefined>(undefined);
  const [minimap, setMinimap] = useState(false);
  const busy = fileBusy || agentBusy;
  const [card, setCard] = useState<CommandCard | undefined>();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const deferredSource = useDeferredValue(source);
  const analysis = useMemo(() => analyze(deferredSource), [deferredSource]);
  const dirty = documents.some(document => document.source !== document.saved);
  useEffect(() => { files.setDirty(dirty); }, [dirty]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault(); event.stopPropagation(); setSearchOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault(); event.stopPropagation(); setPalette(event.shiftKey ? 'all' : 'sources');
      }
    };
    window.addEventListener('keydown', shortcut, true);
    return () => window.removeEventListener('keydown', shortcut, true);
  }, []);
  useEffect(() => { if (terminalOpen) document.getElementById('terminal-command')?.scrollIntoView({ block: 'center' }); }, [terminalOpen]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty && !window.desktop) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  async function perform(action: () => Promise<FileResult | Failure | null>, message: string, commit = false) {
    if (busy) return;
    setBusy(true);
    const snapshot = source;
    try {
      const result = await action();
      if (!result) { setStatus('Opération annulée.'); return; }
      if ('error' in result) { setStatus(result.error); return; }
      if (commit) setDocuments(items => items.map(item => item.id === activeId ? { ...item, saved: snapshot, name: project ? item.name : result.name } : item));
      setStatus(`${message} : ${result.name}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Échec de l’opération.'); }
    finally { setBusy(false); }
  }
  async function open() {
    if (busy || (dirty && !window.confirm('Abandonner les modifications non enregistrées ?'))) return;
    setBusy(true);
    try {
      const result = await files.open();
      if (!result) return;
      if ('error' in result) { setStatus(result.error); return; }
      if (result.source !== undefined) {
        const id = crypto.randomUUID(); setDocuments([{ id, sourceId: 'main', name: result.name, source: result.source, saved: result.source }]);
        setActiveId(id); setProject(undefined); setStatus(`Listing ouvert : ${result.name}`);
      }
    } catch (error) { setStatus(String(error)); }
    finally { setBusy(false); }
  }
  function acceptProject(snapshot: ProjectSnapshot, append = false) {
    const added = snapshot.files.map(file => ({ id: `${snapshot.sessionId}:${file.id}`, sourceId: file.id, name: file.path, source: file.source, saved: file.source }));
    setDocuments(items => append ? [...items, ...added] : added);
    setActiveId(added[0]!.id); setProject({ sessionId: snapshot.sessionId, manifest: snapshot.manifest });
  }
  function acceptAgent(state: AgentWorkspaceState) {
    if (state.sessionId !== project?.sessionId) return;
    const next = state.files.map(file => ({ id: `${state.sessionId}:${file.id}`, sourceId: file.id, name: file.path, source: file.source, saved: file.saved }));
    setDocuments(next); setProject({ sessionId: state.sessionId, manifest: state.manifest });
    if (!next.some(file => file.id === activeId)) setActiveId(next[0]!.id);
  }
  async function projectOperation(action: () => Promise<ProjectSnapshot | ProjectManifest | Failure | null>, append = false) {
    if (busy) return; setBusy(true);
    try {
      const result = await action();
      if (!result) { setStatus('Opération annulée.'); return; }
      if ('error' in result) { setStatus(result.error); return; }
      if ('files' in result) acceptProject(result, append);
      else setProject(previous => previous ? { ...previous, manifest: result } : previous);
      setStatus('Projet mis à jour. Les buffers existants sont conservés lors d’un ajout.');
    } catch (error) { setStatus(String(error)); }
    finally { setBusy(false); }
  }
  function openProject(create: boolean) {
    const port = files.project;
    if (!port || busy || (dirty && !window.confirm('Abandonner les modifications non enregistrées ?'))) return;
    void projectOperation(() => create ? port.create(projectName) : port.open());
  }
  const save = () => perform(() => project && files.project ? files.project.save(project.sessionId, active.sourceId, source) : files.save(source), 'Listing enregistré', true);
  async function saveAll() {
    if (busy || !project || !files.project) return;
    const snapshot = documents.map(item => ({ id: item.id, sourceId: item.sourceId, source: item.source }));
    setBusy(true);
    try {
      const result = await files.project.saveAll(project.sessionId, snapshot.map(item => ({ id: item.sourceId, source: item.source })));
      if ('error' in result) { setStatus(result.error); return; }
      setDocuments(items => items.map(item => {
        const saved = snapshot.find(previous => previous.id === item.id && result.savedIds.includes(previous.sourceId));
        return saved ? { ...item, saved: saved.source } : item;
      }));
      setStatus(`Projet enregistré : ${result.changedCount} source(s) écrite(s).`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Enregistrement global impossible.'); }
    finally { setBusy(false); }
  }
  const exportDisk = () => perform(() => project && files.project ? files.project.exportDisk(project.sessionId, documents.map(item => ({ id: item.sourceId, source: item.source }))) : files.exportDisk(source), 'DSK DATA construit — validation structurelle uniquement');
  function renumber(request: RenumberRequest) {
    const instance = editor.current, model = instance?.getModel();
    if (busy || !instance || !model || activeId !== request.documentId || model.getVersionId() !== request.version)
      throw new Error('Document ou révision modifié depuis l’aperçu. Recalculez la renumérotation.');
    const text = applyRenumber(request.plan, model.getValue());
    instance.pushUndoStop();
    instance.executeEdits('basic-renumber', [{ range: model.getFullModelRange(), text }]);
    instance.pushUndoStop();
    setStatus('Renumérotation du buffer appliquée ; non enregistrée. Ctrl Z pour annuler.');
  }
  const editorAction = (id: string) => { editor.current?.focus(); void editor.current?.getAction(id)?.run(); };
  const commands: WorkbenchCommand[] = [
    { id: 'open', label: 'Ouvrir un listing', disabled: busy, run: () => void open() },
    { id: 'project', label: 'Ouvrir un projet', disabled: busy || !files.project, run: () => openProject(false) },
    { id: 'save', label: 'Enregistrer le listing actif', detail: 'Ctrl S', disabled: busy, run: () => void save() },
    { id: 'save-all', label: 'Enregistrer tout le projet', disabled: busy || !project || !files.project, run: () => void saveAll() },
    { id: 'export', label: 'Exporter le projet en DSK', disabled: busy, run: () => void exportDisk() },
    { id: 'undo', label: 'Annuler la modification', disabled: busy, run: () => { editor.current?.focus(); editor.current?.trigger('workbench', 'undo', null); } },
    { id: 'redo', label: 'Rétablir la modification', disabled: busy, run: () => { editor.current?.focus(); editor.current?.trigger('workbench', 'redo', null); } },
    { id: 'find', label: 'Rechercher dans le listing', detail: 'Ctrl F', run: () => editorAction('actions.find') },
    { id: 'search-sources', label: 'Rechercher dans toutes les sources', detail: 'Ctrl Maj F', run: () => setSearchOpen(true) },
    { id: 'replace', label: 'Remplacer dans le listing', detail: 'Ctrl H', disabled: busy, run: () => editorAction('editor.action.startFindReplaceAction') },
    { id: 'line', label: 'Aller à une ligne physique', detail: 'Ctrl G · distinct du numéro BASIC', run: () => editorAction('editor.action.gotoLine') },
    { id: 'renumber', label: 'Renuméroter le BASIC', disabled: busy, run: () => setRenumberOpen(true) },
    { id: 'complete', label: 'Compléter le BASIC', detail: 'Ctrl Espace', disabled: busy, run: () => editorAction('editor.action.triggerSuggest') },
    { id: 'minimap', label: minimap ? 'Masquer la minimap' : 'Afficher la minimap', run: () => { editor.current?.updateOptions({ minimap: { enabled: !minimap } }); setMinimap(!minimap); } },
    { id: 'zoom-in', label: 'Agrandir le texte du code', run: () => editor.current?.updateOptions({ fontSize: Math.min(28, (editor.current?.getOption(monaco.editor.EditorOption.fontSize) ?? 16) + 1) }) },
    { id: 'zoom-out', label: 'Réduire le texte du code', run: () => editor.current?.updateOptions({ fontSize: Math.max(12, (editor.current?.getOption(monaco.editor.EditorOption.fontSize) ?? 16) - 1) }) },
    { id: 'terminal', label: terminalOpen ? 'Masquer le terminal' : 'Afficher le terminal', disabled: !project || !files.terminal, detail: 'Commandes hôte · confirmation native', run: () => setTerminalOpen(!terminalOpen) },
    ...documents.map(document => ({ id: `source:${document.id}`, label: `Ouvrir la source ${document.name}`, disabled: busy, run: () => { setActiveId(document.id); editor.current?.focus(); } })),
  ];
  const selectedSource = documents.find(document => document.id === contextSource);
  const sourceCommands: WorkbenchCommand[] = selectedSource ? [
    { id: 'select', label: 'Ouvrir cette source', disabled: busy, run: () => setActiveId(selectedSource.id) },
    { id: 'source-save', label: 'Enregistrer cette source', disabled: busy || !project || !files.project, run: () => {
      if (!project || !files.project || busy) return;
      setBusy(true); const selected = selectedSource;
      void files.project.save(project.sessionId, selected.sourceId, selected.source).then(result => {
        if (!result) setStatus('Enregistrement annulé.');
        else if ('error' in result) setStatus(result.error);
        else { setDocuments(items => items.map(item => item.id === selected.id ? { ...item, saved: selected.source } : item)); setStatus(`Source enregistrée : ${selected.name}`); }
      }).catch(() => setStatus('Enregistrement impossible.')).finally(() => setBusy(false));
    } },
    { id: 'entry', label: 'Définir cette source comme entrée', disabled: busy || !project || selectedSource.sourceId === project.manifest.entryPoint, run: () => { if (project && files.project) void projectOperation(() => files.project!.setEntry(project.sessionId, selectedSource.sourceId)); } },
  ] : [];
  const menu = (label: string, ids: string[]) => <details className="workbench-menu"><summary>{label}</summary><div>{commands.filter(command => ids.includes(command.id)).map(command => <button key={command.id} disabled={command.disabled} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); command.run(); }}>{command.label}</button>)}</div></details>;
  return <main className="workbench">
    <header className="topbar">
      <div className="brand"><img className="brand-mark" src="./brand/cpceleste-icon.png" width={56} height={56} alt="" /><div><h1>CPC<span>éleste</span></h1><p className="brand-tagline">Vos idées prennent vie en BASIC.</p><p>Atelier Amstrad CPC · alpha 0.16 · AstroWare Conception</p></div></div>
      <span className="profile">CPC 6128 · BASIC 1.1</span>
    </header>
    <nav className="menubar" aria-label="Menus de l’atelier">
      {menu('Fichier', ['open', 'project', 'save', 'save-all', 'export'])}{menu('Édition', ['undo', 'redo', 'find', 'replace', 'search-sources', 'line'])}
      {menu('BASIC', ['renumber', 'complete'])}{menu('Affichage', ['minimap', 'zoom-in', 'zoom-out', 'terminal'])}
      <button onClick={() => setPalette('all')}>Commandes <kbd>Ctrl Maj P</kbd></button><button onClick={() => setPalette('sources')}>Sources <kbd>Ctrl P</kbd></button>
    </nav>
    {palette && <CommandPalette key={palette} title={palette === 'all' ? 'Commandes CPCéleste' : 'Ouvrir rapidement une source'} commands={palette === 'all' ? commands : commands.filter(command => command.id.startsWith('source:'))} onClose={() => setPalette(undefined)} />}
    {selectedSource && <CommandPalette title={`Actions de ${selectedSource.name}`} searchable={false} commands={sourceCommands} onClose={() => setContextSource(undefined)} />}
    <nav className="toolbar" aria-label="Actions du listing">
      <button disabled={busy} onClick={() => void open()}>Ouvrir</button>
      <button disabled={busy || !files.project} title="Disponible dans l’application desktop" onClick={() => openProject(false)}>Ouvrir projet</button>
      <button disabled={busy} onClick={() => void save()}>Enregistrer <kbd>Ctrl S</kbd></button>
      <button disabled={busy || !project || !files.project} onClick={() => void saveAll()}>Enregistrer tout</button>
      <button disabled={busy || !!project} onClick={() => void perform(() => files.save(source, true), 'Listing enregistré', true)}>Enregistrer sous</button>
      <button className="primary" disabled={busy} onClick={() => void exportDisk()}>Exporter DSK</button>
      <button onClick={() => { editor.current?.focus(); void editor.current?.getAction('editor.action.triggerSuggest')?.run(); }}>Compléter <kbd>Ctrl Espace</kbd></button>
      <button disabled={busy} onClick={() => setRenumberOpen(true)}>Renuméroter</button>
    </nav>
    <div className="workspace">
      <section className="listing" aria-label="Éditeur">
        <div className="tabs" role="tablist" aria-label="Sources ouvertes">{documents.map(document => <button role="tab" aria-selected={document.id === activeId} className="tab" key={document.id} disabled={busy} onClick={() => setActiveId(document.id)} onContextMenu={event => { event.preventDefault(); setContextSource(document.id); }} onKeyDown={event => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); setContextSource(document.id); } }}>{document.name}{document.source !== document.saved ? ' • modifié' : ''}</button>)}</div>
        <Editor documents={documents} activeId={activeId} diagnostics={analysis.diagnostics} busy={busy} onChange={(id, value) => setDocuments(items => items.map(item => item.id === id ? { ...item, source: value } : item))} onCommand={setCard}
          navigation={navigation} onWorkspaceReady={value => { editorWorkspace.current = value; }}
          onPosition={(line, column) => setPosition({ line, column })}
          onSave={() => void save()} onReady={value => { editor.current = value; }} onPalette={() => setPalette('all')} onRenumber={() => setRenumberOpen(true)} onExport={() => void exportDisk()} />
        <div className="problems"><h2>Diagnostics <span>{analysis.diagnostics.length}</span></h2>
          <p className="muted">Analyse partielle : numéros, chaînes, cibles littérales et contraintes d’export. Un listing sans diagnostic n’est pas garanti exécutable.</p>
          {analysis.diagnostics.length ? <ul>{analysis.diagnostics.map((d, i) => <li key={`${d.line}-${d.start}-${i}`}><button onClick={() => {
            editor.current?.revealLineInCenter(d.line); editor.current?.setPosition({ lineNumber: d.line, column: d.start + 1 }); editor.current?.focus();
          }}>L{d.line} · {d.severity === 'error' ? 'Erreur' : 'Avertissement'} · {d.message}</button></li>)}</ul> : <p className="success">Aucun problème détecté dans le sous-ensemble analysé.</p>}
        </div>
      </section>
      <aside aria-label="Références et état du produit">
        {searchOpen && <SearchPanel key={`search:${project?.sessionId ?? documents[0]?.id}`} documents={documents} busy={busy} onClose={() => setSearchOpen(false)} onNavigate={match => { setActiveId(match.documentId); setNavigation({ ...match }); }} onApply={changes => { if (!editorWorkspace.current || busy) throw new Error('Éditeur indisponible.'); editorWorkspace.current.apply(changes); }} />}
        {project && <TerminalPanel key={`terminal:${project.sessionId}`} sessionId={project.sessionId} busy={busy} dirty={dirty} visible={terminalOpen} onBusy={setBusy} />}
        {project && <GitPanel key={`git:${project.sessionId}`} sessionId={project.sessionId} busy={busy} dirty={dirty} documentCount={project.manifest.documents.length} onBusy={setBusy} />}
        {renumberOpen && <RenumberPanel source={source} documentId={activeId} busy={busy} revision={() => editor.current?.getModel()?.getVersionId() ?? -1} onApply={renumber} onClose={() => setRenumberOpen(false)} />}
        <AgentPanel sessionId={project?.sessionId} documentCount={project?.manifest.documents.length ?? 0} buffers={documents.map(document => ({ id: document.sourceId, source: document.source }))} busy={busy} onRunning={setAgentBusy} onState={acceptAgent} />
        {project && <DocumentsPanel key={`documents:${project.sessionId}`} sessionId={project.sessionId} manifest={project.manifest} busy={busy} onBusy={setBusy} onManifest={manifest => setProject(previous => previous ? { ...previous, manifest } : previous)} />}
        <section className="panel"><h2>{project?.manifest.name ?? 'Projets BASIC'}</h2>
          {project ? <>
            <p>Entrée : {project.manifest.sources.find(item => item.id === project.manifest.entryPoint)?.cpcName}</p>
            <nav className="project-files" aria-label="Explorateur de sources">{documents.map(document => <div key={document.id}><button disabled={busy} onClick={() => setActiveId(document.id)} onContextMenu={event => { event.preventDefault(); setContextSource(document.id); }} aria-current={document.id === activeId ? 'page' : undefined}>{document.name}{document.source !== document.saved ? ' •' : ''}</button><button disabled={busy} aria-label={`Actions de ${document.name}`} onClick={() => setContextSource(document.id)}>⋯</button></div>)}</nav>
            <label htmlFor="source-name">Nouvelle source (1–8 caractères)</label><input id="source-name" value={sourceName} onChange={event => setSourceName(event.target.value)} maxLength={8} />
            <button disabled={busy || !sourceName} onClick={() => { if (files.project) void projectOperation(() => files.project!.add(project.sessionId, sourceName), true); }}>Ajouter source</button>
            <button disabled={busy || active.sourceId === project.manifest.entryPoint} onClick={() => { if (files.project) void projectOperation(() => files.project!.setEntry(project.sessionId, active.sourceId)); }}>Définir comme entrée</button>
            <p className="muted">Enregistrer sauvegarde uniquement l’onglet actif. Exporter construit tous les buffers, y compris non enregistrés. Les programmes restent indépendants sur le DSK.</p>
          </> : <><label htmlFor="project-name">Nom du projet</label><input id="project-name" value={projectName} onChange={event => setProjectName(event.target.value)} maxLength={100} />
            <button disabled={busy || !files.project} onClick={() => openProject(true)}>Créer projet dans un dossier vide</button>
            {!files.project && <p className="muted">Projets persistants disponibles dans l’application desktop, pas dans cet aperçu.</p>}</>}
        </section>
        <section className="panel"><h2>Référence BASIC</h2>
          <label htmlFor="command-search">Rechercher une commande</label>
          <input id="command-search" placeholder="PRINT, MODE, GOTO…" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="command-list">{COMMANDS.filter(c => c.name.includes(query.toUpperCase())).map(c => <button className={card?.name === c.name ? 'selected' : ''} key={c.name} onClick={() => setCard(c)}>{c.name}</button>)}</div>
          <h3>{card?.name ?? 'Une aide à portée de curseur'}</h3>
          {card ? <><pre>{card.syntax}</pre><p>{card.description}</p><p className="muted">command-reference.txt · ligne {card.line}</p></> : <p>Survolez une commande, placez le curseur dessus ou choisissez une fiche.</p>}
          <p className="muted">{provenance}. Signatures indicatives, options non exhaustives.</p>
        </section>
        <section className="panel"><h2>Votre atelier</h2><p><kbd>F12</kbd> Aller à une ligne ciblée</p><p><kbd>Ctrl Z</kbd> Annuler une modification</p><p>La complétion reconnaît commandes, identifiants observés et numéros de lignes. Elle est désactivée dans les commentaires, chaînes ouvertes et DATA.</p></section>
        <FirmwarePanel busy={busy} />
        <section className="panel pending"><h2>Prochaines connexions</h2><p>ROM locales configurables ; émulateur chips/WASM : qualification et worker desktop en attente.</p><p>Agent : sources BASIC, références, TXT/MD/PDF texte, aperçus PNG/JPEG et construction DSK ; conversion écran CPC et exécution CPC à venir.</p><p>Git : dépôt/index et historique locaux ; identité, commits et synchronisation intégrés à venir.</p><p>Export : disquette DATA avec sources BASIC ASCII, pas une compilation Z80 ni un lancement automatique.</p></section>
      </aside>
    </div>
    <footer role="status">{busy ? 'Opération en cours…' : status}<span>L{position.line} · C{position.column} · {window.desktop ? 'Bureau local' : 'Aperçu navigateur · enregistrement par téléchargement'}</span></footer>
  </main>;
}
