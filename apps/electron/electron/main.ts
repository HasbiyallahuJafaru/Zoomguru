import { app, BrowserWindow, globalShortcut, ipcMain, shell, Tray, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';

// ─── CUSTOM PROTOCOL — must run before app is ready ───────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(
      'zoomguru', process.execPath, [path.resolve(process.argv[1])]
    );
  }
} else {
  app.setAsDefaultProtocolClient('zoomguru');
}
import Store from 'electron-store';
import { initCapture } from './capture';
import { initSpeech } from './speech';
import { getDeviceFingerprint } from './fingerprint';

// ─── NATIVE WGC-EXCLUDE ADDON ─────────────────────────────────────────────
// The addon is Windows-only; index.js provides a no-op fallback on macOS.
const wgcExclude = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('wgc-exclude') as {
      excludeFromCapture: (hwnd: Buffer) => {
        success: boolean;
        method: string | null;
        error?: string;
      };
      getWindowsVersion: () => { major: number; minor: number; build: number };
    };
  } catch {
    return {
      excludeFromCapture: () => ({ success: false, error: 'addon unavailable', method: null }),
      getWindowsVersion: () => ({ major: 0, minor: 0, build: 0 }),
    };
  }
})();

// Log Windows version info once at startup so we know which protection tier is active.
if (process.platform === 'win32') {
  const ver = wgcExclude.getWindowsVersion();
  const supportsExclude = ver.build >= 19041;  // Win10 2004+
  const supportsWgcExclude = ver.build >= 22621; // Win11 22H2+
  console.log(
    `[ZoomGuru] Windows ${ver.major}.${ver.minor} build ${ver.build} — ` +
    `WDA_EXCLUDEFROMCAPTURE: ${supportsExclude ? 'YES' : 'NO'} — ` +
    `Full WGC exclusion (build>=22621): ${supportsWgcExclude ? 'YES' : 'NO'}`
  );
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Encrypted local store — key derived from device fingerprint
const fingerprint = getDeviceFingerprint();
const store = new Store({
  encryptionKey: 'zoomguru-local-key-' + fingerprint.slice(0, 16),
});

// ─── applyWindowsNativeExclusion ────────────────────────────────────────────
// Calls the native addon to apply SetWindowDisplayAffinity on the HWND.
// Returns the method used ('WDA_EXCLUDEFROMCAPTURE', 'WDA_MONITOR', or null).
// Safe to call repeatedly — DWM ignores redundant identical affinity calls.
function applyWindowsNativeExclusion(win: BrowserWindow): string | null {
  try {
    const hwnd = win.getNativeWindowHandle(); // returns Buffer
    const result = wgcExclude.excludeFromCapture(hwnd);
    if (result.success) {
      console.log(`[ZoomGuru] Screen capture exclusion applied via ${result.method}`);
    } else {
      console.warn(`[ZoomGuru] Native exclusion failed: ${result.error ?? 'unknown error'}`);
    }
    return result.method ?? null;
  } catch (err) {
    console.error('[ZoomGuru] applyWindowsNativeExclusion threw:', err);
    return null;
  }
}

function applyScreenShareExclusion(win: BrowserWindow) {
  if (process.platform === 'darwin') {
    // macOS: setContentProtection maps to NSWindow.sharingType = .none
    // This prevents the window from appearing in screen sharing since macOS 10.13.
    win.setContentProtection(true);
    // Re-apply on every show in case macOS resets it after hide/show cycles.
    win.on('show', () => {
      win.setContentProtection(true);
    });
  } else if (process.platform === 'win32') {
    // Windows: two-layer approach for maximum compatibility across Win10/11 variants.
    //
    // Layer 1 — Native addon (SetWindowDisplayAffinity):
    //   WDA_EXCLUDEFROMCAPTURE (build >= 19041): excludes from DXGI + WGC + PrintWindow
    //   WDA_MONITOR            (build <  19041): excludes from DXGI screen mirroring only
    //
    // Layer 2 — Electron setContentProtection:
    //   Sets WDA_EXCLUDEFROMCAPTURE internally via Chromium's own call.
    //   Belt-and-suspenders: whichever call DWM processes last wins, and both
    //   set the same affinity on supported builds.
    //
    // We apply both pre-show AND on every 'show' event because hide/show cycles
    // can reset display affinity on some Windows builds / GPU driver combos.

    applyWindowsNativeExclusion(win);
    win.setContentProtection(true);

    win.on('show', () => {
      applyWindowsNativeExclusion(win);
      win.setContentProtection(true);
    });
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
    transparent: process.platform === 'darwin',
    backgroundColor: process.platform === 'win32'
      ? '#00000001'
      : '#00000000',
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

  // ─── SCREEN SHARE EXCLUSION — permanent, cannot be disabled ─────────────
  applyScreenShareExclusion(mainWindow);
  // Block any renderer-side attempt to disable content protection via IPC
  mainWindow.webContents.on('ipc-message', (_event, channel) => {
    if (channel === 'disable-protection') mainWindow?.setContentProtection(true);
  });

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

  // ─── SHOW AFTER RENDER ───────────────────────────────────────────────────
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    // On Windows, re-apply after the first paint so DWM registers the affinity
    // while the window is in its final visible state.
    if (process.platform === 'win32' && mainWindow) {
      setTimeout(() => {
        if (!mainWindow) return;
        applyWindowsNativeExclusion(mainWindow);
        mainWindow.setContentProtection(true);
      }, 200);
    }
    setTimeout(() => {
      runProtectionSelfTest();
    }, 1500);
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

// ─── PROTECTION SELF-TEST ─────────────────────────────────────────────────

async function runProtectionSelfTest(): Promise<void> {
  if (!mainWindow) return;

  // Wait for window to render and protection to apply
  await new Promise(r => setTimeout(r, 1500));

  try {
    const { desktopCapturer, screen } = require('electron');

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 400, height: 225 },
    });

    if (!sources || sources.length === 0) {
      mainWindow.webContents.send('protection:status', {
        protected: true,
        reason: 'capture_unavailable',
        platform: process.platform,
      });
      return;
    }

    const [winX, winY] = mainWindow.getPosition();
    const [winW, winH] = mainWindow.getSize();

    const scaleX = 400 / width;
    const scaleY = 225 / height;
    const centerX = Math.floor((winX + winW / 2) * scaleX);
    const centerY = Math.floor((winY + winH / 2) * scaleY);

    const clampedX = Math.max(0, Math.min(399, centerX));
    const clampedY = Math.max(0, Math.min(224, centerY)); // fix: was clampedY (self-ref)

    const bitmap = sources[0].thumbnail.getBitmap();

    const idx = (clampedY * 400 + clampedX) * 4;
    const r = bitmap[idx]     ?? 0;
    const g = bitmap[idx + 1] ?? 0;
    const b = bitmap[idx + 2] ?? 0;

    const isOurUIColor = (r >= 5 && r <= 25) && (g >= 5 && g <= 25) && (b >= 10 && b <= 30);
    const isBlack = r === 0 && g === 0 && b === 0;
    const isProtected = isBlack || !isOurUIColor;

    mainWindow.webContents.send('protection:status', {
      protected: isProtected,
      reason: isBlack ? 'wda_black' : isProtected ? 'color_mismatch' : 'exposed',
      platform: process.platform,
      debug: { r, g, b, centerX: clampedX, centerY: clampedY },
    });

    if (!isProtected) {
      console.warn(
        `⚠️ ZoomGuru overlay may be visible to screen capture. ` +
        `Pixel at (${clampedX},${clampedY}): rgb(${r},${g},${b})`
      );
    } else {
      console.log(
        `✅ Screen protection active [${process.platform}]. ` +
        `Capture pixel: rgb(${r},${g},${b})`
      );
    }

  } catch (err) {
    console.error('Protection self-test error:', err);
    mainWindow.webContents.send('protection:status', {
      protected: true,
      reason: 'test_error',
      platform: process.platform,
    });
  }
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

  ipcMain.handle('window:hide', () => {
    mainWindow?.hide();
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

// ─── DEEP LINK HANDLER ────────────────────────────────────────────────────

function handleDeepLink(url: string): void {
  if (!url.startsWith('zoomguru://auth')) return;

  const urlObj = new URL(url);
  const token = urlObj.searchParams.get('token');

  if (!token || !mainWindow) return;

  mainWindow.webContents.send('auth:google-callback', { token });
  mainWindow.show();
  mainWindow.focus();
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

  // Handle deep link for Google OAuth on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // Handle deep link on Windows (passed as argv)
  if (process.platform === 'win32') {
    const deepLinkUrl = process.argv.find(arg => arg.startsWith('zoomguru://'));
    if (deepLinkUrl) handleDeepLink(deepLinkUrl);
  }

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
