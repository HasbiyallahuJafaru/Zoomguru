'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL!;
const LIMIT = 50;
const REFRESH_MS = 30_000;

const STATUS_CODES = ['', '400', '401', '403', '404', '500'];

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return secs + 's ago';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

function severityIcon(code: number | null) {
  if (!code) return '⚪';
  if (code >= 500) return '🔴';
  if (code >= 400) return '🟡';
  return '⚪';
}

function severityBorder(code: number | null) {
  if (!code) return '#e2e8f0';
  if (code >= 500) return '#fca5a5';
  if (code >= 400) return '#fde68a';
  return '#e2e8f0';
}

interface ErrorRow {
  id: string;
  endpoint: string | null;
  method: string | null;
  error_message: string;
  stack_trace: string | null;
  user_id: string | null;
  status_code: number | null;
  created_at: string;
}

interface Summary {
  last_24h: number;
  last_7d: number;
  last_30d: number;
}

interface TopEndpoint {
  endpoint: string;
  count: number;
}

interface ErrorsResponse {
  rows: ErrorRow[];
  total: number;
  page: number;
  limit: number;
  summary: Summary;
  topEndpoints: TopEndpoint[];
}

// ─── Copy button ─────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{
        padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
        border: '1px solid #e2e8f0', background: copied ? '#dcfce7' : '#f8fafc',
        color: copied ? '#166534' : '#475569', cursor: 'pointer',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ─── Input / Select shared style ─────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0',
  fontSize: 13, outline: 'none', background: '#fff', color: '#0f172a',
};

