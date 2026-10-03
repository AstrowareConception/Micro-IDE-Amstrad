const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  open: () => ipcRenderer.invoke('listing:open'),
  save: (source, saveAs = false) => ipcRenderer.invoke('listing:save', { source, saveAs }),
  exportDisk: source => ipcRenderer.invoke('listing:export', { source }),
  setDirty: dirty => ipcRenderer.send('listing:dirty', dirty),
  agent: Object.freeze({
    configure: (key, model) => ipcRenderer.invoke('agent:configure', { key, model }),
    start: (sessionId, objective, buffers) => ipcRenderer.invoke('agent:start', { sessionId, objective, buffers }),
    status: taskId => ipcRenderer.invoke('agent:status', taskId),
    cancel: taskId => ipcRenderer.invoke('agent:cancel', taskId),
    steer: (taskId, instruction) => ipcRenderer.invoke('agent:steer', { taskId, instruction }),
    restore: (taskId, buffers, sessionId) => ipcRenderer.invoke('agent:restore', { taskId, buffers, sessionId }),
  }),
  project: Object.freeze({
    open: () => ipcRenderer.invoke('project:open'),
    create: name => ipcRenderer.invoke('project:create', name),
    save: (sessionId, id, source) => ipcRenderer.invoke('project:save', { sessionId, id, source }),
    add: (sessionId, name) => ipcRenderer.invoke('project:add', { sessionId, name }),
    setEntry: (sessionId, id) => ipcRenderer.invoke('project:entry', { sessionId, id }),
    exportDisk: (sessionId, sources) => ipcRenderer.invoke('project:export', { sessionId, sources }),
  }),
}));
