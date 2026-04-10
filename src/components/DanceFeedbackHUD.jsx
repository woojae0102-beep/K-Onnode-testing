import React from 'react';

// 수정됨 — 유저 WebRTC 영역 상단·중앙 대형 판정 + 가이드 토스트
function gradeStyle(grade) {
  switch (grade) {
    case 'Perfect':
      return 'text-amber-300 drop-shadow-[0_0_24px_rgba(251,191,36,0.9)]';
    case 'Great':
      return 'text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,0.85)]';
    case 'Good':
      return 'text-sky-300 drop-shadow-[0_0_16px_rgba(125,211,252,0.8)]';
    case 'Bad':
      return 'text-red-500 drop-shadow-[0_0_28px_rgba(239,68,68,0.95)]';
    default:
      return 'text-slate-400';
  }
}

export default function DanceFeedbackHUD({ grade, score, feedback, worstHint }) {
  const lines = Array.isArray(feedback) ? feedback.filter(Boolean).slice(0, 3) : [];
  const hint = worstHint || lines[0] || '';

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] flex flex-col items-center justify-start pt-[6%] px-2">
      <div className="flex flex-col items-center gap-1">
        <p
          className={`text-[clamp(2.5rem,10vw,4.5rem)] font-black leading-none tracking-tighter ${gradeStyle(grade)}`}
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {grade || '—'}
        </p>
        {score != null && Number.isFinite(score) && (
          <p className="text-lg sm:text-2xl font-black text-white/90 drop-shadow-lg tabular-nums">
            {Math.round(score)}
            <span className="text-white/50 text-base font-bold"> / 100</span>
          </p>
        )}
      </div>

      {hint && (
        <div className="mt-4 max-w-[95%] rounded-2xl border-2 border-[#FF1493]/70 bg-black/70 px-4 py-3 shadow-[0_0_32px_rgba(255,20,147,0.35)] backdrop-blur-md">
          <p className="text-center text-[11px] sm:text-sm font-bold text-fuchsia-100 break-keep leading-snug">
            {hint}
          </p>
          {lines.length > 1 && (
            <ul className="mt-2 space-y-1 text-center text-[10px] sm:text-xs text-slate-200/90 font-medium break-keep">
              {lines.slice(1).map((t, i) => (
                <li key={i}>· {t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
