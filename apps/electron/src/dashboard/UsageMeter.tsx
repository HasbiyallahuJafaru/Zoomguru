import type { CSSProperties } from 'react';

const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

interface FeatureUsage {
  used: number;
  limit: number;
  resetAt: string;
}

interface UsageMeterProps {
  label: string;
  data: FeatureUsage | null;
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export default function UsageMeter({ label, data }: UsageMeterProps) {
  const used = data?.used ?? 0;
  const limit = data?.limit ?? 1;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const days = data?.resetAt ? daysUntil(data.resetAt) : null;

  const barColor =
    pct >= 100
      ? 'rgba(248,113,113,0.75)'
      : pct >= 80
      ? 'rgba(251,191,36,0.75)'
      : 'rgba(99,179,237,0.75)';

  return (
    <div style={s.row}>
      <div style={s.top}>
        <span style={s.label}>{label}</span>
        <span style={s.count}>
          {used} / {limit}
          {days !== null && (
            <span style={s.reset}> · resets in {days}d</span>
          )}
        </span>
      </div>
      <div style={s.track}>
        <div style={{ ...s.fill, width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.40)',
    fontFamily: SANS,
    letterSpacing: '0.1px',
  },
  count: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: SANS,
    fontVariantNumeric: 'tabular-nums',
  },
  reset: {
    color: 'rgba(255,255,255,0.22)',
  },
  track: {
    height: '3px',
    background: 'rgba(255,255,255,0.07)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 400ms ease',
  },
};
