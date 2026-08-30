const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cfg', {
  status: () => ipcRenderer.invoke('status'),
  connectEpic: () => ipcRenderer.invoke('epic:connect'),
  submitEpicCode: code => ipcRenderer.invoke('epic:submit-code', code),
  runNow: () => ipcRenderer.invoke('run-now'),
  saveSettings: patch => ipcRenderer.invoke('settings:save', patch),
  testNotification: ntfyUrl => ipcRenderer.invoke('notification:test', ntfyUrl),
  openData: () => ipcRenderer.invoke('open:data'),
  openExternal: url => ipcRenderer.invoke('open:external', url),
  onEpicConnected: cb => ipcRenderer.on('epic-connected', (_event, data) => cb(data)),
  onRunState: cb => ipcRenderer.on('run-state', (_event, data) => cb(data)),
});
