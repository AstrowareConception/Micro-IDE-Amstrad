import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from 'electron';
import { readFile, writeFile, rename, unlink, lstat, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildListingDisk } from '../../packages/basic-language/src/build.ts';
import { parseProject, buildProjectDisk } from '../../packages/workspace/src/project.ts';
import { feedbackReport } from './feedback.ts';
import { RecentProjectsStore } from './recent-projects-store.ts';
import { ProjectStore } from './project-store.ts';
import { ProjectExplorer } from './project-explorer.ts';
import { decodeImage } from './image-document.ts';
import { extractPdf } from './pdf-document.ts';
import { AgentController } from './agent-controller.ts';
import { FirmwareStore } from './firmware-store.ts';
import { runDisk } from '../../packages/emulator/src/run.ts';
import { realpath } from 'node:fs/promises';
import { GitInspection } from './git-inspection.ts';
import { GitOperations } from './git-operations.ts';
import { GitHubSession } from './github-session.ts';
import { GIT_ACTION_LABELS, remoteUrl, remoteName, githubRepository, branchName } from '../../packages/version-control/src/operations.ts';
import { GitIdentityStore } from './git-identity-store.ts';
import { ProjectTerminal } from './terminal.ts';
import { romRole } from '../../packages/emulator/src/firmware.ts';

