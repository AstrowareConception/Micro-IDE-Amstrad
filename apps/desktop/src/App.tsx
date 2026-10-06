import { Button } from './Icon.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeEditor } from '../../../packages/basic-language/src/syntax.ts';
import { WorkbenchMenus } from './WorkbenchMenus.tsx';
import { ShortcutsDialog } from './ShortcutsDialog.tsx';
import { NewProjectDialog } from './NewProjectDialog.tsx';
import { Icon } from './Icon.tsx';
import { COMMANDS, type CommandCard } from '../../../packages/basic-language/src/catalog.ts';
import { files, type Failure, type FileResult } from './port.ts';
import { Editor, type EditorWorkspace } from './Editor.tsx';
import { SearchPanel } from './SearchPanel.tsx';
import type { SearchMatch } from '../../../packages/workspace/src/search.ts';
import { monaco, provenance } from './monaco-language.ts';
import type { ProjectManifest, ProjectSnapshot } from '../../../packages/workspace/src/project.ts';
import type { AgentWorkspaceState } from '../../../packages/agent/src/types.ts';
import { AgentPanel } from './AgentPanel.tsx';
import { EmulatorPanel, type EmulatorLaunch } from './EmulatorPanel.tsx';
import { FirmwarePanel } from './FirmwarePanel.tsx';
import { DocumentsPanel } from './DocumentsPanel.tsx';
import { GitPanel } from './GitPanel.tsx';
import { RenumberPanel } from './RenumberPanel.tsx';
import type { RenumberRequest } from './RenumberPanel.tsx';
import { applyRenumber } from '../../../packages/basic-language/src/renumber.ts';
import { CommandPalette, type WorkbenchCommand } from './CommandPalette.tsx';
import { TerminalPanel } from './TerminalPanel.tsx';
import { HistoryPanel } from './HistoryPanel.tsx';
import { ExternalPanel } from './ExternalPanel.tsx';
import { DraftPanel } from './DraftPanel.tsx';

const SAMPLE = '10 REM MICRO IDE AMSTRAD\n20 MODE 1\n30 INK 0,0:INK 1,24\n40 PEN 1\n50 PRINT "BONJOUR CPC 6128 !"\n60 FOR I=1 TO 5\n70 PRINT "LOCOMOTIVE BASIC";I\n80 NEXT I\n90 END\n';
interface Document { id: string; sourceId: string; name: string; source: string; saved: string }

