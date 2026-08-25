import { useState, useEffect, useRef, useCallback } from 'react';
import type { BroadcastRow, BroadcastCreatedRow, TargetFilter } from './types';
import {
  fetchBroadcasts,
  fetchRecipientCount,
  fetchBroadcastPreview,
  createBroadcast,
  cancelBroadcast,
  retryBroadcast,
} from './api';

// ── Design tokens (matching Dashboard) ─────────────────────────
// Mirrors the token block in Dashboard.tsx — the two pages share one surface,
// so they must share one palette. Change both together.
const C = {
  bg:      '#F7F4F0',
  card:    '#FFFFFF',
  border:  'rgba(23,20,17,0.07)',
  primary: '#26221F',
  secondary:'#6E6660',
  muted:   '#A69E97',
  shadow:  '0 1px 2px rgba(23,20,17,0.04), 0 10px 24px -12px rgba(23,20,17,0.12)',
};
const F = {
  heading: "'Cormorant Garamond', Georgia, serif",
  body:    "'Inter', system-ui, sans-serif",
};

// WAT = UTC+1
const WAT_OFFSET_MS = 60 * 60 * 1000;

function toWAT(utcIso: string): string {
  const d = new Date(new Date(utcIso).getTime() + WAT_OFFSET_MS);
  return d.toISOString().slice(0, 16).replace('T', ' ') + ' WAT';
}

function localToUtcIso(local: string): string {
  // local is "YYYY-MM-DDTHH:mm" in WAT — subtract 1h to get UTC
  const ms = new Date(local).getTime() - WAT_OFFSET_MS;
  return new Date(ms).toISOString();
}

function watNowDefault(): string {
  // Returns "YYYY-MM-DDTHH:mm" offset for WAT, suitable for datetime-local input
  const now = new Date(Date.now() + WAT_OFFSET_MS);
  return now.toISOString().slice(0, 16);
}

function statusColor(status: BroadcastRow['status']): string {
  switch (status) {
    case 'sent': return '#5C7F6B';
    case 'sending': return '#E2894A';
    case 'scheduled': return '#8C847D';
    case 'failed': return '#BE5540';
    case 'cancelled': return '#CFC8C1';
  }
}

function estimateDuration(count: number): string {
  const batches = Math.ceil(count / 50);
  if (batches <= 1) return 'under 1 minute';
  return `~${(batches - 1) * 3} minutes`;
}

interface Props {
  adminKey: string;
}

type Tab = 'compose' | 'history';

