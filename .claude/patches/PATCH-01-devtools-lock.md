# PATCH-01 â€” Disable DevTools in Production Electron Build

## Problem
DevTools are accessible in production via F12 or Ctrl+Shift+I.
Users can inspect network requests, steal JWT tokens, and see your API URL.

## Files Affected
- `apps/electron/electron/main.ts`

## Risk Level
ðŸŸ¢ LOW â€” Additive only. No existing logic changed.

---

## Claude Code Prompt

Paste this verbatim into Claude Code:

```
Read .claude/CLAUDE.md and .claude/ELECTRON.md first.

In apps/electron/electron/main.ts, find the createWindow() function.

After the line where mainWindow is created (new BrowserWindow(...)),
add the following block EXACTLY as written â€” do not modify any
surrounding code:

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

Do not touch any other code in this file.
Show me the diff of exactly what you changed.
```

---

## Verification

```bash
# Build production app
cd apps/electron && npm run build

# Run production build
# Try pressing F12, Ctrl+Shift+I
# Both should do nothing
# Right-click should produce no menu
```

## Rollback
Delete the added block. No other changes needed.

