# ZoomGuru â€” Deployment Patches Index

## How To Use These Files

Each patch file contains:
1. **What it fixes** â€” the problem being solved
2. **Files affected** â€” exactly which files to touch
3. **Claude Code prompt** â€” paste this verbatim into Claude Code
4. **Verification** â€” how to confirm it worked

Apply patches in ORDER. Each is self-contained and surgical.
Never apply two patches simultaneously â€” do one, verify, then next.

---

## Patch Order

### SECURITY (Do First)
```
PATCH-01-devtools-lock.md         Disable DevTools in production
PATCH-02-asar-obfuscation.md      Obfuscate Electron binary
PATCH-03-request-timeout.md       Timeout all AI API calls
PATCH-04-cv-sanitization.md       Sanitize CV text before storage
PATCH-05-webhook-replay.md        Block Paystack webhook replays
PATCH-06-env-validation.md        Validate all env vars on startup
```

### INFRASTRUCTURE
```
PATCH-07-health-endpoint.md       Add /health endpoint to NestJS
PATCH-08-db-retry.md              DB connection retry logic
PATCH-09-connection-pooling.md    Neon connection pooling for 500 users
PATCH-10-sse-manager.md           SSE connection manager
PATCH-11-request-timeout-abort.md AbortController on all fetch calls
```

### FREE TRIAL LOCK
```
PATCH-12-device-lock-registration.md  Block multiple accounts per device
```

### USER EXPERIENCE
```
PATCH-13-system-tray.md           System tray icon + menu
PATCH-14-overlay-position.md      Remember overlay position
PATCH-15-copy-button.md           Copy answer button in overlay
PATCH-16-mic-permission.md        Mic permission error handling
PATCH-17-network-status.md        Online/offline indicator in overlay
PATCH-18-opacity-control.md       Opacity slider in settings
PATCH-19-onboarding.md            4-step first-launch onboarding
```

### STATE MANAGEMENT
```
PATCH-20-zustand.md               Add Zustand store (auth + session + ui)
```

### SESSION OPTIMIZATION
```
PATCH-21-session-summary.md       Save summary only, not full messages
```

### AUTO-UPDATER
```
PATCH-22-auto-updater.md          electron-updater setup
```

### MONITORING
```
PATCH-23-uptime-monitor.md        Health endpoint + UptimeRobot setup
PATCH-24-error-logging.md         Error log table + global handler
PATCH-25-admin-stats.md           Admin stats endpoint
```

### REFERRAL SYSTEM
```
PATCH-26-referral-db.md           Referral tables in Neon
PATCH-27-referral-backend.md      Referral endpoints + commission logic
PATCH-28-referral-ui.md           Referral dashboard in Electron
PATCH-29-referral-landing.md      Referral code capture on landing page
```

### GOOGLE ANALYTICS
```
PATCH-30-analytics-landing.md     GA4 on landing page + key events
```

---

## Ground Rules For Claude Code Sessions

Before starting any patch session, paste this at the top:

```
Read .claude/CLAUDE.md first.
We are applying surgical patches to the ZoomGuru codebase.
Do NOT refactor anything outside the scope of this patch.
Do NOT change variable names, file structure, or imports
unless the patch explicitly requires it.
Make the smallest possible change that fixes the problem.
After each change, tell me exactly what you changed and why.
```

