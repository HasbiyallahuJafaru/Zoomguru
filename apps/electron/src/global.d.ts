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
  signRequest(): Promise<SignedRequest>;
  hideWindow(): Promise<void>;
  quitApp(): Promise<void>;
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
  kokoroCheckReady(): Promise<boolean>;
  kokoroSetReady(ready: boolean): Promise<void>;
  openInterviewer(): Promise<void>;
  closeInterviewer(): Promise<void>;
  openDocCopilot(): Promise<void>;
  docCopilotParseFiles(): Promise<ParsedDoc[]>;
  printReport(): Promise<void>;
  tourHasCompleted(): Promise<boolean>;
  tourSetCompleted(): Promise<void>;
  platform: string;
}

declare global {
  interface ParsedSlide {
    slideNumber: number;
    title: string | null;
    textBlocks: string[];
    tables: Array<{ headers: string[]; rows: string[][] }>;
    chartWarnings: string[];
  }

  interface ParsedPdfPage {
    pageNumber: number;
    text: string;
    isEmpty: boolean;
  }

  interface ParsedDoc {
    docId: string;
    fileName: string;
    fileType: 'pdf' | 'pptx';
    pageCount?: number;
    slideCount?: number;
    parsedContent: ParsedSlide[] | ParsedPdfPage[];
    warnings: string[];
    loadedAt: string;
  }

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
