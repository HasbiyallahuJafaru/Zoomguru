import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('zoomguru', {
  // Triggers from main process → renderer (hotkeys)
  onTrigger: (event: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(`trigger:${event}`, (_e, ...args) => callback(...args));
  },

  // Generic named-channel listener (e.g. protection:status, update:ready)
  onEvent: (channel: string, callback: (...args: any[]) => void) => {
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

  // Google OAuth — open system browser then receive callback token
  onGoogleAuth: (callback: (data: { token: string }) => void) => {
    ipcRenderer.on('auth:google-callback', (_e, data) => callback(data));
  },

  openGoogleAuth: () => {
    const apiUrl = process.env.VITE_API_URL || 'https://zoomguru.onrender.com';
    shell.openExternal(apiUrl + '/auth/google/electron');
  },
});