const base = dirname(fileURLToPath(import.meta.url));
const rendererRoot = join(base, '../../renderer');
if (process.platform === 'win32') app.setAppUserModelId('com.astroware.cpceleste');
protocol.registerSchemesAsPrivileged([{ scheme: 'cpceleste', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const page = 'cpceleste://app/index.html';
const MAX_SOURCE_BYTES = 1024 * 1024;
let window: BrowserWindow;
let current: { path: string; hash: string } | undefined;
let dirty = false;
let project: ProjectStore | undefined;
let inFlight = false;
let agent: AgentController;
let gitSession: { id: string; inspector: GitInspection; operations: GitOperations } | undefined;
let gitTransfer: GitOperations | undefined;
async function gitWork<T>(operations: GitOperations, work: () => Promise<T>): Promise<T> {
  gitTransfer = operations;
  try { return await work(); } finally { gitTransfer = undefined; }
}
const github = new GitHubSession();
const terminal = new ProjectTerminal();
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function trusted(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): void {
  if (event.sender !== window.webContents || event.senderFrame?.url !== page) throw new Error('Émetteur IPC refusé.');
}
function sourceFrom(payload: unknown): { source: string; saveAs: boolean } {
  if (!payload || typeof payload !== 'object') throw new Error('Requête invalide.');
  const value = payload as Record<string, unknown>;
  if (typeof value.source !== 'string' || Buffer.byteLength(value.source) > MAX_SOURCE_BYTES ||
      (value.saveAs !== undefined && typeof value.saveAs !== 'boolean')) throw new Error('Listing invalide ou supérieur à 1 Mio.');
  return { source: value.source, saveAs: value.saveAs === true };
}
async function regularBytes(path: string): Promise<Buffer> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_SOURCE_BYTES) throw new Error('Fichier ordinaire de 1 Mio maximum requis.');
  const bytes = await readFile(path);
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error('Fichier trop volumineux.');
  return bytes;
}
async function atomicWrite(path: string, bytes: Uint8Array): Promise<void> {
  const temp = join(dirname(path), `.microide-${randomUUID()}.tmp`);
  try { await writeFile(temp, bytes, { flag: 'wx', mode: 0o600 }); await rename(temp, path); }
  finally { await unlink(temp).catch(() => undefined); }
}
function route(channel: string, handler: (payload: unknown) => Promise<unknown>, passive = false) {
  let inspecting = false;
  ipcMain.handle(channel, async (event, payload: unknown) => {
    trusted(event);
    if (terminal.running && !channel.startsWith('terminal:')) return { error: 'Une commande terminal est active ; arrêtez-la avant les opérations disque ou IA.' };
    if (agent?.running && !channel.startsWith('agent:')) return { error: 'Une mission agent est active ; arrêtez-la avant les opérations disque.' };
    if (inFlight || passive && inspecting) return { error: 'Une opération disque est déjà en cours.' };
    if (passive) inspecting = true; else inFlight = true;
    try { return await handler(payload); }
    catch (error) { return { error: error instanceof Error ? error.message : 'Échec de l’opération.' }; }
    finally { if (passive) inspecting = false; else inFlight = false; }
  });
}

// Do not hold the ESM entry point open while waiting for Electron's ready lifecycle.
void app.whenReady().then(async () => {
ipcMain.handle('git:cancel', event => { trusted(event); return gitTransfer?.cancel() ?? { stopped: false }; });
ipcMain.handle('feedback:open', async (event, payload: unknown) => {
  trusted(event);
  try { const report = feedbackReport(payload); await shell.openExternal(report.url); return { url: report.url, prefilled: report.prefilled }; }
  catch (error) { return { error: error instanceof Error ? error.message : 'Ouverture du ticket impossible.' }; }
});

protocol.handle('cpceleste', async request => {
  try {
    const url = new URL(request.url), parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    if (request.method !== 'GET' || url.hostname !== 'app' || parts.some(part => part === '..' || part === '.' || part.includes('\\')) || !/\.(html|js|mjs|wasm|css|ttf|png|svg|ico|txt)$/.test(parts.join('/'))) return new Response('Refusé', { status: 403 });
    const root = await realpath(rendererRoot), path = await realpath(join(root, ...parts)), location = relative(root, path);
    if (isAbsolute(location) || location.startsWith('..') || !(await lstat(path)).isFile()) return new Response('Refusé', { status: 403 });
    const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
      '.wasm': 'application/wasm', '.css': 'text/css; charset=utf-8', '.ttf': 'font/ttf', '.png': 'image/png',
      '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
    };
    return new Response(new Uint8Array(await readFile(path)), { headers: { 'Content-Type': contentTypes[extension] ?? 'application/octet-stream' } });
  } catch { return new Response('Ressource absente', { status: 404 }); }
});
agent = new AgentController(join(app.getPath('userData'), 'agent-checkpoints'), join(base, '../../knowledge/locomotive-basic'));
const recents = new RecentProjectsStore(app.getPath('userData'));
async function rememberProject(store: ProjectStore) {
  try { await recents.remember(store.root, store.manifest.projectId, store.manifest.name); return ''; }
  catch { return 'Projet ouvert ; la liste des projets récents n’a pas pu être enregistrée.'; }
}
const gitIdentity = new GitIdentityStore(app.getPath('userData'));
const firmware = new FirmwareStore(join(app.getPath('userData'), 'firmware'));
window = new BrowserWindow({ width: 1440, height: 960, minWidth: 900, minHeight: 650,
  backgroundColor: '#10151d', title: 'CPCéleste — Atelier Amstrad CPC', icon: join(base, '../../renderer/brand/cpceleste-icon.png'),
  webPreferences: { preload: join(base, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
});
window.removeMenu();
window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
window.webContents.on('will-navigate', (event, url) => { if (url !== page) event.preventDefault(); });
window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
window.on('close', event => {
  if (terminal.running) { event.preventDefault(); dialog.showMessageBoxSync(window, { message: 'Arrêtez la commande terminal avant de fermer la fenêtre.' }); return; }
  if (inFlight) { event.preventDefault(); dialog.showMessageBoxSync(window, { message: 'Attendez la fin de l’opération disque avant de fermer la fenêtre.' }); return; }
  if (agent.running) { event.preventDefault(); dialog.showMessageBoxSync(window, { message: 'Arrêtez la mission agent avant de fermer la fenêtre.' }); return; }
  if (dirty && dialog.showMessageBoxSync(window, { type: 'warning', buttons: ['Annuler', 'Quitter sans enregistrer'],
    defaultId: 0, cancelId: 0, message: 'Le listing contient des modifications non enregistrées.' }) === 0) event.preventDefault();
});
ipcMain.on('listing:dirty', (event, value: unknown) => {
  try { trusted(event); if (typeof value === 'boolean') dirty = value; }
  catch { /* Ignore untrusted notification without terminating the main process. */ }
});
route('listing:open', async () => {
  const selection = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'Listing BASIC', extensions: ['bas', 'txt'] }] });
  if (selection.canceled || !selection.filePaths[0]) return null;
  const path = selection.filePaths[0];
  const bytes = await regularBytes(path);
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n?/g, '\n');
  if (source.includes('\0')) throw new Error('Un listing texte UTF-8 est requis, pas un fichier tokenisé.');
  current = { path, hash: hash(bytes) };
  project = undefined;
  return { name: path.split(/[\\/]/).at(-1), source };
});
route('listing:save', async payload => {
  if (project) throw new Error('Utilisez la sauvegarde de source du projet.');
  const { source, saveAs } = sourceFrom(payload);
  let path = current?.path;
  if (!path || saveAs) {
    const selection = await dialog.showSaveDialog(window, { defaultPath: 'MAIN.bas', filters: [{ name: 'Listing BASIC', extensions: ['bas'] }] });
    if (selection.canceled || !selection.filePath) return null;
    path = selection.filePath;
  }
  if (current?.path === path && hash(await regularBytes(path)) !== current.hash)
    throw new Error('Le fichier a changé sur disque. Ouvrez-le à nouveau ou utilisez Enregistrer sous. Aucune modification écrasée.');
  const bytes = Buffer.from(source.replace(/\r\n?/g, '\n'), 'utf8');
  await atomicWrite(path, bytes);
  current = { path, hash: hash(bytes) };
  return { name: path.split(/[\\/]/).at(-1) };
});
route('listing:export', async payload => {
  if (project) throw new Error('Utilisez la construction du projet.');
  const bytes = buildListingDisk(sourceFrom(payload).source);
  const selection = await dialog.showSaveDialog(window, { defaultPath: 'program.dsk', filters: [{ name: 'Disquette CPC DATA', extensions: ['dsk'] }] });
  if (selection.canceled || !selection.filePath) return null;
  // Export cannot silently overwrite the open source.
  if (selection.filePath === current?.path) throw new Error('La destination DSK doit être distincte du listing.');
  await atomicWrite(selection.filePath, bytes);
  return { name: selection.filePath.split(/[\\/]/).at(-1) };
});
async function openProjectFolder(folder: string, expectedId?: string) {
  if (expectedId !== undefined) {
    const manifest = parseProject(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await regularBytes(join(folder, 'microide.project.json')))));
    if (manifest.projectId !== expectedId) throw new Error('Un autre projet occupe ce dossier ; choisissez-le explicitement avec Ouvrir projet.');
  }
  const sourceRecovery = await ProjectStore.sourceRecoveryStatus(folder);
  if (sourceRecovery) {
    const choice = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Terminer l’organisation des sources', 'Rétablir les sources précédentes'], defaultId: 0, cancelId: 0,
      message: 'Une organisation des sources a été interrompue.',
      detail: `${sourceRecovery.createdAt}\n${sourceRecovery.files.join('\n')}\n\nTerminer applique les chemins et le manifeste préparés. Rétablir retrouve les octets précédents. Tout conflit externe bloque la reprise. Les brouillons conservés lors d’une suppression restent dans le journal et l’historique local.` });
    if (choice.response !== 1 && choice.response !== 2) return null;
    await ProjectStore.recoverSources(folder, sourceRecovery.id, choice.response === 1 ? 'finish' : 'restore', sourceRecovery.revision!);
  }
  const agentRecovery = await ProjectStore.agentRecoveryStatus(folder);
  if (agentRecovery) {
    const choice = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Terminer la mutation agent', 'Rétablir les versions avant mutation'], defaultId: 0, cancelId: 0,
      message: 'Une mutation de l’agent a été interrompue.',
      detail: `${agentRecovery.createdAt}\n${agentRecovery.files.join('\n')}\n\nTerminer applique les sources et le manifeste préparés. Rétablir revient aux octets précédents et retire les sources créées par cette mutation. Tout conflit externe bloque la reprise. Les prompts et la mission distante ne sont pas relancés ; les brouillons non enregistrés restent distincts.` });
    if (choice.response !== 1 && choice.response !== 2) return null;
    await ProjectStore.recoverAgent(folder, agentRecovery.id, choice.response === 1 ? 'finish' : 'restore', agentRecovery.revision!);
  }
  const recovery = await ProjectStore.recoveryStatus(folder);
  if (recovery) {
    const choice = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Terminer la sauvegarde', 'Rétablir les anciennes versions'], defaultId: 0, cancelId: 0,
      message: 'Une sauvegarde globale a été interrompue.',
      detail: `${recovery.createdAt}\n${recovery.files.join('\n')}\n\nTerminer applique les versions du snapshot enregistré. Rétablir remet les octets précédant cette sauvegarde. Toute modification externe inconnue bloque la récupération. Les brouillons hors sauvegarde ne sont pas récupérés.` });
    if (choice.response !== 1 && choice.response !== 2) return null;
    await ProjectStore.recoverSave(folder, recovery.id, choice.response === 1 ? 'finish' : 'restore', recovery.revision);
  }
  const opened = await ProjectStore.open(folder, decodeImage, extractPdf);
  project = opened.store; current = undefined;
  return { ...opened.snapshot, recentProjectsNotice: await rememberProject(opened.store) };
}
route('project:open', async () => {
  const selection = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
  if (selection.canceled || !selection.filePaths[0]) return null;
  return openProjectFolder(selection.filePaths[0]);
});
route('recent-projects:list', async () => recents.list(), true);
route('recent-projects:open', async id => {
  const entry = await recents.get(id);
  try { return await openProjectFolder(entry.path, entry.projectId); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES') throw new Error('Projet récent indisponible : dossier déplacé, supprimé ou inaccessible. Choisissez son dossier avec Ouvrir projet.');
    throw error;
  }
});
route('recent-projects:remove', async id => recents.remove(id));
route('recent-projects:clear', async () => recents.clear());

