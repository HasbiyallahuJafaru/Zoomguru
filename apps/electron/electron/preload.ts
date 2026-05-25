import { contextBridge, ipcRenderer } from 'electron';

const API_URL: string = (import.meta as any).env?.VITE_API_URL ?? 'https://zoomguru.onrender.com';

contextBridge.exposeInMainWorld('zoomguru', {
  onTrigger: (event: string, callback: (...args: any[]) => void) => {
    const channel = `trigger:${event}`;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, ...args) => callback(...args));
  },

  onEvent: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, ...args) => callback(...args));
  },

  captureScreen: (): Promise<string> => ipcRenderer.invoke('capture:screen'),

  startListening: (): Promise<string> => ipcRenderer.invoke('speech:start'),
  stopListening: (): Promise<void> => ipcRenderer.invoke('speech:stop'),

  getDeviceId: (): Promise<string> => ipcRenderer.invoke('device:fingerprint'),

  store: {
    get: (key: string): Promise<unknown> => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('store:set', key, value),
    delete: (key: string): Promise<void> => ipcRenderer.invoke('store:delete', key),
  },

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', url),

  onGoogleAuth: (callback: (data: { token: string }) => void) => {
    ipcRenderer.removeAllListeners('auth:google-callback');
    ipcRenderer.on('auth:google-callback', (_e, data) => callback(data));
  },
  offGoogleAuth: () => {
    ipcRenderer.removeAllListeners('auth:google-callback');
  },

  openGoogleAuth: (): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', API_URL + '/auth/google/electron'),

  hideWindow: (): Promise<void> =>
    ipcRenderer.invoke('window:hide'),
});
