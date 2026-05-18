# PATCH-12 — Remember Overlay Position

## Problem
User carefully positions overlay on screen.
Restarts app — overlay resets to default position.
Annoying for paid users who use app daily.

## Files Affected
- `apps/electron/electron/main.ts`

## Risk Level
🟢 LOW — Additive only. Uses existing electron-store.

---

## Claude Code Prompt

```
Read .claude/ELECTRON.md first.

In apps/electron/electron/main.ts, I need to save and
restore the overlay window position using electron-store.

STEP 1: Add electron-store import at the top of main.ts
if it's not already imported:
import Store from 'electron-store';
const store = new Store();

STEP 2: Inside createWindow(), find where the window
position is set after creation. It currently looks like:
  const { width, height } = display.workAreaSize;
  mainWindow.setPosition(width - 440, Math.floor(height / 2) - 300);

Replace those two lines with this block:

  const { width, height } = display.workAreaSize;
  const savedPos = store.get('overlayPosition') as { x: number; y: number } | undefined;
  
  if (savedPos && 
      savedPos.x >= 0 && savedPos.x < width - 100 &&
      savedPos.y >= 0 && savedPos.y < height - 100) {
    mainWindow.setPosition(savedPos.x, savedPos.y);
  } else {
    // Default position — right side of screen
    mainWindow.setPosition(width - 440, Math.floor(height / 2) - 300);
  }

STEP 3: After STEP 2, register a move event listener
to save position whenever the window is moved.
Add this IMMEDIATELY after the setPosition block:

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow!.getPosition();
    store.set('overlayPosition', { x, y });
  });

Do not change anything else in createWindow().
Do not touch the BrowserWindow options.
Show me the exact before/after of the changed lines.
```

---

## Verification

```bash
npm run dev

# 1. Drag overlay to top-left corner
# 2. Quit app from tray
# 3. Relaunch app
# 4. Overlay should appear in top-left corner
# 5. Position should persist across restarts
```

## Rollback
Restore original setPosition() call.
Remove the moved event listener.
Remove Store import if it was newly added.
