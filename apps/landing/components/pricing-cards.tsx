'use client';

import { useState } from 'react';
import { INCLUDED, PLANS, formatNaira, type PlanId } from '@/lib/pricing';

/**
 * Cards you can actually operate: pick a plan and the card takes over, showing
 * what that plan costs per week so three different billing periods can be
 * compared honestly. Selection is local — buying happens inside the app.
 */
export function PricingCards() {
  const [selected, setSelected] = useState<PlanId>('monthly');

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => {
          const active = plan.id === selected;

          return (
            <button
              key={plan.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(plan.id)}
              className={`group relative rounded-[var(--radius-card)] p-8 text-left transition-all duration-400 md:p-10 ${
                active
                  ? '-translate-y-1 bg-ink text-paper shadow-[0_24px_60px_-32px_rgba(14,14,12,0.7)]'
                  : 'card card-hover text-ink'
              }`}
            >
              {plan.featured && (
                <span
                  className={`absolute right-6 top-8 font-mono text-[0.625rem] uppercase tracking-[0.16em] ${
                    active ? 'text-signal' : 'text-overlay'
                  }`}
                >
                  Most picked
                </span>
              )}

              <h3 className={`text-2xl ${active ? 'text-paper' : ''}`}>{plan.name}</h3>

              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="font-display text-4xl tracking-[-0.03em]">
                  {formatNaira(plan.price)}
                </span>
                <span className={`font-mono text-xs ${active ? 'text-paper/60' : 'text-muted'}`}>
                  / {plan.period}
                </span>
              </p>

              <p
                className={`mt-5 border-t pt-5 text-[0.9375rem] ${
                  active ? 'border-paper/20 text-paper/75' : 'border-rule text-muted'
                }`}
              >
                {plan.fit}
              </p>

              <p className="mt-5 flex items-center gap-2 font-mono text-xs">
                <span className={active ? 'text-signal' : 'text-overlay'}>
                  {plan.seats === 1 ? '1 computer' : '2 computers'}
                </span>
                <span className={active ? 'text-paper/50' : 'text-muted'}>at a time</span>
              </p>

              {plan.note && (
                <p
                  className={`mt-3 font-mono text-[0.6875rem] ${
                    active ? 'text-paper/50' : 'text-muted'
                  }`}
                >
                  {plan.note}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="card mt-5 p-8 md:p-10">
        <h3 className="label">In every plan</h3>
        <ul className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-3 text-[0.9375rem]">
              <span aria-hidden="true" className="mt-[0.45em] block h-px w-4 shrink-0 bg-overlay" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
