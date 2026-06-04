// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { useTeachingTts } from '../../hooks/useTeachingTts';

export function KoreanPersonaCoach({
  instruction,
  highlightSyllable = '',
  personaName = '한국어 발음 코치',
  personaAvatar = '🇰🇷',
  autoSpeak = true,
}) {
  const { speakCoaching } = useTeachingTts();
  const lastRef = useRef('');

  useEffect(() => {
    if (!autoSpeak || !instruction || lastRef.current === instruction) return;
    lastRef.current = instruction;
    speakCoaching(instruction, 'korean-teaching-coach');
  }, [instruction, autoSpeak, speakCoaching]);

  return (
    <div className="rounded-2xl border border-[#FF1F8E]/30 bg-gradient-to-r from-[#FF1F8E]/10 to-transparent p-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-[#FF1F8E]/20 border-2 border-[#FF1F8E] flex items-center justify-center text-xl shrink-0">
          {personaAvatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#FF1F8E] font-bold mb-1">{personaName}</p>
          {highlightSyllable ? (
            <p className="text-xs text-amber-300/90 mb-1">
              집중 음절: <span className="font-bold text-white text-base">{highlightSyllable}</span>
            </p>
          ) : null}
          <p className="text-sm text-white leading-relaxed">{instruction}</p>
        </div>
      </div>
    </div>
  );
}

export default KoreanPersonaCoach;
