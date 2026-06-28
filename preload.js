const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Launch Game
  launchGame: (options) => ipcRenderer.send('launch-game', options),

  // Listen for launch status updates
  onLaunchStatus: (callback) => ipcRenderer.on('launch-status', (event, status) => callback(status)),

  // Open directory picker dialog
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // Open file picker dialog
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),

  // Get active JRE path
  getActiveJavaPath: (mcPath, javaPath) => ipcRenderer.invoke('get-active-java-path', mcPath, javaPath),

  // Open external links in default browser
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Auto-updater
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, status) => callback(status)),
  installUpdate: () => ipcRenderer.send('install-update'),

  // Server status
  getServerStatus: (host) => ipcRenderer.invoke('get-server-status', host)
});
