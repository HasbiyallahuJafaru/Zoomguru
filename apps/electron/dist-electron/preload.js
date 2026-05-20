"use strict";
const electron = require("electron");
const API_URL = "http://localhost:3000";
electron.contextBridge.exposeInMainWorld("zoomguru", {
  // Triggers from main process → renderer (hotkeys)
  onTrigger: (event, callback) => {
    const channel = `trigger:${event}`;
    electron.ipcRenderer.removeAllListeners(channel);
    electron.ipcRenderer.on(channel, (_e, ...args) => callback(...args));
  },
  // Generic named-channel listener (e.g. protection:status, update:ready)
  onEvent: (channel, callback) => {
    electron.ipcRenderer.removeAllListeners(channel);
    electron.ipcRenderer.on(channel, (_e, ...args) => callback(...args));
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
  openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url),
  // Google OAuth — opens system browser, receives token back via deep link
  onGoogleAuth: (callback) => {
    electron.ipcRenderer.on("auth:google-callback", (_e, data) => callback(data));
  },
  // Uses IPC → main process shell.openExternal (shell is not available in preload)
  openGoogleAuth: () => electron.ipcRenderer.invoke("shell:openExternal", API_URL + "/auth/google/electron"),
  hideWindow: () => electron.ipcRenderer.invoke("window:hide")
});
