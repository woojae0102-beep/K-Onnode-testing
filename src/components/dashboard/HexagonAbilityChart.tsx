// @ts-nocheck
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ArrowUpRight, Hexagon } from 'lucide-react';
import { AbilityScore } from '../../data/traineeAssets';

interface Props {
  abilities: AbilityScore[];
}

export default function HexagonAbilityChart({ abilities }: Props) {
  const { t } = useTranslation();
  const resolveLabel = (label: string) =>
    label?.startsWith('dashboard.') ? t(label, { defaultValue: label }) : label;
  const data = useMemo(
    () =>
      abilities.map((a) => ({
        ability: resolveLabel(a.label),
        labelKey: a.label,
        current: a.current,
        previous: a.previous,
        delta: a.current - a.previous,
        percentile: a.percentile ?? null,
      })),
    [abilities, t]
  );

  const totalDelta = useMemo(
    () => data.reduce((sum, d) => sum + d.delta, 0),
    [data]
  );
  const overall = useMemo(
    () => Math.round(data.reduce((s, d) => s + d.current, 0) / data.length),
    [data]
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
      className="rounded-3xl bg-white border border-[#EFEFEF] p-5 sm:p-6"
      style={{ boxShadow: '0 6px 20px rgba(15, 15, 25, 0.04)' }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#FF1F8E] font-bold">
            <Hexagon size={13} /> {t('dashboard.hexagon.tag')}
          </div>
          <p className="mt-1 text-base font-bold text-[#111]">{t('dashboard.hexagon.title')}</p>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#666]">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm border border-dashed"
                style={{ background: '#3B82F633', borderColor: '#3B82F6' }}
              />
              {t('dashboard.hexagon.previous')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: '#FF1F8E', opacity: 0.85 }}
              />
              {t('dashboard.hexagon.current')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Stat label={t('dashboard.hexagon.overall')} value={t('dashboard.hexagon.tooltipScore', { value: overall })} />
          <Stat
            label={t('dashboard.hexagon.totalGrowth')}
            value={`${totalDelta > 0 ? '+' : ''}${totalDelta}`}
            color={totalDelta >= 0 ? '#22C55E' : '#FB7185'}
          />
        </div>
      </div>

      <div className="mt-4 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="78%">
            <PolarGrid stroke="#EAEAEA" />
            <PolarAngleAxis
              dataKey="ability"
              tick={{ fill: '#444', fontSize: 12, fontWeight: 700 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#BBB', fontSize: 10 }}
              axisLine={false}
              stroke="#EFEFEF"
            />
            <Radar
              name={t('dashboard.hexagon.previous')}
              dataKey="previous"
              stroke="#3B82F6"
              strokeWidth={1.8}
              strokeDasharray="5 4"
              fill="#3B82F6"
              fillOpacity={0.22}
              isAnimationActive
              animationDuration={900}
              animationBegin={200}
            />
            <Radar
              name={t('dashboard.hexagon.current')}
              dataKey="current"
              stroke="#FF1F8E"
              strokeWidth={2}
              fill="#FF1F8E"
              fillOpacity={0.32}
              isAnimationActive
              animationDuration={1100}
              animationBegin={500}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #E5E5E5',
                fontSize: 12,
              }}
              formatter={(v: number, _name, ctx: any) => {
                const score = t('dashboard.hexagon.tooltipScore', { value: v });
                if (ctx?.dataKey === 'current') return [score, t('dashboard.hexagon.current')];
                if (ctx?.dataKey === 'previous') return [score, t('dashboard.hexagon.previous')];
                return [score, ctx?.dataKey];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {abilities.map((a) => {
          const delta = a.current - a.previous;
          const isUp = delta >= 0;
          return (
            <div
              key={a.key}
              className="rounded-xl border border-[#EFEFEF] bg-[#FAFAFA] px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[#888] font-semibold">{resolveLabel(a.label)}</p>
                {a.isStrength ? (
                  <span className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-[#FFF0F7] text-[#FF1F8E]">
                    {t('dashboard.abilities.coreTag')}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <p className="text-lg font-black text-[#111]">{a.current}</p>
                <span
                  className="text-[11px] font-bold inline-flex items-center"
                  style={{ color: isUp ? '#22C55E' : '#FB7185' }}
                >
                  {isUp ? <ArrowUpRight size={12} /> : null}
                  {isUp ? '+' : ''}
                  {delta}
                </span>
              </div>
              {a.percentile != null ? (
                <p className="mt-0.5 text-[10px] text-[#999]">
                  {t('dashboard.abilities.topPercentile', { value: a.percentile })}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

function Stat({ label, value, color = '#111111' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[#EFEFEF] bg-[#FAFAFA] px-3 py-2 text-right">
      <p className="text-[10px] text-[#888]">{label}</p>
      <p className="text-base font-black mt-0.5" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
