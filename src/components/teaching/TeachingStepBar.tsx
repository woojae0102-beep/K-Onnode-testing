// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';

const STEPS = ['setup', 'practice', 'review'];

export function TeachingStepBar({ current }) {
  const { t } = useTranslation();
  const idx = STEPS.indexOf(current);

  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <React.Fragment key={step}>
            <div
              className={`flex-1 rounded-lg py-2 px-2 text-center text-xs font-semibold transition-colors ${
                active ? 'bg-[#FF1F8E] text-white' : done ? 'bg-[#FF1F8E]/30 text-white' : 'bg-white/10 text-white/50'
              }`}
            >
              {t(`teaching.session.steps.${step}`)}
            </div>
            {i < STEPS.length - 1 ? <span className="text-white/30 text-xs shrink-0">→</span> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default TeachingStepBar;
