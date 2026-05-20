# AUTH-13 — Electron Auth Extensions

## What This Does
- Adds username field to Electron register screen
- Login accepts username OR email
- Adds Google OAuth via deep link
- Shows device fingerprint in app settings
- Registers deep link protocol handler (zoomguru://)

## Files Affected
- `apps/electron/electron/main.ts`
- `apps/electron/src/auth/Login.tsx`
- `apps/electron/src/auth/Register.tsx`
- `apps/electron/electron/preload.ts`

## Risk Level
🟡 MEDIUM — Modifies auth UI. Test full login flow after.

---

## STEP 1 Prompt — Deep link protocol handler

```
Read .claude/ELECTRON.md first.

In apps/electron/electron/main.ts, add deep link
(custom protocol) handling for Google OAuth callback.

CHANGE 1: At the very top of main.ts, before the app
is created, register the custom protocol:

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(
        'zoomguru', process.execPath, [path.resolve(process.argv[1])]
      );
    }
  } else {
    app.setAsDefaultProtocolClient('zoomguru');
  }

CHANGE 2: Add a deep link handler inside app.whenReady():

  // Handle deep link for Google OAuth on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // Handle deep link on Windows (passed as argv)
  if (process.platform === 'win32') {
    const deepLinkUrl = process.argv.find(arg =>
      arg.startsWith('zoomguru://')
    );
    if (deepLinkUrl) handleDeepLink(deepLinkUrl);
  }

CHANGE 3: Add the handleDeepLink function BEFORE app.whenReady():

  function handleDeepLink(url: string): void {
    if (!url.startsWith('zoomguru://auth')) return;

    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');

    if (!token || !mainWindow) return;

    // Send token to renderer for exchange
    mainWindow.webContents.send('auth:google-callback', { token });
    mainWindow.show();
    mainWindow.focus();
  }

CHANGE 4: In preload.ts, add to contextBridge:

  onGoogleAuth: (callback: (data: { token: string }) => void) => {
    ipcRenderer.on('auth:google-callback', (_e, data) => callback(data));
  },

  openGoogleAuth: () => {
    // Opens Google OAuth in system browser
    const apiUrl = process.env.VITE_API_URL ||
      'https://api.zoomguru.com';
    shell.openExternal(apiUrl + '/auth/google/electron');
  },

Do not change any existing code. Only additions.
Show me both file diffs.
```

---

## STEP 2 Prompt — Login page update

```
Read .claude/ELECTRON.md first.

In apps/electron/src/auth/Login.tsx, make these
surgical changes only:

CHANGE 1: Update the identifier input label from
"Email" to "Email or Username" and update placeholder.

CHANGE 2: Add a Google OAuth button ABOVE the existing
email/password form with a divider between them:

  <button
    onClick={() => window.zoomguru.openGoogleAuth()}
    style={{
      width: '100%',
      padding: '11px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 10,
      color: '#fff',
      fontSize: 13,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 16,
    }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
    Continue with Google
  </button>

  <div style={{
    display: 'flex', alignItems: 'center',
    gap: 12, marginBottom: 16
  }}>
    <div style={{ flex: 1, height: 1,
      background: 'rgba(255,255,255,0.1)' }} />
    <span style={{ color: 'rgba(255,255,255,0.3)',
      fontSize: 11 }}>or</span>
    <div style={{ flex: 1, height: 1,
      background: 'rgba(255,255,255,0.1)' }} />
  </div>

CHANGE 3: Add Google callback handler in useEffect:

  useEffect(() => {
    window.zoomguru.onGoogleAuth(async ({ token }) => {
      // Exchange short-lived token for JWT
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/google/electron/exchange`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
        // Navigate to overlay/home
        onLoginSuccess(data.user);
      }
    });
  }, []);

Add the /auth/google/electron/exchange endpoint to backend:
  @Post('google/electron/exchange')
  Exchange the short-lived electronToken for full JWT tokens.
  Verify it: jwtService.verify(token, ELECTRON_OAUTH_SECRET)
  Return: full accessToken + refreshToken like regular login.

Do not change password login logic.
Show me all diffs separately.
```

---

## STEP 3 Prompt — Register page username field

```
In apps/electron/src/auth/Register.tsx, add a username
field to the existing registration form.

CHANGE 1: Add username to the form state:
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<
    boolean | null
  >(null);

CHANGE 2: Add username input field AFTER the name field:

  <input
    type="text"
    placeholder="Username (letters, numbers, underscore)"
    value={username}
    onChange={(e) => {
      setUsername(e.target.value.toLowerCase()
        .replace(/[^a-z0-9_]/g, ''));
      setUsernameAvailable(null);
    }}
    onBlur={async () => {
      if (username.length >= 3) {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/auth/check-username` +
          `?username=${username}`
        );
        const data = await res.json();
        setUsernameAvailable(data.available);
      }
    }}
    style={{ ...existingInputStyle }}
  />
  {usernameAvailable === true && (
    <span style={{ color: '#10b981', fontSize: 11 }}>
      ✓ Available
    </span>
  )}
  {usernameAvailable === false && (
    <span style={{ color: '#ef4444', fontSize: 11 }}>
      ✗ Already taken
    </span>
  )}

CHANGE 3: Include username in the register POST body.

Add to backend auth.controller.ts:
  @Get('auth/check-username')
  async checkUsername(@Query('username') username: string) {
    const sql = getDB();
    const [exists] = await sql`
      SELECT id FROM users WHERE username = ${username} LIMIT 1
    `;
    return { available: !exists };
  }

Show me the register page diff and the new endpoint.
```