const PLAN_OPTIONS: Array<{ value: 'weekly' | 'monthly' | 'yearly'; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

interface ConfirmModal {
  subject: string;
  recipientCount: number;
  estimatedMinutes: number;
  filter: TargetFilter;
  scheduledAt: string | null;
  onConfirm: () => void;
}

export default function BroadcastPage({ adminKey }: Props) {
  const [tab, setTab] = useState<Tab>('compose');

  return (
    <div style={{ fontFamily: F.body }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {(['compose', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 22px',
              borderRadius: 10,
              border: 'none',
              background: tab === t ? C.primary : 'transparent',
              color: tab === t ? '#fff' : C.secondary,
              fontFamily: F.body,
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {t === 'compose' ? 'Compose' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'compose' && <ComposeTab adminKey={adminKey} />}
      {tab === 'history' && <HistoryTab adminKey={adminKey} />}
    </div>
  );
}

// ── Compose tab ─────────────────────────────────────────────────

function ComposeTab({ adminKey }: { adminKey: string }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [planFilter, setPlanFilter] = useState<Array<'weekly' | 'monthly' | 'yearly'>>([]);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState<string>(watNowDefault());
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState(0);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCount = useCallback(async (filter: TargetFilter) => {
    try {
      const res = await fetchRecipientCount(adminKey, filter);
      setRecipientCount(res.count);
      setEstimatedMinutes(res.estimatedMinutes);
    } catch {
      setRecipientCount(null);
    }
  }, [adminKey]);

  useEffect(() => {
    if (countTimerRef.current) clearTimeout(countTimerRef.current);
    const filter: TargetFilter = planFilter.length > 0 ? { plans: planFilter } : {};
    countTimerRef.current = setTimeout(() => void refreshCount(filter), 400);
    return () => { if (countTimerRef.current) clearTimeout(countTimerRef.current); };
  }, [planFilter, refreshCount]);

  function togglePlan(plan: 'weekly' | 'monthly' | 'yearly') {
    setPlanFilter((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan],
    );
  }

  async function handlePreview() {
    if (!body.trim()) return;
    try {
      const res = await fetchBroadcastPreview(adminKey, body);
      setPreviewHtml(res.html);
      setShowPreview(true);
    } catch {
      setError('Could not generate preview.');
    }
  }

  function handleSendClick() {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required.');
      return;
    }
    if (recipientCount === 0) {
      setError('No recipients match the selected filter.');
      return;
    }
    setError('');
    setConfirmModal({
      subject,
      recipientCount: recipientCount ?? 0,
      estimatedMinutes,
      filter: planFilter.length > 0 ? { plans: planFilter } : {},
      scheduledAt: scheduleMode === 'later' ? localToUtcIso(scheduledAt) : null,
      onConfirm: () => void doSend(),
    });
  }

  async function doSend() {
    setConfirmModal(null);
    setSending(true);
    setError('');
    try {
      const filter: TargetFilter = planFilter.length > 0 ? { plans: planFilter } : {};
      const payload = {
        subject,
        body,
        targetFilter: filter,
        scheduledAt: scheduleMode === 'later' ? localToUtcIso(scheduledAt) : undefined,
      };
      const result: BroadcastCreatedRow = await createBroadcast(adminKey, payload);
      const when = result.scheduled_at
        ? `Scheduled for ${toWAT(result.scheduled_at)}`
        : 'Queued for immediate send';
      setSuccessMsg(
        `${when}. ${result.recipient_count ?? 0} recipients across ${Math.ceil((result.recipient_count ?? 0) / 50)} batch(es).`,
      );
      setSubject('');
      setBody('');
      setPlanFilter([]);
      setScheduleMode('now');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send broadcast.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      {/* Left: compose form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {successMsg && (
          <Notice color="#5C7F6B" bg="rgba(92,127,107,0.07)" border="rgba(92,127,107,0.22)">
            {successMsg}
            <button onClick={() => setSuccessMsg('')} style={styles.noticeClose}>×</button>
          </Notice>
        )}
        {error && (
          <Notice color="#BE5540" bg="rgba(190,85,64,0.07)" border="rgba(190,85,64,0.20)">
            {error}
            <button onClick={() => setError('')} style={styles.noticeClose}>×</button>
          </Notice>
        )}

        {/* Subject */}
        <Field label="Subject">
          <input
            style={styles.input}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Your email subject line"
            maxLength={200}
          />
        </Field>

        {/* Body */}
        <Field label="Body (HTML)">
          <textarea
            style={{ ...styles.input, height: 220, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'<p>Hello,</p>\n<p>Your message here.</p>'}
          />
          <button
            onClick={() => void handlePreview()}
            disabled={!body.trim()}
            style={{ ...styles.btnGhost, marginTop: 8, alignSelf: 'flex-start' }}
          >
            Preview email →
          </button>
        </Field>

        {/* Targeting */}
        <Field label="Recipients">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.secondary }}>Filter by plan:</span>
              {PLAN_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => togglePlan(p.value)}
                  style={{
                    ...styles.pillBtn,
                    background: planFilter.includes(p.value) ? C.primary : 'transparent',
                    color: planFilter.includes(p.value) ? '#fff' : C.secondary,
                    borderColor: planFilter.includes(p.value) ? C.primary : 'rgba(0,0,0,0.12)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 13, color: C.muted }}>
              {recipientCount === null
                ? 'Counting…'
                : planFilter.length === 0
                ? `${recipientCount.toLocaleString()} total registered users`
                : `${recipientCount.toLocaleString()} active subscribers on selected plan(s)`}
            </div>
          </div>
        </Field>

        {/* Scheduling */}
        <Field label="Send timing">
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {(['now', 'later'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setScheduleMode(m)}
                style={{
                  ...styles.pillBtn,
                  background: scheduleMode === m ? C.primary : 'transparent',
                  color: scheduleMode === m ? '#fff' : C.secondary,
                  borderColor: scheduleMode === m ? C.primary : 'rgba(0,0,0,0.12)',
                }}
              >
                {m === 'now' ? 'Send immediately' : 'Schedule for later'}
              </button>
            ))}
          </div>
          {scheduleMode === 'later' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                type="datetime-local"
                style={styles.input}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <span style={{ fontSize: 11, color: C.muted }}>Time in WAT (UTC+1)</span>
            </div>
          )}
        </Field>

        {/* Estimated duration */}
        {recipientCount !== null && recipientCount > 0 && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(59,130,246,0.05)',
            border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 10,
            fontSize: 13,
            color: C.secondary,
          }}>
            {Math.ceil(recipientCount / 50)} batch{Math.ceil(recipientCount / 50) !== 1 ? 'es' : ''} · estimated delivery: {estimateDuration(recipientCount)}
          </div>
        )}

        <button
          onClick={handleSendClick}
          disabled={sending || !subject.trim() || !body.trim()}
          style={{
            ...styles.btnPrimary,
            opacity: sending || !subject.trim() || !body.trim() ? 0.5 : 1,
            cursor: sending || !subject.trim() || !body.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? 'Queueing…' : scheduleMode === 'later' ? 'Schedule broadcast' : 'Send broadcast'}
        </button>
      </div>

      {/* Right: live preview */}
      <div style={{
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        boxShadow: C.shadow,
        overflow: 'hidden',
        minHeight: 400,
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Email preview
          </span>
        </div>
        {showPreview && previewHtml ? (
          <iframe
            srcDoc={previewHtml}
            style={{ width: '100%', height: 600, border: 'none', display: 'block' }}
            sandbox="allow-same-origin"
            title="Email preview"
          />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 360, color: C.muted, fontSize: 13,
          }}>
            Click "Preview email →" to see how it looks
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmModal && (
        <ConfirmationModal
          modal={confirmModal}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

// ── History tab ─────────────────────────────────────────────────

function HistoryTab({ adminKey }: { adminKey: string }) {
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchBroadcasts(adminKey);
      setBroadcasts(rows);
    } catch {
      setError('Failed to load broadcast history.');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { void load(); }, [load]);

  async function handleCancel(id: string) {
    setActionId(id);
    try {
      await cancelBroadcast(adminKey, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed.');
    } finally {
      setActionId(null);
    }
  }

  async function handleRetry(id: string) {
    setActionId(id);
    try {
      await retryBroadcast(adminKey, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed.');
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, color: C.muted, fontSize: 13, textAlign: 'center' }}>Loading…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: C.muted }}>{broadcasts.length} broadcast{broadcasts.length !== 1 ? 's' : ''}</span>
        <button onClick={() => void load()} style={styles.btnGhost}>Refresh</button>
      </div>

      {error && (
        <Notice color="#BE5540" bg="rgba(190,85,64,0.07)" border="rgba(190,85,64,0.20)">
          {error}
        </Notice>
      )}

      {broadcasts.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: C.card,
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          color: C.muted,
          fontSize: 14,
        }}>
          No broadcasts yet. Use the Compose tab to send your first one.
        </div>
      ) : (
        <div style={{
          background: C.card,
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          boxShadow: C.shadow,
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{ ...styles.tableRow, background: 'rgba(0,0,0,0.02)', fontWeight: 600, color: C.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            <div style={{ flex: 3 }}>Subject</div>
            <div style={{ flex: 1 }}>Filter</div>
            <div style={{ flex: 1 }}>Recipients</div>
            <div style={{ flex: 1 }}>Opens</div>
            <div style={{ flex: 1 }}>Status</div>
            <div style={{ flex: 1.5 }}>Time (WAT)</div>
            <div style={{ flex: 1.2 }}>Actions</div>
          </div>

          {broadcasts.map((b, idx) => (
            <div
              key={b.id}
              style={{
                ...styles.tableRow,
                borderTop: idx === 0 ? 'none' : `1px solid ${C.border}`,
                fontSize: 13,
              }}
            >
              <div style={{ flex: 3, color: C.primary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
                {b.subject}
              </div>
              <div style={{ flex: 1, color: C.secondary, fontSize: 12 }}>
                {filterLabel(b.target_filter)}
              </div>
              <div style={{ flex: 1, color: C.secondary, fontVariantNumeric: 'tabular-nums' }}>
                {b.recipient_count?.toLocaleString() ?? '—'}
              </div>
              <div style={{ flex: 1, color: C.secondary, fontVariantNumeric: 'tabular-nums' }}>
                {b.open_count > 0 ? (
                  <span>
                    {b.open_count.toLocaleString()}
                    {b.recipient_count ? (
                      <span style={{ color: C.muted, marginLeft: 4 }}>
                        ({Math.round((b.open_count / b.recipient_count) * 100)}%)
                      </span>
                    ) : null}
                  </span>
                ) : '—'}
              </div>
              <div style={{ flex: 1 }}>
                <StatusBadge status={b.status} />
              </div>
              <div style={{ flex: 1.5, color: C.muted, fontSize: 12 }}>
                {b.sent_at
                  ? toWAT(b.sent_at)
                  : b.scheduled_at
                  ? toWAT(b.scheduled_at)
                  : '—'}
              </div>
              <div style={{ flex: 1.2, display: 'flex', gap: 6 }}>
                {(b.status === 'scheduled' || b.status === 'sending') && (
                  <button
                    onClick={() => void handleCancel(b.id)}
                    disabled={actionId === b.id}
                    style={{ ...styles.actionBtn, color: '#BE5540', borderColor: 'rgba(190,85,64,0.30)' }}
                  >
                    {actionId === b.id ? '…' : 'Cancel'}
                  </button>
                )}
                {b.status === 'failed' && (
                  <button
                    onClick={() => void handleRetry(b.id)}
                    disabled={actionId === b.id}
                    style={{ ...styles.actionBtn, color: '#E2894A', borderColor: 'rgba(226,137,74,0.32)' }}
                  >
                    {actionId === b.id ? '…' : 'Retry'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Confirmation modal ──────────────────────────────────────────

function ConfirmationModal({
  modal,
  onCancel,
}: {
  modal: ConfirmModal;
  onCancel: () => void;
}) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <h2 style={{ fontFamily: F.heading, fontSize: 26, fontWeight: 700, fontStyle: 'italic', margin: '0 0 20px', color: C.primary }}>
          Confirm broadcast
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <Row label="Subject" value={modal.subject} />
          <Row label="Recipients" value={`${modal.recipientCount.toLocaleString()} users`} />
          <Row label="Filter" value={filterLabel(modal.filter)} />
          <Row label="Est. delivery" value={estimateDuration(modal.recipientCount)} />
          {modal.scheduledAt && (
            <Row label="Scheduled for" value={toWAT(modal.scheduledAt)} />
          )}
          {!modal.scheduledAt && (
            <Row label="Timing" value="Immediate" />
          )}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCancel} style={{ ...styles.btnGhost, flex: 1 }}>
            Cancel
          </button>
          <button onClick={modal.onConfirm} style={{ ...styles.btnPrimary, flex: 2 }}>
            Confirm &amp; Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ───────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Notice({ color, bg, border, children }: {
  color: string; bg: string; border: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 10,
      padding: '11px 15px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', fontSize: 13, color,
    }}>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
      <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 13, color: C.primary, fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: BroadcastRow['status'] }) {
  const color = statusColor(status);
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'capitalize',
      background: `${color}18`,
      color,
      border: `1px solid ${color}30`,
    }}>
      {status}
    </span>
  );
}

function filterLabel(filter: TargetFilter): string {
  if (!filter.plans || filter.plans.length === 0) return 'All users';
  return filter.plans.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
}

// ── Styles ──────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  input: {
    display: 'block',
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(0,0,0,0.03)',
    border: '1.5px solid rgba(0,0,0,0.09)',
    borderRadius: 12,
    fontFamily: F.body,
    fontSize: 14,
    color: C.primary,
    boxSizing: 'border-box',
    outline: 'none',
  },
  btnPrimary: {
    padding: '13px 24px',
    background: C.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontFamily: F.body,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '8px 16px',
    background: 'transparent',
    color: C.secondary,
    border: '1.5px solid rgba(0,0,0,0.1)',
    borderRadius: 10,
    fontFamily: F.body,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  pillBtn: {
    padding: '6px 14px',
    borderRadius: 20,
    border: '1.5px solid',
    fontFamily: F.body,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  actionBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: '1px solid',
    borderRadius: 6,
    fontFamily: F.body,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  noticeClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
    color: 'inherit',
    opacity: 0.6,
    padding: '0 4px',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '13px 20px',
    gap: 8,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modalCard: {
    background: '#fff',
    borderRadius: 20,
    padding: '36px 36px 32px',
    width: '100%',
    maxWidth: 460,
    boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
  },
};
