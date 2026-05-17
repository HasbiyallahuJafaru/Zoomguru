# ZoomGuru — Electron App

## Stack
- **Electron** (latest) + **Vite** + **React 18**
- **electron-builder** — cross-platform packaging
- **electron-wda** — Windows display affinity (screen share exclusion)
- **@picovoice/porcupine-node** — local wake word detection
- **whisper.js / onnxruntime-node** — local speech-to-text
- **electron-store** — local encrypted storage (tokens, settings)

---

## Project Bootstrap

```bash
npm create vite@latest electron-app -- --template react-ts
cd electron-app

npm install electron electron-builder vite-plugin-electron
npm install electron-store electron-wda
npm install @picovoice/porcupine-node
npm install onnxruntime-node

# Dev tools
npm install -D concurrently wait-on
```

---

## Directory Structure

```
apps/electron/
├── electron/
│   ├── main.ts           ← main process — window creation, hotkeys
│   ├── preload.ts        ← context bridge — safe IPC
│   ├── capture.ts        ← desktopCapturer — screenshot logic
│   ├── speech.ts         ← Whisper STT + Porcupine wake word
│   └── fingerprint.ts    ← device fingerprint generation
├── src/
│   ├── App.tsx           ← root component
│   ├── overlay/
│   │   ├── Overlay.tsx       ← main overlay UI
│   │   ├── AnswerStream.tsx   ← streaming text display
│   │   ├── ModeBar.tsx        ← behavioral/technical/coding switcher
│   │   ├── HotkeyHint.tsx     ← hotkey reminder display
│   │   └── PaywallModal.tsx   ← upgrade prompt
│   ├── auth/
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   ├── setup/
│   │   ├── CVUpload.tsx      ← pre-interview CV upload
│   │   ├── JDInput.tsx       ← job description paste
│   │   └── PreflightCheck.tsx← mic test + mode select
│   └── store/
│       ├── session.ts        ← interview session state
│       └── auth.ts           ← token management
├── package.json
├── vite.config.ts
└── electron-builder.config.js
```

---

## main.ts — Window Creation + Screen Protection

```typescript
import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron';
import path from 'path';
import { initCapture } from './capture';
import { initSpeech } from './speech';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    frame: false,              // no title bar
    transparent: true,         // transparent background
    alwaysOnTop: true,         // stays above everything
    skipTaskbar: true,         // doesn't appear in taskbar
    resizable: true,
    movable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  // ─── SCREEN SHARE EXCLUSION ───────────────────────────────
  if (process.platform === 'darwin') {
    // macOS — built into Electron
    mainWindow.setContentProtection(true);
  } else if (process.platform === 'win32') {
    // Windows — via native addon
    const { setWindowDisplayAffinity } = require('electron-wda');
    mainWindow.once('ready-to-show', () => {
      setWindowDisplayAffinity(mainWindow!, 'WDA_EXCLUDEFROMCAPTURE');
    });
  }

  // ─── ALWAYS ON TOP (above screen share UI) ────────────────
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Load app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Position — right side of screen by default
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  mainWindow.setPosition(width - 440, Math.floor(height / 2) - 300);
}

app.whenReady().then(() => {
  createWindow();
  registerHotkeys();
  initCapture(mainWindow!);
  initSpeech(mainWindow!);
});

function registerHotkeys() {
  // Listen mode
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    mainWindow?.webContents.send('trigger:listen');
  });

  // Screenshot mode
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    mainWindow?.webContents.send('trigger:screenshot');
  });

  // Hide/show overlay
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });

  // Regenerate last answer
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    mainWindow?.webContents.send('trigger:regenerate');
  });

  // Clear / new question
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    mainWindow?.webContents.send('trigger:clear');
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

---

## preload.ts — Context Bridge

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('zoomguru', {
  // Triggers from main process to renderer
  onTrigger: (event: string, callback: () => void) => {
    ipcRenderer.on(`trigger:${event}`, callback);
  },

  // Screenshot capture
  captureScreen: () => ipcRenderer.invoke('capture:screen'),

  // Speech
  startListening: () => ipcRenderer.invoke('speech:start'),
  stopListening: () => ipcRenderer.invoke('speech:stop'),

  // Device fingerprint
  getDeviceId: () => ipcRenderer.invoke('device:fingerprint'),

  // Store (encrypted local storage)
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },

  // Open external links
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
});
```

