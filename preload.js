const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('raoof', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (k,v) => ipcRenderer.invoke('settings:set', k, v),
  appVersion: () => ipcRenderer.invoke('app:version'),
  clearCache: () => ipcRenderer.invoke('cache:clear'),
  onToast: (cb) => ipcRenderer.on('toast', (_e, payload) => cb(payload)),
  toggleFull: () => ipcRenderer.invoke('win:toggleFull'),
  netProbe: (startUrl) => ipcRenderer.invoke('net:probe', startUrl)
});


try {
  contextBridge.exposeInMainWorld('raoofMaintenance', {
    purgeAndRelaunch: () => ipcRenderer.invoke('app:purge-and-relaunch')
  });
} catch {}
