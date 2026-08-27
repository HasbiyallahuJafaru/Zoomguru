import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { BroadcastRow, BroadcastCreatedRow, TargetFilter } from './types';
import {
  fetchBroadcasts,
  fetchRecipientCount,
  fetchBroadcastPreview,
  createBroadcast,
  cancelBroadcast,
  retryBroadcast,
} from './api';
import { SERIES, STATUS, Badge, Notice, Skel, Segmented, LedgerCard } from './ui';

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

/** Broadcast state is a lifecycle, not a series, so it draws from the reserved
 *  status colours plus two neutrals — never from the chart palette. */
function statusTone(status: BroadcastRow['status']): string {
  switch (status) {
    case 'sent': return STATUS.good;
    case 'sending': return SERIES[1];
    case 'scheduled': return SERIES[0];
    case 'failed': return STATUS.bad;
    case 'cancelled': return '#6e6e78';
  }
}

function estimateDuration(count: number): string {
  const batches = Math.ceil(count / 50);
  if (batches <= 1) return 'under a minute';
  const mins = (batches - 1) * 3;
  if (mins < 90) return `about ${mins} minutes`;
  const hours = Math.round(mins / 30) / 2;
  return `about ${hours} hour${hours === 1 ? '' : 's'}`;
}

function filterLabel(filter: TargetFilter): string {
  if (!filter.plans || filter.plans.length === 0) return 'All users';
  return filter.plans.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
}

interface Props {
  adminKey: string;
}

type Tab = 'compose' | 'history';

