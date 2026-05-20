'use client';
export const dynamic = 'force-dynamic';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';

interface Session {
  id: string;
  interview_type: string;
  duration_seconds: number | null;
  total_questions: number;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
}

interface SessionsResponse {
  sessions: Session[];
  total: number;
  totalSessions: number;
  avgDurationSeconds: number;
  avgQuestions: number;
}

const TYPE_LABELS: Record<string, string> = {
  behavioral: 'Behavioral',
  technical: 'Technical',
  coding: 'Coding',
  system_design: 'System Design',
  general: 'General',
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  behavioral:    { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  technical:     { bg: 'rgba(79,110,247,0.15)',  color: '#4f6ef7' },
  coding:        { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  system_design: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  general:       { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' },
};

const TYPE_FILTERS = ['all', 'behavioral', 'technical', 'coding', 'system_design', 'general'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'longest', label: 'Longest first' },
  { value: 'questions', label: 'Most questions' },
];

export default function SessionsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [expanded, setExpanded] = useState<string | null>(null);

  const LIMIT = 20;

  const fetchSessions = useCallback(async () => {
    if (!user?.accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), limit: String(LIMIT),
      type: typeFilter, sort,
    });
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/user/sessions?${params}`,
      { headers: { Authorization: `Bearer ${user.accessToken}` } }
    );
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [user?.accessToken, page, typeFilter, sort]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { setPage(1); }, [typeFilter, sort]);

  function fmt(secs: number | null) {
    if (!secs) return 'â€”';
    const m = Math.round(secs / 60);
    return m < 1 ? '<1 min' : `${m} min`;
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '860px' }}>

      {/* Title */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>Interview Sessions</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', marginTop: '4px' }}>Your full interview history</p>
      </div>

      {/* Stats row */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <MiniStat label="Total sessions"  value={String(data.totalSessions)} />
          <MiniStat label="Avg duration"    value={fmt(data.avgDurationSeconds)} />
          <MiniStat label="Avg questions"   value={data.avgQuestions ? String(Math.round(data.avgQuestions)) : 'â€”'} />
          <MiniStat label="This page"       value={`${data.sessions.length} shown`} />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Type filter pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: '6px 14px', borderRadius: '20px',
              background: typeFilter === t ? 'rgba(79,110,247,0.2)' : 'rgba(255,255,255,0.06)',
              color: typeFilter === t ? '#4f6ef7' : 'rgba(255,255,255,0.45)',
              fontSize: '13px', fontWeight: typeFilter === t ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
              border: typeFilter === t ? '1px solid rgba(79,110,247,0.35)' : '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.15s',
            }}>
              {t === 'all' ? 'All' : TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>
        {/* Sort */}
        <select value={sort} onChange={e => setSort(e.target.value)} style={{
          padding: '7px 12px', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
          color: '#e8e8e8', fontSize: '13px', outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
        }}>
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#1a1a1a' }}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Session cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1,2,3].map(i => <div key={i} className="glass" style={{ borderRadius: '12px', height: '110px', opacity: 0.4 }} />)}
        </div>
      ) : !data?.sessions.length ? (
        <EmptyState hasFilter={typeFilter !== 'all'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.sessions.map(s => {
            const typeColor = TYPE_COLORS[s.interview_type] || TYPE_COLORS.general;
            const isExpanded = expanded === s.id;
            return (
              <div key={s.id} className="glass" style={{ borderRadius: '12px', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  {/* Left */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                        background: typeColor.bg, color: typeColor.color,
                      }}>
                        {TYPE_LABELS[s.interview_type] || s.interview_type}
                      </span>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{fmtDate(s.started_at)}</span>
                    </div>
                    {s.summary && (
                      <p style={{
                        fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5,
                        display: isExpanded ? 'block' : '-webkit-box',
                        WebkitLineClamp: isExpanded ? undefined : 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: isExpanded ? 'visible' : 'hidden',
                      }}>
                        {s.summary}
                      </p>
                    )}
                    {!s.summary && (
                      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>No summary available</p>
                    )}
                  </div>

                  {/* Right: stats */}
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexShrink: 0 }}>
                    <SessionStat label="Duration" value={fmt(s.duration_seconds)} />
                    <SessionStat label="Questions" value={String(s.total_questions)} />
                    {s.summary && (
                      <button
                        onClick={() => setExpanded(isExpanded ? null : s.id)}
                        style={{
                          padding: '6px 14px', borderRadius: '8px',
                          background: 'rgba(79,110,247,0.12)',
                          border: '1px solid rgba(79,110,247,0.25)',
                          color: '#4f6ef7', fontSize: '13px', fontWeight: 500,
                          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}
                      >
                        {isExpanded ? 'Collapse' : 'View Summary'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <PageBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} label="â† Prev" />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Page {page} of {totalPages}</span>
          <PageBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} label="Next â†’" />
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass" style={{ borderRadius: '10px', padding: '14px 16px' }}>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 700, color: '#e8e8e8' }}>{value}</p>
    </div>
  );
}

function SessionStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: '16px', fontWeight: 600, color: '#e8e8e8' }}>{value}</p>
    </div>
  );
}

function PageBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.05)', color: disabled ? 'rgba(255,255,255,0.2)' : '#e8e8e8',
      fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
    }}>{label}</button>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="glass" style={{ borderRadius: '12px', padding: '56px 32px', textAlign: 'center' }}>
      <p style={{ fontSize: '36px', marginBottom: '14px' }}>â–£</p>
      <p style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
        {hasFilter ? 'No sessions match this filter' : 'No sessions yet'}
      </p>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', maxWidth: '320px', margin: '0 auto 20px' }}>
        {hasFilter
          ? 'Try a different interview type filter.'
          : 'Download the ZoomGuru desktop app and start your first interview to see your history here.'}
      </p>
      {!hasFilter && (
        <a href="/download" style={{
          display: 'inline-block', padding: '10px 24px', borderRadius: '10px',
          background: '#fff', color: '#080808', fontSize: '14px', fontWeight: 600,
          textDecoration: 'none',
        }}>Download App</a>
      )}
    </div>
  );
}