route('project:create', async payload => {
  if (typeof payload !== 'string') throw new Error('Nom de projet requis.');
  const selection = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'] });
  if (selection.canceled || !selection.filePaths[0]) return null;
  const created = await ProjectStore.create(selection.filePaths[0], payload, decodeImage, extractPdf);
  project = created.store; current = undefined; return { ...created.snapshot, recentProjectsNotice: await rememberProject(created.store) };
});
function projectRequest(payload: unknown): { store: ProjectStore; value: Record<string, unknown> } {
  if (!project || !payload || typeof payload !== 'object') throw new Error('Aucun projet ouvert.');
  const value = payload as Record<string, unknown>; project.assertSession(value.sessionId);
  return { store: project, value };
}
function gitInspector(store: ProjectStore): GitInspection {
  if (gitSession?.id !== store.sessionId) {
    const inspector = new GitInspection(store.root, () => store.manifest.sources.map(source => source.path));
    gitSession = { id: store.sessionId, inspector, operations: new GitOperations(store.root, inspector, {
      authorization: url => github.authorization(url), validateProject: folder => ProjectStore.open(folder, decodeImage, extractPdf),
    }) };
  }
  return gitSession.inspector;
}
function gitOperations(store: ProjectStore): GitOperations { gitInspector(store); return gitSession!.operations; }
route('git:overview', async payload => { const { store } = projectRequest(payload); await store.assertCurrent(); return gitOperations(store).overview(); });
route('git:prepare-operation', async payload => {
  const { store, value } = projectRequest(payload); gitMutation(); await store.assertCurrent();
  const operations = gitOperations(store);
  return gitWork(operations, () => operations.prepare(value.revision, value.request));
});
route('git:apply-operation', async payload => {
  const { store, value } = projectRequest(payload); gitMutation(); await store.assertCurrent();
  const operations = gitOperations(store), plan = operations.selection(value.planId);
  const choice = await dialog.showMessageBox(window, { type: plan.action === 'push' ? 'warning' : 'question', buttons: ['Annuler', 'Confirmer'], defaultId: 0, cancelId: 0,
    message: GIT_ACTION_LABELS[plan.action] + ' dans ' + store.root,
    detail: 'Branche locale : ' + plan.localBranch + '\nBranche cible : ' + plan.branch + '\nRemote : ' + plan.remote + '\nDestination : ' + plan.url + '\nHEAD : ' + plan.head + '\nCible : ' + (plan.target || 'aucune') +
      '\n' + plan.commits + ' commit(s) à publier\n' + plan.files.join('\n') + (plan.action === 'pull' ? '\nLe fetch préparatoire a déjà actualisé les références distantes ; annuler conserve ce fetch sans changer les sources.' : '') +
      '\n\nPas de sauvegarde, stash, fusion de divergence ou push forcé automatique. Une opération interrompue exige de vérifier son résultat.' });
  if (choice.response !== 1) return null;
  gitMutation(); await store.assertCurrent();
  let result;
  try { result = await gitWork(operations, () => operations.apply(value.planId)); }
  catch (error) {
    try { await store.assertCurrent(); } catch { project = undefined; gitSession = undefined; }
    throw error;
  }
  if (!result.changesFiles) return result;
  try {
    const opened = await ProjectStore.open(store.root, decodeImage, extractPdf);
    project = opened.store; current = undefined; await rememberProject(opened.store);
    return { ...result, project: opened.snapshot };
  } catch {
    project = undefined; gitSession = undefined;
    throw new Error('Git a modifié les fichiers, mais le projet n’est plus valide. Les buffers restent visibles ; réouvrez explicitement un projet valide avant toute écriture.');
  }
});
route('git:clone', async payload => {
  if (!payload || typeof payload !== 'object') throw new Error('URL et nom du dossier requis.');
  const value = payload as Record<string, unknown>, url = remoteUrl(value.url);
  if (typeof value.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(value.name) || value.name.endsWith('.')) throw new Error('Nom du nouveau dossier invalide.');
  const selected = await dialog.showOpenDialog(window, { title: 'Choisissez le dossier parent du nouveau clone', properties: ['openDirectory'] });
  if (selected.canceled || !selected.filePaths[0]) return null;
  const folder = join(await realpath(selected.filePaths[0]), value.name);
  const choice = await dialog.showMessageBox(window, { type: 'question', buttons: ['Annuler', 'Cloner'], defaultId: 0, cancelId: 0, message: 'Cloner ' + url, detail: 'Nouveau dossier : ' + folder + '\nAucun dossier existant ne sera écrasé. Un projet CPCéleste valide est requis pour l’ouverture automatique.' });
  if (choice.response !== 1) return null;
  await mkdir(folder); const root = await realpath(folder);
  const inspector = new GitInspection(root, () => []);
  try {
    const operations = new GitOperations(root, inspector, { authorization: url => github.authorization(url), validateProject: folder => ProjectStore.open(folder, decodeImage, extractPdf) });
    await gitWork(operations, () => operations.clone(url));
    return await openProjectFolder(root);
  } catch { throw new Error('Clone non confirmé ou projet cible invalide. Dossier ' + folder + ' conservé pour inspection ; projet courant inchangé.'); }
});
route('git:suggest-message', async payload => {
  const { store, value } = projectRequest(payload); gitMutation(); await store.assertCurrent();
  const inspector = gitInspector(store), identity = value.identity;
  if (!identity || typeof identity !== 'object') throw new Error('Identité du commit requise.');
  const fields = identity as Record<string, unknown>, plan = await inspector.prepareCommit({ name: fields.name, email: fields.email, message: 'Préparation de la suggestion IA' });
  if (Buffer.byteLength(plan.diff) > 128 * 1024) throw new Error('Diff supérieur à 128 Kio : rédigez le message manuellement.');
  const revision = await inspector.operationRevision();
  const choice = await dialog.showMessageBox(window, { type: 'question', buttons: ['Annuler', 'Générer le message'], defaultId: 0, cancelId: 0,
    message: 'Envoyer le diff de l’index à OpenAI pour proposer un message ?',
    detail: plan.files.map(file => file.path).join('\n') + '\n\nClé et modèle du panneau IA. Appel facturable, 128 Kio maximum, sans documents ni historique. Le texte proposé restera modifiable, sans commit ou push automatique.' });
  if (choice.response !== 1) return null;
  gitMutation(); await store.assertCurrent();
  if (revision !== await inspector.operationRevision()) throw new Error('Index modifié pendant la confirmation ; suggestion annulée.');
  const result = await agent.suggestCommit(plan.diff);
  await store.assertCurrent(); if (revision !== await inspector.operationRevision()) throw new Error('Index modifié pendant la génération ; suggestion périmée.');
  return result;
});
route('github:account', async () => github.account());
route('github:connect', async payload => github.connect(payload));
route('github:connect-cli', async () => github.connectCLI(project?.root ?? base));
route('github:disconnect', async () => github.disconnect());
route('github:token-page', async () => { await shell.openExternal('https://github.com/settings/personal-access-tokens/new'); return { ok: true }; });
route('github:repositories', async payload => github.repositories(payload === undefined ? 1 : payload));
route('github:create-repository', async payload => {
  if (!payload || typeof payload !== 'object') throw new Error('Nom et visibilité requis.');
  const value = payload as Record<string, unknown>;
  if (typeof value.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(value.name) || typeof value.isPrivate !== 'boolean') throw new Error('Nom et visibilité invalides.');
  const account = github.account(); if (!account.connected) throw new Error('Connectez GitHub avant de créer un dépôt.');
  const choice = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Créer sur GitHub'], defaultId: 0, cancelId: 0,
    message: 'Créer ' + account.login + '/' + value.name + ' sur GitHub ?', detail: value.isPrivate ? 'Dépôt PRIVÉ vide, sans publication des fichiers du projet.' : 'Dépôt PUBLIC vide, sans publication des fichiers du projet. Son nom et sa visibilité seront publics.' });
  if (choice.response !== 1) return null; return github.createRepository(value.name, value.isPrivate);
});
async function githubDestination(store: ProjectStore, remote: unknown) {
  const overview = await gitOperations(store).overview(), entry = overview.remotes.find(entry => entry.name === remoteName(remote));
  if (!entry) throw new Error('Remote inconnu.'); return { overview, repository: githubRepository(entry.url) };
}
route('github:pull-requests', async payload => { const { store, value } = projectRequest(payload); await store.assertCurrent(); return github.pullRequests((await githubDestination(store, value.remote)).repository); });
route('github:create-pull-request', async payload => {
  const { store, value } = projectRequest(payload); gitMutation(); await store.assertCurrent();
  const { overview, repository } = await githubDestination(store, value.remote), head = branchName(overview.branch), target = branchName(value.base);
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 256 || typeof value.body !== 'string' || value.body.length > 20_000 || typeof value.draft !== 'boolean') throw new Error('Titre, description et état de PR invalides.');
  const choice = await dialog.showMessageBox(window, { type: 'question', buttons: ['Annuler', 'Créer la PR'], defaultId: 0, cancelId: 0,
    message: 'Créer une PR sur ' + repository + ' : ' + head + ' → ' + target + ' ?', detail: value.title + '\n\n' + value.body + '\n\n' + (value.draft ? 'Brouillon.' : 'Prête pour revue.') + ' La branche doit déjà être publiée. Aucun push ou merge automatique.' });
  if (choice.response !== 1) return null;
  gitMutation(); await store.assertCurrent(); if (overview.revision !== (await gitOperations(store).overview()).revision) throw new Error('Branche modifiée pendant la confirmation.');
  return github.createPullRequest(repository, head, target, value.title, value.body, value.draft);
});
route('github:open', async payload => {
  if (typeof payload !== 'string' || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/(?:pull\/\d+|actions))?\/?$/.test(payload)) throw new Error('Lien GitHub non qualifié.');
  await shell.openExternal(payload); return { ok: true };
});
route('git:identity', async payload => { projectRequest(payload); return gitIdentity.status(); });
route('git:remember-identity', async payload => { const { value } = projectRequest(payload); return gitIdentity.remember(value.revision, value.identity); });
route('git:forget-identity', async payload => { const { value } = projectRequest(payload); return gitIdentity.forget(value.revision); });
route('git:status', async payload => {
  const { store } = projectRequest(payload); await store.assertCurrent();
  return gitInspector(store).status();
});
route('git:diff', async payload => {
  const { store, value } = projectRequest(payload); await store.assertCurrent();
  return gitInspector(store).diff(value.changeId, value.side);
});
route('git:history', async payload => {
  const { store, value } = projectRequest(payload); await store.assertCurrent();
  return gitInspector(store).history(value.cursor);
});
route('terminal:run', async payload => {
  const { store, value } = projectRequest(payload);
  if (terminal.running) throw new Error('Une commande terminal est déjà active.');
  if (dirty) throw new Error('Enregistrez ou arbitrez les brouillons avant le terminal.');
  await store.assertCurrent(); const command = ProjectTerminal.command(value.command);
  const choice = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Exécuter'], defaultId: 0, cancelId: 0,
    message: `Exécuter dans ${store.root} ?`, detail: `${command}\n\nCommande du système hôte, sans sandbox : elle peut modifier des fichiers hors du projet. Pas d’entrée interactive ; limite 30 s / 64 Kio. L’agent IA n’a pas accès au terminal.` });
  if (choice.response !== 1) return null;
  if (dirty) throw new Error('Brouillons modifiés pendant la confirmation.');
  await store.assertCurrent(); return terminal.run(store.sessionId, store.root, command);
});
route('terminal:status', async payload => { const { store, value } = projectRequest(payload); return terminal.status(store.sessionId, value.id); });
route('terminal:stop', async payload => { const { store, value } = projectRequest(payload); return terminal.stop(store.sessionId, value.id); });
function gitMutation(): void {
  if (dirty) throw new Error('Enregistrez ou arbitrez tous les brouillons avant de modifier Git ; aucune sauvegarde automatique.');
}
route('git:prepare-commit', async payload => {
  const { store, value } = projectRequest(payload); gitMutation(); await store.assertCurrent();
  return gitInspector(store).prepareCommit(value.input);
});
route('git:commit', async payload => {
  const { store, value } = projectRequest(payload); gitMutation(); await store.assertCurrent();
  const inspector = gitInspector(store), plan = inspector.commitSelection(value.planId);
  const choice = await dialog.showMessageBox(window, { type: 'question', buttons: ['Annuler', 'Créer le commit local'], defaultId: 0, cancelId: 0,
    message: `Créer un commit local sur ${plan.branch} dans ${store.root} ?`,
    detail: `${plan.name} <${plan.email}>\n${plan.message}\n${plan.files.map(file => `${file.status} ${file.path}`).join('\n')}\n\nIndex examiné uniquement. Commit non signé, hooks désactivés. Aucun push et aucune sauvegarde automatique. Les changements hors index restent sur disque.` });
  if (choice.response !== 1) return null;
  gitMutation(); await store.assertCurrent(); return inspector.commit(value.planId);
});
route('git:prepare-init', async payload => {
  const { store } = projectRequest(payload); gitMutation(); await store.assertCurrent();
  return gitInspector(store).prepareInit();
});
route('git:init', async payload => {
  const { store, value } = projectRequest(payload); gitMutation(); await store.assertCurrent();
  if (typeof value.planId !== 'string') throw new Error('Plan de création Git requis.');
  const choice = await dialog.showMessageBox(window, { type: 'question', buttons: ['Annuler', 'Créer le dépôt'], defaultId: 0, cancelId: 0,
    message: `Créer un dépôt Git local dans ${store.root} ?`, detail: 'Branche main, exclusions des documents/ROM/secrets/artefacts. Aucun fichier indexé, aucun commit, aucun accès réseau. Le .gitignore existant est conservé ; les exclusions proposées seront alors locales au dépôt.' });
  if (choice.response !== 1) return null;
  gitMutation(); await store.assertCurrent(); return gitInspector(store).init(value.planId);
});
route('git:index', async payload => {
  const { store, value } = projectRequest(payload); gitMutation(); await store.assertCurrent();
  const inspector = gitInspector(store), change = inspector.indexSelection(value.snapshotId, value.changeId, value.action);
  const choice = await dialog.showMessageBox(window, { type: 'question', buttons: ['Annuler', 'Confirmer'], defaultId: 0, cancelId: 0,
    message: `${value.action === 'stage' ? 'Indexer' : 'Retirer de l’index'} uniquement ${change.path} ?`,
    detail: 'Les sources sur disque et les autres fichiers indexés restent inchangés. Aucune exécution de hook, aucun commit et aucune publication.' });
  if (choice.response !== 1) return null;
  gitMutation(); await store.assertCurrent(); return inspector.changeIndex(value.snapshotId, value.changeId, value.action);
});
route('explorer:list', async payload => { const { store, value } = projectRequest(payload); return new ProjectExplorer(store).list(value.directory, value.showHidden); }, true);
route('explorer:preview', async payload => { const { store, value } = projectRequest(payload); return new ProjectExplorer(store).preview(value.path, value.revision); });
route('sources:prepare', async payload => { const { store, value } = projectRequest(payload); return store.prepareSourceOperation(value.request); });
route('sources:last', async payload => { const { store } = projectRequest(payload); return store.lastSourceOperation(); }, true);
route('sources:draft', async payload => { const { store } = projectRequest(payload); return store.sourceDraft(); });
route('sources:apply', async payload => {
  const { store, value } = projectRequest(payload), source = sourceFrom(value).source;
  const plan = store.sourceOperationPlan(value.planId);
  const dirtyDeletion = plan.action === 'delete' && store.sourceOperationDirty(value.planId, source);
  const choice = await dialog.showMessageBox(window, { type: plan.action === 'delete' ? 'warning' : 'question', defaultId: 0, cancelId: 0,
    buttons: dirtyDeletion ? ['Annuler', 'Conserver le brouillon et supprimer', 'Enregistrer puis supprimer'] : ['Annuler', 'Appliquer'],
    message: `${plan.action === 'delete' ? 'Supprimer' : plan.action === 'rename' ? 'Renommer' : 'Déplacer'} ${plan.source.path} ?`,
    detail: `${plan.destination ? `${plan.destination.path}\nNom CPC : ${plan.source.cpcName} → ${plan.destination.cpcName}` : 'Retrait du fichier et de sa déclaration dans le projet.'}\nEntrée : ${plan.entryPoint}\n\nLes autres brouillons restent ouverts. Le journal permet de rétablir la dernière organisation tant que les versions disque correspondent. Les noms de fichiers écrits dans le BASIC ne sont pas réécrits.${dirtyDeletion ? '\nConserver archive le brouillon sans l’enregistrer ; Enregistrer le sauvegarde explicitement avant le retrait.' : ''}` });
  if (choice.response !== 1 && !(dirtyDeletion && choice.response === 2)) return null;
  return store.applySourceOperation(value.planId, source, dirtyDeletion && choice.response === 2 ? 'save' : 'keep');
});
route('sources:restore', async payload => {
  const { store, value } = projectRequest(payload);
  if (typeof value.revision !== 'string') throw new Error('Révision de la dernière organisation requise.');
  const last = await store.lastSourceOperation();
  if (!last || last.revision !== value.revision) throw new Error('Dernière organisation périmée ; actualisez.');
  const choice = await dialog.showMessageBox(window, { type: 'question', buttons: ['Annuler', 'Rétablir'], defaultId: 0, cancelId: 0,
    message: 'Rétablir la dernière organisation des sources ?', detail: `${last.files.join('\n')}\n\nLe manifeste et les fichiers retrouvent leur état précédent. Les brouillons existants sont conservés ; un brouillon archivé avant suppression revient dans son onglet sans être enregistré.` });
  if (choice.response !== 1) return null;
  return store.restoreSourceOperation(value.revision);
});
route('project:save', async payload => {
  const { store, value } = projectRequest(payload);
  if (typeof value.id !== 'string') throw new Error('Identifiant de source requis.');
  await store.save(value.id, sourceFrom(value).source); return { name: value.id };
});
route('project:save-all', async payload => {
  const { store, value } = projectRequest(payload);
  if (!Array.isArray(value.sources) || value.sources.length < 1 || value.sources.length > 64) throw new Error('1 à 64 sources requises.');
  const sources = value.sources.map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') throw new Error('Identifiant de source requis.');
    return { id: item.id, source: sourceFrom(item).source };
  });
  return store.saveAll(sources);
});
// A bounded read-only poll must not reserve the foreground mutation lock.
// Its results are advisory; every explicit read/adoption rechecks disk revisions.
route('external:status', async payload => { const { store } = projectRequest(payload); return store.externalStatus(); }, true);
route('external:read', async payload => {
  const { store, value } = projectRequest(payload);
  if (typeof value.id !== 'string' || typeof value.revision !== 'string') throw new Error('Référence externe requise.');
  return store.externalVersion(value.id, value.revision);
});
route('external:accept', async payload => {
  const { store, value } = projectRequest(payload);
  if (typeof value.id !== 'string' || typeof value.revision !== 'string' || typeof value.baseRevision !== 'string') throw new Error('Révision externe et base requises.');
  return store.acceptExternal(value.id, value.revision, value.baseRevision);
});
route('history:list', async payload => { const { store } = projectRequest(payload); return store.historyList(); });
route('drafts:status', async payload => { const { store } = projectRequest(payload); return store.draftStatus(); });
route('drafts:capture', async payload => {
  const { store, value } = projectRequest(payload);
  if (!Array.isArray(value.sources) || value.sources.length < 1 || value.sources.length > 64 || value.revision !== null && typeof value.revision !== 'string') throw new Error('Snapshot et révision de brouillons requis.');
  const sources = value.sources.map(item => { if (!item || typeof item !== 'object' || typeof item.id !== 'string') throw new Error('Identifiant de brouillon requis.'); return { id: item.id, source: sourceFrom(item).source }; });
  return store.captureDrafts(sources, value.revision as string | null);
});
route('drafts:read', async payload => { const { store, value } = projectRequest(payload); if (typeof value.revision !== 'string') throw new Error('Révision de brouillons requise.'); return store.readDrafts(value.revision); });
route('drafts:forget', async payload => {
  const { store, value } = projectRequest(payload); if (typeof value.revision !== 'string') throw new Error('Révision de brouillons requise.');
  const status = await store.draftStatus(); if (status.revision !== value.revision) throw new Error('Copie de brouillons périmée.');
  const choice = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Effacer la copie'], defaultId: 0, cancelId: 0,
    message: 'Effacer la copie de récupération des brouillons ?', detail: 'Les buffers ouverts et les fichiers BASIC restent intacts. Cette copie locale ne sera plus récupérable après confirmation.' });
  if (choice.response !== 1) return status;
  return store.forgetDrafts(value.revision);
});
route('history:version', async payload => {
  const { store, value } = projectRequest(payload);
  if (typeof value.snapshotId !== 'string' || typeof value.id !== 'string' || typeof value.revision !== 'string') throw new Error('Référence historique requise.');
  return store.historyVersion(value.snapshotId, value.id, value.revision);
});
route('project:add', async payload => {
  const { store, value } = projectRequest(payload);
  if (typeof value.name !== 'string') throw new Error('Nom de source requis.');
  return store.add(value.name);
});
route('project:entry', async payload => {
  const { store, value } = projectRequest(payload);
  if (typeof value.id !== 'string') throw new Error('Identifiant de source requis.');
  return store.setEntry(value.id);
});
route('documents:import', async payload => {
  const { store, value } = projectRequest(payload);
  if (value.kind !== 'text' && value.kind !== 'image' && value.kind !== 'pdf') throw new Error('Catégorie documentaire invalide.');
  const selection = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: value.kind === 'pdf' ? 'Document PDF' : value.kind === 'image' ? 'Image PNG / JPEG' : 'Document UTF-8 TXT / Markdown', extensions: value.kind === 'pdf' ? ['pdf'] : value.kind === 'image' ? ['png', 'jpg', 'jpeg'] : ['txt', 'md'] }] });
  if (selection.canceled || !selection.filePaths[0]) return null;
  if (!(value.kind === 'pdf' ? /\.pdf$/i : value.kind === 'image' ? /\.(png|jpe?g)$/i : /\.(txt|md)$/i).test(selection.filePaths[0])) throw new Error('Extension hors de la catégorie choisie.');
  return store.importDocument(selection.filePaths[0]);
});
route('documents:read', async payload => {
  const { store, value } = projectRequest(payload);
  if (typeof value.id !== 'string') throw new Error('Identifiant de document requis.');
  return store.readDocument(value.id);
});
route('project:export', async payload => {
  const { store, value } = projectRequest(payload); await store.assertCurrent();
  if (!Array.isArray(value.sources) || value.sources.length > 64) throw new Error('Snapshot invalide.');
  let total = 0;
  const sources = value.sources.map(item => {
    const source = sourceFrom(item).source;
    const id = (item as Record<string, unknown>).id;
    total += Buffer.byteLength(source);
    if (typeof id !== 'string' || total > 8 * MAX_SOURCE_BYTES) throw new Error('Snapshot invalide ou supérieur à 8 Mio.');
    return { id, source };
  });
  const bytes = buildProjectDisk(store.manifest, sources);
  const selection = await dialog.showSaveDialog(window, { defaultPath: 'project.dsk', filters: [{ name: 'Disquette CPC DATA', extensions: ['dsk'] }] });
  if (selection.canceled || !selection.filePath) return null;
  await store.assertCurrent(); await store.assertExportDestination(selection.filePath);
  await atomicWrite(selection.filePath, bytes);
  return { name: selection.filePath.split(/[\\/]/).at(-1) };
});
function bufferRequest(value: unknown): { id: string; source: string }[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error('Snapshot invalide.');
  let total = 0;
  return value.map(item => {
    const source = sourceFrom(item).source, id = (item as Record<string, unknown>).id;
    total += Buffer.byteLength(source);
    if (typeof id !== 'string' || total > 256 * 1024) throw new Error('Snapshot invalide ou supérieur à 256 Kio.');
    return { id, source };
  });
}
route('agent:models', async payload => {
  if (payload !== undefined && (!payload || typeof payload !== 'object' || Array.isArray(payload))) throw new Error('Demande de modèles invalide.');
  return agent.models((payload as { key?: unknown } | undefined)?.key);
});
route('agent:select-model', async payload => agent.selectModel(payload));
route('agent:pricing', async payload => agent.pricing(payload));
route('agent:configure', async payload => {
  if (!payload || typeof payload !== 'object') throw new Error('Configuration invalide.');
  const value = payload as Record<string, unknown>; return agent.configure(value.key, value.model);
});
route('agent:start', async payload => {
  const { store, value } = projectRequest(payload);
  if (value.includeDocuments !== undefined && typeof value.includeDocuments !== 'boolean') throw new Error('Scope documentaire invalide.');
  return agent.start(store, value.objective, bufferRequest(value.buffers), value.includeDocuments === true, value.budget);
});
route('agent:resume', async payload => {
  const { store, value } = projectRequest(payload);
  return agent.resume(value.taskId, store, bufferRequest(value.buffers));
});
route('agent:status', async payload => agent.status(payload));
route('agent:cancel', async payload => agent.cancel(payload));
route('agent:steer', async payload => {
  if (!payload || typeof payload !== 'object') throw new Error('Consigne invalide.');
  const value = payload as Record<string, unknown>; return agent.steer(value.taskId, value.instruction);
});
route('agent:restore', async payload => {
  const { store, value } = projectRequest(payload);
  const view = agent.status(value.taskId); store.assertSession(view.workspace.sessionId);
  return agent.restore(value.taskId, bufferRequest(value.buffers));
});
route('emulator:prepare', async payload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Snapshot d’exécution invalide.');
  const value = payload as Record<string, unknown>;
  let image, label = 'Listing courant';
  if (Object.hasOwn(value, 'sessionId')) { const { store } = projectRequest(payload); await store.assertCurrent(); image = runDisk(value, store.manifest); label = store.manifest.name; }
  else image = runDisk(value);
  const status = await firmware.status();
  if (!status.complete) throw new Error('ROM CPC manquantes ou invalides : importez OS, BASIC 1.1 et AMSDOS dans Configuration ROM avant Exécuter.');
  const roms = await firmware.load();
  return { ...image, label, sha256: hash(image.disk), roms, firmware: Object.fromEntries(Object.entries(roms).map(([role, bytes]) => [role, hash(bytes)])) };
});
route('firmware:status', async () => firmware.status());
route('emulator:export', async payload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Disquette de session invalide.');
  const value = payload as Record<string, unknown>;
  if (Object.keys(value).some(key => key !== 'disk' && key !== 'sessionId') || !(value.disk instanceof Uint8Array) || value.disk.length !== 194816) throw new Error('Disquette CPC DATA de session requise.');
  const owner = project;
  if (owner) { owner.assertSession(value.sessionId); await owner.assertCurrent(); }
  else if (value.sessionId !== undefined) throw new Error('Session projet expirée.');
  const sourcePath = current?.path;
  const bytes = new Uint8Array(value.disk);
  const selection = await dialog.showSaveDialog(window, { defaultPath: 'session-cpc.dsk', filters: [{ name: 'Disquette CPC DATA', extensions: ['dsk'] }] });
  if (selection.canceled || !selection.filePath) return null;
  if (owner) { await owner.assertCurrent(); await owner.assertExportDestination(selection.filePath); }
  if (selection.filePath === sourcePath) throw new Error('La destination DSK doit être distincte du listing.');
  await atomicWrite(selection.filePath, bytes);
  return { name: selection.filePath.split(/[\\/]/).at(-1) };
});
route('firmware:import', async payload => {
  const role = romRole(payload);
  const selection = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'ROM séparée CPC (16 Kio)', extensions: ['rom', 'bin'] }] });
  if (selection.canceled || !selection.filePaths[0]) return null;
  return firmware.importRom(role, selection.filePaths[0]);
});
route('firmware:clear', async () => firmware.clear());
await window.loadURL(page);
}).catch(error => { console.error('Desktop startup failed:', error); app.quit(); });
app.on('window-all-closed', () => app.quit());
