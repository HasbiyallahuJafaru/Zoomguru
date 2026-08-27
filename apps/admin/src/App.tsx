import { useState, useEffect } from 'react';
import { fetchStats } from './api';
import Dashboard from './Dashboard';
import { Notice, Wordmark, STATUS } from './ui';

const SESSION_KEY = 'zg_admin_key';

/** What the dashboard covers. Signposting, so the door tells you what is
 *  behind it rather than just asking for a key. */
const COVERS = ['Signups', 'Payments', 'AI providers', 'Referrals', 'Broadcasts'];

export default function App() {
  const [adminKey, setAdminKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) setAuthed(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adminKey.trim()) return;
    setLoading(true);
    setError('');
    try {
      await fetchStats(adminKey.trim());
      sessionStorage.setItem(SESSION_KEY, adminKey.trim());
      setAuthed(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg === '401' ? 'That key was not accepted.' : 'Could not reach the backend.');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
    setAdminKey('');
  }

  if (authed) {
    const key = sessionStorage.getItem(SESSION_KEY) ?? '';
    return <Dashboard adminKey={key} onLogout={handleLogout} />;
  }

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      {/* The screen layer at full scale. On the site it is a tinted panel over
          the page; here, on the one screen that sits outside the product, it
          takes a whole half and the wordmark inverts onto it. */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-overlay px-8 py-10 text-paper md:px-14 lg:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-32 size-[34rem] rounded-full opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 62%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[30rem] rounded-full opacity-50"
          style={{ background: 'radial-gradient(circle, rgba(255,74,28,0.5), transparent 66%)' }}
        />

        <div className="relative flex items-center gap-3">
          <Wordmark className="!text-paper [&_em]:!text-paper/70" />
          <span className="label !text-paper/70">Admin</span>
        </div>

        <h1
          className="relative my-10 max-w-[15ch] text-hed lg:my-0"
          style={{ fontVariationSettings: '"SOFT" 0, "WONK" 1, "opsz" 144' }}
        >
          Everything the product knows about itself.
        </h1>

        <ul className="relative flex flex-wrap gap-x-5 gap-y-2">
          {COVERS.map((c) => (
            <li key={c} className="label !text-paper/70">
              {c}
            </li>
          ))}
        </ul>
      </aside>

      {/* Paper. The form itself stays quiet — one field, one button. */}
      <main className="flex items-center justify-center px-6 py-16 md:px-12">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rise w-full max-w-[24rem]"
        >
          <p className="label">Admin access</p>
          <h2 className="mt-3 text-hed">Sign in</h2>

          <label htmlFor="admin-key" className="label mt-10 block">
            Admin key
          </label>
          <input
            id="admin-key"
            className="field-input mt-2.5"
            type="password"
            placeholder="Paste your key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />

          {error && (
            <div className="mt-4">
              <Notice tone={STATUS.bad}>{error}</Notice>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary mt-6 w-full !py-3.5">
            {loading ? 'Checking…' : 'Sign in'}
          </button>

          <p className="mt-5 text-[0.8125rem] leading-relaxed text-muted">
            The key is kept in this browser tab only, and is cleared when the tab closes.
          </p>
        </form>
      </main>
    </div>
  );
}
