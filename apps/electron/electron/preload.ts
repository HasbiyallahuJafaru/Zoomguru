import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('zoomguru', {
  onTrigger: (event: string, callback: (...args: any[]) => void): void => {
    const ALLOWED_TRIGGERS = new Set([
      'listen', 'screenshot', 'hide', 'clear', 'auto',
    ]);
    if (!ALLOWED_TRIGGERS.has(event)) {
      console.warn(`onTrigger: unknown event "${event}"`);
      return;
    }
    const channel = `trigger:${event}`;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, ...args) => callback(...args));
  },

  offTrigger: (event: string): void => {
    ipcRenderer.removeAllListeners(`trigger:${event}`);
  },

  captureScreen: (): Promise<string> =>
    ipcRenderer.invoke('capture:screen'),

  getDevicePublicKey: (): Promise<{ keyId: string; publicKey: string }> =>
    ipcRenderer.invoke('device:getPublicKey'),

  signRequest: (userId: string): Promise<{ keyId: string; timestamp: number; signature: string }> =>
    ipcRenderer.invoke('device:sign', userId),

  hideWindow: (): Promise<void> =>
    ipcRenderer.invoke('window:hide'),

  quitApp: (): Promise<void> =>
    ipcRenderer.invoke('window:quit'),

  requestMicPermission: (): Promise<boolean> =>
    ipcRenderer.invoke('permissions:request-mic'),

  parseCV: (): Promise<{ text: string; filename: string } | { error: string } | null> =>
    ipcRenderer.invoke('cv:parse'),

  loadCV: (): Promise<{ text: string; filename: string } | null> =>
    ipcRenderer.invoke('cv:load'),

  clearCV: (): Promise<void> =>
    ipcRenderer.invoke('cv:clear'),

  getSystemAudioSourceId: (): Promise<string> =>
    ipcRenderer.invoke('capture:audio-source-id'),

  saveJD: (text: string): Promise<void> =>
    ipcRenderer.invoke('jd:save', text),

  loadJD: (): Promise<string | null> =>
    ipcRenderer.invoke('jd:load'),

  clearJD: (): Promise<void> =>
    ipcRenderer.invoke('jd:clear'),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('open-external', url),

  setToken: (token: string): Promise<void> =>
    ipcRenderer.invoke('token:set', token),

  getToken: (): Promise<string> =>
    ipcRenderer.invoke('token:get'),

  clearToken: (): Promise<void> =>
    ipcRenderer.invoke('token:clear'),

  getProtectionStatus: (): Promise<boolean> =>
    ipcRenderer.invoke('protection:status'),

  setSessionActive: (active: boolean): Promise<void> =>
    ipcRenderer.invoke('session:setActive', active),

  getNoiseSuppressor: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:getNoiseSuppressor'),

  setNoiseSuppressor: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setNoiseSuppressor', enabled),

  getDarkMode: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:getDarkMode'),

  setDarkMode: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setDarkMode', enabled),

  setMouseIgnore: (ignore: boolean): Promise<void> =>
    ipcRenderer.invoke('overlay:setMouseIgnore', ignore),

  printReport: (): Promise<void> =>
    ipcRenderer.invoke('report:print'),

  tourHasCompleted: (): Promise<boolean> =>
    ipcRenderer.invoke('tour:hasCompleted'),

  tourSetCompleted: (): Promise<void> =>
    ipcRenderer.invoke('tour:setCompleted'),

  parseMeetingDoc: (): Promise<{ text: string; filename: string } | { error: string } | null> =>
    ipcRenderer.invoke('meeting-doc:parse'),

  loadMeetingDoc: (): Promise<{ text: string; filename: string } | null> =>
    ipcRenderer.invoke('meeting-doc:load'),

  clearMeetingDoc: (): Promise<void> =>
    ipcRenderer.invoke('meeting-doc:clear'),

  platform: process.platform,
});
