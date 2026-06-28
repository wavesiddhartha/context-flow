const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Overlay controls
  closeOverlay: () => ipcRenderer.send('overlay:close'),
  openMain: () => ipcRenderer.send('overlay:open-main'),
  setSize: (mode) => ipcRenderer.send('overlay:set-size', mode),
  onSetMode: (callback) => {
    ipcRenderer.on('overlay:set-mode', (_, mode) => callback(mode))
    return () => ipcRenderer.removeAllListeners('overlay:set-mode')
  },

  // Screenshot events
  onScreenshot: (callback) => {
    ipcRenderer.on('screenshot-ready', (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('screenshot-ready')
  },

  // Capture on demand
  capture: () => ipcRenderer.invoke('app:capture'),
  captureInteractive: () => ipcRenderer.invoke('app:capture-interactive'),

  // Platform info
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // Database
  saveSession: (data) => ipcRenderer.invoke('db:save-session', data),
  saveMessage: (data) => ipcRenderer.invoke('db:save-message', data),
  getSessions: () => ipcRenderer.invoke('db:get-sessions'),
  getSession: (id) => ipcRenderer.invoke('db:get-session', id),
  deleteSession: (id) => ipcRenderer.invoke('db:delete-session', id),
  updatePattern: (keyword) => ipcRenderer.send('db:update-pattern', keyword),
  getPatterns: () => ipcRenderer.invoke('db:get-patterns'),
  openFile: (filepath) => ipcRenderer.invoke('app:open-file', filepath),
})
