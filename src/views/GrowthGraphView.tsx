// @ts-nocheck
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const C = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  border: '#F0F0F0',
  textPrimary: '#111111',
  textSecondary: '#666666',
  textTertiary: '#999999',
  accent: '#FF1F8E',
  blue: '#4A6BFF',
  green: '#1DB971',
  purple: '#8E56FF',
  warn: '#FF9F43',
};

// 30 days of overall + per-track scores (sample so the page is alive)
const TODAY = new Date();
const DAILY = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - (29 - i));
  // Smooth growth curve with slight noise for realism
  const t = i / 29;
  const base = 62 + t * 22;
  const noise = (Math.sin(i * 0.7) + Math.cos(i * 1.3)) * 2.4;
  const dance = Math.round(base + noise + (i > 18 ? 3 : 0));
  const vocal = Math.round(base - 4 + noise * 0.8 + (i > 12 ? 5 : 0));
  const korean = Math.round(base - 8 + noise * 1.2 + (i > 22 ? 6 : 1));
  const overall = Math.round((dance + vocal + korean) / 3);
  return {
    date: `${d.getMonth() + 1}/${d.getDate()}`,
    overall,
    dance,
    vocal,
    korean,
  };
});

const WEEKLY_HOURS = [
  { week: '4주 전', dance: 3.2, vocal: 1.8, korean: 0.9 },
  { week: '3주 전', dance: 4.1, vocal: 2.5, korean: 1.3 },
  { week: '2주 전', dance: 5.6, vocal: 3.0, korean: 1.7 },
  { week: '지난주', dance: 6.4, vocal: 3.4, korean: 2.2 },
  { week: '이번주', dance: 4.8, vocal: 2.9, korean: 1.5 },
];

const RADAR = [
  { axis: '리듬', value: 86 },
  { axis: '표현력', value: 72 },
  { axis: '발음', value: 78 },
  { axis: '안정성', value: 81 },
  { axis: '음정', value: 74 },
  { axis: '에너지', value: 88 },
];

const RANGES = [
  { id: '7d', label: '7일', days: 7 },
  { id: '30d', label: '30일', days: 30 },
  { id: '90d', label: '90일', days: 30 }, // sample only has 30 — we just show what we have
];

export default function GrowthGraphView() {
  const [range, setRange] = useState('30d');
  const data = useMemo(() => {
    const r = RANGES.find((x) => x.id === range);
    return DAILY.slice(-r.days);
  }, [range]);

  const first = data[0]?.overall ?? 0;
  const last = data[data.length - 1]?.overall ?? 0;
  const delta = last - first;
  const totalHoursThisWeek =
    WEEKLY_HOURS[WEEKLY_HOURS.length - 1].dance +
    WEEKLY_HOURS[WEEKLY_HOURS.length - 1].vocal +
    WEEKLY_HOURS[WEEKLY_HOURS.length - 1].korean;

  return (
    <div style={{ background: C.bg, minHeight: '100%', padding: 'clamp(12px, 3vw, 24px)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <Header range={range} setRange={setRange} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <KpiCard label="현재 종합" value={`${last}점`} delta={delta >= 0 ? `+${delta}` : `${delta}`} positive={delta >= 0} accent={C.accent} />
          <KpiCard label="이번주 연습 시간" value={`${totalHoursThisWeek.toFixed(1)}h`} delta="+1.3h" positive accent={C.blue} />
          <KpiCard label="연속 출석" value="12일" delta="🔥" positive accent={C.warn} />
          <KpiCard label="이번주 세션" value="9회" delta="+2" positive accent={C.green} />
        </div>

        <Card title="📈 점수 추이" sub="최근 30일 (트랙별)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textTertiary }} />
              <YAxis domain={[40, 100]} tick={{ fontSize: 10, fill: C.textTertiary }} />
              <Tooltip
                contentStyle={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="overall" name="종합" stroke="#111" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="dance" name="댄스" stroke={C.accent} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="vocal" name="보컬" stroke={C.blue} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="korean" name="한국어" stroke={C.purple} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          <Card title="⏱ 주간 연습 시간" sub="최근 5주 · 트랙별 누적">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={WEEKLY_HOURS} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: C.textTertiary }} />
                <YAxis unit="h" tick={{ fontSize: 10, fill: C.textTertiary }} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => `${v}h`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="dance" name="댄스" stackId="a" fill={C.accent} radius={[0, 0, 0, 0]} />
                <Bar dataKey="vocal" name="보컬" stackId="a" fill={C.blue} />
                <Bar dataKey="korean" name="한국어" stackId="a" fill={C.purple} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="🎯 능력치 분포" sub="최근 30일 평균">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={RADAR}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: C.textSecondary }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: C.textTertiary }} />
                <Radar name="능력치" dataKey="value" stroke={C.accent} fill={C.accent} fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card title="🏅 이번달 마일스톤" sub="이번달 달성한 성취">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { icon: '🔥', label: '12일 연속 연습', color: C.warn },
              { icon: '🎤', label: '보컬 80점 돌파', color: C.blue },
              { icon: '💃', label: '안무 1곡 마스터', color: C.accent },
              { icon: '🇰🇷', label: '한국어 문장 50개', color: C.purple },
              { icon: '📈', label: '종합 점수 +12 상승', color: C.green },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: `${m.color}14`,
                  border: `1px solid ${m.color}33`,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  color: m.color,
                }}
              >
                <span style={{ fontSize: 16 }}>{m.icon}</span>
                {m.label}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Header({ range, setRange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.15em' }}>GROWTH</p>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: C.textPrimary }}>성장 그래프</h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textSecondary }}>
          연습 성과를 한눈에 — 점수, 시간, 능력치까지
        </p>
      </div>
      <div style={{ display: 'flex', gap: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: 4 }}>
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            style={{
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 999,
              background: range === r.id ? C.accent : 'transparent',
              color: range === r.id ? '#FFF' : C.textSecondary,
              transition: 'background 0.15s',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ label, value, delta, positive, accent }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <p style={{ margin: 0, fontSize: 11, color: C.textTertiary }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: C.textPrimary }}>{value}</p>
      <p
        style={{
          margin: '4px 0 0',
          fontSize: 11,
          fontWeight: 700,
          color: positive ? accent : '#999',
        }}
      >
        {delta}
      </p>
    </div>
  );
}

function Card({ title, sub, children }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{title}</p>
        {sub ? <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textTertiary }}>{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}
