// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKoreanSpeechCoach } from '../../hooks/useKoreanSpeechCoach';

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^0-9a-zA-Z가-힣]/g, '');
}

export default function LyricsVocabMode({ onReportUpdate, referenceText, onSpeechUpdate, koreanFeedback }) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const vocab = [
    { word: '무대', meaning: 'stage' },
    { word: '연습', meaning: 'practice' },
    { word: '발음', meaning: 'pronunciation' },
    { word: '리듬', meaning: 'rhythm' },
  ];
  const referenceSentence =
    referenceText?.trim().split('\n')[0] ||
    '무대 위에서 연습한 발음과 리듬을 정확하게 보여줄게요.';
  const { combinedTranscript, metrics, micError, speechError } = useKoreanSpeechCoach({
    active: recording,
    referenceText: referenceSentence,
  });
  const matchedWords = useMemo(() => {
    const spoken = normalize(combinedTranscript);
    return vocab.map((item) => ({
      ...item,
      matched: spoken.includes(normalize(item.word)),
    }));
  }, [combinedTranscript]);
  const matchedCount = matchedWords.filter((item) => item.matched).length;
  const vocabScore = Math.round((matchedCount / Math.max(1, matchedWords.length)) * 100);
  const overall = Math.round(vocabScore * 0.5 + metrics.overall * 0.5);

  useEffect(() => {
    onSpeechUpdate?.({ transcript: combinedTranscript, metrics, isRecording: recording });
    onReportUpdate?.({
      mode: 'korean-lyrics',
      recording,
      transcript: combinedTranscript,
      vocabScore,
      matchedCount,
      vocabTotal: matchedWords.length,
      metrics,
      overall,
      updatedAt: Date.now(),
    });
  }, [combinedTranscript, matchedCount, matchedWords.length, metrics, onReportUpdate, onSpeechUpdate, overall, recording, vocabScore]);

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#111111]">{t('korean.vocabTitle')}</p>
        <button
          type="button"
          onClick={() => setRecording((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-xs text-white ${recording ? 'bg-rose-500' : 'bg-[#FF1F8E]'}`}
        >
          {recording ? '녹음 중지' : t('korean.record')}
        </button>
      </div>
      <p className="text-xs text-[#666666]">가사 문장: {referenceSentence}</p>
      <div className="grid grid-cols-2 gap-2">
        {matchedWords.map((item) => (
          <div key={item.word} className={`rounded-lg border p-3 text-sm ${item.matched ? 'border-emerald-300 bg-emerald-50' : 'border-[#E5E5E5]'}`}>
            <p className="font-semibold text-[#111111]">{item.word}</p>
            <p className="text-[#888888]">{item.meaning}</p>
            <p className={`text-[11px] mt-1 ${item.matched ? 'text-emerald-600' : 'text-[#999999]'}`}>{item.matched ? '인식됨' : '미인식'}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[#E5E5E5] p-3 bg-[#FAFAFA]">
        <p className="text-xs text-[#666666]">실시간 인식 문장</p>
        <p className="text-sm text-[#111111] mt-1">{combinedTranscript || '말하면 여기에 실시간으로 표시됩니다.'}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <ScoreBox label="어휘 인식" value={`${vocabScore}%`} />
        <ScoreBox label="문장 일치" value={`${metrics.similarity}%`} />
        <ScoreBox label="종합" value={`${overall}`} />
      </div>
      {micError ? <p className="text-xs text-rose-500">{micError}</p> : null}
      {speechError ? <p className="text-xs text-rose-500">{speechError}</p> : null}
    </div>
  );
}

function ScoreBox({ label, value }) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-2 py-1.5">
      <p className="text-[10px] text-[#888888]">{label}</p>
      <p className="text-sm font-semibold text-[#111111]">{value}</p>
    </div>
  );
}
