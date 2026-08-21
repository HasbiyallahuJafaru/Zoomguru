import type { CSSProperties } from 'react';
import type { QAEntry } from './InterviewerSession';
import { API_URL } from '../utils';

interface PerAnswerScore {
  questionNumber: number;
  question: string;
  score: number;
  assessment: string;
}

export interface ScorerReport {
  overallScore: number;
  answers: PerAnswerScore[];
  strengths: string[];
  improvements: string[];
  nextFocus: string;
}

interface Props {
  report: ScorerReport;
  onTryAgain: () => void;
  onDone: () => void;
}

const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

function scoreColor(score: number): string {
  if (score >= 80) return 'rgba(52,211,153,0.90)';
  if (score >= 60) return 'rgba(251,191,36,0.90)';
  return 'rgba(248,113,113,0.90)';
}

function scoreBarColor(score: number): string {
  if (score >= 80) return 'rgba(52,211,153,0.55)';
  if (score >= 60) return 'rgba(251,191,36,0.55)';
  return 'rgba(248,113,113,0.55)';
}

export async function fetchReport(
  entries: QAEntry[],
): Promise<ScorerReport> {
  const token = await window.zoomguru.getToken();
  let userId = '';
  try { userId = (JSON.parse(atob(token.split('.')[1])) as { sub?: string }).sub ?? ''; } catch { /* ignore */ }
  const sig = await window.zoomguru.signRequest(userId);
  const res = await fetch(`${API_URL}/ai/score-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Key-ID': sig.keyId,
      'X-Timestamp': String(sig.timestamp),
      'X-Signature': sig.signature,
    },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) throw new Error(`Score session failed: ${res.status}`);
  return res.json() as Promise<ScorerReport>;
}

export default function InterviewerReport({ report, onTryAgain, onDone }: Props) {
  const { overallScore, strengths, improvements, nextFocus, answers } = report;

  return (
    <>
      <style>{`
        .zg-primary:hover:not(:disabled) { opacity: 0.90; }
        .zg-ghost:hover { color: rgba(255,255,255,0.45) !important; }
      `}</style>
      <div style={s.root}>
        <div style={s.content}>
          {/* Score */}
          <div style={s.scoreSection}>
            <span style={{ ...s.scoreNumber, color: scoreColor(overallScore) }}>
              {overallScore}
            </span>
            <span style={s.scoreOutOf}>/100</span>
          </div>

          {/* Strengths */}
          {strengths.length > 0 && (
            <div style={s.feedbackCard}>
              <span style={{ ...s.feedbackTitle, color: 'rgba(52,211,153,0.75)' }}>Strengths</span>
              {strengths.map((s_, i) => (
                <span key={i} style={s.feedbackItem}>{s_}</span>
              ))}
            </div>
          )}

          {/* Improvements */}
          {improvements.length > 0 && (
            <div style={s.feedbackCard}>
              <span style={{ ...s.feedbackTitle, color: 'rgba(251,191,36,0.75)' }}>Areas to Improve</span>
              {improvements.map((s_, i) => (
                <span key={i} style={s.feedbackItem}>{s_}</span>
              ))}
            </div>
          )}

          {/* Next Focus */}
          {nextFocus && (
            <div style={s.nextFocusCard}>
              <span style={s.nextFocusLabel}>Next Focus</span>
              <span style={s.nextFocusText}>{nextFocus}</span>
            </div>
          )}

          {/* Per-question breakdown */}
          <div style={s.breakdownSection}>
            <span style={s.breakdownTitle}>Question Breakdown</span>
            <div style={s.breakdownList}>
              {answers.map((a) => (
                <div key={a.questionNumber} style={s.breakdownItem}>
                  <div style={s.breakdownRow}>
                    <span style={s.breakdownQNum}>Q{a.questionNumber}</span>
                    <div style={s.breakdownBar}>
                      <div style={{ ...s.breakdownBarFill, width: `${a.score}%`, background: scoreBarColor(a.score) }} />
                    </div>
                    <span style={{ ...s.breakdownScore, color: scoreColor(a.score) }}>{a.score}</span>
                  </div>
                  <p style={s.breakdownAssessment}>{a.assessment}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={s.actions}>
            <button
              className="zg-primary"
              style={s.tryAgainBtn}
              onClick={onTryAgain}
            >
              Try Again
            </button>
            <button
              className="zg-primary"
              style={s.doneBtn}
              onClick={onDone}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(7, 7, 11, 0.97)',
    borderRadius: '16px',
    fontFamily: SANS,
  },
  content: {
    width: '100%',
    maxWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
    paddingBottom: '8px',
    WebkitAppRegion: 'no-drag' as unknown as undefined,
  },
  scoreSection: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '4px',
    padding: '8px 0 4px',
  },
  scoreNumber: {
    fontSize: '64px',
    fontWeight: 700,
    lineHeight: '1',
    fontFamily: SANS,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-2px',
  },
  scoreOutOf: {
    fontSize: '18px',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: SANS,
  },
  feedbackCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px 14px',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.02)',
  },
  feedbackTitle: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.4px',
    textTransform: 'uppercase' as const,
    fontFamily: SANS,
    marginBottom: '2px',
  },
  feedbackItem: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.60)',
    fontFamily: SANS,
    lineHeight: '1.5',
    paddingLeft: '10px',
    position: 'relative' as const,
  },
  nextFocusCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px 14px',
    border: '1px solid rgba(99,102,241,0.18)',
    borderRadius: '8px',
    background: 'rgba(99,102,241,0.04)',
  },
  nextFocusLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(139,92,246,0.75)',
    letterSpacing: '0.4px',
    textTransform: 'uppercase' as const,
    fontFamily: SANS,
  },
  nextFocusText: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.60)',
    fontFamily: SANS,
    lineHeight: '1.5',
  },
  breakdownSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  breakdownTitle: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: '0.4px',
    textTransform: 'uppercase' as const,
    fontFamily: SANS,
  },
  breakdownList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  breakdownItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '6px',
  },
  breakdownRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  breakdownQNum: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: SANS,
    width: '22px',
    flexShrink: 0,
  },
  breakdownBar: {
    flex: 1,
    height: '4px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 600ms ease',
  },
  breakdownScore: {
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: SANS,
    width: '24px',
    textAlign: 'right' as const,
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  breakdownAssessment: {
    margin: 0,
    fontSize: '10px',
    color: 'rgba(255,255,255,0.40)',
    fontFamily: SANS,
    lineHeight: '1.4',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    paddingTop: '4px',
  },
  tryAgainBtn: {
    flex: 1,
    padding: '10px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.60)',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: SANS,
    cursor: 'pointer',
    transition: 'opacity 120ms ease',
    textAlign: 'center' as const,
  },
  doneBtn: {
    flex: 1,
    padding: '10px',
    background: 'rgba(255,255,255,0.92)',
    border: 'none',
    borderRadius: '6px',
    color: '#07070b',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: SANS,
    cursor: 'pointer',
    transition: 'opacity 120ms ease',
    textAlign: 'center' as const,
  },
};
