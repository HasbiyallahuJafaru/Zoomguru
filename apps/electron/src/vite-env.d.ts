/// <reference types="vite/client" />

interface Window {
  zoomguru: {
    onTrigger: (event: string, callback: (...args: any[]) => void) => void;
    onEvent: (channel: string, callback: (...args: any[]) => void) => void;
    captureScreen: () => Promise<string>;
    startListening: () => Promise<string>;
    stopListening: () => Promise<void>;
    getDeviceId: () => Promise<string>;
    store: {
      get: (key: string) => Promise<unknown>;
      set: (key: string, value: unknown) => Promise<void>;
      delete: (key: string) => Promise<void>;
    };
    openExternal: (url: string) => Promise<void>;
    onGoogleAuth: (callback: (data: { token: string }) => void) => void;
    offGoogleAuth?: () => void;
    openGoogleAuth: () => Promise<void>;
    hideWindow: () => Promise<void>;
  };
}
