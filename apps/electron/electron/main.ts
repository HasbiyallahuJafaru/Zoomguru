import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  screen as electronScreen,
  session,
  systemPreferences,
  dialog,
  desktopCapturer,
  shell,
  Notification,
} from 'electron';
import path from 'path';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { initCapture } from './capture';
import { initDeviceKey, getPublicKeyInfo, signRequest } from './deviceKey';

interface WindowStore {
  windowX: number;
  windowY: number;
  cvText?: string;
  cvFilename?: string;
  jdText?: string;
  accessToken?: string;
  noiseSuppressor?: boolean;
  tourCompleted?: boolean;
}

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isSessionActive = false;
const store = new Store<WindowStore>();

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = null;

function scheduleUpdateChecks(): void {
  autoUpdater.checkForUpdates().catch(() => undefined);
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => undefined);
  }, 4 * 60 * 60 * 1000);
}

// Suppress AMD VideoProcessorGetOutputExtension DirectComposition error on Windows.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'UseSkiaRenderer');
}

// Prevent multiple instances from competing for global hotkeys.
// Secondary instances show the existing window and quit.
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  let contentProtected = false;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
    new Notification({
      title: 'ZoomGuru is already running',
      body: 'Find it in your system tray.',
      silent: true,
    }).show();
  });

  function createSplash(): void {
    const { width, height } = electronScreen.getPrimaryDisplay().workAreaSize;
    splashWindow = new BrowserWindow({
      width: 320,
      height: 160,
      x: Math.floor((width - 320) / 2),
      y: Math.floor((height - 160) / 2),
      frame: false,
      transparent: false,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    const html = `<!DOCTYPE html>
<html>
<head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 320px; height: 160px;
    background: #0a0a0a;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #ffffff;
    user-select: none;
  }
  .logo { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 10px; }
  .sub { font-size: 13px; color: #666; }
  .dot { display: inline-block; animation: blink 1.2s infinite; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,80%,100% { opacity: 0; } 40% { opacity: 1; } }
</style></head>
<body>
  <div class="logo">ZoomGuru</div>
  <div class="sub">Starting<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></div>
</body>
</html>`;

    void splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }

  function createWindow(): void {
    const { width: screenWidth, height: screenHeight } =
      electronScreen.getPrimaryDisplay().workAreaSize;

    const defaultX = screenWidth - 440;
    const defaultY = Math.floor(screenHeight / 2) - 300;

    const savedX = store.get('windowX', defaultX);
    const savedY = store.get('windowY', defaultY);

    mainWindow = new BrowserWindow({
      width: 420,
      height: 600,
      x: savedX,
      y: savedY,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      movable: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        devTools: !app.isPackaged,
      },
    });

    try {
      mainWindow.setContentProtection(true);
      contentProtected = true;
    } catch {
      contentProtected = false;
    }

    if (process.platform === 'win32') {
      mainWindow.once('show', () => {
        try {
          mainWindow?.setContentProtection(true);
          contentProtected = true;
        } catch {
          contentProtected = false;
        }
      });
    }

    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    mainWindow.on('moved', () => {
      if (!mainWindow) return;
      const [x, y] = mainWindow.getPosition();
      store.set('windowX', x);
      store.set('windowY', y);
    });

    if (!app.isPackaged) {
      void mainWindow.loadURL('http://localhost:5173');
    } else {
      void mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
      splashWindow?.destroy();
      splashWindow = null;
      mainWindow?.show();
    });

    mainWindow.on('close', () => {
      isQuitting = true;
      app.quit();
    });
  }

  function createTray(): void {
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show ZoomGuru',
        click: () => { mainWindow?.show(); },
      },
      {
        label: 'Hide ZoomGuru',
        click: () => { mainWindow?.hide(); },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
      }
    });
  }

  function tryRegister(
    primary: string,
    fallback: string,
    handler: () => void,
    label: string,
  ): void {
    if (globalShortcut.register(primary, handler)) {
      console.log(`✅ ${label}: ${primary}`);
      return;
    }
    console.warn(`⚠  ${primary} taken by another app — trying fallback ${fallback}`);
    if (globalShortcut.register(fallback, handler)) {
      console.log(`✅ ${label}: ${fallback} (fallback)`);
    } else {
      console.error(`❌ ${label}: both ${primary} and ${fallback} blocked — close the conflicting app`);
    }
  }

  function registerHotkeys(): void {
    tryRegister(
      'CommandOrControl+Shift+L', 'CommandOrControl+Alt+L',
      () => mainWindow?.webContents.send('trigger:listen'),
      'Listen',
    );
    tryRegister(
      'CommandOrControl+Shift+S', 'CommandOrControl+Alt+S',
      () => mainWindow?.webContents.send('trigger:screenshot'),
      'Screenshot',
    );
    tryRegister(
      'CommandOrControl+Shift+H', 'CommandOrControl+Alt+H',
      () => {
        if (mainWindow?.isVisible()) mainWindow.hide();
        else mainWindow?.show();
      },
      'Hide/show',
    );
    tryRegister(
      'CommandOrControl+Shift+C', 'CommandOrControl+Alt+C',
      () => mainWindow?.webContents.send('trigger:clear'),
      'Clear',
    );
    tryRegister(
      'CommandOrControl+Shift+D', 'CommandOrControl+Alt+D',
      () => mainWindow?.webContents.send('trigger:auto'),
      'Auto',
    );
  }

  function registerIpcHandlers(): void {
    ipcMain.handle('window:hide', () => {
      mainWindow?.hide();
    });

    ipcMain.handle('window:quit', () => {
      isQuitting = true;
      app.quit();
    });

    ipcMain.handle('device:getPublicKey', () => {
      return getPublicKeyInfo();
    });

    ipcMain.handle('device:sign', () => {
      return signRequest();
    });

    ipcMain.handle('permissions:request-mic', async () => {
      if (process.platform === 'darwin') {
        return await systemPreferences.askForMediaAccess('microphone');
      }
      return true;
    });

    ipcMain.handle('cv:parse', async () => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: 'Select your CV',
        properties: ['openFile'],
        filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'md'] }],
      });

      if (result.canceled || !result.filePaths[0]) return null;

      const filePath = result.filePaths[0];
      const filename = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();

      try {
        let text: string;
        if (ext === '.pdf') {
          const buffer = fs.readFileSync(filePath);
          const parsed = await pdfParse(buffer);
          text = parsed.text;
        } else {
          text = fs.readFileSync(filePath, 'utf-8');
        }

        store.set('cvText', text);
        store.set('cvFilename', filename);
        return { text, filename };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { error: `Failed to parse file: ${message}` };
      }
    });

    ipcMain.handle('cv:load', () => {
      const text = store.get('cvText', '');
      const filename = store.get('cvFilename', '');
      if (!text) return null;
      return { text, filename };
    });

    ipcMain.handle('cv:clear', () => {
      store.delete('cvText');
      store.delete('cvFilename');
    });

    ipcMain.handle('capture:audio-source-id', async () => {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
      return sources[0]?.id ?? '';
    });

    ipcMain.handle('jd:save', (_event, text: string) => {
      if (typeof text !== 'string' || text.length > 100_000) return;
      store.set('jdText', text);
    });

    ipcMain.handle('jd:load', () => {
      const text = store.get('jdText', '');
      return text || null;
    });

    ipcMain.handle('jd:clear', () => {
      store.delete('jdText');
    });

    ipcMain.handle('open-external', (_event, url: string) => {
      if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return;
      const BLOCKED = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/i;
      if (BLOCKED.test(url)) return;
      void shell.openExternal(url);
    });

    ipcMain.handle('token:set', (_event, token: string) => {
      if (typeof token === 'string') store.set('accessToken', token);
    });

    ipcMain.handle('token:get', () => store.get('accessToken', ''));

    ipcMain.handle('token:clear', () => store.delete('accessToken'));

    ipcMain.handle('protection:status', () => contentProtected);

    ipcMain.handle('session:setActive', (_event, active: boolean) => {
      isSessionActive = typeof active === 'boolean' ? active : false;
    });

    ipcMain.handle('settings:getNoiseSuppressor', () => {
      return store.get('noiseSuppressor', true);
    });

    ipcMain.handle('settings:setNoiseSuppressor', (_event, enabled: boolean) => {
      if (typeof enabled === 'boolean') store.set('noiseSuppressor', enabled);
    });

    ipcMain.handle('tour:hasCompleted', () => {
      return store.get('tourCompleted', false);
    });

    ipcMain.handle('tour:setCompleted', () => {
      store.set('tourCompleted', true);
    });

    ipcMain.handle('report:print', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.webContents.print();
    });
  }

  app.once('ready', () => { createSplash(); });

  void app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler(
      (_webContents, permission, callback) => {
        const allowed = ['media', 'mediaKeySystem', 'display-capture'];
        callback(allowed.includes(permission));
      },
    );

    session.defaultSession.setPermissionCheckHandler(
      (_webContents, permission) => {
        const allowed = ['media', 'mediaKeySystem', 'display-capture'];
        return allowed.includes(permission);
      },
    );

    const devOrigins = app.isPackaged
      ? ''
      : 'http://localhost:5173 http://localhost:5174';
    const vendorOrigins = app.isPackaged
      ? ''
      : 'https://api.deepseek.com https://*.huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co';

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const connectSrc = [
        "'self'",
        'https://zoomguru.onrender.com',
        'https://api.groq.com',
        'https://*.paystack.co',
        'https://*.paystack.com',
        'https://huggingface.co',
        devOrigins,
        vendorOrigins,
      ].filter(Boolean).join(' ');

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://js.paystack.co",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src ${connectSrc}`,
              "img-src 'self' data: blob: https://*.paystack.co https://*.paystack.com",
              "media-src 'self' blob:",
              "frame-src https://checkout.paystack.com",
            ].join('; '),
          ],
        },
      });
    });

    initDeviceKey();
    createWindow();
    createTray();
    registerHotkeys();
    registerIpcHandlers();
    initCapture(mainWindow!);
    if (app.isPackaged) scheduleUpdateChecks();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
