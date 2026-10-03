const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  open: () => ipcRenderer.invoke('listing:open'),
  save: (source, saveAs = false) => ipcRenderer.invoke('listing:save', { source, saveAs }),
  exportDisk: source => ipcRenderer.invoke('listing:export', { source }),
  setDirty: dirty => ipcRenderer.send('listing:dirty', dirty),
  project: Object.freeze({
    open: () => ipcRenderer.invoke('project:open'),
    create: name => ipcRenderer.invoke('project:create', name),
    save: (sessionId, id, source) => ipcRenderer.invoke('project:save', { sessionId, id, source }),
    add: (sessionId, name) => ipcRenderer.invoke('project:add', { sessionId, name }),
    setEntry: (sessionId, id) => ipcRenderer.invoke('project:entry', { sessionId, id }),
    exportDisk: (sessionId, sources) => ipcRenderer.invoke('project:export', { sessionId, sources }),
  }),
}));
