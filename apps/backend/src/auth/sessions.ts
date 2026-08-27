import { randomBytes } from 'node:crypto';
import { getRedis } from '../redis/redis';

// Monthly and yearly seat two computers. Weekly seats one — that is the
// difference the plan sells. Trial and lapsed accounts get one. `plan` is
// already null unless the subscription is active — the caller resolves that
// with isSubActive().
const ACTIVE_SEATS = 2;
export const DEFAULT_SEATS = 1;

export function seatsForPlan(plan: string | null | undefined): number {
  if (!plan) return DEFAULT_SEATS;
  return plan === 'weekly' ? DEFAULT_SEATS : ACTIVE_SEATS;
}

// Login tokens live 3 hours. Sessions are pruned on the same clock, so a slot
// dies exactly when the token holding it does — never before (the token is
// still usable) and never after (a slot outliving its token would be
// unreclaimable, and two cycles of that would lock the account out).
export const TOKEN_TTL_SEC = 3 * 60 * 60;
const TOKEN_TTL_MS = TOKEN_TTL_SEC * 1000;

// `lastSeen` is shown in the "who is signed in" list. It is refreshed at most
// this often, so the steady-state cost of the per-request check stays one HGET.
const SEEN_REFRESH_MS = 60 * 1000;

export interface SessionInfo {
  sid: string;
  ip: string;
  device: string;
  loginAt: string;
  lastSeen: string;
  current: boolean;
}

interface Stored {
  ip: string;
  device: string;
  at: number;
  seen: number;
}

const key = (userId: string): string => `sess:${userId}`;

export function deviceLabel(ua: string | undefined): string {
  if (!ua) return 'Unknown device';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'Mac';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iPhone/iPad';
  if (/Linux|X11/i.test(ua)) return 'Linux';
  return 'Unknown device';
}

function parse(raw: string): Stored | null {
  try {
    const v = JSON.parse(raw) as Stored;
    return typeof v.seen === 'number' ? v : null;
  } catch {
    return null;
  }
}

// Reads every session for a user, deleting any whose token has expired. Pruning
// on read means no background sweeper and no per-field TTL.
async function loadLive(userId: string): Promise<Map<string, Stored>> {
  const redis = getRedis();
  const all = await redis.hgetall(key(userId));
  const live = new Map<string, Stored>();
  const stale: string[] = [];
  const now = Date.now();

  for (const [sid, raw] of Object.entries(all)) {
    const v = parse(raw);
    if (!v || now - v.at > TOKEN_TTL_MS) stale.push(sid);
    else live.set(sid, v);
  }
  if (stale.length) await redis.hdel(key(userId), ...stale);
  return live;
}

// Redis down → empty list. The caller treats that as "no sessions known",
// which keeps logins working rather than locking everyone out.
export async function listSessions(userId: string, currentSid?: string): Promise<SessionInfo[]> {
  let live: Map<string, Stored>;
  try {
    live = await loadLive(userId);
  } catch {
    return [];
  }
  return [...live.entries()]
    .sort((a, b) => a[1].at - b[1].at)
    .map(([sid, v]) => ({
      sid,
      ip: v.ip,
      device: v.device,
      loginAt: new Date(v.at).toISOString(),
      lastSeen: new Date(v.seen).toISOString(),
      current: sid === currentSid,
    }));
}

// Returns the new session id, or null when the account is already at its cap.
// Redis down → returns a session id anyway: the cap is an abuse control, not a
// security boundary, and it must not become a hard dependency for logging in.
export async function addSession(
  userId: string,
  ip: string,
  ua: string | undefined,
  seats: number,
): Promise<string | null> {
  const sid = randomBytes(16).toString('hex');
  try {
    const redis = getRedis();
    const live = await loadLive(userId);
    const device = deviceLabel(ua);

    // No same-device takeover: two computers on one router share an IP, and
    // reclaiming by IP collapsed a two-seat account to one. Slots are released
    // by /auth/logout (called on quit) or by the token expiring.

    // One seat yields to the newest login instead of refusing — the displaced
    // session is the same person's. Two seats refuse, so the pair can see each
    // other in the 409 list and coordinate. `while` so a two-to-one downgrade
    // can't evict someone and still be refused.
    while (seats === 1 && live.size >= seats) {
      const oldest = [...live.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!oldest) break;
      live.delete(oldest[0]);
      await redis.hdel(key(userId), oldest[0]);
    }

    if (live.size >= seats) return null;

    const now = Date.now();
    const entry: Stored = { ip, device, at: now, seen: now };
    await redis.hset(key(userId), sid, JSON.stringify(entry));
    await redis.pexpire(key(userId), TOKEN_TTL_MS);

    // ponytail: two logins racing here both see a count over the cap and both
    // back out, so the user retries. Cheaper than a Lua CAS, and it fails
    // closed. Swap in an EVAL if simultaneous logins ever become common.
    if ((await redis.hlen(key(userId))) > seats) {
      await redis.hdel(key(userId), sid);
      return null;
    }
    return sid;
  } catch {
    return sid;
  }
}

// Per-request liveness check. False means the session was revoked or went idle,
// and the bearer token should no longer be honoured.
export async function touchSession(userId: string, sid: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const raw = await redis.hget(key(userId), sid);
    if (!raw) return false;

    const v = parse(raw);
    if (!v) return false;

    const now = Date.now();
    if (now - v.at > TOKEN_TTL_MS) {
      await redis.hdel(key(userId), sid);
      return false;
    }
    if (now - v.seen > SEEN_REFRESH_MS) {
      v.seen = now;
      await redis.hset(key(userId), sid, JSON.stringify(v));
      await redis.pexpire(key(userId), TOKEN_TTL_MS);
    }
    return true;
  } catch {
    return true; // Redis down → fail open, same as every other Redis check here
  }
}

export async function revokeSession(userId: string, sid: string): Promise<void> {
  try {
    await getRedis().hdel(key(userId), sid);
  } catch {
    // Redis down — slot ages out on its own
  }
}

export async function revokeAllSessions(userId: string): Promise<void> {
  try {
    await getRedis().del(key(userId));
  } catch {
    // Redis down — slots age out on their own
  }
}
