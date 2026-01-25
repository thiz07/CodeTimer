const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getDisplays: () => ipcRenderer.invoke("app:getDisplays"),

  openDisplay: () => ipcRenderer.invoke("display:open"),
  closeDisplay: () => ipcRenderer.invoke("display:close"),

  getDisplayBounds: () => ipcRenderer.invoke("display:getBounds"),
  setDisplayBounds: (bds) => ipcRenderer.invoke("display:setBounds", bds),

  setConfig: (cfg) => ipcRenderer.invoke("timer:setConfig", cfg),

  start: () => ipcRenderer.invoke("timer:start"),
  pause: () => ipcRenderer.invoke("timer:pause"),
  reset: () => ipcRenderer.invoke("timer:reset"),

  onState: (cb) => {
    ipcRenderer.removeAllListeners("timer:state");
    ipcRenderer.on("timer:state", (_evt, state) => cb(state));
  }
});
