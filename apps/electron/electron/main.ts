import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { initCapture } from './capture';
import { initSpeech } from './speech';
import { getDeviceFingerprint } from './fingerprint';

let mainWindow: BrowserWindow | null = null;

// Encrypted local store — key derived from device fingerprint
const fingerprint = getDeviceFingerprint();
const store = new Store({
  encryptionKey: 'zoomguru-local-key-' + fingerprint.slice(0, 16),
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
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

  // ─── SCREEN SHARE EXCLUSION ───────────────────────────────────────────────
  if (process.platform === 'darwin') {
    // macOS — built into Electron
    mainWindow.setContentProtection(true);
  } else if (process.platform === 'win32') {
    // Windows — via native addon (electron-wda)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { setWindowDisplayAffinity } = require('electron-wda');
      mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
          setWindowDisplayAffinity(mainWindow, 'WDA_EXCLUDEFROMCAPTURE');
        }
      });
    } catch (e) {
      // electron-wda may not be available in dev; log and continue
      console.warn('electron-wda not available:', e);
    }
  }

  // ─── ALWAYS ON TOP (above screen share UI) ────────────────────────────────
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // ─── LOAD APP ────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // ─── POSITION: right side of screen ──────────────────────────────────────
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  mainWindow.setPosition(width - 440, Math.floor(height / 2) - 300);
}

// ─── IPC HANDLERS ──────────────────────────────────────────────────────────

function registerIpcHandlers() {
  // Encrypted local store
  ipcMain.handle('store:get', (_event, key: string) => {
    return store.get(key);
  });

  ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
    store.set(key, value);
  });

  ipcMain.handle('store:delete', (_event, key: string) => {
    store.delete(key);
  });

  // Open links in default system browser
  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    return shell.openExternal(url);
  });

  // Device fingerprint
  ipcMain.handle('device:fingerprint', () => {
    return fingerprint;
  });
}

// ─── GLOBAL HOTKEYS ────────────────────────────────────────────────────────

function registerHotkeys() {
  // Listen mode — start mic recording
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    mainWindow?.webContents.send('trigger:listen');
  });

  // Screenshot mode — capture + send to AI
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

// ─── APP LIFECYCLE ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  registerHotkeys();
  registerIpcHandlers();
  initCapture(mainWindow!);
  initSpeech(mainWindow!);

  app.on('activate', () => {
    // macOS — re-create window if dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