export function App() {
  const [documents, setDocuments] = useState<Document[]>([{ id: 'initial', sourceId: 'main', name: 'MAIN.bas', source: SAMPLE, saved: SAMPLE }]);
  const [activeId, setActiveId] = useState('initial');
  const [project, setProject] = useState<{ sessionId: string; manifest: ProjectManifest } | undefined>();
  const [projectName, setProjectName] = useState('Mon projet CPC');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const active = documents.find(document => document.id === activeId)!;
  const { source } = active;
  const [status, setStatus] = useState('Prêt. Écrivez du BASIC, sans ROM ni connexion.');
  const [emulatorLaunch, setEmulatorLaunch] = useState<EmulatorLaunch>();
  const runCurrent = useRef<() => void>(() => undefined);
  runCurrent.current = () => { if (!busy) { showOutput('emulator'); setEmulatorLaunch({ id: crypto.randomUUID(), request: project ? { sessionId: project.sessionId, sources: documents.map(document => ({ id: document.sourceId, source: document.source })) } : { source } }); } };
  const [fileBusy, setBusy] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [renumberOpen, setRenumberOpen] = useState(false);
  const [palette, setPalette] = useState<'all' | 'sources' | undefined>();
  const [contextSource, setContextSource] = useState<string>();
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [tool, setTool] = useState('project');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentOpen, setAgentOpen] = useState(true);
  const [outputOpen, setOutputOpen] = useState(true);
  const [outputTab, setOutputTab] = useState('problems');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [closedTabs, setClosedTabs] = useState(new Set<string>());
  const workbenchActions = useRef<WorkbenchCommand[]>([]);
  function showTool(name: string) { setTool(name); setSidebarOpen(true); }
  function showOutput(name: string) { setOutputTab(name); setOutputOpen(true); if (name === 'terminal') setTerminalOpen(true); }
  function closeTab(id: string) {
    const visible = documents.filter(item => !closedTabs.has(item.id) && item.id !== id);
    if (!visible.length) return;
    setClosedTabs(previous => new Set([...previous, id]));
    if (activeId === id) setActiveId(visible[0]!.id);
  }
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [navigation, setNavigation] = useState<SearchMatch>();
  const editorWorkspace = useRef<EditorWorkspace | undefined>(undefined);
  const [minimap, setMinimap] = useState(false);
  const busy = fileBusy || agentBusy;
  const [card, setCard] = useState<CommandCard | undefined>();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const analysis = useMemo(() => analyzeEditor(source), [source]);
  const dirty = documents.some(document => document.source !== document.saved);
  useEffect(() => { files.setDirty(dirty); }, [dirty]);
  useEffect(() => { if (searchOpen) showTool('search'); }, [searchOpen]);
  useEffect(() => { setClosedTabs(previous => { if (!previous.has(activeId)) return previous; const next = new Set(previous); next.delete(activeId); return next; }); }, [activeId]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest?.('dialog[open]')) return;
      const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      const id = event.key === 'F5' ? 'run' : event.key === 'F1' ? 'reference'
        : modifier && event.shiftKey && key === 'p' ? 'palette'
        : modifier && !event.shiftKey && key === 'p' ? 'quick-sources'
        : modifier && event.shiftKey && key === 'o' ? 'project'
        : modifier && !event.shiftKey && key === 'o' ? 'open'
        : modifier && event.shiftKey && key === 's' ? 'save-all'
        : modifier && event.altKey && key === 's' ? 'save-as'
        : modifier && !event.shiftKey && key === 's' ? 'save'
        : modifier && event.shiftKey && key === 'f' ? 'search-sources'
        : modifier && event.shiftKey && key === 'e' ? 'explorer'
        : modifier && event.shiftKey && key === 'g' ? 'git'
        : modifier && event.shiftKey && key === 'd' ? 'documents'
        : modifier && event.shiftKey && key === 'a' ? 'agent'
        : modifier && event.shiftKey && key === 'r' ? 'renumber'
        : modifier && event.altKey && key === 'r' ? 'firmware'
        : modifier && key === '`' ? 'terminal'
        : modifier && !event.shiftKey && key === 'b' ? 'sidebar'
        : modifier && !event.shiftKey && key === 'j' ? 'output'
        : modifier && !event.shiftKey && key === 'w' ? 'close-tab'
        : modifier && key === 'tab' ? (event.shiftKey ? 'previous-tab' : 'next-tab') : undefined;
      if (!id) return;
      const command = workbenchActions.current.find(item => item.id === id);
      if (command) { event.preventDefault(); event.stopPropagation(); if (!command.disabled) command.run(); }
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
    if (!append) setClosedTabs(new Set());
    showTool('project');
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
  function openProject(create: boolean, name = projectName) {
    const port = files.project;
    if (!port || busy || (dirty && !window.confirm('Abandonner les modifications non enregistrées ?'))) return;
    void projectOperation(() => create ? port.create(name) : port.open());
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
    { id: 'open', detail: 'Ctrl O', label: 'Ouvrir un listing', disabled: busy, run: () => void open() },
    { id: 'project', detail: 'Ctrl Maj O', label: 'Ouvrir un projet', disabled: busy || !files.project, run: () => openProject(false) },
    { id: 'save', label: 'Enregistrer le listing actif', detail: 'Ctrl S', disabled: busy, run: () => void save() },
    { id: 'save-all', detail: 'Ctrl Maj S', label: 'Enregistrer tout le projet', disabled: busy || !project || !files.project, run: () => void saveAll() },
    { id: 'local-history', label: 'Historique local de la source', disabled: busy || !project || !files.history, run: () => setHistoryOpen(true) },
    { id: 'run', label: 'Exécuter dans le CPC 6128', detail: 'F5', disabled: busy, run: () => runCurrent.current() },
    { id: 'export', label: 'Exporter le projet en DSK', disabled: busy, run: () => void exportDisk() },
    { id: 'undo', label: 'Annuler la modification', disabled: busy, run: () => { editor.current?.focus(); editor.current?.trigger('workbench', 'undo', null); } },
    { id: 'redo', label: 'Rétablir la modification', disabled: busy, run: () => { editor.current?.focus(); editor.current?.trigger('workbench', 'redo', null); } },
    { id: 'find', label: 'Rechercher dans le listing', detail: 'Ctrl F', run: () => editorAction('actions.find') },
    { id: 'search-sources', label: 'Rechercher dans toutes les sources', detail: 'Ctrl Maj F', run: () => { setSearchOpen(true); showTool('search'); } },
    { id: 'replace', label: 'Remplacer dans le listing', detail: 'Ctrl H', disabled: busy, run: () => editorAction('editor.action.startFindReplaceAction') },
    { id: 'line', label: 'Aller à une ligne physique', detail: 'Ctrl G · distinct du numéro BASIC', run: () => editorAction('editor.action.gotoLine') },
    { id: 'renumber', detail: 'Ctrl Maj R', label: 'Renuméroter le BASIC', disabled: busy, run: () => setRenumberOpen(true) },
    { id: 'complete', label: 'Compléter le BASIC', detail: 'Ctrl Espace', disabled: busy, run: () => editorAction('editor.action.triggerSuggest') },
    { id: 'minimap', label: minimap ? 'Masquer la minimap' : 'Afficher la minimap', run: () => { editor.current?.updateOptions({ minimap: { enabled: !minimap } }); setMinimap(!minimap); } },
    { id: 'zoom-in', label: 'Agrandir le texte du code', run: () => editor.current?.updateOptions({ fontSize: Math.min(28, (editor.current?.getOption(monaco.editor.EditorOption.fontSize) ?? 16) + 1) }) },
    { id: 'zoom-out', label: 'Réduire le texte du code', run: () => editor.current?.updateOptions({ fontSize: Math.max(12, (editor.current?.getOption(monaco.editor.EditorOption.fontSize) ?? 16) - 1) }) },
    ...[
      ['editor.action.marker.next', 'Problème suivant', 'F8'], ['editor.action.marker.prev', 'Problème précédent', 'Maj F8'],
      ['basic-comment', 'Commenter / décommenter les lignes', 'Ctrl /'],
      ['editor.action.copyLinesDownAction', 'Dupliquer la ligne vers le bas', 'Maj Alt ↓'],
      ['editor.action.moveLinesUpAction', 'Déplacer la ligne vers le haut', 'Alt ↑'],
      ['editor.action.moveLinesDownAction', 'Déplacer la ligne vers le bas', 'Alt ↓'],
      ['editor.action.deleteLines', 'Supprimer la ligne', 'Ctrl Maj K'],
      ['editor.action.addSelectionToNextFindMatch', 'Ajouter la prochaine occurrence à la sélection', 'Ctrl D'],
      ['editor.action.revealDefinition', 'Aller à la cible BASIC', 'F12'],
    ].map(([id, label, detail]) => ({ id: id!, label: label!, detail: detail!, disabled: busy, run: () => editorAction(id === 'editor.action.revealDefinition' ? 'basic-goto-line' : id === 'editor.action.marker.next' ? 'cpc-next-problem' : id === 'editor.action.marker.prev' ? 'cpc-previous-problem' : id!) })),
    { id: 'terminal', label: 'Afficher le terminal', detail: 'Ctrl `', run: () => showOutput('terminal') },
    { id: 'save-as', label: 'Enregistrer sous', detail: 'Ctrl Alt S', disabled: busy || !!project, run: () => void perform(() => files.save(source, true), 'Listing enregistré', true) },
    { id: 'create-project', label: 'Créer un projet', disabled: busy || !files.project, run: () => setNewProjectOpen(true) },
    { id: 'explorer', label: 'Afficher l’explorateur', detail: 'Ctrl Maj E', run: () => showTool('project') },
    { id: 'git', label: 'Afficher Git', detail: 'Ctrl Maj G', run: () => showTool('git') },
    { id: 'git-refresh', label: 'Actualiser Git', disabled: busy || !project || !files.git, run: () => { showTool('git'); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.git-panel button')?.click()); } },
    { id: 'git-history', label: 'Historique des commits Git', disabled: busy || !project || !files.git, run: () => { showTool('git'); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.git-panel button:nth-of-type(2)')?.click()); } },
    { id: 'git-commit', label: 'Préparer un commit Git', disabled: busy || !project || !files.git, run: () => { showTool('git'); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.git-commit-form textarea')?.focus()); } },
    { id: 'documents', label: 'Afficher les documents du projet', detail: 'Ctrl Maj D', run: () => showTool('documents') },
    { id: 'reference', label: 'Référence Locomotive BASIC', detail: 'F1', run: () => showTool('reference') },
    { id: 'firmware', label: 'Configurer les ROM du CPC', detail: 'Ctrl Alt R', run: () => showTool('firmware') },
    { id: 'recovery', label: 'Brouillons et modifications externes', run: () => showTool('recovery') },
    { id: 'agent', label: 'Afficher / masquer l’agent IA', detail: 'Ctrl Maj A', run: () => setAgentOpen(value => !value) },
    { id: 'problems', label: 'Afficher les problèmes', run: () => showOutput('problems') },
    { id: 'sidebar', label: 'Afficher / masquer les outils', detail: 'Ctrl B', run: () => setSidebarOpen(value => !value) },
    { id: 'output', label: 'Afficher / masquer les sorties', detail: 'Ctrl J', run: () => setOutputOpen(value => !value) },
    { id: 'palette', label: 'Palette des commandes', detail: 'Ctrl Maj P', run: () => setPalette('all') },
    { id: 'quick-sources', label: 'Ouvrir rapidement une source', detail: 'Ctrl P', run: () => setPalette('sources') },
    { id: 'shortcuts', label: 'Raccourcis clavier et souris', run: () => setShortcutsOpen(true) },
    { id: 'close-tab', label: 'Fermer l’onglet actif', detail: 'Ctrl W · buffer conservé', disabled: busy || documents.filter(item => !closedTabs.has(item.id)).length < 2, run: () => closeTab(activeId) },
    { id: 'next-tab', label: 'Source suivante', detail: 'Ctrl Tab', disabled: busy, run: () => setActiveId(documents[(documents.findIndex(item => item.id === activeId) + 1) % documents.length]!.id) },
    { id: 'previous-tab', label: 'Source précédente', detail: 'Ctrl Maj Tab', disabled: busy, run: () => setActiveId(documents[(documents.findIndex(item => item.id === activeId) + documents.length - 1) % documents.length]!.id) },
    ...documents.map(document => ({ id: `source:${document.id}`, label: `Ouvrir la source ${document.name}`, disabled: busy, run: () => { setActiveId(document.id); editor.current?.focus(); } })),
  ];
  workbenchActions.current = commands;
  const selectedSource = documents.find(document => document.id === contextSource);
  const sourceCommands: WorkbenchCommand[] = selectedSource ? [
    { id: 'select', label: 'Ouvrir cette source', disabled: busy, run: () => setActiveId(selectedSource.id) },
    { id: 'source-history', label: 'Historique local de cette source', disabled: busy || !project || !files.history, run: () => { setActiveId(selectedSource.id); setHistoryOpen(true); } },
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
  return <main className="workbench">
    <header className="topbar">
      <div className="brand"><img className="brand-mark" src="./brand/cpceleste-icon.png" width={56} height={56} alt="" /><div><h1>CPC<span>éleste</span></h1><p className="brand-tagline">Vos idées prennent vie en BASIC.</p><p>Atelier Amstrad CPC · alpha 0.25 · AstroWare Conception</p></div></div>
      <span className="profile">CPC 6128 · BASIC 1.1</span>
    </header>
    <WorkbenchMenus groups={[
      ['Fichier', ['open', 'project', 'create-project', 'save', 'save-all', 'save-as', 'local-history', 'export']],
      ['Édition', ['undo', 'redo', 'find', 'replace', 'search-sources', 'line', 'basic-comment', 'editor.action.copyLinesDownAction', 'editor.action.moveLinesUpAction', 'editor.action.moveLinesDownAction', 'editor.action.deleteLines', 'editor.action.addSelectionToNextFindMatch', 'next-tab', 'previous-tab', 'close-tab']],
      ['BASIC', ['run', 'renumber', 'complete', 'editor.action.revealDefinition', 'editor.action.marker.next', 'editor.action.marker.prev', 'reference']],
      ['Git', ['git', 'git-refresh', 'git-history', 'git-commit']],
      ['Projet', ['explorer', 'documents', 'recovery']],
      ['Affichage', ['sidebar', 'agent', 'output', 'problems', 'terminal', 'minimap', 'zoom-in', 'zoom-out', 'palette', 'quick-sources']],
      ['Outils', ['firmware', 'shortcuts']],
    ].map(([label, ids]) => ({ label: label as string, commands: (ids as string[]).map(id => commands.find(command => command.id === id)!) }))} />
    {newProjectOpen && <NewProjectDialog busy={busy} onClose={() => setNewProjectOpen(false)} onCreate={name => { setProjectName(name); openProject(true, name); }} />}
    {renumberOpen && <RenumberPanel source={source} documentId={activeId} busy={busy} revision={() => editor.current?.getModel()?.getVersionId() ?? -1} onApply={renumber} onClose={() => setRenumberOpen(false)} />}
    {palette && <CommandPalette key={palette} title={palette === 'all' ? 'Commandes CPCéleste' : 'Ouvrir rapidement une source'} commands={palette === 'all' ? commands : commands.filter(command => command.id.startsWith('source:'))} onClose={() => setPalette(undefined)} />}
    {selectedSource && <CommandPalette title={`Actions de ${selectedSource.name}`} searchable={false} commands={sourceCommands} onClose={() => setContextSource(undefined)} />}
    {historyOpen && project && <HistoryPanel key={`history:${project.sessionId}:${active.id}`} sessionId={project.sessionId} sourceId={active.sourceId} path={active.name} source={source} busy={busy} onClose={() => setHistoryOpen(false)} onApply={(before, after) => {
      if (!editorWorkspace.current) throw new Error('Éditeur indisponible.');
      editorWorkspace.current.apply([{ id: active.id, name: active.name, before, after, count: 1 }]);
      setStatus('Version locale restaurée dans le buffer ; non enregistrée. Ctrl Z pour annuler.');
    }} />}
    <nav className="toolbar" aria-label="Actions du listing">
      <Button disabled={busy} onClick={() => void open()}>Ouvrir</Button>
      <Button disabled={busy || !files.project} title="Disponible dans l’application desktop" onClick={() => openProject(false)}>Ouvrir projet</Button>
      <Button disabled={busy} onClick={() => void save()}>Enregistrer <kbd>Ctrl S</kbd></Button>
      <Button disabled={busy || !project || !files.project} onClick={() => void saveAll()}>Enregistrer tout</Button>
      <Button disabled={busy || !project || !files.history} onClick={() => setHistoryOpen(true)}>Historique local</Button>
      <Button disabled={busy || !!project} onClick={() => void perform(() => files.save(source, true), 'Listing enregistré', true)}>Enregistrer sous</Button>
      <Button className="primary" disabled={busy} onClick={() => runCurrent.current()}>Exécuter <kbd>F5</kbd></Button>
      <Button className="primary" disabled={busy} onClick={() => void exportDisk()}>Exporter DSK</Button>
      <Button onClick={() => { editor.current?.focus(); void editor.current?.getAction('editor.action.triggerSuggest')?.run(); }}>Compléter <kbd>Ctrl Espace</kbd></Button>
      <Button disabled={busy} onClick={() => setRenumberOpen(true)}>Renuméroter</Button>
    </nav>
    <div className={`workspace ${sidebarOpen ? '' : 'sidebar-closed'} ${agentOpen ? '' : 'agent-closed'}`}>
      <nav className="activitybar" aria-label="Outils de l’IDE">{[
        ['project', 'Explorateur', 'folder'], ['search', 'Recherche', 'search'], ['git', 'Git', 'git'], ['documents', 'Documents', 'file'], ['reference', 'Référence BASIC', 'book'], ['recovery', 'Récupération', 'history'], ['firmware', 'ROM CPC', 'chip'],
      ].map(([id, label, icon]) => <Button key={id} icon={icon as import('./Icon.tsx').IconName} aria-label={`Afficher ${label}`} aria-pressed={sidebarOpen && tool === id} title={label} onClick={() => { if (sidebarOpen && tool === id) setSidebarOpen(false); else showTool(id!); }} />)}<Button icon="spark" aria-label="Afficher l’agent IA" aria-pressed={agentOpen} title="Agent IA · Ctrl Maj A" onClick={() => setAgentOpen(value => !value)} /></nav>
      <aside className="tool-sidebar" aria-label="Outils du projet" hidden={!sidebarOpen}>
        <div className="tool-content" hidden={tool !== 'recovery'}>{!project && <div className="empty-tool">Ouvrez un projet pour retrouver ses brouillons et suivre les modifications externes.</div>}
        {project && files.external && <ExternalPanel key={`external:${project.sessionId}`} sessionId={project.sessionId} documents={documents} busy={busy} onAccept={(version, before, reload) => {
          const id = `${project.sessionId}:${version.id}`;
          let loaded = false;
          if (reload && !busy && editorWorkspace.current?.source(id) === before) {
            try { editorWorkspace.current.apply([{ id, name: version.path, before, after: version.source, count: 1 }]); loaded = true; }
            catch { /* Keep the buffer if it changed while the disk baseline was being adopted. */ }
          }
          setDocuments(items => items.map(item => item.id === id ? { ...item, saved: version.source } : item));
          setStatus(loaded ? 'Version disque chargée ; Ctrl Z annule dans le buffer.' : 'Buffer conservé. La prochaine sauvegarde explicite remplacera la version disque comparée.');
        }} />}
        {project && files.drafts && <DraftPanel key={`drafts:${project.sessionId}`} sessionId={project.sessionId} documents={documents} busy={busy} onApply={changes => {
          if (!editorWorkspace.current) throw new Error('Éditeur indisponible.');
          editorWorkspace.current.apply(changes);
          setStatus('Brouillons récupérés dans les buffers ; non enregistrés. Ctrl Z pour annuler.');
        }} />}
        </div><div className="tool-content" hidden={tool !== 'search'}>
        <SearchPanel key={`search:${project?.sessionId ?? documents[0]?.id}`} documents={documents} busy={busy} onClose={() => { setSearchOpen(false); showTool('project'); }} onNavigate={match => { setActiveId(match.documentId); setNavigation({ ...match }); }} onApply={changes => { if (!editorWorkspace.current || busy) throw new Error('Éditeur indisponible.'); editorWorkspace.current.apply(changes); }} />
        </div>
        <div className="tool-content" hidden={tool !== 'git'}>{!project && <section className="panel"><h2>Contrôle de version Git</h2><p>Ouvrez ou créez un projet pour afficher son statut, index, commits et historique Git.</p><Button disabled={busy || !files.project} onClick={() => openProject(false)}>Choisir un projet pour Git</Button></section>}
        {project && <GitPanel key={`git:${project.sessionId}`} sessionId={project.sessionId} busy={busy} dirty={dirty} documentCount={project.manifest.documents.length} onBusy={setBusy} />}
        </div>


        <div className="tool-content" hidden={tool !== 'documents'}>{!project && <div className="empty-tool">Ouvrez un projet pour importer textes, images et PDF.</div>}
        {project && <DocumentsPanel key={`documents:${project.sessionId}`} sessionId={project.sessionId} manifest={project.manifest} busy={busy} onBusy={setBusy} onManifest={manifest => setProject(previous => previous ? { ...previous, manifest } : previous)} />}
        </div><div className="tool-content" hidden={tool !== 'project'}><section className="panel"><h2>{project?.manifest.name ?? 'Projets BASIC'}</h2>
          {project ? <>
            <p>Entrée : {project.manifest.sources.find(item => item.id === project.manifest.entryPoint)?.cpcName}</p>
            <nav className="project-files" aria-label="Explorateur de sources">{documents.map(document => <div key={document.id}><Button disabled={busy} onClick={() => setActiveId(document.id)} onContextMenu={event => { event.preventDefault(); setContextSource(document.id); }} aria-current={document.id === activeId ? 'page' : undefined}>{document.name}{document.source !== document.saved ? ' •' : ''}</Button><Button disabled={busy} aria-label={`Actions de ${document.name}`} onClick={() => setContextSource(document.id)}>⋯</Button></div>)}</nav>
            <label htmlFor="source-name">Nouvelle source (1–8 caractères)</label><input id="source-name" value={sourceName} onChange={event => setSourceName(event.target.value)} maxLength={8} />
            <Button disabled={busy || !sourceName} onClick={() => { if (files.project) void projectOperation(() => files.project!.add(project.sessionId, sourceName), true); }}>Ajouter source</Button>
            <Button disabled={busy || active.sourceId === project.manifest.entryPoint} onClick={() => { if (files.project) void projectOperation(() => files.project!.setEntry(project.sessionId, active.sourceId)); }}>Définir comme entrée</Button>
            <p className="muted">Enregistrer sauvegarde uniquement l’onglet actif. Exporter construit tous les buffers, y compris non enregistrés. Les programmes restent indépendants sur le DSK.</p>
          </> : <><label htmlFor="project-name">Nom du projet</label><input id="project-name" value={projectName} onChange={event => setProjectName(event.target.value)} maxLength={100} />
            <Button disabled={busy || !files.project} onClick={() => openProject(true)}>Créer projet dans un dossier vide</Button>
            {!files.project && <p className="muted">Projets persistants disponibles dans l’application desktop, pas dans cet aperçu.</p>}</>}
        </section>
        </div><div className="tool-content" hidden={tool !== 'reference'}><section className="panel"><h2>Référence BASIC</h2>
          <label htmlFor="command-search">Rechercher une commande</label>
          <input id="command-search" placeholder="PRINT, MODE, GOTO…" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="command-list">{COMMANDS.filter(c => c.name.includes(query.toUpperCase())).map(c => <Button className={card?.name === c.name ? 'selected' : ''} key={c.name} onClick={() => setCard(c)}>{c.name}</Button>)}</div>
          <h3>{card?.name ?? 'Une aide à portée de curseur'}</h3>
          {card ? <><pre>{card.syntax}</pre><p>{card.description}</p><p className="muted">command-reference.txt · ligne {card.line}</p></> : <p>Survolez une commande, placez le curseur dessus ou choisissez une fiche.</p>}
          <p className="muted">{provenance}. Signatures indicatives, options non exhaustives.</p>
        </section>
        </div><div className="tool-content" hidden={tool !== 'firmware'}><FirmwarePanel busy={busy} /></div>
      </aside>

      <section className="listing" aria-label="Éditeur">
        <div className="tabs" role="tablist" aria-label="Sources ouvertes">{documents.filter(document => !closedTabs.has(document.id)).map(document => <div className="tab-entry" key={document.id}><Button role="tab" aria-selected={document.id === activeId} className="tab" disabled={busy} onClick={() => setActiveId(document.id)} onMouseDown={event => { if (event.button === 1) { event.preventDefault(); closeTab(document.id); } }} onContextMenu={event => { event.preventDefault(); setContextSource(document.id); }} onKeyDown={event => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); setContextSource(document.id); } }}>{document.name}{document.source !== document.saved ? ' • modifié' : ''}</Button><Button icon="close" className="tab-close" aria-label={`Fermer l’onglet ${document.name}`} title="Fermer la vue · buffer conservé · Ctrl W" disabled={busy || documents.filter(item => !closedTabs.has(item.id)).length < 2} onClick={() => closeTab(document.id)} /></div>)}</div>
        <Editor documents={documents} activeId={activeId} diagnostics={analysis.diagnostics} busy={busy} onChange={(id, value) => setDocuments(items => items.map(item => item.id === id ? { ...item, source: value } : item))} onCommand={setCard}
          navigation={navigation} onWorkspaceReady={value => { editorWorkspace.current = value; }}
          onPosition={(line, column) => setPosition({ line, column })}
          onSave={() => void save()} onReady={value => { editor.current = value; }} onPalette={() => setPalette('all')} onRenumber={() => setRenumberOpen(true)} onExport={() => void exportDisk()} />
        <div className="output-dock" hidden={!outputOpen}><nav className="output-tabs" aria-label="Panneaux de sortie"><Button aria-pressed={outputTab === 'problems'} onClick={() => showOutput('problems')} icon="warning">Problèmes {analysis.diagnostics.length}</Button><Button aria-pressed={outputTab === 'emulator'} onClick={() => showOutput('emulator')} icon="chip">CPC</Button><Button aria-pressed={outputTab === 'terminal'} onClick={() => showOutput('terminal')} icon="terminal">Terminal</Button><Button aria-label="Masquer les sorties" icon="close" onClick={() => setOutputOpen(false)} /></nav><div hidden={outputTab !== 'problems'} className="problems"><h2>Diagnostics <span>{analysis.diagnostics.length}</span></h2>
          <p className="muted">Analyse syntaxique conservative : expressions incomplètes, parenthèses, IF/FOR, arguments, cibles et export. Un listing sans diagnostic n’est pas garanti exécutable.</p>
          {analysis.diagnostics.length ? <ul>{analysis.diagnostics.map((d, i) => <li key={`${d.line}-${d.start}-${i}`}><Button onClick={() => {
            editor.current?.revealLineInCenter(d.line); editor.current?.setPosition({ lineNumber: d.line, column: d.start + 1 }); editor.current?.focus();
          }}>L{d.line} · {d.severity === 'error' ? 'Erreur' : 'Avertissement'} · {d.message}</Button></li>)}</ul> : <p className="success">Aucun problème détecté dans le sous-ensemble analysé.</p>}
        </div>
        <div hidden={outputTab !== 'emulator'}>{emulatorLaunch ? <EmulatorPanel key={emulatorLaunch.id} launch={emulatorLaunch} onClose={() => setEmulatorLaunch(undefined)} onConfigure={() => showTool('firmware')} /> : <div className="empty-tool"><Icon name="chip" /><p>Exécutez le listing avec F5 pour ouvrir le CPC.</p></div>}</div>
        {project ? <TerminalPanel key={`terminal:${project.sessionId}`} sessionId={project.sessionId} busy={busy} dirty={dirty} visible={terminalOpen && outputTab === 'terminal'} onBusy={setBusy} /> : outputTab === 'terminal' && <div className="empty-tool">Ouvrez un projet pour exécuter des commandes dans son dossier.</div>}
        </div>
      </section>
      <aside className="ai-sidebar" aria-label="Assistant IA" hidden={!agentOpen}>
        <div className="tool-heading"><Icon name="spark" /><strong>Assistant de programmation</strong><Button icon="close" aria-label="Masquer l’agent IA" onClick={() => setAgentOpen(false)} /></div>
        <AgentPanel sessionId={project?.sessionId} documentCount={project?.manifest.documents.length ?? 0} buffers={documents.map(document => ({ id: document.sourceId, source: document.source }))} busy={busy} onRunning={setAgentBusy} onState={acceptAgent} />
      </aside>
    </div>
    {shortcutsOpen && <ShortcutsDialog commands={commands} onClose={() => setShortcutsOpen(false)} />}
    <footer role="status"><Button icon="warning" title="Afficher les diagnostics" onClick={() => showOutput('problems')}>{analysis.diagnostics.filter(item => item.severity === 'error').length} erreur(s)</Button>{busy ? 'Opération en cours…' : status}<span>L{position.line} · C{position.column} · {window.desktop ? 'Bureau local' : 'Aperçu navigateur · enregistrement par téléchargement'}</span></footer>
  </main>;
}
