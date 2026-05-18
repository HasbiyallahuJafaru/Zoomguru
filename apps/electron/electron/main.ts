import { app, BrowserWindow, globalShortcut, ipcMain, shell, Tray, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import Store from 'electron-store';
import { initCapture } from './capture';
import { initSpeech } from './speech';
import { getDeviceFingerprint } from './fingerprint';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Encrypted local store — key derived from device fingerprint
const fingerprint = getDeviceFingerprint();
const store = new Store({
  encryptionKey: 'zoomguru-local-key-' + fingerprint.slice(0, 16),
});

function applyScreenShareExclusion(win: BrowserWindow) {
  if (process.platform === 'darwin') {
    // macOS — Electron built-in. Applies to ALL capture: Zoom, Meet, OBS, QuickTime,
    // and browser getDisplayMedia(). Window renders on user display, black in any capture.
    win.setContentProtection(true);

  } else if (process.platform === 'win32') {
    // Windows — SetWindowDisplayAffinity(HWND, WDA_EXCLUDEFROMCAPTURE = 0x11)
    // This is an OS API call — operates below the application layer.
    // Excluded from: Zoom, Teams, Meet, OBS, Chrome getDisplayMedia(), DxGi capture,
    // BitBlt, PrintWindow, and every screen recording method on Windows 10 2004+.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { setWindowDisplayAffinity } = require('electron-wda');
      // Must be called BEFORE the window is shown for reliable exclusion.
      // electron-wda wraps the native Win32 call using the window's HWND.
      setWindowDisplayAffinity(win, 'WDA_EXCLUDEFROMCAPTURE');
    } catch (e) {
      console.warn('[ZoomGuru] electron-wda unavailable — screen share protection inactive:', e);
    }
  }
}

function createWindow() {
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

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
    // Start hidden — we apply screen exclusion BEFORE first show
    // so the window is never briefly visible in screen capture.
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  // Block DevTools in production
  if (process.env.NODE_ENV !== 'development') {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Block F12
      if (input.key === 'F12') event.preventDefault();
      // Block Ctrl+Shift+I / Cmd+Option+I
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault();
      }
      // Block Ctrl+Shift+J / Cmd+Option+J
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'j') {
        event.preventDefault();
      }
    });

    // Disable right-click context menu
    mainWindow.webContents.on('context-menu', (e) => {
      e.preventDefault();
    });
  }

  // ─── APPLY SCREEN SHARE EXCLUSION BEFORE SHOWING ────────────────────────
  // Called here (not in ready-to-show) so exclusion is active before render.
  applyScreenShareExclusion(mainWindow);

  // ─── ALWAYS ON TOP — above all screen share capture UIs ──────────────────
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // ─── POSITION: restore saved or default to right side of screen ─────────
  const savedPos = store.get('overlayPosition') as { x: number; y: number } | undefined;

  if (savedPos &&
      savedPos.x >= 0 && savedPos.x < width - 100 &&
      savedPos.y >= 0 && savedPos.y < height - 100) {
    mainWindow.setPosition(savedPos.x, savedPos.y);
  } else {
    mainWindow.setPosition(width - 440, Math.floor(height / 2) - 300);
  }

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow!.getPosition();
    store.set('overlayPosition', { x, y });
  });

  // ─── LOAD APP ────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // ─── SHOW AFTER RENDER (exclusion already applied above) ─────────────────
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // ─── INTERCEPT CLOSE — hide to tray instead of quitting ──────────────────
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

// ─── SYSTEM TRAY ───────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show ZoomGuru',
      click: () => mainWindow?.show(),
    },
    {
      label: 'Hide ZoomGuru',
      click: () => mainWindow?.hide(),
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

  tray.setToolTip('ZoomGuru — Interview Copilot');
  tray.setContextMenu(contextMenu);

  // Single click toggles overlay
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}

// ─── AUTO UPDATER ──────────────────────────────────────────────────────────

function setupAutoUpdater() {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-downloaded', () => {
    if (!mainWindow) return;

    mainWindow.webContents.send('update:ready');

    const { dialog } = require('electron');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of ZoomGuru has been downloaded.',
      detail: 'Restart the app to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }: { response: number }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('Auto-updater error:', err.message);
  });
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
  createTray();
  setupAutoUpdater();
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
