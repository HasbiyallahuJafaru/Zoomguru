import { BrowserWindow, ipcMain, app } from 'electron';
import path from 'path';
import Store from 'electron-store';

interface InterviewerStore {
  kokoroModelReady?: boolean;
}

let interviewerWindow: BrowserWindow | null = null;
const store = new Store<InterviewerStore>({ name: 'interviewer' });

export function createInterviewerWindow(): void {
  if (interviewerWindow && !interviewerWindow.isDestroyed()) {
    interviewerWindow.focus();
    return;
  }

  interviewerWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 760,
    minHeight: 560,
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
    interviewerWindow.setContentProtection(true);
  } catch {
    // not supported on all platforms
  }

  if (!app.isPackaged) {
    void interviewerWindow.loadURL('http://localhost:5173/interviewer.html');
  } else {
    void interviewerWindow.loadFile(
      path.join(__dirname, '../dist-renderer/interviewer.html'),
    );
  }

  interviewerWindow.once('ready-to-show', () => {
    interviewerWindow?.show();
  });

  interviewerWindow.on('closed', () => {
    interviewerWindow = null;
  });
}

export function registerInterviewerIpcHandlers(): void {
  ipcMain.handle('kokoro:checkReady', () => {
    return store.get('kokoroModelReady', false);
  });

  ipcMain.handle('kokoro:setReady', (_event, ready: boolean) => {
    if (typeof ready === 'boolean') store.set('kokoroModelReady', ready);
  });

  ipcMain.handle('interviewer:open', () => {
    createInterviewerWindow();
  });

  ipcMain.handle('interviewer:close', () => {
    if (interviewerWindow && !interviewerWindow.isDestroyed()) {
      interviewerWindow.close();
    }
  });

  ipcMain.handle('report:print', () => {
    if (interviewerWindow && !interviewerWindow.isDestroyed()) {
      interviewerWindow.webContents.print({ silent: false, printBackground: true });
    }
  });
}