---

## capture.ts — Screenshot

```typescript
import { desktopCapturer, ipcMain, BrowserWindow } from 'electron';

export function initCapture(win: BrowserWindow) {
  ipcMain.handle('capture:screen', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    const primaryScreen = sources[0];
    const png = primaryScreen.thumbnail.toPNG();
    return png.toString('base64');
  });
}
```

---

## fingerprint.ts — Device Locking

```typescript
import os from 'os';
import crypto from 'crypto';
import { networkInterfaces } from 'os';

function getFirstMAC(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const net = nets[name];
    if (net) {
      for (const iface of net) {
        if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
          return iface.mac;
        }
      }
    }
  }
  return 'unknown';
}

export function getDeviceFingerprint(): string {
  const data = {
    cpuModel: os.cpus()[0]?.model || 'unknown',
    cpuCount: os.cpus().length,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    totalMemory: os.totalmem(),
    mac: getFirstMAC(),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}
```

---

## Overlay UI (src/overlay/Overlay.tsx)

```tsx
import { useState, useEffect, useRef } from 'react';
import { AnswerStream } from './AnswerStream';
import { ModeBar } from './ModeBar';

type Mode = 'behavioral' | 'technical' | 'coding' | 'systemdesign';

export function Overlay() {
  const [answer, setAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState<Mode>('behavioral');
  const [visible, setVisible] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Listen for hotkey triggers from main process
    window.zoomguru.onTrigger('listen', handleListen);
    window.zoomguru.onTrigger('screenshot', handleScreenshot);
    window.zoomguru.onTrigger('regenerate', handleRegenerate);
    window.zoomguru.onTrigger('clear', () => setAnswer(''));
  }, []);

  async function handleListen() {
    setIsListening(true);
    const transcript = await window.zoomguru.startListening();
    setIsListening(false);
    if (transcript) streamAnswer(transcript);
  }

  async function handleScreenshot() {
    const image = await window.zoomguru.captureScreen();
    streamScreenshot(image);
  }

  function streamAnswer(transcript: string) {
    setAnswer('');
    setIsStreaming(true);

    const token = localStorage.getItem('access_token');
    const sessionId = localStorage.getItem('session_id');

    // SSE stream
    const es = new EventSource(
      `${import.meta.env.VITE_API_URL}/ai/stream?` +
      `transcript=${encodeURIComponent(transcript)}&sessionId=${sessionId}&token=${token}`
    );

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.done) {
        es.close();
        setIsStreaming(false);
      } else {
        setAnswer(prev => prev + data.chunk);
      }
    };

    es.onerror = () => {
      es.close();
      setIsStreaming(false);
    };

    eventSourceRef.current = es;
  }

  function handleRegenerate() {
    // Re-trigger last question
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 10, 15, 0.88)',
      backdropFilter: 'blur(12px)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        WebkitAppRegion: 'drag' as any,
      }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>
          ZoomGuru
        </span>
        {isListening && (
          <span style={{ color: '#22c55e', fontSize: 11 }}>● Listening...</span>
        )}
        {isStreaming && (
          <span style={{ color: '#3b82f6', fontSize: 11 }}>● Thinking...</span>
        )}
      </div>

      {/* Mode Bar */}
      <ModeBar mode={mode} onModeChange={setMode} />

      {/* Answer */}
      <AnswerStream answer={answer} isStreaming={isStreaming} />

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        gap: 8,
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
      }}>
        <span>⌘⇧A Listen</span>
        <span>⌘⇧S Screen</span>
        <span>⌘⇧H Hide</span>
        <span>⌘⇧R Retry</span>
      </div>
    </div>
  );
}
```

---

## electron-builder.config.js — Packaging

```javascript
module.exports = {
  appId: 'com.zoomguru.app',
  productName: 'ZoomGuru',
  directories: { output: 'release' },
  files: ['dist/**/*', 'electron/**/*'],

  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    category: 'public.app-category.productivity',
    icon: 'assets/icon.icns',
    // Notarization config here for production
  },

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icon.ico',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'assets/icon.ico',
    installerHeaderIcon: 'assets/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
};
```

---

## Environment Variables (Electron)

```env
# apps/electron/.env
VITE_API_URL=https://api.zoomguru.com
VITE_PAYSTACK_PUBLIC_KEY=pk_live_...
VITE_APP_ENV=production
```