const TAB_OPTIONS = [
  { value: 'compose' as const, label: 'Compose' },
  { value: 'history' as const, label: 'History' },
];

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
    <div>
      <div className="mb-8 flex justify-start">
        <Segmented options={TAB_OPTIONS} value={tab} onChange={setTab} label="Broadcast view" />
      </div>

      {tab === 'compose' ? <ComposeTab adminKey={adminKey} /> : <HistoryTab adminKey={adminKey} />}
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
      setError('Could not build the preview.');
    }
  }

  function handleSendClick() {
    if (!subject.trim() || !body.trim()) {
      setError('Add a subject and a body before sending.');
      return;
    }
    if (recipientCount === 0) {
      setError('No one matches this filter. Widen it, then send.');
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
        : 'Queued to send now';
      setSuccessMsg(
        `${when}. ${result.recipient_count ?? 0} recipients across ${Math.ceil((result.recipient_count ?? 0) / 50)} batch(es).`,
      );
      setSubject('');
      setBody('');
      setPlanFilter([]);
      setScheduleMode('now');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The broadcast could not be queued.');
    } finally {
      setSending(false);
    }
  }

  const batches = recipientCount === null ? 0 : Math.ceil(recipientCount / 50);
  const blocked = sending || !subject.trim() || !body.trim();

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      {/* Left: the draft */}
      <div className="card p-6 md:p-7">
        <div className="flex flex-col gap-6">
          {successMsg && (
            <Notice tone={STATUS.good} onClose={() => setSuccessMsg('')}>{successMsg}</Notice>
          )}
          {error && (
            <Notice tone={STATUS.bad} onClose={() => setError('')}>{error}</Notice>
          )}

          <Field label="Subject" htmlFor="bc-subject">
            <input
              id="bc-subject"
              className="field-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What the email is about"
              maxLength={200}
            />
          </Field>

          <Field label="Body" htmlFor="bc-body" hint="HTML. Everything else in the email is added by the template.">
            <textarea
              id="bc-body"
              className="field-input h-56 resize-y font-mono text-[0.8125rem] leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'<p>Hello,</p>\n<p>Your message here.</p>'}
            />
            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={!body.trim()}
              className="btn btn-outline btn-sm mt-3 self-start"
            >
              Build preview
            </button>
          </Field>

          <Field label="Recipients">
            <div className="flex flex-wrap gap-2">
              {PLAN_OPTIONS.map((p) => {
                const on = planFilter.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePlan(p.value)}
                    className={`btn btn-sm ${on ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[0.8125rem] text-muted">
              {recipientCount === null
                ? 'Counting…'
                : planFilter.length === 0
                  ? `${recipientCount.toLocaleString()} registered users. Pick a plan to narrow this.`
                  : `${recipientCount.toLocaleString()} active subscribers on the selected plan(s).`}
            </p>
          </Field>

          <Field label="Timing">
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'now' as const, label: 'Send now' },
                { value: 'later' as const, label: 'Schedule' },
              ]).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={scheduleMode === m.value}
                  onClick={() => setScheduleMode(m.value)}
                  className={`btn btn-sm ${scheduleMode === m.value ? 'btn-primary' : 'btn-outline'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {scheduleMode === 'later' && (
              <div className="mt-3">
                <input
                  type="datetime-local"
                  aria-label="Send at (WAT)"
                  className="field-input"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="mt-2 text-[0.75rem] text-muted">Times are WAT (UTC+1).</p>
              </div>
            )}
          </Field>

          {recipientCount !== null && recipientCount > 0 && (
            <p className="label border-t border-rule/60 pt-5">
              {batches} batch{batches !== 1 ? 'es' : ''} · delivery takes {estimateDuration(recipientCount)}
            </p>
          )}

          <button
            type="button"
            onClick={handleSendClick}
            disabled={blocked}
            className="btn btn-primary w-full !py-3.5"
          >
            {sending ? 'Queueing…' : scheduleMode === 'later' ? 'Schedule broadcast' : 'Send broadcast'}
          </button>
        </div>
      </div>

      {/* Right: what lands in the inbox */}
      <div className="card xl:sticky xl:top-24">
        <div className="border-b border-rule/60 px-5 py-4">
          <p className="label">Inbox preview</p>
        </div>
        {showPreview && previewHtml ? (
          <iframe
            srcDoc={previewHtml}
            className="block h-[38rem] w-full border-0 bg-paper"
            sandbox="allow-same-origin"
            title="Email preview"
          />
        ) : (
          <div className="flex h-[24rem] flex-col items-center justify-center gap-2 px-8 text-center">
            <p className="text-[0.9375rem] text-ink">Nothing to preview yet</p>
            <p className="max-w-[32ch] text-[0.8125rem] text-muted">
              Write the body, then choose Build preview to see the email exactly as it will arrive.
            </p>
          </div>
        )}
      </div>

      {confirmModal && (
        <ConfirmationModal modal={confirmModal} onCancel={() => setConfirmModal(null)} />
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
      setError('Could not load the broadcast history.');
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
      setError(err instanceof Error ? err.message : 'The broadcast could not be cancelled.');
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
      setError(err instanceof Error ? err.message : 'The broadcast could not be retried.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice tone={STATUS.bad} onClose={() => setError('')}>{error}</Notice>}

      <LedgerCard
        title="Sent and scheduled"
        caption={loading ? 'Loading…' : `${broadcasts.length} broadcast${broadcasts.length !== 1 ? 's' : ''}`}
        footer={
          <button type="button" onClick={() => void load()} className="btn btn-outline btn-sm">
            Refresh
          </button>
        }
      >
        {loading ? (
          <div className="p-5"><Skel h={140} /></div>
        ) : broadcasts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-8 py-14 text-center">
            <p className="text-[0.9375rem] text-ink">No broadcasts yet</p>
            <p className="max-w-[34ch] text-[0.8125rem] text-muted">
              Write one in Compose. Everything you send shows up here with its open rate.
            </p>
          </div>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Sent to</th>
                <th className="num">Recipients</th>
                <th className="num">Opens</th>
                <th>Status</th>
                <th>Time (WAT)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => (
                <tr key={b.id}>
                  <td className="max-w-[22rem] truncate font-medium text-ink">{b.subject}</td>
                  <td className="text-muted">{filterLabel(b.target_filter)}</td>
                  <td className="num text-muted">{b.recipient_count?.toLocaleString() ?? '—'}</td>
                  <td className="num">
                    {b.open_count > 0 ? (
                      <span className="figure text-ink">
                        {b.open_count.toLocaleString()}
                        {b.recipient_count ? (
                          <span className="ml-1.5 text-muted">
                            {Math.round((b.open_count / b.recipient_count) * 100)}%
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-rule">—</span>
                    )}
                  </td>
                  <td><Badge tone={statusTone(b.status)}>{b.status}</Badge></td>
                  <td className="font-mono text-[0.75rem] text-muted">
                    {b.sent_at ? toWAT(b.sent_at) : b.scheduled_at ? toWAT(b.scheduled_at) : '—'}
                  </td>
                  <td>
                    {(b.status === 'scheduled' || b.status === 'sending') && (
                      <button
                        type="button"
                        onClick={() => void handleCancel(b.id)}
                        disabled={actionId === b.id}
                        className="btn btn-danger btn-sm"
                      >
                        {actionId === b.id ? '…' : 'Cancel'}
                      </button>
                    )}
                    {b.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => void handleRetry(b.id)}
                        disabled={actionId === b.id}
                        className="btn btn-outline btn-sm"
                      >
                        {actionId === b.id ? '…' : 'Retry'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </LedgerCard>
    </div>
  );
}

// ── Confirmation ────────────────────────────────────────────────

/** The last stop before real email reaches real people, so it restates every
 *  decision rather than asking "are you sure?". */
function ConfirmationModal({
  modal,
  onCancel,
}: {
  modal: ConfirmModal;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-ink/35 p-5 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="overlay-panel rise w-full max-w-[28rem] p-8"
      >
        <p className="label">Before it goes out</p>
        <h2 id="confirm-title" className="mt-2.5 text-sub">Send this broadcast?</h2>

        <dl className="my-7 flex flex-col">
          <Row label="Subject" value={modal.subject} />
          <Row label="Recipients" value={`${modal.recipientCount.toLocaleString()} people`} />
          <Row label="Sent to" value={filterLabel(modal.filter)} />
          <Row label="Delivery takes" value={estimateDuration(modal.recipientCount)} />
          <Row
            label={modal.scheduledAt ? 'Scheduled for' : 'Timing'}
            value={modal.scheduledAt ? toWAT(modal.scheduledAt) : 'Immediately'}
          />
        </dl>

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">
            Back to draft
          </button>
          <button type="button" onClick={modal.onConfirm} className="btn btn-primary flex-[2]" autoFocus>
            Send broadcast
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small parts ─────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {hint && <p className="mt-1.5 text-[0.75rem] text-muted">{hint}</p>}
      <div className="mt-2.5 flex flex-col">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-rule/50 py-2.5 last:border-b-0">
      <dt className="label shrink-0">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-[0.875rem] font-medium text-ink">{value}</dd>
    </div>
  );
}
