# PATCH-02 — ASAR Packaging + Binary Obfuscation

## Problem
Electron apps ship as unpacked files by default.
Anyone can unpack the app folder and read your source code,
API URLs, and logic.

## Files Affected
- `apps/electron/electron-builder.config.js`

## Risk Level
🟢 LOW — Config change only. No code changes.

---

## Claude Code Prompt

```
Read .claude/ELECTRON.md first.

In apps/electron/electron-builder.config.js, make these
two additions ONLY — do not change anything else:

1. Add asar: true at the top level of the config object
   (same level as appId, productName, etc.)

2. Add asarUnpack: ["**/node_modules/**/*.node"]
   immediately after asar: true

The result should look like:
  asar: true,
  asarUnpack: ["**/node_modules/**/*.node"],

These two lines enable ASAR packaging which bundles
all source files into a binary archive.

Do not touch mac, win, nsis, or any other sections.
Show me the exact diff.
```

---

## Verification

```bash
cd apps/electron
npm run dist:mac   # or dist:win

# After build, check release/ folder
# You should see .asar files instead of loose JS files
# Try to open the .app bundle — source should not be readable
```

## Rollback
Remove `asar: true` and `asarUnpack` lines.
