# ZoomGuru â€” Commands

## Monorepo Setup

```bash
# Root package.json â€” npm workspaces
{
  "name": "zoomguru",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev:backend": "npm run dev --workspace=apps/backend",
    "dev:landing": "npm run dev --workspace=apps/landing",
    "dev:electron": "npm run dev --workspace=apps/electron",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:landing\" \"npm run dev:electron\"",
    "build:backend": "npm run build --workspace=apps/backend",
    "build:landing": "npm run build --workspace=apps/landing",
    "build:electron": "npm run build --workspace=apps/electron"
  }
}
```

---

## Backend Commands

```bash
cd apps/backend

# Install
npm install

# Dev (hot reload)
npm run start:dev

# Build
npm run build

# Production
node dist/main.js

# Generate NestJS module
nest generate module <name>
nest generate controller <name>
nest generate service <name>
```

---

## Electron Commands

```bash
cd apps/electron

# Install
npm install

# Dev (starts Vite + Electron together)
npm run dev

# Build production app
npm run build

# Package for macOS (.dmg)
npm run dist:mac

# Package for Windows (.exe)
npm run dist:win

# Package both
npm run dist
```

### package.json scripts for Electron
```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "build": "vite build && tsc -p electron/tsconfig.json",
    "dist:mac": "npm run build && electron-builder --mac",
    "dist:win": "npm run build && electron-builder --win",
    "dist": "npm run build && electron-builder --mac --win"
  }
}
```

---

## Landing Page Commands

```bash
cd apps/landing

# Install
npm install

# Dev
npm run dev

# Build
npm run build

# Deploy to Vercel (auto on git push if connected)
# Manual deploy:
npx vercel --prod
```

---

## Database Commands

```bash
# No migration CLI â€” tables auto-created on backend boot

# Manual Neon SQL console
# Go to: console.neon.tech â†’ SQL Editor

# Reset all tables (CAUTION â€” destroys data)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS interview_sessions CASCADE;
DROP TABLE IF EXISTS cv_profiles CASCADE;
DROP TABLE IF EXISTS user_usage CASCADE;
DROP TABLE IF EXISTS licenses CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
# Then restart backend â€” initDB() recreates everything

# View active licenses
SELECT u.email, l.plan, l.currency, l.device_fingerprint, l.expires_at, l.status
FROM licenses l JOIN users u ON u.id = l.user_id
ORDER BY l.activated_at DESC;

# View usage stats
SELECT u.email, uu.sessions_used, uu.responses_used, uu.reset_at
FROM user_usage uu JOIN users u ON u.id = uu.user_id
ORDER BY uu.responses_used DESC;

# Monthly usage reset (run manually or as cron)
UPDATE user_usage
SET responses_used = 0, sessions_used = 0, reset_at = NOW() + INTERVAL '30 days'
WHERE reset_at < NOW() AND user_id IN (
  SELECT id FROM users WHERE is_pro = false
);
```

---

## Environment Files

### apps/backend/.env
```env
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/zoomguru?sslmode=require
JWT_SECRET=change_this_to_random_64_char_string
JWT_REFRESH_SECRET=change_this_to_different_random_64_char_string
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx
QWEN_API_KEY=sk-xxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxx
PAYSTACK_WEBHOOK_SECRET=xxxxxxxxxxxx
PAYSTACK_NGN_MONTHLY_PLAN=PLN_xxxxxxxxxxxx
PAYSTACK_USD_MONTHLY_PLAN=PLN_xxxxxxxxxxxx
PORT=3000
NODE_ENV=development
```

### apps/electron/.env
```env
VITE_API_URL=http://localhost:3000
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxx
VITE_APP_ENV=development
```

### apps/electron/.env.production
```env
VITE_API_URL=https://api.zoomguru.xyz
VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxx
VITE_APP_ENV=production
```

### apps/landing/.env.local
```env
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxx
NEXT_PUBLIC_API_URL=https://api.zoomguru.xyz
```

---

## Render Deployment (Backend)

```bash
# Automatic deploy on git push if connected
# Manual deploy via Render dashboard

# Environment variables to set in Render:
# DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET,
# DEEPSEEK_API_KEY, QWEN_API_KEY,
# PAYSTACK_SECRET_KEY, PAYSTACK_WEBHOOK_SECRET,
# PAYSTACK_NGN_MONTHLY_PLAN, PAYSTACK_USD_MONTHLY_PLAN

# Build command (in Render settings):
npm install && npm run build

# Start command:
node dist/main.js
```

---

## Vercel Deployment (Landing)

```bash
# Recommended â€” connect repo in Vercel dashboard
# 1. Import at vercel.com/new
# 2. Root Directory: apps/landing
# 3. Framework: Next.js (auto-detected)
# 4. Env var: NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
# Auto-deploys on every push to main

# Or CLI:
cd apps/landing
npx vercel --prod
```

---

## Electron Release Distribution

```bash
# Build and sign for macOS
# Requires Apple Developer certificate for notarization

cd apps/electron
npm run dist:mac
# Output: release/ZoomGuru-{version}-arm64.dmg
#         release/ZoomGuru-{version}.dmg

# Build for Windows
npm run dist:win
# Output: release/ZoomGuru-Setup-{version}.exe

# Upload release files to:
# GitHub Releases OR
# Cloudflare R2 bucket (releases.zoomguru.xyz)
# Then update DOWNLOAD_LINKS in landing/components/Download.tsx
```

---

## Generating JWT Secrets

```bash
# Run once to generate secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output â†’ JWT_SECRET

node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output â†’ JWT_REFRESH_SECRET
```

---

## Checking Paystack Webhook (Local Testing)

```bash
# Use Paystack CLI or ngrok to expose local backend

# With ngrok:
ngrok http 3000
# Copy https URL â†’ set as Paystack webhook in dashboard
# Dashboard â†’ Settings â†’ API Keys & Webhooks â†’ Webhook URL

# Test charge event:
curl -X POST https://your-ngrok-url/paystack/webhook \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: {computed_hmac}" \
  -d '{"event":"charge.success","data":{"reference":"test_ref","metadata":{"user_id":"uuid","plan":"monthly"},"amount":1500000,"currency":"NGN"}}'
```

