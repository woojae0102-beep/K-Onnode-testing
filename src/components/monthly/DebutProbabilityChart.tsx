// @ts-nocheck
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MonthlyResult } from '../../data/monthlyEvalData';

interface Props {
  history: MonthlyResult[];
  current: MonthlyResult | null;
}

export default function DebutProbabilityChart({ history, current }: Props) {
  const { t } = useTranslation();
  const data = useMemo(() => {
    const items = [...(history || [])];
    if (current && !items.find((i) => i.month === current.month)) {
      items.push(current);
    } else if (current) {
      const idx = items.findIndex((i) => i.month === current.month);
      if (idx >= 0) items[idx] = current;
    }
    return items
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .slice(-6)
      .map((m) => ({ month: m.month?.slice(5) || '', probability: Math.round(m.debutProbability || 0) }));
  }, [history, current]);

  if (!data.length) {
    return (
      <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5 text-sm text-[#888]">
        {t('monthly.countdown.previewEmpty')}
      </div>
    );
  }

  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const diff = prev ? last.probability - prev.probability : 0;

  return (
    <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#FF1F8E] font-bold">{t('monthly.labels.debutProbability')}</p>
          <p className="text-[28px] font-black text-[#111] mt-1">
            {last.probability}
            <span className="text-base font-bold ml-1">%</span>
          </p>
          <p className="text-xs text-[#666] mt-0.5">
            {t('monthly.labels.vsLastMonth')}{' '}
            <span className={diff > 0 ? 'text-[#059669]' : diff < 0 ? 'text-[#DC2626]' : 'text-[#666]'}>
              {diff > 0 ? '▲' : diff < 0 ? '▼' : '−'} {Math.abs(diff)}%
            </span>
          </p>
        </div>
      </div>
      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#F0F0F0" strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="#999" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} stroke="#999" fontSize={11} tickLine={false} axisLine={false} width={32} />
            <Tooltip
              cursor={{ stroke: '#FF1F8E22' }}
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E5E5', fontSize: 12 }}
              formatter={(v) => [`${v}%`, t('monthly.labels.debutProbability')]}
            />
            <ReferenceLine y={65} stroke="#FF1F8E" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="probability"
              stroke="#FF1F8E"
              strokeWidth={3}
              dot={{ r: 4, fill: '#FF1F8E' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-[#AAA]">{t('monthly.labels.debutLine')}</p>
    </div>
  );
}
