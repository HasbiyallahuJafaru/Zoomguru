interface CvResult {
  text: string;
  filename: string;
}

interface CvError {
  error: string;
}

interface SignedRequest {
  keyId: string;
  timestamp: number;
  signature: string;
}

interface ZoomGuruBridge {
  onTrigger(event: string, callback: (...args: any[]) => void): void;
  offTrigger(event: string): void;
  captureScreen(): Promise<string>;
  getDevicePublicKey(): Promise<{ keyId: string; publicKey: string }>;
  signRequest(userId: string): Promise<SignedRequest>;
  hideWindow(): Promise<void>;
  quitApp(): Promise<void>;
  getWindowBounds(): Promise<{ x: number; y: number; width: number; height: number }>;
  setWindowBounds(bounds: { x: number; y: number; width: number; height: number }): Promise<void>;
  openPayment(checkoutUrl: string): Promise<{ status: 'success' | 'cancelled' | 'error'; reference?: string }>;
  requestMicPermission(): Promise<boolean>;
  parseCV(): Promise<CvResult | CvError | null>;
  loadCV(): Promise<CvResult | null>;
  clearCV(): Promise<void>;
  getSystemAudioSourceId(): Promise<string>;
  saveJD(text: string): Promise<void>;
  loadJD(): Promise<string | null>;
  clearJD(): Promise<void>;
  openExternal(url: string): Promise<void>;
  setToken(token: string): Promise<void>;
  getToken(): Promise<string>;
  clearToken(): Promise<void>;
  getProtectionStatus(): Promise<boolean>;
  setSessionActive(active: boolean): Promise<void>;
  getNoiseSuppressor(): Promise<boolean>;
  setNoiseSuppressor(enabled: boolean): Promise<void>;
  getDarkMode(): Promise<boolean>;
  setDarkMode(enabled: boolean): Promise<void>;
  setMouseIgnore(ignore: boolean): Promise<void>;
  printReport(): Promise<void>;
  tourHasCompleted(): Promise<boolean>;
  tourSetCompleted(): Promise<void>;
  parseMeetingDoc(): Promise<CvResult | CvError | null>;
  loadMeetingDoc(): Promise<CvResult | null>;
  clearMeetingDoc(): Promise<void>;
  platform: string;
}

declare global {
  interface Window {
    zoomguru: ZoomGuruBridge;
  }
}

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
  }
}

export {};
