/// <reference types="vite/client" />

interface Window {
  zoomguru: {
    onTrigger: (event: string, callback: () => void) => void;
    captureScreen: () => Promise<string>;
    startListening: () => Promise<string>;
    stopListening: () => Promise<void>;
    getDeviceId: () => Promise<string>;
    store: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
      delete: (key: string) => Promise<void>;
    };
    openExternal: (url: string) => Promise<void>;
  };
}
