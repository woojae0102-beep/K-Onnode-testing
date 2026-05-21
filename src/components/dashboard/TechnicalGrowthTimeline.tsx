// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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
import { Activity, ArrowUpRight, Award } from 'lucide-react';
import { TechnicalSkillSeries } from '../../data/traineeAssets';

interface Props {
  series: TechnicalSkillSeries[];
}

export default function TechnicalGrowthTimeline({ series }: Props) {
  const { t } = useTranslation();
  const resolveLabel = (label: string) =>
    label?.startsWith('dashboard.') ? t(label, { defaultValue: label }) : label;
  const [activeId, setActiveId] = useState<string>(series[0]?.id || '');
  const active = useMemo(
    () => series.find((s) => s.id === activeId) || series[0],
    [series, activeId]
  );

  const chartData = useMemo(() => {
    if (!active) return [];
    return active.points.map((p) => ({
      date: p.date.slice(5), // MM-DD
      value: p.value,
    }));
  }, [active]);

  const lastValue = chartData[chartData.length - 1]?.value ?? 0;
  const firstValue = chartData[0]?.value ?? 0;
  const isMastered = active && lastValue >= active.masterScore;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
      className="rounded-3xl bg-white border border-[#EFEFEF] p-5 sm:p-6"
      style={{ boxShadow: '0 6px 20px rgba(15, 15, 25, 0.04)' }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#FF1F8E] font-bold">
            <Activity size={13} /> {t('dashboard.timeline.tag')}
          </div>
          <p className="mt-1 text-base font-bold text-[#111]">{t('dashboard.timeline.title')}</p>
          <p className="text-xs text-[#888] mt-0.5">{t('dashboard.timeline.subtitle')}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {series.map((s) => {
          const isActive = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              className="rounded-full px-3 py-1.5 text-[12px] font-bold border transition"
              style={{
                background: isActive ? s.color : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#222',
                borderColor: isActive ? s.color : '#E5E5E5',
              }}
            >
              <span className="opacity-70 mr-1.5 text-[10px]">
                {t(`dashboard.timeline.category.${s.category}`, { defaultValue: s.category })}
              </span>
              {resolveLabel(s.label)}
            </button>
          );
        })}
      </div>

      {active ? (
        <>
          <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] text-[#888]">{t('dashboard.timeline.currentScore')}</p>
              <p className="text-3xl font-black text-[#111] leading-none mt-1">
                {lastValue}
                <span className="text-base font-bold ml-1 text-[#888]">
                  {active.unit || t('dashboard.hexagon.scoreUnit')}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold"
                style={{
                  background: active.delta30d >= 0 ? '#ECFDF5' : '#FEF2F2',
                  color: active.delta30d >= 0 ? '#059669' : '#DC2626',
                }}
              >
                <ArrowUpRight size={12} />
                {t('dashboard.timeline.delta30d', {
                  sign: active.delta30d >= 0 ? '+' : '',
                  value: active.delta30d,
                })}
              </span>
              {isMastered ? (
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold bg-[#FFF0F7] text-[#FF1F8E]">
                  <Award size={12} /> {t('dashboard.timeline.mastered')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold bg-[#FFF7ED] text-[#B45309]">
                  {t('dashboard.timeline.masterGoal', {
                    value: active.masterScore,
                    remaining: Math.max(0, active.masterScore - lastValue),
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#F0F0F0" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#999" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  domain={[Math.max(0, Math.min(firstValue, lastValue) - 10), 100]}
                  stroke="#999"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ stroke: `${active.color}33` }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E5E5E5',
                    fontSize: 12,
                  }}
                  formatter={(v) => [
                    `${v}${active.unit || t('dashboard.hexagon.scoreUnit')}`,
                    resolveLabel(active.label),
                  ]}
                />
                <ReferenceLine
                  y={active.masterScore}
                  stroke={active.color}
                  strokeDasharray="4 4"
                  label={{
                    value: t('dashboard.timeline.masterRefLabel'),
                    position: 'right',
                    fill: active.color,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={active.color}
                  strokeWidth={3}
                  dot={{ r: 3, fill: active.color }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationDuration={900}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </motion.section>
  );
}
