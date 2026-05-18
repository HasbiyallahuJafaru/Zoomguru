"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("zoomguru", {
  // Triggers from main process → renderer (hotkeys)
  onTrigger: (event, callback) => {
    electron.ipcRenderer.on(`trigger:${event}`, callback);
  },
  // Screenshot capture via desktopCapturer
  captureScreen: () => electron.ipcRenderer.invoke("capture:screen"),
  // Speech-to-text (Whisper via main process)
  startListening: () => electron.ipcRenderer.invoke("speech:start"),
  stopListening: () => electron.ipcRenderer.invoke("speech:stop"),
  // Device fingerprint (SHA256 of hardware identifiers)
  getDeviceId: () => electron.ipcRenderer.invoke("device:fingerprint"),
  // Encrypted local storage
  store: {
    get: (key) => electron.ipcRenderer.invoke("store:get", key),
    set: (key, value) => electron.ipcRenderer.invoke("store:set", key, value),
    delete: (key) => electron.ipcRenderer.invoke("store:delete", key)
  },
  // Open URL in system browser
  openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url)
});