// ─── Expanded stack trace ─────────────────────────────────────────────────────
function StackTrace({ row }: { row: ErrorRow }) {
  const text = [
    `Endpoint: ${row.method ?? ''} ${row.endpoint ?? '—'}`,
    `Status: ${row.status_code ?? '—'}`,
    `Time: ${row.created_at}`,
    `User: ${row.user_id ?? 'anonymous'}`,
    '',
    'Error:',
    row.error_message,
    '',
    'Stack Trace:',
    row.stack_trace ?? '(no stack trace recorded)',
  ].join('\n');

  return (
    <tr>
      <td colSpan={7} style={{ padding: '0 14px 14px 46px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{
          background: '#0f172a', borderRadius: 8, padding: '14px 16px',
          fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, color: '#e2e8f0',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 10, right: 12 }}>
            <CopyButton text={text} />
          </div>
          <span style={{ color: '#f87171', fontWeight: 700 }}>{row.error_message}</span>
          {'\n\n'}
          <span style={{ color: '#94a3b8' }}>{row.stack_trace ?? '(no stack trace)'}</span>
        </div>
      </td>
    </tr>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '16px 20px', flex: 1, minWidth: 140,
      borderTop: accent ? `3px solid ${accent}` : undefined,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ErrorsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [statusCode, setStatusCode] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ErrorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);

  // Track newest row id seen so we can detect new errors on refresh
  const newestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const fetchErrors = useCallback(async (isBackground = false) => {
    if (status !== 'authenticated') return;
    if (!isBackground) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: String(LIMIT),
        search, endpoint, statusCode,
      });
      const r = await fetch(`${API}/admin/errors?${params}`, {
        headers: { Authorization: `Bearer ${(session as any)?.accessToken}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json: ErrorsResponse = await r.json();

      if (isBackground && newestIdRef.current && json.rows.length > 0) {
        const topId = json.rows[0].id;
        if (topId !== newestIdRef.current) {
          // Count how many are newer than last known
          const idx = json.rows.findIndex(r => r.id === newestIdRef.current);
          setNewCount(idx === -1 ? json.rows.length : idx);
        }
      }

      if (!isBackground || !data) {
        if (json.rows.length > 0) newestIdRef.current = json.rows[0].id;
        setData(json);
        setNewCount(0);
      }
    } catch (e: any) {
      if (!isBackground) setError(e.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [status, session, page, search, endpoint, statusCode, data]);

  // Foreground load when filters/page change
  useEffect(() => { fetchErrors(false); }, [page, search, endpoint, statusCode, status]); // eslint-disable-line

  // Background auto-refresh
  useEffect(() => {
    const id = setInterval(() => fetchErrors(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchErrors]);

  function applyNewErrors() {
    newestIdRef.current = null;
    setNewCount(0);
    fetchErrors(false);
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;
  const summary = data?.summary ?? { last_24h: 0, last_7d: 0, last_30d: 0 };
  const topEp = data?.topEndpoints?.[0];

  if (status === 'loading' || loading) {
    return <AdminLayout><div style={{ padding: 40, color: '#64748b', fontSize: 14 }}>Loading error logs…</div></AdminLayout>;
  }
  if (error) {
    return <AdminLayout><div style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {error}</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Error Logs</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Auto-refreshes every 30 seconds</p>
          </div>
          <button
            onClick={() => fetchErrors(false)}
            style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
          <SummaryCard label="Last 24 hours" value={Number(summary.last_24h)} accent="#ef4444" />
          <SummaryCard label="Last 7 days" value={Number(summary.last_7d)} accent="#f59e0b" />
          <SummaryCard label="Last 30 days" value={Number(summary.last_30d)} />
          {topEp && (
            <SummaryCard label="Hottest endpoint (7d)" value={topEp.endpoint} accent="#7c3aed" />
          )}
          <SummaryCard label="Total (all time)" value={(data?.total ?? 0).toLocaleString()} />
        </div>

        {/* New errors banner */}
        {newCount > 0 && (
          <div
            onClick={applyNewErrors}
            style={{
              background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
              padding: '10px 16px', marginBottom: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
            }}
          >
            <span style={{ fontSize: 16 }}>🔴</span>
            <span style={{ fontWeight: 600, color: '#dc2626' }}>{newCount} new error{newCount !== 1 ? 's' : ''} detected</span>
            <span style={{ color: '#ef4444' }}>— click to load</span>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search error messages…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ ...inputStyle, width: 260 }}
          />
          <input
            type="text"
            placeholder="Filter by endpoint…"
            value={endpoint}
            onChange={e => { setEndpoint(e.target.value); setPage(1); }}
            style={{ ...inputStyle, width: 220 }}
          />
          <select
            value={statusCode}
            onChange={e => { setStatusCode(e.target.value); setPage(1); }}
            style={{ ...inputStyle, width: 150 }}
          >
            <option value="">All status codes</option>
            {STATUS_CODES.filter(Boolean).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {(search || endpoint || statusCode) && (
            <button
              onClick={() => { setSearch(''); setEndpoint(''); setStatusCode(''); setPage(1); }}
              style={{ ...inputStyle, cursor: 'pointer', color: '#ef4444', borderColor: '#fca5a5' }}
            >
              ✕ Clear
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
            {data?.total ?? 0} result{data?.total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['', 'Endpoint', 'Error', 'User', 'Code', 'Time', ''].map((h, i) => (
                  <th key={i} style={{
                    textAlign: 'left', padding: '11px 14px', color: '#64748b',
                    fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!data?.rows || data.rows.length === 0) ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8', fontSize: 15 }}>
                    No errors logged. 🎉
                  </td>
                </tr>
              ) : data.rows.map(row => (
                <>
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: expanded === row.id ? 'none' : '1px solid #f1f5f9',
                      borderLeft: `3px solid ${severityBorder(row.status_code)}`,
                      background: expanded === row.id ? '#fafafa' : undefined,
                    }}
                  >
                    {/* Severity */}
                    <td style={{ padding: '11px 10px 11px 14px', fontSize: 16, lineHeight: 1 }}>
                      {severityIcon(row.status_code)}
                    </td>

                    {/* Endpoint */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      {row.method && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                          background: row.method === 'GET' ? '#dbeafe' : row.method === 'POST' ? '#dcfce7' : '#fef3c7',
                          color: row.method === 'GET' ? '#1d4ed8' : row.method === 'POST' ? '#166534' : '#92400e',
                          marginRight: 6,
                        }}>
                          {row.method}
                        </span>
                      )}
                      <span style={{ color: '#374151', fontFamily: 'monospace', fontSize: 12 }}>
                        {row.endpoint ?? '—'}
                      </span>
                    </td>

                    {/* Error message */}
                    <td style={{ padding: '11px 14px', maxWidth: 360 }}>
                      <span style={{ color: '#dc2626', fontFamily: 'monospace', fontSize: 12 }} title={row.error_message}>
                        {row.error_message.length > 80 ? row.error_message.slice(0, 80) + '…' : row.error_message}
                      </span>
                    </td>

                    {/* User */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      {row.user_id ? (
                        <a
                          href={`/users/${row.user_id}`}
                          style={{ color: '#4f6ef7', fontSize: 11, fontFamily: 'monospace', textDecoration: 'none' }}
                        >
                          {row.user_id.slice(0, 8)}…
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>anon</span>
                      )}
                    </td>

                    {/* Status code */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      {row.status_code ? (
                        <span style={{
                          fontWeight: 700, fontSize: 13,
                          color: row.status_code >= 500 ? '#dc2626' : row.status_code >= 400 ? '#d97706' : '#475569',
                        }}>
                          {row.status_code}
                        </span>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>

                    {/* Time */}
                    <td style={{ padding: '11px 14px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {timeAgo(row.created_at)}
                    </td>

                    {/* Details toggle */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                        style={{
                          padding: '4px 10px', borderRadius: 5, fontSize: 12, fontWeight: 500,
                          border: '1px solid #e2e8f0',
                          background: expanded === row.id ? '#eef2ff' : '#f8fafc',
                          color: expanded === row.id ? '#4f6ef7' : '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        {expanded === row.id ? '▲ hide' : '▼ details'}
                      </button>
                    </td>
                  </tr>

                  {expanded === row.id && <StackTrace key={row.id + '-st'} row={row} />}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: page <= 1 ? '#cbd5e1' : '#475569', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 13 }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 13, color: '#64748b' }}>Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: page >= totalPages ? '#cbd5e1' : '#475569', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: 13 }}
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
