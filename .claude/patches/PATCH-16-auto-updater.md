# PATCH-16 â€” Auto-Updater (electron-updater)

## Problem
No way to push bug fixes to existing users.
They're stuck on whatever version they installed forever.

## Files Affected
- `apps/electron/electron/main.ts`
- `apps/electron/electron-builder.config.js`
- `apps/electron/package.json`

## Risk Level
ðŸŸ¡ MEDIUM â€” Main process addition. Does not affect renderer.

---

## Claude Code Prompt

```
Read .claude/ELECTRON.md first.

STEP 1: Install electron-updater
cd apps/electron && npm install electron-updater

STEP 2: In apps/electron/electron/main.ts,
add this import at the top:
import { autoUpdater } from 'electron-updater';

Add this function AFTER the createTray() function
(or after createWindow() if tray not yet added):

function setupAutoUpdater() {
  // Check for updates silently on launch
  autoUpdater.checkForUpdatesAndNotify();

  // Update downloaded â€” prompt user to restart
  autoUpdater.on('update-downloaded', () => {
    if (!mainWindow) return;
    
    mainWindow.webContents.send('update:ready');
    
    // Also show native dialog as backup
    const { dialog } = require('electron');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of ZoomGuru has been downloaded.',
      detail: 'Restart the app to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    // Silent fail â€” don't interrupt interview with update errors
    console.error('Auto-updater error:', err.message);
  });
}

STEP 3: In app.whenReady(), add setupAutoUpdater()
AFTER createWindow() and createTray():
  setupAutoUpdater();

STEP 4: In apps/electron/electron-builder.config.js,
add the publish configuration at the top level of the config:
  publish: [
    {
      provider: 'github',
      owner: 'YOUR_GITHUB_USERNAME',
      repo: 'zoomguru',
      private: false,
    }
  ],

Replace YOUR_GITHUB_USERNAME with the actual GitHub username.

STEP 5: In apps/electron/package.json, ensure this
exists at the top level:
  "build": {
    "publish": {
      "provider": "github"
    }
  }

If a "build" key already exists, add "publish" inside it.
If it does not exist, add the whole block.

Show me all changed files.
```

---

## GitHub Release Setup

```bash
# Set GitHub token for publishing releases
export GH_TOKEN=your_github_personal_access_token

# Build and publish a new release
cd apps/electron
npm run dist:mac    # builds and uploads to GitHub Releases
npm run dist:win

# Add to package.json scripts:
"release:mac": "electron-builder --mac --publish always",
"release:win": "electron-builder --win --publish always",
```

## How It Works After Setup
```
You push new code â†’ build release â†’ upload to GitHub Releases
         â†“
Existing users launch app
         â†“
autoUpdater checks GitHub for latest.yml
         â†“
New version found â†’ downloads in background
         â†“
Dialog: "Restart Now" or "Later"
         â†“
User restarts â†’ new version installed
```

## Overlay Update Notification (Optional)
```tsx
// In Overlay.tsx, listen for update ready signal
useEffect(() => {
  window.zoomguru.onTrigger('update:ready', () => {
    // Show subtle banner in overlay
    setUpdateReady(true);
  });
}, []);

// In preload.ts, expose the IPC listener
// (already handled by existing onTrigger bridge)
```

## Verification

```bash
# 1. Build and publish v1.0.0 to GitHub Releases
# 2. Change version in package.json to 1.0.1
# 3. Build and publish v1.0.1
# 4. Run v1.0.0 app
# 5. Should detect update and show dialog within 30 seconds
```

## Rollback
Remove import and setupAutoUpdater() from main.ts.
Remove publish config from electron-builder.config.js.
Uninstall: npm uninstall electron-updater

