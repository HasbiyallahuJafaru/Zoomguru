# ZoomGuru — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S MACHINE                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              ELECTRON APP (Protected Window)          │  │
│  │                                                       │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │ Transparent │  │  Whisper STT │  │  Porcupine  │ │  │
│  │  │   Overlay   │  │  (local mic) │  │  Wake Word  │ │  │
│  │  │     UI      │  │  transcribe  │  │  (local)    │ │  │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │  │
│  │         │                │                  │         │  │
│  │         └────────────────┴──────────────────┘         │  │
│  │                          │                             │  │
│  │                  Global Hotkeys                        │  │
│  │             Ctrl+Shift+A / S / H / R / C               │  │
│  │                          │                             │  │
│  │              desktopCapturer (screenshots)              │  │
│  └──────────────────────────┬──────────────────────────── ┘  │
│                             │ HTTPS + SSE                  │
│                             │ (certificate pinned)         │
└─────────────────────────────┼───────────────────────────── ┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND (Render)                           │
│                  NestJS + Fastify                           │
│                                                             │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │    Auth    │  │   License    │  │   Claude Proxy     │  │
│  │  /auth/*   │  │  /license/*  │  │   /ai/stream       │  │
│  │  JWT       │  │  Fingerprint │  │   /ai/screenshot   │  │
│  └────────────┘  └──────────────┘  └────────────────────┘  │
│                                                             │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Paystack  │  │   Session    │  │      CV Parser     │  │
│  │  /paystack │  │  /session/*  │  │   /cv/upload       │  │
│  │  webhook   │  │  management  │  │   /cv/parse        │  │
│  └────────────┘  └──────────────┘  └────────────────────┘  │
│                             │                               │
└─────────────────────────────┼───────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
    ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
    │     Neon     │  │  DeepSeek   │  │   Qwen VL    │
    │  PostgreSQL  │  │  V3 + R1    │  │  (vision)    │
    │  (all data)  │  │  (text AI)  │  │(screenshots) │
    └──────────────┘  └─────────────┘  └──────────────┘
```

---

## Data Flow — Listen Mode

```
1. User presses Ctrl+Shift+A
2. Electron activates mic → Whisper tiny model transcribes locally
3. Silence detected (2 seconds) → transcription complete
4. Electron sends to backend:
   POST /ai/stream
   {
     sessionId: "uuid",
     transcript: "Explain how you'd handle race conditions",
     trigger: "hotkey"
   }
5. Backend:
   a. Verify JWT + device fingerprint
   b. Check user is pro OR under free tier limit
   c. Load session from Neon (messages history + cv_profile)
   d. Detect question type → route to DeepSeek V3 or R1
   e. Inject CV profile into system prompt
   f. Call DeepSeek API with full context
   g. Stream SSE chunks back to Electron
6. Electron renders each chunk to overlay as it arrives
7. Full answer stored back to session.messages in Neon
```

---

## Data Flow — Screenshot Mode

```
1. User presses Ctrl+Shift+S
2. Electron calls desktopCapturer → captures full screen PNG
3. Screenshot compressed, base64 encoded
4. Electron sends to backend:
   POST /ai/screenshot
   {
     sessionId: "uuid",
     image: "base64...",
     voiceContext: "optional — if combined mode"
   }
5. Backend:
   a. Auth + license check
   b. Send image to Qwen VL → get text description + detected content
   c. If code detected → route to DeepSeek R1 with code context
   d. If math detected → route to DeepSeek R1 with reasoning mode
   e. If diagram/system → route to DeepSeek R1 with system design prompt
   f. Stream SSE response back to Electron
6. Overlay shows: problem summary + approach + solution
```

---

## Data Flow — Wake Word Mode

```
1. Porcupine runs locally always (tiny CPU footprint)
2. User says "Hey ZoomGuru"
3. Porcupine detects wake word → triggers mic activation
4. Whisper starts transcribing for 10 seconds max OR until silence
5. Same flow as Listen Mode from step 4 above
```

---

## Data Flow — Payment (In-App)

```
1. User clicks Upgrade in Electron app
2. Electron opens embedded Paystack modal (WebView)
3. User selects plan + pays
4. Paystack calls backend webhook: POST /paystack/webhook
5. Backend:
   a. Verify Paystack signature (HMAC SHA512)
   b. Extract user_id from metadata
   c. Update users.is_pro = true
   d. Insert license record with device_fingerprint
   e. Set expires_at (monthly) or NULL (lifetime)
6. Electron polls /license/verify every 5 seconds for 60s
7. License verified → overlay unlocks Pro features
```

---

## Data Flow — Payment (Landing Page)

```
1. User lands on zoomguru.com
2. Clicks pricing plan → Paystack inline opens
3. Pays → Paystack webhook hits backend (same as above)
4. Redirect to /download page
5. Download .exe or .dmg based on detected OS
6. User installs, logs in → license already active
```

---

## Device Fingerprinting

```typescript
// Electron collects these hardware identifiers
const fingerprint = {
  cpuModel: os.cpus()[0].model,
  cpuCount: os.cpus().length,
  platform: os.platform(),
  arch: os.arch(),
  hostname: os.hostname(),
  totalMemory: os.totalmem(),
  networkMAC: getFirstMACAddress()  // from os.networkInterfaces()
}

// SHA256 hashed before leaving device
const deviceId = sha256(JSON.stringify(fingerprint))
```

Sent in every request header: `X-Device-ID: sha256hash`

Backend checks: `licenses.device_fingerprint = $deviceId` on every request.

If fingerprint doesn't match — request rejected with 403.

---

## Screen Share Invisibility

### macOS
```javascript
// Electron built-in
win.setContentProtection(true)
// Window renders on user's display
// Appears black/absent in any screen capture
```

### Windows
```javascript
// Via electron-wda native addon
const { setWindowDisplayAffinity } = require('electron-wda')
setWindowDisplayAffinity(win, 'WDA_EXCLUDEFROMCAPTURE')
// Same effect — visible to user, invisible to capture
```

---

## Question Type Router

```
Input: transcript or screenshot content
         ↓
Keyword analysis (fast, no API call)
         ↓
┌─────────────────┬────────────────────┬──────────────────┐
│   BEHAVIORAL    │    TECHNICAL       │     CODING       │
│                 │                    │                  │
│ "tell me about" │ "what is"          │ "implement"      │
│ "describe a     │ "explain"          │ "write a"        │
│  time when"     │ "difference        │ "algorithm"      │
│ "how do you     │  between"          │ "complexity"     │
│  handle"        │ "define"           │ "optimize"       │
│ "weakness"      │ "how does X work"  │ "leetcode-style" │
│                 │                    │                  │
│ → DeepSeek V3   │ → DeepSeek V3      │ → DeepSeek R1    │
│ → STAR format   │ → Concise format   │ → Code + steps   │
└─────────────────┴────────────────────┴──────────────────┘
         ┌────────────────────┬────────────────────┐
         │   SYSTEM DESIGN    │       MATH         │
         │                    │                    │
         │ "design a system"  │ "calculate"        │
         │ "how would you     │ "probability"      │
         │  architect"        │ "prove"            │
         │ "scale this"       │ "how many"         │
         │ "design [app]"     │ "derive"           │
         │                    │                    │
         │ → DeepSeek R1      │ → DeepSeek R1      │
         │ → Structured       │ → Step by step     │
         │   breakdown        │   working shown    │
         └────────────────────┴────────────────────┘
```

---

## SSE Streaming Architecture

```
Backend opens SSE connection:
    Content-Type: text/event-stream
    Cache-Control: no-cache
    Connection: keep-alive

Sends chunks:
    data: {"chunk": "I ", "done": false}
    data: {"chunk": "would ", "done": false}
    data: {"chunk": "approach ", "done": false}
    ...
    data: {"chunk": ".", "done": true, "fullAnswer": "..."}

Electron EventSource receives each chunk:
    → appends to overlay in real time
    → user sees answer building word by word
    → first word appears in <500ms
```

---

## Security Layers

```
1. HTTPS everywhere — no HTTP allowed
2. Certificate pinning in Electron production build
3. JWT access token — 15 minute expiry
4. JWT refresh token — 30 day expiry, rotated on use
5. Device fingerprint header — verified on every request
6. Paystack webhook — HMAC SHA512 signature verified
7. AI API keys — environment variables on Render only
8. Electron production — devtools disabled, source obfuscated
9. CV files — processed server-side, not stored as files (text extracted only)
10. Rate limiting — Postgres counter check before every AI call
```
