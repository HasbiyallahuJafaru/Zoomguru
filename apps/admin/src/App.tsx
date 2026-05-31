import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { fetchStats } from './api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Dashboard from './Dashboard';

const SESSION_KEY = 'zg_admin_key';

export default function App() {
  const [adminKey, setAdminKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) setAuthed(true);
  }, []);

  async function handleSubmit(e: FormEvent) {
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
      setError(msg === '401' ? 'Invalid admin key.' : 'Could not reach backend.');
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
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
          <CardDescription>ZoomGuru Analytics Dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key">Admin Key</Label>
              <Input
                id="key"
                type="password"
                placeholder="Enter admin key"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying…' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
