// @ts-nocheck
// 역량 자산 대시보드 (Trainee Asset Dashboard)
// 기존 To-do 형 "목표 진행률" UI를 대체하여, 사용자의 실력을 입증하는
// 데이터 중심 화면으로 재구성합니다.
//
// 데이터 인터페이스: src/data/traineeAssets.ts
// TODO: GET /api/user/trainee-assets (또는 Firestore) 로 교체

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/languageStore';
import AuditionReadinessCard from '../components/dashboard/AuditionReadinessCard';
import HexagonAbilityChart from '../components/dashboard/HexagonAbilityChart';
import TechnicalGrowthTimeline from '../components/dashboard/TechnicalGrowthTimeline';
import AIInsightCard from '../components/dashboard/AIInsightCard';
import {
  DUMMY_ASSET_DATA,
  TraineeAssetDashboardData,
} from '../data/traineeAssets';

const LANG_LOCALE: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
  th: 'th-TH',
  vi: 'vi-VN',
  es: 'es-ES',
  fr: 'fr-FR',
};

interface Props {
  onNavigate?: (view: string) => void;
  /** 추후 API/Firestore 결과로 주입 가능 */
  data?: TraineeAssetDashboardData;
}

export default function GoalsView({ onNavigate, data }: Props) {
  const dashboard = data || DUMMY_ASSET_DATA;
  const { portfolio, abilities, agencyReadiness, technicalSeries, insights } = dashboard;
  const [now, setNow] = useState(() => new Date());
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language) || 'ko';

  const generatedLabel = useMemo(() => {
    try {
      return new Date(dashboard.generatedAt).toLocaleString(LANG_LOCALE[language] || 'ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [dashboard.generatedAt, language]);

  return (
    <div className="bg-[#F5F5F7] min-h-full">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <Header
          portfolio={portfolio}
          generatedLabel={generatedLabel}
          onNavigate={onNavigate}
          onRefresh={() => setNow(new Date())}
        />

        <AuditionReadinessCard portfolio={portfolio} agencies={agencyReadiness} />

        <div className="grid lg:grid-cols-5 gap-5 items-start">
          <div className="lg:col-span-3">
            <HexagonAbilityChart abilities={abilities} />
          </div>
          <div className="lg:col-span-2">
            <PortfolioSummary portfolio={portfolio} onNavigate={onNavigate} />
          </div>
        </div>

        <TechnicalGrowthTimeline series={technicalSeries} />

        <AIInsightCard insights={insights} onCta={(target) => onNavigate?.(target)} />

        {/* hidden refresh marker for now */}
        <div className="hidden">{now.toString()}</div>
      </div>
    </div>
  );
}

function Header({ portfolio, generatedLabel, onNavigate, onRefresh }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex items-end justify-between gap-3 flex-wrap"
    >
      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-[#FF1F8E] uppercase">
          {t('dashboard.tag')}
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-[#111] leading-tight">
          {t('dashboard.title')}
        </h1>
        <p className="mt-1 text-[12px] text-[#666]">{t('dashboard.subtitle', { at: generatedLabel })}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E5E5E5] px-3 py-1.5 text-[12px] font-bold text-[#444] hover:border-[#FF1F8E33] transition"
        >
          <RefreshCw size={13} />
          {t('dashboard.refresh')}
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.('aicoach')}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FF1F8E] hover:brightness-110 transition text-white px-3.5 py-1.5 text-[12px] font-bold shadow-[0_8px_22px_rgba(255,31,142,0.32)]"
        >
          <Sparkles size={13} />
          {t('dashboard.strengthenCta')}
        </button>
      </div>
    </motion.div>
  );
}

function PortfolioSummary({ portfolio, onNavigate }) {
  const { t } = useTranslation();
  const inProgressPct = portfolio.total
    ? Math.round((portfolio.inProgress / portfolio.total) * 100)
    : 0;
  const masteredPct = portfolio.total
    ? Math.round((portfolio.mastered / portfolio.total) * 100)
    : 0;

  // top strength label may be an i18n key or raw string
  const topStrengthRaw = portfolio.topStrengthLabel || '';
  const topStrength = topStrengthRaw.startsWith('dashboard.')
    ? t(topStrengthRaw)
    : topStrengthRaw || t('dashboard.portfolio.topStrengthDummy');

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.08 }}
      className="rounded-3xl bg-[#0E0E14] text-white p-5 sm:p-6"
      style={{ boxShadow: '0 12px 32px rgba(15, 15, 25, 0.28)' }}
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/55 font-bold">
        {t('dashboard.portfolio.tag')}
      </p>
      <h3 className="mt-1 text-base font-bold">{t('dashboard.portfolio.title')}</h3>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric
          label={t('dashboard.portfolio.inProgress')}
          value={`${portfolio.inProgress}`}
          sub={t('dashboard.portfolio.outOfTotal', { total: portfolio.total })}
          accent="#FF6BB1"
        />
        <Metric
          label={t('dashboard.portfolio.mastered')}
          value={`${portfolio.mastered}`}
          sub={t('dashboard.portfolio.outOfTotal', { total: portfolio.total })}
          accent="#86EFAC"
        />
      </div>

      <div className="mt-5 space-y-3">
        <Bar label={t('dashboard.portfolio.barInProgress')} value={inProgressPct} color="#FF1F8E" />
        <Bar label={t('dashboard.portfolio.barMastered')} value={masteredPct} color="#22C55E" />
      </div>

      <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/55 font-bold">
          {t('dashboard.portfolio.coreStrength')}
        </p>
        <p className="mt-1 text-sm text-white">⭐ {topStrength}</p>
      </div>

      <button
        type="button"
        onClick={() => onNavigate?.('aicoach')}
        className="mt-5 w-full rounded-2xl bg-[#FF1F8E] hover:brightness-110 text-white py-3 text-sm font-black transition"
      >
        {t('dashboard.portfolio.ctaToday')}
      </button>
    </motion.section>
  );
}

function Metric({ label, value, sub, accent }: any) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
      <p className="text-[11px] text-white/60">{label}</p>
      <p className="mt-1 text-2xl font-black" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-[10px] text-white/45 mt-0.5">{sub}</p>
    </div>
  );
}

function Bar({ label, value, color }: any) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-white/65">
        <span>{label}</span>
        <span className="font-bold text-white">{value}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ background: color }}
        />
      </div>
    </div>
  );
}
