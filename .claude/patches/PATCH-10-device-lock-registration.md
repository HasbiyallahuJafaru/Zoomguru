# PATCH-10 â€” Free Trial Device Lock at Registration

## Problem
User hits 3-session free trial limit.
Creates new account with different email.
Gets another free trial on same device.
Repeat forever â€” never pays.

## Rule
One device fingerprint = one free account, ever.
Paid users can use any device (their license is fingerprint-bound on first login).

## Files Affected
- `apps/backend/src/auth/auth.service.ts`

## Risk Level
ðŸŸ¡ MEDIUM â€” Modifies registration logic. Test new user signup after.

---

## Claude Code Prompt

```
Read .claude/AUTH.md and .claude/DATABASE.md first.

In apps/backend/src/auth/auth.service.ts, find the
register() method.

The register() method currently accepts: email, password, name.

STEP 1: Add deviceId as a new parameter to register():
Change the signature from:
  async register(email: string, password: string, name: string)
To:
  async register(email: string, password: string, name: string, deviceId: string)

STEP 2: Add a device fingerprint check as the FIRST operation
inside register(), BEFORE the existing email duplicate check:

  // Block multiple free accounts on same device
  if (deviceId) {
    const [deviceExists] = await sql`
      SELECT u.id, u.is_pro FROM users u
      INNER JOIN licenses l ON l.user_id = u.id
      WHERE l.device_fingerprint = ${deviceId}
      UNION
      SELECT u.id, u.is_pro FROM users u
      WHERE u.device_fingerprint_trial = ${deviceId}
      LIMIT 1
    `;
    
    if (deviceExists && !deviceExists.is_pro) {
      throw new ConflictException(
        'A free trial has already been used on this device. ' +
        'Please upgrade to create a new account.'
      );
    }
  }

STEP 3: After the user INSERT, store the device fingerprint
on the user record for trial tracking. Find the INSERT INTO users
statement and add device_fingerprint_trial to it:

  const [user] = await sql`
    INSERT INTO users (email, password_hash, name, device_fingerprint_trial)
    VALUES (${email.toLowerCase()}, ${passwordHash}, ${name}, ${deviceId || null})
    RETURNING id, email, name, is_pro
  `;

STEP 4: In apps/backend/src/database/init.ts, find the
CREATE TABLE users statement. Add this column to it:
  device_fingerprint_trial TEXT

Add it after the currency TEXT column and before created_at.

STEP 5: In apps/backend/src/auth/auth.controller.ts,
find the register endpoint handler. Pass the deviceId from
the request body to auth.service.register():
  - Add deviceId to the register DTO/body destructuring
  - Pass it as the 4th argument to this.authService.register()

Do not change any other registration logic.
Do not change the login flow.
Show me all changed files with diffs.
```

---

## Verification

```bash
# Test 1: Register first account on device A â†’ should succeed
# Test 2: Register second account on device A â†’ should fail with:
# "A free trial has already been used on this device"
# Test 3: Paid user can still register/login normally

# From Electron, deviceId is sent in request body:
# { email, password, name, deviceId: getDeviceFingerprint() }
```

## Electron Side
```
In apps/electron/src/auth/Register.tsx,
ensure deviceId is included in the register POST body:

const deviceId = await window.zoomguru.getDeviceId();
const res = await fetch(`${API_URL}/auth/register`, {
  method: 'POST',
  body: JSON.stringify({ email, password, name, deviceId }),
  ...
});
```

## Rollback
Remove device_fingerprint_trial column from CREATE TABLE.
Remove the device check block from register().
Revert register() signature to 3 params.
Remove deviceId from controller.

