import { app, BrowserWindow, dialog, ipcMain, protocol, net } from 'electron';
import { readFile, writeFile, rename, unlink, lstat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildListingDisk } from '../../packages/basic-language/src/build.ts';
import { buildProjectDisk } from '../../packages/workspace/src/project.ts';
import { ProjectStore } from './project-store.ts';
import { decodeImage } from './image-document.ts';
import { extractPdf } from './pdf-document.ts';
import { AgentController } from './agent-controller.ts';
import { FirmwareStore } from './firmware-store.ts';
import { runDisk } from '../../packages/emulator/src/run.ts';
import { realpath } from 'node:fs/promises';
import { GitInspection } from './git-inspection.ts';
import { GitIdentityStore } from './git-identity-store.ts';
import { ProjectTerminal } from './terminal.ts';
import { romRole } from '../../packages/emulator/src/firmware.ts';

const base = dirname(fileURLToPath(import.meta.url));
const rendererRoot = join(base, '../../renderer');
protocol.registerSchemesAsPrivileged([{ scheme: 'cpceleste', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const page = 'cpceleste://app/index.html';
const MAX_SOURCE_BYTES = 1024 * 1024;
let window: BrowserWindow;
let current: { path: string; hash: string } | undefined;
let dirty = false;
let project: ProjectStore | undefined;
let inFlight = false;
let agent: AgentController;
let gitSession: { id: string; inspector: GitInspection } | undefined;
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
protocol.handle('cpceleste', async request => {
  try {
    const url = new URL(request.url), parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    if (request.method !== 'GET' || url.hostname !== 'app' || parts.some(part => part === '..' || part === '.' || part.includes('\\')) || !/\.(html|js|mjs|wasm|css|ttf|png|svg|ico|txt)$/.test(parts.join('/'))) return new Response('Refusé', { status: 403 });
    const root = await realpath(rendererRoot), path = await realpath(join(root, ...parts)), location = relative(root, path);
    if (isAbsolute(location) || location.startsWith('..') || !(await lstat(path)).isFile()) return new Response('Refusé', { status: 403 });
    return net.fetch(pathToFileURL(path).href);
  } catch { return new Response('Ressource absente', { status: 404 }); }
});
agent = new AgentController(join(app.getPath('userData'), 'agent-checkpoints'), join(base, '../../knowledge/locomotive-basic'));
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
route('project:open', async () => {
  const selection = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
  if (selection.canceled || !selection.filePaths[0]) return null;
  const agentRecovery = await ProjectStore.agentRecoveryStatus(selection.filePaths[0]);
  if (agentRecovery) {
    const choice = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Terminer la mutation agent', 'Rétablir les versions avant mutation'], defaultId: 0, cancelId: 0,
      message: 'Une mutation de l’agent a été interrompue.',
      detail: `${agentRecovery.createdAt}\n${agentRecovery.files.join('\n')}\n\nTerminer applique les sources et le manifeste préparés. Rétablir revient aux octets précédents et retire les sources créées par cette mutation. Tout conflit externe bloque la reprise. Les prompts et la mission distante ne sont pas relancés ; les brouillons non enregistrés restent distincts.` });
    if (choice.response !== 1 && choice.response !== 2) return null;
    await ProjectStore.recoverAgent(selection.filePaths[0], agentRecovery.id, choice.response === 1 ? 'finish' : 'restore', agentRecovery.revision!);
  }
  const recovery = await ProjectStore.recoveryStatus(selection.filePaths[0]);
  if (recovery) {
    const choice = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Terminer la sauvegarde', 'Rétablir les anciennes versions'], defaultId: 0, cancelId: 0,
      message: 'Une sauvegarde globale a été interrompue.',
      detail: `${recovery.createdAt}\n${recovery.files.join('\n')}\n\nTerminer applique les versions du snapshot enregistré. Rétablir remet les octets précédant cette sauvegarde. Toute modification externe inconnue bloque la récupération. Les brouillons hors sauvegarde ne sont pas récupérés.` });
    if (choice.response !== 1 && choice.response !== 2) return null;
    await ProjectStore.recoverSave(selection.filePaths[0], recovery.id, choice.response === 1 ? 'finish' : 'restore', recovery.revision);
  }
  const opened = await ProjectStore.open(selection.filePaths[0], decodeImage, extractPdf);
  project = opened.store; current = undefined; return opened.snapshot;
});
route('project:create', async payload => {
  if (typeof payload !== 'string') throw new Error('Nom de projet requis.');
  const selection = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'] });
  if (selection.canceled || !selection.filePaths[0]) return null;
  const created = await ProjectStore.create(selection.filePaths[0], payload, decodeImage, extractPdf);
  project = created.store; current = undefined; return created.snapshot;
});
function projectRequest(payload: unknown): { store: ProjectStore; value: Record<string, unknown> } {
  if (!project || !payload || typeof payload !== 'object') throw new Error('Aucun projet ouvert.');
  const value = payload as Record<string, unknown>; project.assertSession(value.sessionId);
  return { store: project, value };
}
function gitInspector(store: ProjectStore): GitInspection {
  if (gitSession?.id !== store.sessionId) gitSession = { id: store.sessionId,
    inspector: new GitInspection(store.root, () => store.manifest.sources.map(source => source.path)) };
  return gitSession.inspector;
}
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
    message: `Créer un dépôt Git local dans ${store.root} ?`, detail: 'Branche main, exclusions des documents/ROM/secrets/artefacts. Aucun fichier indexé, aucun commit, aucun accès réseau. Un .gitignore existant est conservé et bloque cette première version.' });
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
route('agent:configure', async payload => {
  if (!payload || typeof payload !== 'object') throw new Error('Configuration invalide.');
  const value = payload as Record<string, unknown>; return agent.configure(value.key, value.model);
});
route('agent:start', async payload => {
  const { store, value } = projectRequest(payload);
  if (value.includeDocuments !== undefined && typeof value.includeDocuments !== 'boolean') throw new Error('Scope documentaire invalide.');
  return agent.start(store, value.objective, bufferRequest(value.buffers), value.includeDocuments === true);
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
