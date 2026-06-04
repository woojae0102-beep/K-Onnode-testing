// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { useJudgeVoice } from '../../hooks/useJudgeVoice';

export function VocalPersonaCoach({
  instruction,
  personaName = '보컬 코치',
  personaAvatar = '🎤',
  highlightText = '',
  autoSpeak = true,
}) {
  const { speak, supported, stop } = useJudgeVoice();
  const lastSpokenRef = useRef('');

  useEffect(() => {
    if (!autoSpeak || !supported || !instruction) return;
    if (lastSpokenRef.current === instruction) return;
    lastSpokenRef.current = instruction;
    stop?.();
    speak(instruction, 'vocal-teaching-coach');
  }, [instruction, autoSpeak, supported, speak, stop]);

  return (
    <div className="rounded-2xl border border-[#FF1F8E]/30 bg-gradient-to-r from-[#FF1F8E]/10 to-transparent p-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-[#FF1F8E]/20 border-2 border-[#FF1F8E] flex items-center justify-center text-xl shrink-0">
          {personaAvatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#FF1F8E] font-bold mb-1">{personaName}</p>
          {highlightText ? (
            <p className="text-xs text-white/50 mb-1">
              현재 구간: <span className="text-white font-medium">{highlightText}</span>
            </p>
          ) : null}
          <p className="text-sm text-white leading-relaxed">{instruction}</p>
        </div>
      </div>
    </div>
  );
}

export default VocalPersonaCoach;
