// Surgical unit tests for admin analytics pure logic
// No DB — tests the computations that admin.service.ts performs on query results

// ── revenue KPI calculations ──────────────────────────────────────────────────

function buildKPIs(raw: {
  mrr: string | number;
  total_revenue: string | number;
  net_revenue: string | number;
  arpu: string | number;
  ltv: string | number;
}) {
  const mrr = Number(raw.mrr);
  return {
    mrr,
    arr: mrr * 12,
    totalRevenue: Number(raw.total_revenue),
    netRevenue: Number(raw.net_revenue),
    arpu: Number(raw.arpu),
    ltv: Number(raw.ltv),
  };
}

describe('buildKPIs', () => {
  it('converts string DB values to numbers', () => {
    const kpis = buildKPIs({ mrr: '150000', total_revenue: '900000', net_revenue: '870000', arpu: '15000', ltv: '14500' });
    expect(kpis.mrr).toBe(150000);
    expect(typeof kpis.mrr).toBe('number');
  });

  it('calculates ARR as MRR × 12', () => {
    const kpis = buildKPIs({ mrr: '150000', total_revenue: '0', net_revenue: '0', arpu: '0', ltv: '0' });
    expect(kpis.arr).toBe(1800000);
  });

  it('handles zero MRR', () => {
    const kpis = buildKPIs({ mrr: 0, total_revenue: 0, net_revenue: 0, arpu: 0, ltv: 0 });
    expect(kpis.arr).toBe(0);
  });

  it('preserves total_revenue separately from net_revenue', () => {
    const kpis = buildKPIs({ mrr: 0, total_revenue: '100000', net_revenue: '98500', arpu: '0', ltv: '0' });
    expect(kpis.totalRevenue).toBe(100000);
    expect(kpis.netRevenue).toBe(98500);
  });
});

// ── plan breakdown type-key normalisation ─────────────────────────────────────

function normalisePlanKey(currency: string, plan: string): string {
  return `${currency.toUpperCase()} ${plan.charAt(0).toUpperCase() + plan.slice(1)}`;
}

describe('normalisePlanKey', () => {
  it('produces correct key for NGN monthly', () => {
    expect(normalisePlanKey('ngn', 'monthly')).toBe('NGN Monthly');
  });

  it('produces correct key for USD lifetime', () => {
    expect(normalisePlanKey('usd', 'lifetime')).toBe('USD Lifetime');
  });

  it('handles already-uppercase currency', () => {
    expect(normalisePlanKey('NGN', 'monthly')).toBe('NGN Monthly');
  });
});

// ── cohort retention colour coding ───────────────────────────────────────────

function retentionColor(pct: number | null | undefined): string {
  if (pct == null) return '#f8fafc';
  const v = Number(pct);
  if (v >= 0.8) return '#dcfce7';   // green
  if (v >= 0.5) return '#fef9c3';   // amber
  return '#fee2e2';                  // red
}

describe('retentionColor', () => {
  it('returns green for 100% retention', () => {
    expect(retentionColor(1.0)).toBe('#dcfce7');
  });

  it('returns green for exactly 80%', () => {
    expect(retentionColor(0.8)).toBe('#dcfce7');
  });

  it('returns amber for 79%', () => {
    expect(retentionColor(0.79)).toBe('#fef9c3');
  });

  it('returns amber for exactly 50%', () => {
    expect(retentionColor(0.5)).toBe('#fef9c3');
  });

  it('returns red for 49%', () => {
    expect(retentionColor(0.49)).toBe('#fee2e2');
  });

  it('returns red for 0%', () => {
    expect(retentionColor(0)).toBe('#fee2e2');
  });

  it('returns neutral for null (no data)', () => {
    expect(retentionColor(null)).toBe('#f8fafc');
  });

  it('returns neutral for undefined', () => {
    expect(retentionColor(undefined)).toBe('#f8fafc');
  });
});

// ── hourly usage peak detection ───────────────────────────────────────────────

function getTopHours(hourlyData: { hour: number; avg_sessions: number }[], n = 3): number[] {
  return [...hourlyData]
    .sort((a, b) => b.avg_sessions - a.avg_sessions)
    .slice(0, n)
    .map(r => r.hour);
}

