const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  open: () => ipcRenderer.invoke('listing:open'),
  save: (source, saveAs = false) => ipcRenderer.invoke('listing:save', { source, saveAs }),
  exportDisk: source => ipcRenderer.invoke('listing:export', { source }),
  setDirty: dirty => ipcRenderer.send('listing:dirty', dirty),
  history: Object.freeze({
    list: sessionId => ipcRenderer.invoke('history:list', { sessionId }),
    version: (sessionId, snapshotId, id, revision) => ipcRenderer.invoke('history:version', { sessionId, snapshotId, id, revision }),
  }),
  external: Object.freeze({
    status: sessionId => ipcRenderer.invoke('external:status', { sessionId }),
    read: (sessionId, id, revision) => ipcRenderer.invoke('external:read', { sessionId, id, revision }),
    accept: (sessionId, id, revision, baseRevision) => ipcRenderer.invoke('external:accept', { sessionId, id, revision, baseRevision }),
  }),
  drafts: Object.freeze({
    status: sessionId => ipcRenderer.invoke('drafts:status', { sessionId }),
    capture: (sessionId, sources, revision) => ipcRenderer.invoke('drafts:capture', { sessionId, sources, revision }),
    read: (sessionId, revision) => ipcRenderer.invoke('drafts:read', { sessionId, revision }),
    forget: (sessionId, revision) => ipcRenderer.invoke('drafts:forget', { sessionId, revision }),
  }),
  terminal: Object.freeze({
    run: (sessionId, command) => ipcRenderer.invoke('terminal:run', { sessionId, command }),
    status: (sessionId, id) => ipcRenderer.invoke('terminal:status', { sessionId, id }),
    stop: (sessionId, id) => ipcRenderer.invoke('terminal:stop', { sessionId, id }),
  }),
  git: Object.freeze({
    status: sessionId => ipcRenderer.invoke('git:status', { sessionId }),
    diff: (sessionId, changeId, side) => ipcRenderer.invoke('git:diff', { sessionId, changeId, side }),
    history: (sessionId, cursor) => ipcRenderer.invoke('git:history', { sessionId, cursor }),
    prepareInit: sessionId => ipcRenderer.invoke('git:prepare-init', { sessionId }),
    init: (sessionId, planId) => ipcRenderer.invoke('git:init', { sessionId, planId }),
    changeIndex: (sessionId, snapshotId, changeId, action) => ipcRenderer.invoke('git:index', { sessionId, snapshotId, changeId, action }),
  }),
  firmware: Object.freeze({
    status: () => ipcRenderer.invoke('firmware:status'),
    importRom: role => ipcRenderer.invoke('firmware:import', role),
    clear: () => ipcRenderer.invoke('firmware:clear'),
  }),
  agent: Object.freeze({
    configure: (key, model) => ipcRenderer.invoke('agent:configure', { key, model }),
    start: (sessionId, objective, buffers, includeDocuments = false) => ipcRenderer.invoke('agent:start', { sessionId, objective, buffers, includeDocuments }),
    status: taskId => ipcRenderer.invoke('agent:status', taskId),
    cancel: taskId => ipcRenderer.invoke('agent:cancel', taskId),
    steer: (taskId, instruction) => ipcRenderer.invoke('agent:steer', { taskId, instruction }),
    restore: (taskId, buffers, sessionId) => ipcRenderer.invoke('agent:restore', { taskId, buffers, sessionId }),
  }),
  project: Object.freeze({
    open: () => ipcRenderer.invoke('project:open'),
    create: name => ipcRenderer.invoke('project:create', name),
    save: (sessionId, id, source) => ipcRenderer.invoke('project:save', { sessionId, id, source }),
    saveAll: (sessionId, sources) => ipcRenderer.invoke('project:save-all', { sessionId, sources }),
    add: (sessionId, name) => ipcRenderer.invoke('project:add', { sessionId, name }),
    setEntry: (sessionId, id) => ipcRenderer.invoke('project:entry', { sessionId, id }),
    exportDisk: (sessionId, sources) => ipcRenderer.invoke('project:export', { sessionId, sources }),
    importDocument: (sessionId, kind = 'text') => ipcRenderer.invoke('documents:import', { sessionId, kind }),
    readDocument: (sessionId, id) => ipcRenderer.invoke('documents:read', { sessionId, id }),
  }),
}));
