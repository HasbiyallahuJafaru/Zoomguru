# ZoomGuru — Claude Code Session Starter

## Paste This at the Start of EVERY Claude Code Session

```
You are working on ZoomGuru — an AI-powered invisible interview
copilot. Read .claude/CLAUDE.md before doing anything else.

SURGICAL RULES (non-negotiable):
1. Read the relevant .claude/*.md file before touching any file
2. Make the SMALLEST possible change that achieves the goal
3. Never refactor, rename, or restructure anything outside patch scope
4. Never change imports unless the patch explicitly requires it
5. After every change, show me the EXACT diff — nothing else
6. If you are unsure about anything, ASK before writing code
7. One patch at a time — never combine multiple patches
8. Always run: what files will you touch? BEFORE writing any code

Before writing any code, tell me:
- Which files you will modify
- Which files you will create
- Which files you will NOT touch
```

---

## Patch Session Template

When starting a patch session, paste:

```
Read .claude/CLAUDE.md and .claude/patches/PATCH-[XX]-[name].md

We are applying PATCH-[XX]: [description]

Before you write anything:
1. Tell me which files you will touch
2. Tell me which files you will NOT touch
3. Confirm the risk level from the patch file
4. Then apply the change
```

---

## Quick Reference — Patch Risk Levels

```
🟢 LOW    = Safe to apply anytime. Pure addition, no existing logic changed.
🟡 MEDIUM = Test immediately after. Modifies existing logic.
🔴 HIGH   = Test end-to-end. Core data flow change.
```

## Patch Order Reminder

```
MUST DO BEFORE LAUNCH:
01 DevTools lock           🟢
02 ASAR obfuscation        🟢
03 Request timeouts        🟡
04 CV sanitization         🟢
05 Webhook replay          🟡
06 Env validation          🟢
07 Health endpoint         🟢
08 DB retry + pooling      🟡
09 SSE manager             🟡
10 Device lock register    🟡
11 System tray             🟡
12 Overlay position        🟢
13 UX improvements         🟡
14 Zustand stores          🟡
15 Session summary         🔴
16 Auto-updater            🟡
17 Error logging + admin   🟢
18 Referral system         🟡
19 Google Analytics        🟢
20 Onboarding              🟡
```
