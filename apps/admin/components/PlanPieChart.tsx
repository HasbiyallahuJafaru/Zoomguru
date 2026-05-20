'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PlanRow { plan: string; currency: string; count: number; revenue: number }

const COLORS: Record<string, string> = {
  'monthly-NGN': '#4f6ef7',
  'lifetime-NGN': '#10b981',
  'monthly-USD': '#06b6d4',
  'lifetime-USD': '#a855f7',
};

const FALLBACK_COLORS = ['#4f6ef7', '#10b981', '#06b6d4', '#a855f7', '#f59e0b'];

export function PlanPieChart({ data }: { data: PlanRow[] }) {
  const slices = data.map((r, i) => {
    const key = `${r.plan}-${r.currency}`;
    return {
      name: `${r.plan === 'monthly' ? 'Monthly' : 'Lifetime'} ${r.currency}`,
      value: Number(r.count),
      color: COLORS[key] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    };
  });

  if (!slices.length) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>No subscription data yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={slices}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {slices.map((s, i) => (
            <Cell key={i} fill={s.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => [v + ' subscribers', '']}
          contentStyle={{
            background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: 8, fontSize: 12,
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: '#475569', paddingTop: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
