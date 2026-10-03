import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { readFile, writeFile, rename, unlink, lstat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildListingDisk } from '../../packages/basic-language/src/build.ts';

const base = dirname(fileURLToPath(import.meta.url));
const page = pathToFileURL(join(base, '../../renderer/index.html')).href;
const MAX_SOURCE_BYTES = 1024 * 1024;
let window: BrowserWindow;
let current: { path: string; hash: string } | undefined;
let dirty = false;
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
function route(channel: string, handler: (payload: unknown) => Promise<unknown>) {
  ipcMain.handle(channel, async (event, payload: unknown) => {
    trusted(event);
    try { return await handler(payload); }
    catch (error) { return { error: error instanceof Error ? error.message : 'Échec de l’opération.' }; }
  });
}

await app.whenReady();
window = new BrowserWindow({ width: 1440, height: 960, minWidth: 900, minHeight: 650,
  backgroundColor: '#10151d', title: 'Micro IDE Amstrad',
  webPreferences: { preload: join(base, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
});
window.removeMenu();
window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
window.webContents.on('will-navigate', (event, url) => { if (url !== page) event.preventDefault(); });
window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
window.on('close', event => {
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
  return { name: path.split(/[\\/]/).at(-1), source };
});
route('listing:save', async payload => {
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
  const bytes = buildListingDisk(sourceFrom(payload).source);
  const selection = await dialog.showSaveDialog(window, { defaultPath: 'program.dsk', filters: [{ name: 'Disquette CPC DATA', extensions: ['dsk'] }] });
  if (selection.canceled || !selection.filePath) return null;
  // Export cannot silently overwrite the open source.
  if (selection.filePath === current?.path) throw new Error('La destination DSK doit être distincte du listing.');
  await atomicWrite(selection.filePath, bytes);
  return { name: selection.filePath.split(/[\\/]/).at(-1) };
});
await window.loadURL(page);
app.on('window-all-closed', () => app.quit());
