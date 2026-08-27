import {
  COMPETITORS,
  MONTHLY,
  NGN_PER_USD,
  PRICES_CHECKED,
  formatNaira,
  monthlyUsd,
  percentCheaperThan,
  timesOurPrice,
} from '@/lib/pricing';
import { SITE } from '@/lib/site';

/**
 * Three cards, ours first and dark so the eye lands there. A price claim is
 * only worth making if it can be checked, so each card carries the vendor's own
 * list price and the block below carries the date those were read. Everything
 * comes from lib/pricing.ts.
 */
export function ComparisonTable() {
  return (
    <div>
      <ul className="grid gap-5 md:grid-cols-3">
        <li className="relative overflow-hidden rounded-[var(--radius-card)] bg-ink p-8 text-paper shadow-[0_24px_60px_-32px_rgba(14,14,12,0.7)] md:p-9">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-signal">
            {SITE.name}
          </p>

          <p className="mt-7 font-display text-[2.75rem] leading-none tracking-[-0.03em]">
            {formatNaira(MONTHLY.price)}
          </p>
          <p className="mt-2.5 font-mono text-xs text-paper/55">
            about ${monthlyUsd} / month
          </p>

          <dl className="mt-7 space-y-2 border-t border-paper/15 pt-5 text-sm">
            <Row label="Plan" value="Unlimited, monthly" tone="dark" />
            <Row label="Metering" value="None" tone="dark" />
            <Row label="Computers" value={`${MONTHLY.seats} at a time`} tone="dark" />
          </dl>
        </li>

        {COMPETITORS.map((c) => (
          <li key={c.name} className="card p-8 md:p-9">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted">
              {c.name}
            </p>

            <p className="mt-7 font-display text-[2.75rem] leading-none tracking-[-0.03em] text-ink/75">
              ${c.usdPerMonth.toFixed(2)}
            </p>
            <p className="mt-2.5 font-mono text-xs text-muted">
              {timesOurPrice(c)}&times; our monthly price
            </p>

            <dl className="mt-7 space-y-2 border-t border-rule/60 pt-5 text-sm">
              <Row label="Plan" value={c.plan} />
              {/* percentCheaperThan is our discount against THEIR price, so it
                  has to be phrased from their price down, not from ours up. */}
              <Row
                label="Difference"
                value={`${percentCheaperThan(c)}% less with ${SITE.name}`}
              />
            </dl>
          </li>
        ))}
      </ul>

      <p className="mt-7 max-w-[74ch] font-mono text-[0.6875rem] leading-relaxed text-muted">
        List prices read from each vendor&rsquo;s own pricing page on {PRICES_CHECKED}. Both
        localise pricing by country and run promotions, so check theirs before relying on the
        gap. Naira converted at {formatNaira(NGN_PER_USD)} to the dollar for comparison only —
        you are charged in naira.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  tone = 'light',
}: {
  label: string;
  value: string;
  tone?: 'light' | 'dark';
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={`font-mono text-[0.625rem] uppercase tracking-[0.14em] ${tone === 'dark' ? 'text-paper/45' : 'text-muted'}`}>
        {label}
      </dt>
      <dd className={`text-right text-[0.8125rem] ${tone === 'dark' ? 'text-paper/85' : 'text-ink/80'}`}>
        {value}
      </dd>
    </div>
  );
}
