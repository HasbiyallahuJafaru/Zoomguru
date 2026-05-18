# PATCH-11 — System Tray Icon

## Problem
User closes overlay — app disappears completely.
No way to reopen without relaunching from Applications folder.
Paid users lose access mid-session if they accidentally close.

## Files Affected
- `apps/electron/electron/main.ts`
- `apps/electron/assets/tray-icon.png` (you must provide 16x16 or 22x22 PNG)

## Risk Level
🟡 MEDIUM — Modifies main process. Test on both Mac and Windows.

---

## Claude Code Prompt

```
Read .claude/ELECTRON.md first.

In apps/electron/electron/main.ts, I need to add a system
tray icon. Make these changes surgically:

STEP 1: Add Tray and Menu to the existing electron import.
Find the line: import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron';
Add Tray and Menu to that import:
import { app, BrowserWindow, globalShortcut, ipcMain, shell, Tray, Menu } from 'electron';

STEP 2: Add a tray variable at module level, AFTER the
existing mainWindow variable declaration:
let tray: Tray | null = null;

STEP 3: Add a createTray() function AFTER the createWindow()
function (do not put it inside createWindow):

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

STEP 4: In the existing app.whenReady() block, add
createTray() call AFTER createWindow():
  createTray();

STEP 5: Find the window close event. If there is a
mainWindow.on('close') handler, modify it to hide instead of close.
If there is none, add this INSIDE createWindow() after the
window is created:

  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow?.hide();
  });

STEP 6: To allow actual quit (from tray menu), ensure
app.quit() in the tray menu bypasses the close prevention.
Add a flag at module level:
  let isQuitting = false;

In the tray Quit click handler, set it first:
  isQuitting = true;
  app.quit();

In the window close handler, check it:
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

Do not change createWindow(), hotkeys, or any other logic.
Show me every line changed with its exact location.
```

---

## Asset Required
```
Create or export a 22x22 PNG icon and save it to:
apps/electron/assets/tray-icon.png

For macOS, a Template image (black on transparent) works best.
For Windows, use a colored 16x16 or 32x32 ICO or PNG.
```

## Verification

```bash
npm run dev

# Verify:
# 1. Tray icon appears in menu bar (Mac) or system tray (Win)
# 2. Clicking X on overlay hides it (does not quit)
# 3. Clicking tray icon shows/hides overlay
# 4. Right-click tray → Quit actually closes app
```

## Rollback
Remove Tray, Menu from imports.
Remove tray variable.
Remove createTray() function.
Remove createTray() call from app.whenReady().
Remove isQuitting flag.
Restore close handler to default behavior.
