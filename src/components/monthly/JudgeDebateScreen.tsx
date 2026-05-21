// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JudgeDebate } from '../../data/monthlyEvalData';

interface Props {
  debate: JudgeDebate;
}

const AGENCY_ACCENT: Record<string, string> = {
  HYBE: '#7C3AED',
  YG: '#111111',
  JYP: '#22C55E',
  SM: '#0EA5E9',
  Starship: '#FF1F8E',
};

const TONE_BORDER: Record<string, string> = {
  positive: '#059669',
  critical: '#DC2626',
  neutral: '#94A3B8',
  impressed: '#FF1F8E',
  conflicted: '#F59E0B',
};

interface DebateLineState {
  index: number;
  visibleChars: number;
}

export default function JudgeDebateScreen({ debate }: Props) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<DebateLineState[]>([]);
  const lastTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLines([]);
    if (!debate?.debateLines?.length) return;
    let cancelled = false;

    async function run() {
      for (let i = 0; i < debate.debateLines.length; i += 1) {
        if (cancelled) return;
        const pause = Math.max(0.5, Number(debate.debateLines[i].pauseBefore) || 1);
        await new Promise((r) => {
          lastTimer.current = window.setTimeout(r, pause * 1000);
        });
        if (cancelled) return;
        const text = debate.debateLines[i].line || '';
        // typing effect
        for (let c = 0; c <= text.length; c += 1) {
          if (cancelled) return;
          setLines((prev) => {
            const next = [...prev];
            next[i] = { index: i, visibleChars: c };
            return next;
          });
          await new Promise((r) => {
            lastTimer.current = window.setTimeout(r, 22);
          });
        }
      }
    }
    run();
    return () => {
      cancelled = true;
      if (lastTimer.current) window.clearTimeout(lastTimer.current);
    };
  }, [debate]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-[#FF1F8E] font-bold">
          {t('monthly.debate.tag')}
        </span>
        <span className="text-xs text-[#888]">{t('monthly.debate.headerSub')}</span>
      </div>

      <div ref={containerRef} className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {(debate?.debateLines || []).map((line, idx) => {
          const visible = lines[idx]?.visibleChars ?? 0;
          if (visible === 0 && idx > (lines.length - 1)) return null;
          const accent = AGENCY_ACCENT[line.agency] || '#666';
          const border = TONE_BORDER[line.tone] || '#E5E5E5';
          const text = (line.line || '').slice(0, visible);
          return (
            <div key={idx} className="flex gap-3">
              <div
                className="w-9 h-9 rounded-2xl grid place-items-center text-base flex-shrink-0"
                style={{ background: `${accent}15`, border: `1px solid ${accent}55` }}
              >
                {line.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-bold text-[#111]">{line.speaker}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: accent }}
                  >
                    {line.agency}
                  </span>
                </div>
                <div
                  className="mt-1 rounded-2xl px-3 py-2 bg-[#FAFAFA] text-[13px] text-[#222] border-l-2"
                  style={{ borderColor: border }}
                >
                  {text}
                  {visible < (line.line || '').length ? (
                    <span className="ml-0.5 inline-block w-[6px] h-[14px] align-middle bg-[#FF1F8E] animate-pulse" />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {debate?.keyConflict ? (
        <div className="mt-4 grid sm:grid-cols-2 gap-2">
          <div className="rounded-xl bg-[#FFF7ED] border border-[#F59E0B22] p-3 text-[12px] text-[#92400E]">
            <p className="font-bold text-[11px] uppercase tracking-wider">{t('monthly.debate.keyConflict')}</p>
            <p className="mt-1">{debate.keyConflict}</p>
          </div>
          <div className="rounded-xl bg-[#ECFDF5] border border-[#05966922] p-3 text-[12px] text-[#065F46]">
            <p className="font-bold text-[11px] uppercase tracking-wider">{t('monthly.debate.consensus')}</p>
            <p className="mt-1">{debate.consensus}</p>
          </div>
        </div>
      ) : null}

      {debate?.finalSummary ? (
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#FF1F8E] to-[#7C3AED] p-4 text-white">
          <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">{t('monthly.debate.summary')}</p>
          <p className="mt-2 text-sm leading-relaxed">{debate.finalSummary}</p>
        </div>
      ) : null}
    </div>
  );
}
