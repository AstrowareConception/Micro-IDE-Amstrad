import { GitHubDialog } from './GitHubDialog.tsx';
import { RecentProjectsDialog } from './RecentProjectsDialog.tsx';
import { DockPanel } from './DockPanel.tsx';
import { ResizeHandle } from './ResizeHandle.tsx';
import { defaultPanelLayouts, loadPanelLayouts, persistPanelLayouts, type PanelId, type PanelLayout } from './panel-layout.ts';
import { Button } from './Icon.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeEditor } from '../../../packages/basic-language/src/syntax.ts';
import { WorkbenchMenus } from './WorkbenchMenus.tsx';
import { ShortcutsDialog } from './ShortcutsDialog.tsx';
import { FeedbackDialog } from './FeedbackDialog.tsx';
import { SettingsDialog } from './SettingsDialog.tsx';
import { loadPreferences, persistPreferences, type Preferences } from './preferences.ts';
import type { CSSProperties } from 'react';
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
import { GitLogPanel } from './GitLogPanel.tsx';
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
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [panels, setPanels] = useState(loadPanelLayouts);
  const workspaceElement = useRef<HTMLDivElement>(null);
  const [workspaceSize, setWorkspaceSize] = useState({ width: 1440, height: 700 });
  function updatePanel(id: PanelId, value: PanelLayout) { setPanels(previous => ({ ...previous, [id]: value })); }
  useEffect(() => {
    const element = workspaceElement.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWorkspaceSize({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const [recentProjectsOpen, setRecentProjectsOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const autoSaveAttempt = useRef('');
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
  const [sidebarOpen, setSidebarOpen] = useState(panels.tools.visible);
  const [agentOpen, setAgentOpen] = useState(panels.agent.visible);
  const [outputOpen, setOutputOpen] = useState(panels.output.visible);
  const [outputTab, setOutputTab] = useState('problems');
  useEffect(() => {
    const save = () => { if (!persistPanelLayouts({ tools: { ...panels.tools, visible: sidebarOpen }, agent: { ...panels.agent, visible: agentOpen }, output: { ...panels.output, visible: outputOpen } })) setStatus('Disposition appliquée pour cette session ; conservation indisponible.'); };
    const timer = setTimeout(save, 150); window.addEventListener('pagehide', save);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', save); };
  }, [panels, sidebarOpen, agentOpen, outputOpen]);

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
  const busy = fileBusy || agentBusy;
  const [card, setCard] = useState<CommandCard | undefined>();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const analysis = useMemo(() => analyzeEditor(source), [source]);
  const dirty = documents.some(document => document.source !== document.saved);
  useEffect(() => {
    const save = () => { if (!persistPreferences(preferences)) setStatus('Paramètres appliqués pour cette session ; conservation indisponible.'); };
    const timer = setTimeout(save, 150); window.addEventListener('pagehide', save);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', save); };
  }, [preferences]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const applyTheme = () => { const light = preferences.theme === 'light' || preferences.theme === 'system' && media.matches; document.documentElement.dataset.theme = light ? 'light' : 'dark'; monaco.editor.setTheme(light ? 'cpc-workbench-light' : 'cpc-workbench'); };
    applyTheme(); media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [preferences.theme]);
  useEffect(() => {
    if (!preferences.autoSave) { autoSaveAttempt.current = ''; return; }
    if (!project || !files.project || busy || !dirty) return;
    const revision = JSON.stringify([project.sessionId, preferences.autoSaveDelay, documents.map(item => [item.id, item.source, item.saved])]);
    if (autoSaveAttempt.current === revision) return;
    const timer = setTimeout(() => { autoSaveAttempt.current = revision; void saveAll(); }, preferences.autoSaveDelay);
    return () => clearTimeout(timer);
  }, [preferences.autoSave, preferences.autoSaveDelay, project?.sessionId, busy, dirty, documents]);
  useEffect(() => { files.setDirty(dirty); }, [dirty]);
  useEffect(() => { if (searchOpen) showTool('search'); }, [searchOpen]);
  useEffect(() => { setClosedTabs(previous => { if (!previous.has(activeId)) return previous; const next = new Set(previous); next.delete(activeId); return next; }); }, [activeId]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest?.('dialog[open]')) return;
      const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      const id = modifier && event.altKey && key === 'k' ? 'git-push' : modifier && event.altKey && key === 'g' ? 'git-fetch' : modifier && event.altKey && key === 'b' ? 'git-branches' : modifier && key === ',' ? 'settings' : event.key === 'F5' ? 'run' : event.key === 'F1' ? 'reference'
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
        : modifier && !event.shiftKey && !event.altKey && key === 'r' && !!files.recentProjects ? 'recent-projects'
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
    if (busy) return false; setBusy(true);
    try {
      const result = await action();
      if (!result) { setStatus('Opération annulée.'); return false; }
      if ('error' in result) { setStatus(result.error); return result.error; }
      if ('files' in result) acceptProject(result, append);
      else setProject(previous => previous ? { ...previous, manifest: result } : previous);
      setStatus('recentProjectsNotice' in result && typeof result.recentProjectsNotice === 'string' && result.recentProjectsNotice ? result.recentProjectsNotice : 'Projet mis à jour. Les buffers existants sont conservés lors d’un ajout.');
      return true;
    } catch (error) { setStatus(String(error)); return String(error); }
    finally { setBusy(false); }
  }
  function openProject(create: boolean, name = projectName) {
    const port = files.project;
    if (!port || busy || (dirty && !window.confirm('Abandonner les modifications non enregistrées ?'))) return;
    void projectOperation(() => create ? port.create(name) : port.open());
  }
  async function openRecentProject(id: string) {
    if (!files.recentProjects || busy || (dirty && !window.confirm('Abandonner les modifications non enregistrées ?'))) return false;
    return await projectOperation(() => files.recentProjects!.open(id)) ?? false;
  }
  async function cloneProject(url: string, name: string) {
    if (!files.gitOperations || busy || dirty && !window.confirm('Abandonner les modifications non enregistrées ?')) return false;
    return await projectOperation(() => files.gitOperations!.clone(url, name));
  }
  async function associateRemote(url: string, remote: string) {
    if (!files.gitOperations || !project || busy || dirty) return false; setBusy(true);
    try {
      const overview = await files.gitOperations.overview(project.sessionId); if ('error' in overview) return overview.error;
      const plan = await files.gitOperations.prepare(project.sessionId, overview.revision, { action: overview.remotes.some(entry => entry.name === remote) ? 'set-remote' : 'add-remote', remote, url });
      if ('error' in plan) return plan.error;
      const result = await files.gitOperations.apply(project.sessionId, plan.id); if (!result) return false; if ('error' in result) return result.error;
      setStatus(result.summary); return true;
    } catch { return 'Association non confirmée ; actualisez Git avant de reprendre.'; }
    finally { setBusy(false); }
  }
  function gitAction(action: string) {
    showTool('git'); requestAnimationFrame(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-git-action="' + action + '"]');
      let details = button?.closest('details'); while (details) { details.open = true; details = details.parentElement?.closest('details'); }
      button?.scrollIntoView({ block: 'nearest' });
      if (action === 'remote' || action === 'create-branch') button?.closest('details')?.querySelector<HTMLInputElement>('input')?.focus();
      else if (action === 'suggest-message') document.querySelector<HTMLInputElement>('.git-commit-form input')?.focus();
      else button?.click();
    });
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
    { id: 'recent-projects', label: 'Projets récents…', detail: 'Ctrl R', disabled: busy || !files.recentProjects, run: () => setRecentProjectsOpen(true) },
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
    { id: 'minimap', label: preferences.minimap ? 'Masquer la minimap' : 'Afficher la minimap', run: () => setPreferences(previous => ({ ...previous, minimap: !previous.minimap })) },
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
    { id: 'github', label: 'Compte GitHub et dépôts privés…', disabled: busy || !files.github, run: () => setGithubOpen(true) },
    { id: 'clone', label: 'Cloner un dépôt Git…', disabled: busy || !files.gitOperations, run: () => setGithubOpen(true) },
    ...([['git-init', 'Créer un dépôt Git local…', 'init'], ['git-remotes', 'Configurer les remotes…', 'remote'], ['git-branches', 'Branches locales et distantes', 'branches'], ['git-create-branch', 'Créer une branche…', 'create-branch'], ['git-fetch', 'Fetch · références distantes', 'fetch'], ['git-pull', 'Pull · fast-forward', 'pull'], ['git-push', 'Push · publier la branche…', 'push'], ['git-prs', 'Pull requests GitHub…', 'prs'], ['git-ai-message', 'Message de commit par IA…', 'suggest-message']] as const).map(([id, label, action]) => ({ id, label, ...(action === 'push' ? { detail: 'Ctrl Alt K' } : action === 'fetch' ? { detail: 'Ctrl Alt G' } : action === 'branches' ? { detail: 'Ctrl Alt B' } : {}), disabled: busy || dirty || !project || !files.gitOperations, run: () => gitAction(action) })),
    { id: 'git-refresh', label: 'Actualiser Git', disabled: busy || !project || !files.git, run: () => { showTool('git'); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.git-panel button')?.click()); } },
    { id: 'git-history', label: 'Historique des commits Git', disabled: busy || !project || !files.git, run: () => showOutput('git-log') },
    { id: 'git-commit', label: 'Préparer un commit Git', disabled: busy || !project || !files.git, run: () => { showTool('git'); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.git-commit-form textarea')?.focus()); } },
    { id: 'documents', label: 'Afficher les documents du projet', detail: 'Ctrl Maj D', run: () => showTool('documents') },
    { id: 'reference', label: 'Référence Locomotive BASIC', detail: 'F1', run: () => showTool('reference') },
    { id: 'firmware', label: 'Configurer les ROM du CPC', detail: 'Ctrl Alt R', run: () => showTool('firmware') },
    { id: 'recovery', label: 'Brouillons et modifications externes', run: () => showTool('recovery') },
    { id: 'agent', label: 'Afficher / masquer l’agent IA', detail: 'Ctrl Maj A', run: () => setAgentOpen(value => !value) },
    { id: 'reset-layout', label: 'Restaurer la disposition des panneaux', run: () => { setPanels(defaultPanelLayouts()); setSidebarOpen(true); setAgentOpen(true); setOutputOpen(true); setPreferences(previous => ({ ...previous, sidebarWidth: 260, agentWidth: 310, outputHeight: 230 })); } },
    { id: 'problems', label: 'Afficher les problèmes', run: () => showOutput('problems') },
    { id: 'sidebar', label: 'Afficher / masquer les outils', detail: 'Ctrl B', run: () => setSidebarOpen(value => !value) },
    { id: 'output', label: 'Afficher / masquer les sorties', detail: 'Ctrl J', run: () => setOutputOpen(value => !value) },
    { id: 'palette', label: 'Palette des commandes', detail: 'Ctrl Maj P', run: () => setPalette('all') },
    { id: 'quick-sources', label: 'Ouvrir rapidement une source', detail: 'Ctrl P', run: () => setPalette('sources') },
    { id: 'feedback', label: 'Proposer une amélioration ou signaler un problème', run: () => setFeedbackOpen(true) },
    { id: 'settings', label: 'Paramètres de CPCéleste', detail: 'Ctrl ,', run: () => setSettingsOpen(true) },
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
  return <main className="workbench" style={{ '--sidebar-width': `${preferences.sidebarWidth}px`, '--agent-width': `${preferences.agentWidth}px`, '--output-height': `${preferences.outputHeight}px` } as CSSProperties}>
    <header className="topbar">
      <div className="brand"><img className="brand-mark" src="./brand/cpceleste-icon.png" width={56} height={56} alt="" /><div><h1>CPC<span>éleste</span></h1><p className="brand-tagline">Vos idées prennent vie en BASIC.</p><p>Atelier Amstrad CPC · alpha 0.29 · AstroWare Conception</p></div></div>
      <span className="profile">CPC 6128 · BASIC 1.1</span>
    </header>
    <WorkbenchMenus groups={[
      ['Fichier', ['open', 'project', 'recent-projects', 'clone', 'create-project', 'save', 'save-all', 'save-as', 'local-history', 'export']],
      ['Édition', ['undo', 'redo', 'find', 'replace', 'search-sources', 'line', 'basic-comment', 'editor.action.copyLinesDownAction', 'editor.action.moveLinesUpAction', 'editor.action.moveLinesDownAction', 'editor.action.deleteLines', 'editor.action.addSelectionToNextFindMatch', 'next-tab', 'previous-tab', 'close-tab']],
      ['BASIC', ['run', 'renumber', 'complete', 'editor.action.revealDefinition', 'editor.action.marker.next', 'editor.action.marker.prev', 'reference']],
      ['Git', ['git', 'git-refresh', 'git-init', 'git-commit', 'git-ai-message', 'git-history', 'git-branches', 'git-create-branch', 'git-remotes', 'git-fetch', 'git-pull', 'git-push', 'clone', 'github', 'git-prs']],
      ['Projet', ['explorer', 'documents', 'recovery']],
      ['Affichage', ['sidebar', 'agent', 'output', 'problems', 'terminal', 'git-history', 'reset-layout', 'minimap', 'zoom-in', 'zoom-out', 'palette', 'quick-sources']],
      ['Outils', ['firmware', 'settings', 'shortcuts']],
      ['Aide', ['reference', 'shortcuts', 'feedback']],
    ].map(([label, ids]) => ({ label: label as string, commands: (ids as string[]).map(id => commands.find(command => command.id === id)!) }))} />
    {newProjectOpen && <NewProjectDialog busy={busy} onClose={() => setNewProjectOpen(false)} onCreate={name => { setProjectName(name); openProject(true, name); }} />}
    {renumberOpen && <RenumberPanel source={source} documentId={activeId} busy={busy} defaultStart={preferences.renumberStart} defaultStep={preferences.renumberStep} revision={() => editor.current?.getModel()?.getVersionId() ?? -1} onApply={renumber} onClose={() => setRenumberOpen(false)} />}
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
    <div ref={workspaceElement} className={`workspace ${sidebarOpen && !panels.tools.floating ? '' : 'sidebar-closed'} ${agentOpen && !panels.agent.floating ? '' : 'agent-closed'}`}>
      <nav className="activitybar" aria-label="Outils de l’IDE">{[
        ['project', 'Explorateur', 'folder'], ['search', 'Recherche', 'search'], ['git', 'Git', 'git'], ['documents', 'Documents', 'file'], ['reference', 'Référence BASIC', 'book'], ['recovery', 'Récupération', 'history'], ['firmware', 'ROM CPC', 'chip'],
      ].map(([id, label, icon]) => <Button key={id} icon={icon as import('./Icon.tsx').IconName} aria-label={`Afficher ${label}`} aria-pressed={sidebarOpen && tool === id} title={label} onClick={() => { if (sidebarOpen && tool === id) setSidebarOpen(false); else showTool(id!); }} />)}<Button icon="spark" aria-label="Afficher l’agent IA" aria-pressed={agentOpen} title="Agent IA · Ctrl Maj A" onClick={() => setAgentOpen(value => !value)} /></nav>
      <DockPanel as="aside" className="tool-sidebar" label="Outils du projet" name="les outils" hidden={!sidebarOpen} layout={panels.tools} onLayout={value => updatePanel('tools', value)} onHide={() => setSidebarOpen(false)}>
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
        {project && <GitPanel key={`git:${project.sessionId}`} sessionId={project.sessionId} busy={busy} dirty={dirty} documentCount={project.manifest.documents.length} onBusy={setBusy} onProject={snapshot => { acceptProject(snapshot); showTool('git'); }} />}
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
      </DockPanel>
      <ResizeHandle className="tools-separator" label="Largeur des outils" orientation="vertical" value={Math.min(preferences.sidebarWidth, workspaceSize.width * .3)} min={180} max={Math.min(800, workspaceSize.width * .3)} hidden={!sidebarOpen || panels.tools.floating} onChange={sidebarWidth => setPreferences(previous => ({ ...previous, sidebarWidth }))} />

      <section className="listing" aria-label="Éditeur">
        <div className="tabs" role="tablist" aria-label="Sources ouvertes">{documents.filter(document => !closedTabs.has(document.id)).map(document => <div className="tab-entry" key={document.id}><Button role="tab" aria-selected={document.id === activeId} className="tab" disabled={busy} onClick={() => setActiveId(document.id)} onMouseDown={event => { if (event.button === 1) { event.preventDefault(); event.currentTarget.focus(); } }} onAuxClick={event => { if (event.button === 1) { event.preventDefault(); event.stopPropagation(); requestAnimationFrame(() => closeTab(document.id)); } }} onContextMenu={event => { event.preventDefault(); setContextSource(document.id); }} onKeyDown={event => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); setContextSource(document.id); } }}>{document.name}{document.source !== document.saved ? ' • modifié' : ''}</Button><Button icon="close" className="tab-close" aria-label={`Fermer l’onglet ${document.name}`} title="Fermer la vue · buffer conservé · Ctrl W" disabled={busy || documents.filter(item => !closedTabs.has(item.id)).length < 2} onClick={() => closeTab(document.id)} /></div>)}</div>
        <Editor preferences={preferences} documents={documents} activeId={activeId} diagnostics={analysis.diagnostics} busy={busy} onChange={(id, value) => setDocuments(items => items.map(item => item.id === id ? { ...item, source: value } : item))} onCommand={setCard}
          navigation={navigation} onWorkspaceReady={value => { editorWorkspace.current = value; }}
          onPosition={(line, column) => setPosition({ line, column })}
          onSave={() => void save()} onReady={value => { editor.current = value; }} onPalette={() => setPalette('all')} onRenumber={() => setRenumberOpen(true)} onExport={() => void exportDisk()} />
        <ResizeHandle label="Hauteur des sorties" orientation="horizontal" reverse value={Math.min(preferences.outputHeight, Math.max(120, workspaceSize.height - 180))} min={120} max={Math.min(1200, workspaceSize.height - 180)} hidden={!outputOpen || panels.output.floating} onChange={outputHeight => setPreferences(previous => ({ ...previous, outputHeight }))} />
        <DockPanel className="output-dock" label="Sorties de l’atelier" name="les sorties" hidden={!outputOpen} layout={panels.output} onLayout={value => updatePanel('output', value)} onHide={() => setOutputOpen(false)} tabs={<nav className="output-tabs" aria-label="Panneaux de sortie"><Button aria-pressed={outputTab === 'problems'} onClick={() => showOutput('problems')} icon="warning">Problèmes {analysis.diagnostics.length}</Button><Button aria-pressed={outputTab === 'emulator'} onClick={() => showOutput('emulator')} icon="chip">CPC</Button><Button aria-pressed={outputTab === 'terminal'} onClick={() => showOutput('terminal')} icon="terminal">Terminal</Button><Button aria-pressed={outputTab === 'git-log'} onClick={() => showOutput('git-log')} icon="git">Git</Button></nav>}><div hidden={outputTab !== 'problems'} className="problems"><h2>Diagnostics <span>{analysis.diagnostics.length}</span></h2>
          <p className="muted">Analyse syntaxique conservative : expressions incomplètes, parenthèses, IF/FOR, arguments, cibles et export. Un listing sans diagnostic n’est pas garanti exécutable.</p>
          {analysis.diagnostics.length ? <ul>{analysis.diagnostics.map((d, i) => <li key={`${d.line}-${d.start}-${i}`}><Button onClick={() => {
            editor.current?.revealLineInCenter(d.line); editor.current?.setPosition({ lineNumber: d.line, column: d.start + 1 }); editor.current?.focus();
          }}>L{d.line} · {d.severity === 'error' ? 'Erreur' : 'Avertissement'} · {d.message}</Button></li>)}</ul> : <p className="success">Aucun problème détecté dans le sous-ensemble analysé.</p>}
        </div>
        <div className="emulator-output" hidden={outputTab !== 'emulator'}>{emulatorLaunch ? <EmulatorPanel key={emulatorLaunch.id} launch={emulatorLaunch} onClose={() => setEmulatorLaunch(undefined)} onConfigure={() => showTool('firmware')} /> : <div className="empty-tool"><Icon name="chip" /><p>Exécutez le listing avec F5 pour ouvrir le CPC.</p></div>}</div>
        {project ? <GitLogPanel key={`git-log:${project.sessionId}`} sessionId={project.sessionId} busy={busy} visible={outputTab === 'git-log'} /> : outputTab === 'git-log' && <div className="empty-tool">Ouvrez un projet pour consulter son journal Git.</div>}
        {project ? <TerminalPanel key={`terminal:${project.sessionId}`} sessionId={project.sessionId} busy={busy} dirty={dirty} visible={terminalOpen && outputTab === 'terminal'} onBusy={setBusy} /> : outputTab === 'terminal' && <div className="empty-tool">Ouvrez un projet pour exécuter des commandes dans son dossier.</div>}
        </DockPanel>
      </section>
      <ResizeHandle label="Largeur de l’assistant" orientation="vertical" reverse value={Math.min(preferences.agentWidth, Math.max(240, workspaceSize.width * .35))} min={240} max={Math.min(800, Math.max(240, workspaceSize.width * .35))} hidden={!agentOpen || panels.agent.floating} onChange={agentWidth => setPreferences(previous => ({ ...previous, agentWidth }))} />
      <DockPanel as="aside" className="ai-sidebar" label="Assistant IA" name="l’agent IA" hidden={!agentOpen} layout={panels.agent} onLayout={value => updatePanel('agent', value)} onHide={() => setAgentOpen(false)}>
        <AgentPanel sessionId={project?.sessionId} documentCount={project?.manifest.documents.length ?? 0} buffers={documents.map(document => ({ id: document.sourceId, source: document.source }))} busy={busy} onRunning={setAgentBusy} onState={acceptAgent} />
      </DockPanel>
    </div>
    {githubOpen && <GitHubDialog busy={busy} onClone={cloneProject} {...(project ? { onRemote: associateRemote } : {})} onClose={() => setGithubOpen(false)} />}
    {recentProjectsOpen && <RecentProjectsDialog busy={busy} onOpen={openRecentProject} onChoose={() => openProject(false)} onClose={() => setRecentProjectsOpen(false)} />}
    {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
    {settingsOpen && <SettingsDialog preferences={preferences} onApply={setPreferences} onClose={() => setSettingsOpen(false)} />}
    {shortcutsOpen && <ShortcutsDialog commands={commands} onClose={() => setShortcutsOpen(false)} />}
    <footer role="status"><Button icon="warning" title="Afficher les diagnostics" onClick={() => showOutput('problems')}>{analysis.diagnostics.filter(item => item.severity === 'error').length} erreur(s)</Button>{busy ? 'Opération en cours…' : status}{preferences.autoSave && <span>Auto-save</span>}<span>L{position.line} · C{position.column} · {window.desktop ? 'Bureau local' : 'Aperçu navigateur · enregistrement par téléchargement'}</span></footer>
  </main>;
}
