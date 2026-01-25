const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getDisplays: () => ipcRenderer.invoke("app:getDisplays"),

  openDisplay: () => ipcRenderer.invoke("display:open"),
  closeDisplay: () => ipcRenderer.invoke("display:close"),

  // ✅ NOUVEAU : lire/appliquer la position/taille de la fenêtre Timer
  getDisplayBounds: () => ipcRenderer.invoke("display:getBounds"),
  setDisplayBounds: (bounds) => ipcRenderer.invoke("display:setBounds", bounds),

  setConfig: (cfg) => ipcRenderer.invoke("timer:setConfig", cfg),

  start: () => ipcRenderer.invoke("timer:start"),
  pause: () => ipcRenderer.invoke("timer:pause"),
  reset: () => ipcRenderer.invoke("timer:reset"),

  onState: (cb) => {
    ipcRenderer.removeAllListeners("timer:state");
    ipcRenderer.on("timer:state", (_evt, state) => cb(state));
  }
});
