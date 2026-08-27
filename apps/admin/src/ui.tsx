import type { ReactNode } from 'react';

// ── Palette ────────────────────────────────────────────────────
// Hex duplicated from the @theme block in index.css because Recharts wants
// real colour values, not CSS custom properties, for its SVG fills. index.css
// is the source of truth — change it there first, then mirror here.

/** Chart series, in fixed order. Assign by position; never cycle, never
 *  reorder. Slot 3 and slot 5 collide under deuteranopia, and the only thing
 *  keeping them safe is that the fixed order never places them side by side. */
export const SERIES = ['#1b2ed6', '#ff4a1c', '#00897d', '#a8801f', '#b0407a', '#8b7ae8'] as const;

/** Reserved. Never used as a series colour, and never the only signal — every
 *  use ships with a word, because green/red collapses under deuteranopia. */
export const STATUS = { good: '#16794a', bad: '#b3261e' } as const;

const MUTED = '#6e6e78';
const RULE = '#d8d8dd';
const PAPER = '#ffffff';

// ── Chart config ───────────────────────────────────────────────

export const AXIS = {
  tick: { fill: MUTED, fontSize: 10, fontFamily: '"DM Mono", monospace' },
  axisLine: false,
  tickLine: false,
} as const;

export const GRID = { stroke: RULE, strokeOpacity: 0.55, vertical: false } as const;

/** A paper hairline around each fill, so stacked segments are separated by the
 *  surface rather than touching. Deliberately 1px, not the 2px a wide bar would
 *  take: a 90-day window compresses these bars to a few pixels, and a 2px stroke
 *  on each side would leave more surface than bar. */
export const SEGMENT_GAP = { stroke: PAPER, strokeWidth: 1 } as const;

interface TooltipPayload {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/** Named series, tabular values, paper surface. Replaces the Recharts default,
 *  which sets everything in the browser font at the browser size. */
export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3.5 py-3 shadow-[0_18px_44px_-24px_rgba(14,14,12,0.45)]">
      <p className="label mb-2">{label}</p>
      <div className="flex flex-col gap-1.5">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-baseline justify-between gap-6 text-[0.8125rem]">
            <span className="flex items-center gap-2 text-muted">
              <span
                aria-hidden
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ background: p.color }}
              />
              {p.name}
            </span>
            <span className="figure font-medium text-ink">
              {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const TOOLTIP_CURSOR = { fill: 'rgba(27,46,214,0.05)' } as const;

// ── Type ───────────────────────────────────────────────────────

const WONK = { fontVariationSettings: '"SOFT" 0, "WONK" 1, "opsz" 144' };

/** Type, not a bitmap — the same wordmark the marketing site sets. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-display text-[1.35rem] leading-none tracking-[-0.03em] text-ink ${className}`}
      style={WONK}
    >
      Zoom<em className="not-italic text-overlay">Guru</em>
    </span>
  );
}

/** Every section opens the same way: a mono department line, a serif headline,
 *  then a rule. The repetition is what makes a long scrolling page scannable. */
export function SectionHead({
  eyebrow,
  title,
  aside,
  className = '',
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="label">{eyebrow}</p>
          <h2 className="mt-2 text-sub">{title}</h2>
        </div>
        {aside}
      </div>
      <hr className="mt-4 border-0 border-t border-rule" />
    </div>
  );
}

// ── Surfaces ───────────────────────────────────────────────────

/** A chart in a card. `series` draws the legend in the header, where identity
 *  is read before the plot rather than after it. One-series charts pass none —
 *  the title already names the line. */
export function ChartCard({
  title,
  series,
  children,
  delay = 0,
}: {
  title: string;
  series?: ReadonlyArray<{ name: string; color: string }>;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <div className="card rise" style={{ '--d': `${delay}ms` } as React.CSSProperties}>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-rule/60 px-5 py-4">
        <p className="label">{title}</p>
        {series && (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {series.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5 font-mono text-[0.6875rem] text-muted">
                <span
                  aria-hidden
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="px-2 py-5 pr-4">{children}</div>
    </div>
  );
}

/** A table in a card, with the same head as a chart card. */
export function LedgerCard({
  title,
  caption,
  children,
  footer,
  delay = 0,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  footer?: ReactNode;
  delay?: number;
}) {
  return (
    <div className="card rise" style={{ '--d': `${delay}ms` } as React.CSSProperties}>
      <div className="border-b border-rule/60 px-5 py-4">
        <p className="label">{title}</p>
        {caption && <p className="mt-1.5 text-[0.8125rem] text-muted">{caption}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
      {footer && <div className="border-t border-rule/60 px-5 py-4">{footer}</div>}
    </div>
  );
}

// ── Small parts ────────────────────────────────────────────────

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className="badge" style={{ '--tone': tone } as React.CSSProperties}>
      {children}
    </span>
  );
}

export function Notice({
  tone,
  onClose,
  children,
}: {
  tone: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <div role="status" className="notice" style={{ '--tone': tone } as React.CSSProperties}>
      <span>{children}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="-my-1 shrink-0 cursor-pointer px-1 text-lg leading-none opacity-60 hover:opacity-100"
        >
          &times;
        </button>
      )}
    </div>
  );
}

export function Skel({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return <div className="skeleton" style={{ width: w, height: h }} />;
}

/** An em dash carries "no value here" everywhere on the page. */
export function Empty() {
  return <span className="text-rule">&mdash;</span>;
}

/** Segmented control. Options are always few and always visible, which beats a
 *  select for something you switch between constantly. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className="seg-item"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
