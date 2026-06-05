// @ts-nocheck
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CorrectionMode from '../components/korean/CorrectionMode';
import FollowAlongMode from '../components/korean/FollowAlongMode';
import LyricsVocabMode from '../components/korean/LyricsVocabMode';
import PronunciationMode from '../components/korean/PronunciationMode';

const modes = ['pronunciation', 'follow', 'correction', 'lyricsVocab'];

export default function KoreanAIView() {
  const { t } = useTranslation();
  const [mode, setMode] = useState('pronunciation');

  return (
    <div className="min-h-full bg-[#F5F5F7] p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        <aside className="rounded-xl border border-[#E5E5E5] bg-white p-3 space-y-2">
          {modes.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm min-h-[44px] touch-manipulation ${
                mode === item
                  ? 'bg-[#FF1F8E18] text-[#FF1F8E] border border-[#FF1F8E]'
                  : 'border border-[#E5E5E5] text-[#888888]'
              }`}
            >
              {t(`korean.modes.${item}`)}
            </button>
          ))}
        </aside>
        <section className="overflow-visible md:overflow-y-auto">
          {mode === 'pronunciation' ? <PronunciationMode /> : null}
          {mode === 'follow' ? <FollowAlongMode /> : null}
          {mode === 'correction' ? <CorrectionMode /> : null}
          {mode === 'lyricsVocab' ? <LyricsVocabMode /> : null}
        </section>
      </div>
    </div>
  );
}
