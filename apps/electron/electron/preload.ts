import { contextBridge, ipcRenderer } from 'electron';

// Vite bakes this value in at build time from .env / .env.production
const API_URL: string = (import.meta as any).env?.VITE_API_URL ?? 'https://zoomguru-backend.onrender.com';

contextBridge.exposeInMainWorld('zoomguru', {
  // Triggers from main process → renderer (hotkeys)
  onTrigger: (event: string, callback: (...args: any[]) => void) => {
    const channel = `trigger:${event}`;
    // Remove ALL existing listeners on this channel before adding new one
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, ...args) => callback(...args));
  },

  // Generic named-channel listener (e.g. protection:status, update:ready)
  onEvent: (channel: string, callback: (...args: any[]) => void) => {
    // Remove existing listener before adding — prevents duplicates
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, ...args) => callback(...args));
  },

  // Screenshot capture via desktopCapturer
  captureScreen: (): Promise<string> => ipcRenderer.invoke('capture:screen'),

  // Speech-to-text (Whisper via main process)
  startListening: (): Promise<string> => ipcRenderer.invoke('speech:start'),
  stopListening: (): Promise<void> => ipcRenderer.invoke('speech:stop'),

  // Device fingerprint (SHA256 of hardware identifiers)
  getDeviceId: (): Promise<string> => ipcRenderer.invoke('device:fingerprint'),

  // Encrypted local storage
  store: {
    get: (key: string): Promise<unknown> => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('store:set', key, value),
    delete: (key: string): Promise<void> => ipcRenderer.invoke('store:delete', key),
  },

  // Open URL in system browser
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', url),

  // Google OAuth — opens system browser, receives token back via deep link
  onGoogleAuth: (callback: (data: { token: string }) => void) => {
    ipcRenderer.removeAllListeners('auth:google-callback');
    ipcRenderer.on('auth:google-callback', (_e, data) => callback(data));
  },
  offGoogleAuth: () => {
    ipcRenderer.removeAllListeners('auth:google-callback');
  },

  // Uses IPC → main process shell.openExternal (shell is not available in preload)
  openGoogleAuth: (): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', API_URL + '/auth/google/electron'),

  hideWindow: (): Promise<void> =>
    ipcRenderer.invoke('window:hide'),
});