describe('getTopHours', () => {
  const data = [
    { hour: 0, avg_sessions: 1 },
    { hour: 9, avg_sessions: 45 },
    { hour: 10, avg_sessions: 62 },
    { hour: 14, avg_sessions: 80 },
    { hour: 20, avg_sessions: 30 },
    { hour: 23, avg_sessions: 5 },
  ];

  it('identifies top 3 peak hours', () => {
    const top = getTopHours(data);
    expect(top).toContain(14);
    expect(top).toContain(10);
    expect(top).toContain(9);
  });

  it('does not include low-traffic hours in top 3', () => {
    const top = getTopHours(data);
    expect(top).not.toContain(0);
    expect(top).not.toContain(23);
  });

  it('handles fewer items than n', () => {
    const small = [{ hour: 5, avg_sessions: 10 }];
    expect(getTopHours(small, 3)).toEqual([5]);
  });

  it('returns empty for empty input', () => {
    expect(getTopHours([])).toEqual([]);
  });
});

// ── type breakdown percentage ─────────────────────────────────────────────────

function calcTypeBreakdown(
  rows: { type: string; count: number }[]
): { type: string; count: number; pct: number }[] {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return rows.map(r => ({
    type: r.type,
    count: r.count,
    pct: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
  }));
}

describe('calcTypeBreakdown', () => {
  it('calculates percentages that sum to 100', () => {
    const rows = [
      { type: 'behavioral', count: 50 },
      { type: 'technical', count: 30 },
      { type: 'coding', count: 20 },
    ];
    const result = calcTypeBreakdown(rows);
    const sum = result.reduce((s, r) => s + r.pct, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it('handles single type as 100%', () => {
    const result = calcTypeBreakdown([{ type: 'general', count: 42 }]);
    expect(result[0].pct).toBe(100);
  });

  it('returns 0% for all when total is 0', () => {
    const result = calcTypeBreakdown([{ type: 'coding', count: 0 }]);
    expect(result[0].pct).toBe(0);
  });

  it('rounds to 1 decimal place', () => {
    const rows = [{ type: 'a', count: 1 }, { type: 'b', count: 2 }, { type: 'c', count: 3 }];
    const result = calcTypeBreakdown(rows);
    result.forEach(r => {
      expect(r.pct.toString()).toMatch(/^\d+(\.\d)?$/);
    });
  });
});

// ── churn rate stats ─────────────────────────────────────────────────────────

function calcChurnStats(churnData: { month: string; rate: number }[]): {
  avg: number;
  best: { month: string; rate: number } | null;
  worst: { month: string; rate: number } | null;
} {
  if (churnData.length === 0) return { avg: 0, best: null, worst: null };
  const avg = churnData.reduce((s, d) => s + Number(d.rate), 0) / churnData.length;
  const best = churnData.reduce((a, b) => Number(a.rate) < Number(b.rate) ? a : b);
  const worst = churnData.reduce((a, b) => Number(a.rate) > Number(b.rate) ? a : b);
  return { avg, best, worst };
}

describe('calcChurnStats', () => {
  const data = [
    { month: 'Jan 2026', rate: 0.05 },
    { month: 'Feb 2026', rate: 0.12 },
    { month: 'Mar 2026', rate: 0.03 },
  ];

  it('calculates average churn rate', () => {
    const stats = calcChurnStats(data);
    expect(stats.avg).toBeCloseTo((0.05 + 0.12 + 0.03) / 3, 5);
  });

  it('identifies best (lowest churn) month', () => {
    expect(calcChurnStats(data).best?.month).toBe('Mar 2026');
  });

  it('identifies worst (highest churn) month', () => {
    expect(calcChurnStats(data).worst?.month).toBe('Feb 2026');
  });

  it('returns nulls for empty data', () => {
    const stats = calcChurnStats([]);
    expect(stats.avg).toBe(0);
    expect(stats.best).toBeNull();
    expect(stats.worst).toBeNull();
  });

  it('single data point: best and worst are same month', () => {
    const stats = calcChurnStats([{ month: 'Apr 2026', rate: 0.08 }]);
    expect(stats.best?.month).toBe('Apr 2026');
    expect(stats.worst?.month).toBe('Apr 2026');
  });
});

// ── account masking ───────────────────────────────────────────────────────────

function maskAccount(accountNumber: string | null): string {
  if (!accountNumber) return '—';
  return accountNumber.slice(0, 4) + 'x'.repeat(Math.max(0, accountNumber.length - 4));
}

describe('maskAccount', () => {
  it('masks last 6 digits of 10-digit account', () => {
    expect(maskAccount('0123456789')).toBe('0123xxxxxx');
  });

  it('returns — for null', () => {
    expect(maskAccount(null)).toBe('—');
  });

  it('handles short account number (under 4 chars)', () => {
    expect(maskAccount('123')).toBe('123');
  });

  it('handles exactly 4 chars', () => {
    expect(maskAccount('1234')).toBe('1234');
  });
});
