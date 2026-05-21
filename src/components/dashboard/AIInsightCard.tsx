// @ts-nocheck
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, AlertTriangle, Stars } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AIInsight } from '../../data/traineeAssets';

interface Props {
  insights: AIInsight[];
  onCta?: (target: string) => void;
}

const TONE_META = {
  positive: {
    bg: 'linear-gradient(135deg, #FF1F8E 0%, #7C3AED 100%)',
    color: '#FFFFFF',
    Icon: Stars,
    labelKey: 'dashboard.insight.labels.positive',
  },
  caution: {
    bg: 'linear-gradient(135deg, #1F1F1F 0%, #FF9F43 110%)',
    color: '#FFFFFF',
    Icon: AlertTriangle,
    labelKey: 'dashboard.insight.labels.caution',
  },
  neutral: {
    bg: 'linear-gradient(135deg, #1F1F2E 0%, #3F3F4E 100%)',
    color: '#FFFFFF',
    Icon: Sparkles,
    labelKey: 'dashboard.insight.labels.neutral',
  },
};

function resolve(t: any, value?: string) {
  if (!value) return '';
  return value.startsWith('dashboard.') ? t(value, { defaultValue: value }) : value;
}

export default function AIInsightCard({ insights, onCta }: Props) {
  const { t } = useTranslation();
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-[#FF1F8E]" />
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#FF1F8E] font-bold">
          {t('dashboard.insight.tag')}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((insight, idx) => {
          const meta = TONE_META[insight.tone] || TONE_META.neutral;
          const Icon = meta.Icon;
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.07, duration: 0.45, ease: 'easeOut' }}
              className="rounded-3xl p-5 flex flex-col"
              style={{ background: meta.bg, color: meta.color }}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/65 font-bold">
                <Icon size={13} /> {t(meta.labelKey)}
              </div>
              <p className="mt-3 text-base font-black leading-snug">{resolve(t, insight.headline)}</p>
              <p className="mt-2 text-[12px] text-white/80 leading-relaxed flex-1">
                {resolve(t, insight.message)}
              </p>
              {insight.ctaLabel ? (
                <button
                  type="button"
                  onClick={() => insight.ctaTarget && onCta?.(insight.ctaTarget)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 transition border border-white/25 px-3 py-1.5 text-[11px] font-bold w-fit"
                >
                  {resolve(t, insight.ctaLabel)} <ArrowRight size={12} />
                </button>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
