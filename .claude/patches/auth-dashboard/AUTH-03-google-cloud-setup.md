# AUTH-03 â€” Google Cloud Project Setup (Guided)

## What This Does
Creates a Google Cloud project and OAuth 2.0 credentials
needed for "Continue with Google" on the web and Electron app.
This is a manual setup â€” no code changes in this patch.

## Risk Level
ðŸŸ¢ LOW â€” External service setup only. No code changes.

---

## Prompt

```
I need to set up Google OAuth for ZoomGuru. Guide me through
creating a Google Cloud project and OAuth credentials step by step.
Do not write any code yet â€” just give me the exact steps to follow
in the Google Cloud Console so I can get my:
  - GOOGLE_CLIENT_ID
  - GOOGLE_CLIENT_SECRET

I need OAuth to work for:
1. Web login at zoomguru.xyz (Next.js with NextAuth)
2. Electron app deep link callback via api.zoomguru.xyz
```

---

## The Steps (Follow These Exactly)

### Part 1 â€” Create Google Cloud Project

```
1. Go to: console.cloud.google.com
2. Click the project dropdown at the top (says "Select a project")
3. Click "New Project"
4. Project name: ZoomGuru
5. Leave organization as-is
6. Click "Create"
7. Wait ~30 seconds, then select the ZoomGuru project
```

### Part 2 â€” Enable Google OAuth API

```
1. In the left sidebar, go to: APIs & Services â†’ Library
2. Search for: "Google Identity"
3. Click "Google Identity Toolkit API" â†’ Enable
4. Also search "Google+ API" â†’ Enable (needed for profile info)
   OR search "People API" â†’ Enable
```

### Part 3 â€” Configure OAuth Consent Screen

```
1. Go to: APIs & Services â†’ OAuth consent screen
2. Select: External (so any Google account can sign in)
3. Click Create
4. Fill in:
   App name:         ZoomGuru
   User support email: your@email.com
   App logo:         upload your logo (optional)
   App domain:       zoomguru.xyz
   Authorized domain: zoomguru.xyz
   Developer email:  your@email.com
5. Click Save and Continue
6. On Scopes screen:
   Click "Add or Remove Scopes"
   Add these scopes:
     .../auth/userinfo.email
     .../auth/userinfo.profile
     openid
   Click Save and Continue
7. On Test users screen:
   Add your own Gmail as a test user
   (Required while app is in Testing mode)
8. Click Save and Continue â†’ Back to Dashboard
```

### Part 4 â€” Create OAuth Credentials

```
1. Go to: APIs & Services â†’ Credentials
2. Click "+ Create Credentials" â†’ OAuth Client ID
3. Application type: Web application
4. Name: ZoomGuru Web
5. Authorized JavaScript origins â€” add ALL of these:
   http://localhost:3000
   http://localhost:3001
   https://zoomguru.xyz
   https://admin.zoomguru.xyz
6. Authorized redirect URIs â€” add ALL of these:
   http://localhost:3000/api/auth/callback/google
   http://localhost:3001/api/auth/callback/google
   https://zoomguru.xyz/api/auth/callback/google
   https://admin.zoomguru.xyz/api/auth/callback/google
   https://api.zoomguru.xyz/auth/google/electron/callback
7. Click Create
8. COPY and SAVE:
   Client ID     â†’ this is your GOOGLE_CLIENT_ID
   Client secret â†’ this is your GOOGLE_CLIENT_SECRET
```

### Part 5 â€” Add to Environment Files

```
Add to apps/landing/.env.local:
  GOOGLE_CLIENT_ID=your_client_id_here
  GOOGLE_CLIENT_SECRET=your_client_secret_here

Add to apps/admin/.env.local:
  GOOGLE_CLIENT_ID=your_client_id_here
  GOOGLE_CLIENT_SECRET=your_client_secret_here

Add to apps/backend/.env:
  GOOGLE_CLIENT_ID=your_client_id_here
  GOOGLE_CLIENT_SECRET=your_client_secret_here
  BACKEND_URL=https://api.zoomguru.xyz
  ELECTRON_OAUTH_SECRET=run this: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Add to Render environment variables (same as above)
```

### Part 6 â€” Publish the App (Remove Test Restriction)

```
Do this BEFORE going live to paying users.

1. Go to: APIs & Services â†’ OAuth consent screen
2. Click "Publish App"
3. Confirm the warning
4. App is now in Production mode
   (No longer limited to test users only)

Note: Google may review your app if you request
sensitive scopes. For email + profile, no review needed.
```

---

## Verification

```
After completing setup, test with:

1. In landing app local dev, visit:
   http://localhost:3000/login
   Click "Continue with Google"
   Should redirect to Google consent screen
   After approval, should redirect back logged in

2. Check Google Cloud Console:
   APIs & Services â†’ OAuth consent screen
   Should show active users after first login
```

---

## Common Errors

```
Error: "redirect_uri_mismatch"
Fix: The callback URL in your code doesn't match what's
in Google Cloud Console. Check every URL in step 4 above.

Error: "Access blocked: This app's request is invalid"
Fix: OAuth consent screen not configured.
Go back to Part 3 and complete it.

Error: "Error 400: admin_policy_enforced"
Fix: Your Google Workspace org blocks OAuth apps.
Use a personal Gmail account for testing.
```

