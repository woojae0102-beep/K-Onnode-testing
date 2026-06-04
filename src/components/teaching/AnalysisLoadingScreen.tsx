// @ts-nocheck
import React from 'react';

const DEFAULT_STEPS = [
  { id: 1, label: '영상 업로드 중...', icon: '📤' },
  { id: 2, label: '원본 영상 스켈레톤 추출 중...', icon: '🦴' },
  { id: 3, label: '내 영상 자세 분석 중...', icon: '🔍' },
  { id: 4, label: '프레임별 비교 중...', icon: '📊' },
  { id: 5, label: 'AI 페르소나 피드백 생성 중...', icon: '🤖' },
  { id: 6, label: '분석 완료!', icon: '✅' },
];

export function AnalysisLoadingScreen({
  steps = DEFAULT_STEPS,
  currentStep = 1,
  title = '분석 중',
  subtitle = '잠시만 기다려 주세요',
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="w-16 h-16 rounded-full border-4 border-[#FF1F8E]/30 border-t-[#FF1F8E] animate-spin mb-6" />
      <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
      <p className="text-sm text-white/60 mb-8">{subtitle}</p>
      <ul className="w-full max-w-md space-y-3">
        {steps.map((step) => {
          const done = step.id < currentStep;
          const active = step.id === currentStep;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                active ? 'bg-[#FF1F8E]/15 border border-[#FF1F8E]/40' : done ? 'bg-emerald-500/10' : 'bg-white/5'
              }`}
            >
              <span className="text-lg w-8 text-center">{step.icon}</span>
              <span className={`flex-1 text-sm ${done ? 'text-emerald-400' : active ? 'text-white' : 'text-white/40'}`}>
                {step.label}
              </span>
              {done ? (
                <span className="text-emerald-400 text-lg">✓</span>
              ) : active ? (
                <span className="w-5 h-5 border-2 border-[#FF1F8E] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="w-5 h-5 rounded-full border border-white/20" />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AnalysisLoadingScreen;
