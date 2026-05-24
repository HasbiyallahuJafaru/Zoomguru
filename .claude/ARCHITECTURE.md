# ZoomGuru â€” Architecture

## System Overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    USER'S MACHINE                           â”‚
â”‚                                                             â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚              ELECTRON APP (Protected Window)          â”‚  â”‚
â”‚  â”‚                                                       â”‚  â”‚
â”‚  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚  â”‚
â”‚  â”‚  â”‚ Transparent â”‚  â”‚  Whisper STT â”‚  â”‚  Porcupine  â”‚ â”‚  â”‚
â”‚  â”‚  â”‚   Overlay   â”‚  â”‚  (local mic) â”‚  â”‚  Wake Word  â”‚ â”‚  â”‚
â”‚  â”‚  â”‚     UI      â”‚  â”‚  transcribe  â”‚  â”‚  (local)    â”‚ â”‚  â”‚
â”‚  â”‚  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜ â”‚  â”‚
â”‚  â”‚         â”‚                â”‚                  â”‚         â”‚  â”‚
â”‚  â”‚         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚  â”‚
â”‚  â”‚                          â”‚                             â”‚  â”‚
â”‚  â”‚                  Global Hotkeys                        â”‚  â”‚
â”‚  â”‚             Ctrl+Shift+A / S / H / R / C               â”‚  â”‚
â”‚  â”‚                          â”‚                             â”‚  â”‚
â”‚  â”‚              desktopCapturer (screenshots)              â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”˜  â”‚
â”‚                             â”‚ HTTPS + SSE                  â”‚
â”‚                             â”‚ (certificate pinned)         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”˜
                              â”‚
                              â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                  BACKEND (Render)                           â”‚
