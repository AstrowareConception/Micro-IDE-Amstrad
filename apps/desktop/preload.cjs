const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  open: () => ipcRenderer.invoke('listing:open'),
  save: (source, saveAs = false) => ipcRenderer.invoke('listing:save', { source, saveAs }),
  exportDisk: source => ipcRenderer.invoke('listing:export', { source }),
  setDirty: dirty => ipcRenderer.send('listing:dirty', dirty),
}));
