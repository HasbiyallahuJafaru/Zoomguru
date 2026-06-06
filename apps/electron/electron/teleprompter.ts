import { BrowserWindow, ipcMain, app } from 'electron';
import path from 'path';

let teleprompterWindow: BrowserWindow | null = null;

export function createTeleprompterWindow(): void {
  if (teleprompterWindow && !teleprompterWindow.isDestroyed()) {
    teleprompterWindow.focus();
    return;
  }

  teleprompterWindow = new BrowserWindow({
    width: 900,
    height: 660,
    minWidth: 600,
    minHeight: 440,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0a',
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    movable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  try {
    teleprompterWindow.setContentProtection(true);
  } catch {
    // not supported on all platforms
  }

  if (!app.isPackaged) {
    void teleprompterWindow.loadURL('http://localhost:5173/teleprompter.html');
  } else {
    void teleprompterWindow.loadFile(
      path.join(__dirname, '../dist-renderer/teleprompter.html'),
    );
  }

  teleprompterWindow.once('ready-to-show', () => {
    teleprompterWindow?.show();
  });

  teleprompterWindow.on('closed', () => {
    teleprompterWindow = null;
  });
}

export function registerTeleprompterIpcHandlers(): void {
  ipcMain.handle('teleprompter:open', () => {
    createTeleprompterWindow();
  });
}