â”‚                  NestJS + Fastify                           â”‚
â”‚                                                             â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚    Auth    â”‚  â”‚   License    â”‚  â”‚   Claude Proxy     â”‚  â”‚
â”‚  â”‚  /auth/*   â”‚  â”‚  /license/*  â”‚  â”‚   /ai/stream       â”‚  â”‚
â”‚  â”‚  JWT       â”‚  â”‚  Fingerprint â”‚  â”‚   /ai/screenshot   â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                             â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚  Paystack  â”‚  â”‚   Session    â”‚  â”‚      CV Parser     â”‚  â”‚
â”‚  â”‚  /paystack â”‚  â”‚  /session/*  â”‚  â”‚   /cv/upload       â”‚  â”‚
â”‚  â”‚  webhook   â”‚  â”‚  management  â”‚  â”‚   /cv/parse        â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                             â”‚                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚               â”‚               â”‚
              â–¼               â–¼               â–¼
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚     Neon     â”‚  â”‚  DeepSeek   â”‚  â”‚   Qwen VL    â”‚
    â”‚  PostgreSQL  â”‚  â”‚  V3 + R1    â”‚  â”‚  (vision)    â”‚
    â”‚  (all data)  â”‚  â”‚  (text AI)  â”‚  â”‚(screenshots) â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Data Flow â€” Listen Mode

```
1. User presses Ctrl+Shift+A
2. Electron activates mic â†’ Whisper tiny model transcribes locally
3. Silence detected (2 seconds) â†’ transcription complete
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
   d. Detect question type â†’ route to DeepSeek V3 or R1
   e. Inject CV profile into system prompt
   f. Call DeepSeek API with full context
   g. Stream SSE chunks back to Electron
6. Electron renders each chunk to overlay as it arrives
7. Full answer stored back to session.messages in Neon
```

---

## Data Flow â€” Screenshot Mode

```
1. User presses Ctrl+Shift+S
2. Electron calls desktopCapturer â†’ captures full screen PNG
3. Screenshot compressed, base64 encoded
4. Electron sends to backend:
   POST /ai/screenshot
   {
     sessionId: "uuid",
     image: "base64...",
     voiceContext: "optional â€” if combined mode"
   }
5. Backend:
   a. Auth + license check
   b. Send image to Qwen VL â†’ get text description + detected content
   c. If code detected â†’ route to DeepSeek R1 with code context
   d. If math detected â†’ route to DeepSeek R1 with reasoning mode
   e. If diagram/system â†’ route to DeepSeek R1 with system design prompt
   f. Stream SSE response back to Electron
6. Overlay shows: problem summary + approach + solution
```

---

## Data Flow â€” Wake Word Mode

```
1. Porcupine runs locally always (tiny CPU footprint)
2. User says "Hey ZoomGuru"
3. Porcupine detects wake word â†’ triggers mic activation
4. Whisper starts transcribing for 10 seconds max OR until silence
5. Same flow as Listen Mode from step 4 above
```

---

## Data Flow â€” Payment (In-App)

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
7. License verified â†’ overlay unlocks Pro features
```

---

## Data Flow â€” Payment (Landing Page)

```
1. User lands on zoomguru.xyz
2. Clicks pricing plan â†’ Paystack inline opens
3. Pays â†’ Paystack webhook hits backend (same as above)
4. Redirect to /download page
5. Download .exe or .dmg based on detected OS
6. User installs, logs in â†’ license already active
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

If fingerprint doesn't match â€” request rejected with 403.

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
// Same effect â€” visible to user, invisible to capture
```

---

## Question Type Router

```
Input: transcript or screenshot content
         â†“
Keyword analysis (fast, no API call)
         â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   BEHAVIORAL    â”‚    TECHNICAL       â”‚     CODING       â”‚
â”‚                 â”‚                    â”‚                  â”‚
â”‚ "tell me about" â”‚ "what is"          â”‚ "implement"      â”‚
â”‚ "describe a     â”‚ "explain"          â”‚ "write a"        â”‚
â”‚  time when"     â”‚ "difference        â”‚ "algorithm"      â”‚
â”‚ "how do you     â”‚  between"          â”‚ "complexity"     â”‚
â”‚  handle"        â”‚ "define"           â”‚ "optimize"       â”‚
â”‚ "weakness"      â”‚ "how does X work"  â”‚ "leetcode-style" â”‚
â”‚                 â”‚                    â”‚                  â”‚
â”‚ â†’ DeepSeek V3   â”‚ â†’ DeepSeek V3      â”‚ â†’ DeepSeek R1    â”‚
â”‚ â†’ STAR format   â”‚ â†’ Concise format   â”‚ â†’ Code + steps   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
         â”‚   SYSTEM DESIGN    â”‚       MATH         â”‚
         â”‚                    â”‚                    â”‚
         â”‚ "design a system"  â”‚ "calculate"        â”‚
         â”‚ "how would you     â”‚ "probability"      â”‚
         â”‚  architect"        â”‚ "prove"            â”‚
         â”‚ "scale this"       â”‚ "how many"         â”‚
         â”‚ "design [app]"     â”‚ "derive"           â”‚
         â”‚                    â”‚                    â”‚
         â”‚ â†’ DeepSeek R1      â”‚ â†’ DeepSeek R1      â”‚
         â”‚ â†’ Structured       â”‚ â†’ Step by step     â”‚
         â”‚   breakdown        â”‚   working shown    â”‚
         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
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
    â†’ appends to overlay in real time
    â†’ user sees answer building word by word
    â†’ first word appears in <500ms
```

---

## Security Layers

```
1. HTTPS everywhere â€” no HTTP allowed
2. Certificate pinning in Electron production build
3. JWT access token â€” 15 minute expiry
4. JWT refresh token â€” 30 day expiry, rotated on use
5. Device fingerprint header â€” verified on every request
6. Paystack webhook â€” HMAC SHA512 signature verified
7. AI API keys â€” environment variables on Render only
8. Electron production â€” devtools disabled, source obfuscated
9. CV files â€” processed server-side, not stored as files (text extracted only)
10. Rate limiting â€” Postgres counter check before every AI call
```

