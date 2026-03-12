const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yooai', {
  getOpenClawHome: () => ipcRenderer.invoke('get-openclaw-home'),
  getMemoryDir: () => ipcRenderer.invoke('get-memory-dir'),
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  closeWindow: () => ipcRenderer.send('win-close'),
  openDevTools: () => ipcRenderer.send('win-devtools'),
  platform: process.platform,
  // 图片处理 API
  saveImage: async (data) => ipcRenderer.invoke('save-image', data),
  selectImage: async () => ipcRenderer.invoke('select-image')
});
