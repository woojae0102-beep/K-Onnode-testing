// @ts-nocheck
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AgencyReadiness, PortfolioMastery } from '../../data/traineeAssets';

function resolveKey(t: any, value?: string, fallback = '') {
  if (!value) return fallback;
  return value.startsWith('dashboard.') ? t(value, { defaultValue: fallback }) : value;
}

interface Props {
  portfolio: PortfolioMastery;
  agencies: AgencyReadiness[];
}

export default function AuditionReadinessCard({ portfolio, agencies }: Props) {
  const { t } = useTranslation();
  const sorted = useMemo(
    () => [...agencies].sort((a, b) => b.matchPercent - a.matchPercent),
    [agencies]
  );
  const debutDelta = portfolio.debutReadinessDelta;
  const deltaSign = debutDelta > 0 ? '+' : '';
  const topStrength = resolveKey(t, portfolio.topStrengthLabel, t('dashboard.portfolio.topStrengthDummy'));

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="rounded-3xl overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #0E0E14 0%, #1A1024 60%, #29102E 100%)',
        boxShadow: '0 20px 50px rgba(15, 15, 25, 0.18)',
      }}
    >
      <div className="p-6 sm:p-7 text-white">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/55">
          <Target size={14} className="text-[#FF1F8E]" />
          {t('dashboard.audition.tag')}
        </div>

        <div className="mt-4 flex items-end gap-4 flex-wrap">
          <div>
            <p className="text-xs text-white/55">{t('dashboard.audition.overallLabel')}</p>
            <p className="text-5xl font-black leading-none mt-1">
              {portfolio.debutReadiness}
              <span className="text-base font-bold ml-1 text-white/70">%</span>
            </p>
          </div>
          <div className="pb-2">
            <span
              className="inline-flex items-center gap-1 rounded-full text-[11px] font-bold px-3 py-1"
              style={{
                background: debutDelta >= 0 ? '#22C55E22' : '#FB718522',
                color: debutDelta >= 0 ? '#86EFAC' : '#FCA5A5',
              }}
            >
              {debutDelta >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {t('dashboard.audition.delta', { sign: deltaSign, value: debutDelta })}
            </span>
            <p className="mt-2 text-[12px] text-white/65 leading-relaxed max-w-md">
              {t('dashboard.audition.topStrengthPrefix')}{topStrength}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {sorted.map((agency, idx) => (
            <motion.div
              key={agency.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + idx * 0.06, duration: 0.4, ease: 'easeOut' }}
            >
              <div className="flex items-center justify-between text-[12px] text-white/85">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: agency.accentColor }}
                  />
                  <span className="font-bold text-white truncate">{agency.name}</span>
                  <span className="text-[10px] text-white/45">· {resolveKey(t, agency.styleTag, agency.styleTag)}</span>
                </div>
                <div className="flex items-baseline gap-2 flex-shrink-0">
                  <span className="font-black text-white text-sm">
                    {agency.matchPercent}%
                  </span>
                  <span
                    className="text-[10px] font-bold"
                    style={{
                      color:
                        agency.matchDelta > 0
                          ? '#86EFAC'
                          : agency.matchDelta < 0
                          ? '#FCA5A5'
                          : 'rgba(255,255,255,0.55)',
                    }}
                  >
                    {agency.matchDelta > 0 ? '▲' : agency.matchDelta < 0 ? '▼' : '−'}
                    {Math.abs(agency.matchDelta)}%
                  </span>
                </div>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${agency.matchPercent}%` }}
                  transition={{ delay: 0.25 + idx * 0.06, duration: 0.7, ease: 'easeOut' }}
                  style={{ background: agency.accentColor }}
                />
              </div>
              <p className="mt-1 text-[10px] text-white/50">{resolveKey(t, agency.topSignal, agency.topSignal)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
