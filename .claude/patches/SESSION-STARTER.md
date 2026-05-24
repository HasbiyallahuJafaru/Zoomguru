# ZoomGuru â€” Claude Code Session Starter

## Paste This at the Start of EVERY Claude Code Session

```
You are working on ZoomGuru â€” an AI-powered invisible interview
copilot. Read .claude/CLAUDE.md before doing anything else.

SURGICAL RULES (non-negotiable):
1. Read the relevant .claude/*.md file before touching any file
2. Make the SMALLEST possible change that achieves the goal
3. Never refactor, rename, or restructure anything outside patch scope
4. Never change imports unless the patch explicitly requires it
5. After every change, show me the EXACT diff â€” nothing else
6. If you are unsure about anything, ASK before writing code
7. One patch at a time â€” never combine multiple patches
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

## Quick Reference â€” Patch Risk Levels

```
ðŸŸ¢ LOW    = Safe to apply anytime. Pure addition, no existing logic changed.
ðŸŸ¡ MEDIUM = Test immediately after. Modifies existing logic.
ðŸ”´ HIGH   = Test end-to-end. Core data flow change.
```

## Patch Order Reminder

```
MUST DO BEFORE LAUNCH:
01 DevTools lock           ðŸŸ¢
02 ASAR obfuscation        ðŸŸ¢
03 Request timeouts        ðŸŸ¡
04 CV sanitization         ðŸŸ¢
05 Webhook replay          ðŸŸ¡
06 Env validation          ðŸŸ¢
07 Health endpoint         ðŸŸ¢
08 DB retry + pooling      ðŸŸ¡
09 SSE manager             ðŸŸ¡
10 Device lock register    ðŸŸ¡
11 System tray             ðŸŸ¡
12 Overlay position        ðŸŸ¢
13 UX improvements         ðŸŸ¡
14 Zustand stores          ðŸŸ¡
15 Session summary         ðŸ”´
16 Auto-updater            ðŸŸ¡
17 Error logging + admin   ðŸŸ¢
18 Referral system         ðŸŸ¡
19 Google Analytics        ðŸŸ¢
20 Onboarding              ðŸŸ¡
```

