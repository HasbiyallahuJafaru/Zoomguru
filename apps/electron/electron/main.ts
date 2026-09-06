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
import Store from 'electron-store';
import { initCapture } from './capture';
import { initDeviceKey, getPublicKeyInfo, signRequest } from './deviceKey';
import { extractDocumentText } from './documents';

interface WindowStore {
  windowX: number;
  windowY: number;
  windowWidth: number;
  windowHeight: number;
  cvText?: string;
  cvFilename?: string;
  jdText?: string;
  meetingDocText?: string;
  meetingDocFilename?: string;
  accessToken?: string;
  noiseSuppressor?: boolean;
  darkMode?: boolean;
  tourCompleted?: boolean;
}

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isSessionActive = false;
const store = new Store<WindowStore>();

// The main process cannot import from src/, so the API base is its own literal
// here (see .claude/CLAUDE.md). Used by the sign-out-on-quit hook and the CSP.
const API_BASE = process.env['VITE_API_URL'] ?? 'https://zoomguru-backend-production.up.railway.app';

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
    const savedWidth = store.get('windowWidth', 420);
    const savedHeight = store.get('windowHeight', 600);

    mainWindow = new BrowserWindow({
      width: savedWidth,
      height: savedHeight,
      x: savedX,
      y: savedY,
      minWidth: 320,
      minHeight: 320,
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

    // Paystack opens auth/OTP/3-D-Secure popups via window.open. Without this
    // handler they get trapped behind the always-on-top overlay (so the modal's
    // buttons appear dead). Allow Paystack popups as real focusable windows
    // above the overlay; route any other link to the system browser.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/paystack\.(co|com)/i.test(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: { alwaysOnTop: true, autoHideMenuBar: true },
        };
      }
      void shell.openExternal(url);
      return { action: 'deny' };
    });

    mainWindow.on('moved', () => {
      if (!mainWindow) return;
      const [x, y] = mainWindow.getPosition();
      store.set('windowX', x);
      store.set('windowY', y);
    });

    mainWindow.on('resized', () => {
      if (!mainWindow) return;
      const [width, height] = mainWindow.getSize();
      store.set('windowWidth', width);
      store.set('windowHeight', height);
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

    ipcMain.handle('window:getBounds', () => {
      return mainWindow?.getBounds() ?? { x: 0, y: 0, width: 420, height: 600 };
    });

    // Edge/corner resize: the frameless overlay has no native resize border on
    // Windows, so the renderer drives resizing by sending new bounds while the
    // user drags a handle. Clamp to the same minimum the window was created with.
    ipcMain.handle(
      'window:setBounds',
      (_event, bounds: { x: number; y: number; width: number; height: number }) => {
        if (!mainWindow) return;
        if (!bounds || typeof bounds.width !== 'number') return;
        mainWindow.setBounds({
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.max(320, Math.round(bounds.width)),
          height: Math.max(320, Math.round(bounds.height)),
        });
      },
    );

    // Embedded hosted checkout. The renderer hands us a zoomguru.xyz checkout URL
    // (minted by the backend); we open it in a child window that loads Paystack
    // from the registered domain. We watch for the /payment-success navigation to
    // know the payment completed, and treat a manual close as a cancellation.
    // A separate session partition keeps the overlay's CSP/permission rules off
    // this window so the page behaves like an ordinary browser tab.
    ipcMain.handle('payment:open', (_event, checkoutUrl: string) => {
      if (typeof checkoutUrl !== 'string' || !/^https:\/\/(www\.)?zoomguru\.xyz\//i.test(checkoutUrl)) {
        return { status: 'error' as const };
      }

      return new Promise<{ status: 'success' | 'cancelled' | 'error'; reference?: string }>((resolve) => {
        const payWin = new BrowserWindow({
          width: 480,
          height: 720,
          parent: mainWindow ?? undefined,
          modal: true,
          title: 'ZoomGuru — Secure Checkout',
          backgroundColor: '#0a0a0a',
          autoHideMenuBar: true,
          webPreferences: {
            partition: 'payment',
            contextIsolation: true,
            nodeIntegration: false,
          },
        });
        payWin.setAlwaysOnTop(true, 'screen-saver');

        let settled = false;
        const finish = (status: 'success' | 'cancelled' | 'error', reference?: string): void => {
          if (settled) return;
          settled = true;
          resolve({ status, reference });
          if (!payWin.isDestroyed()) payWin.close();
        };

        const checkUrl = (url: string): void => {
          if (!/\/payment-success(\.html)?/i.test(url)) return;
          // Carry the Paystack reference back so the renderer can run an
          // authenticated last-resort verify if status polling lags.
          let reference: string | undefined;
          try { reference = new URL(url).searchParams.get('reference') ?? undefined; } catch { /* keep undefined */ }
          finish('success', reference);
        };
        payWin.webContents.on('did-navigate', (_e, url) => checkUrl(url));
        payWin.webContents.on('did-navigate-in-page', (_e, url) => checkUrl(url));
        payWin.webContents.on('will-redirect', (_e, url) => checkUrl(url));

        // Paystack opens OTP / 3-D Secure popups via window.open — allow those as
        // real child windows; route anything else to the system browser.
        payWin.webContents.setWindowOpenHandler(({ url }) => {
          if (/paystack\.(co|com)/i.test(url)) {
            return { action: 'allow', overrideBrowserWindowOptions: { alwaysOnTop: true, autoHideMenuBar: true } };
          }
          void shell.openExternal(url);
          return { action: 'deny' };
        });

        payWin.on('closed', () => finish('cancelled'));
        void payWin.loadURL(checkoutUrl);
      });
    });

    ipcMain.handle('device:getPublicKey', () => {
      return getPublicKeyInfo();
    });

    ipcMain.handle('device:sign', (_event, userId: string) => {
      return signRequest(userId);
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
        // .doc is listed deliberately even though it cannot be parsed: leaving
        // it out hides the user's file from the picker with no explanation,
        // whereas selecting it now returns "save it as .docx" and tells them
        // exactly what to do.
        filters: [{ name: 'Documents', extensions: ['pdf', 'docx', 'doc', 'txt', 'md'] }],
      });

      if (result.canceled || !result.filePaths[0]) return null;

      const filePath = result.filePaths[0];
      const filename = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();

      try {
        const text = await extractDocumentText(filePath);
        store.set('cvText', text);
        store.set('cvFilename', filename);
        return { text, filename };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Could not read that file.' };
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

    ipcMain.handle('settings:getDarkMode', () => {
      return store.get('darkMode', false);
    });

    ipcMain.handle('settings:setDarkMode', (_event, enabled: boolean) => {
      if (typeof enabled === 'boolean') store.set('darkMode', enabled);
    });

    // Click-through: when ignore=true the overlay passes mouse events to the
    // app underneath; { forward: true } still delivers mousemove to the renderer
    // so it can re-enable interactivity when the cursor enters a control.
    ipcMain.handle('overlay:setMouseIgnore', (_event, ignore: boolean) => {
      if (!mainWindow) return;
      if (ignore) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      } else {
        mainWindow.setIgnoreMouseEvents(false);
      }
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

    ipcMain.handle('meeting-doc:parse', async () => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: 'Select your document or presentation',
        properties: ['openFile'],
        filters: [{ name: 'Documents', extensions: ['pdf', 'docx', 'doc', 'pptx', 'txt', 'md'] }],
      });

      if (result.canceled || !result.filePaths[0]) return null;

      const filePath = result.filePaths[0];
      const filename = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();

      try {
        const text = await extractDocumentText(filePath);
        store.set('meetingDocText', text);
        store.set('meetingDocFilename', filename);
        return { text, filename };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Could not read that file.' };
      }
    });

    ipcMain.handle('meeting-doc:load', () => {
      const text = store.get('meetingDocText', '');
      const filename = store.get('meetingDocFilename', '');
      if (!text) return null;
      return { text, filename };
    });

    ipcMain.handle('meeting-doc:clear', () => {
      store.delete('meetingDocText');
      store.delete('meetingDocFilename');
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
      : 'https://*.huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co';

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const connectSrc = [
        "'self'",
        API_BASE,
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
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Closing the app signs out, so the account's session slot is released now
  // rather than being held until the token expires hours later. Every way out —
  // the in-app × buttons, the tray Quit item, Alt+F4, the last window closing —
  // funnels through app.quit(), so this one hook catches them all.
  let quitSignOut: 'pending' | 'running' | 'done' = 'pending';

  app.on('before-quit', (event) => {
    if (quitSignOut === 'done') return;
    // Hold the quit open until the logout settles. A second quit arriving while
    // the request is still in flight has to be held too, or the app exits from
    // under it — the window's own close event fires one immediately after ours.
    event.preventDefault();
    if (quitSignOut === 'running') return;
    quitSignOut = 'running';

    void (async () => {
      const token = store.get('accessToken', '');
      if (token) {
        try {
          await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: '{}',
            // Never let a hanging request make the app unquittable.
            signal: AbortSignal.timeout(1500),
          });
        } catch {
          // Offline or backend down — best effort, same as the in-app Log out
          // button. The slot ages out with the token.
        }
        store.delete('accessToken');
      }
      quitSignOut = 'done';
      app.quit();
    })();
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
