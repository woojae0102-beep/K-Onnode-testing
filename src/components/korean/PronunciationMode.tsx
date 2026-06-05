// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKoreanSpeechCoach } from '../../hooks/useKoreanSpeechCoach';

export default function PronunciationMode({
  onReportUpdate,
  referenceText,
  onSpeechUpdate,
  koreanFeedback,
}) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [showRomanized, setShowRomanized] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const sampleSentence =
    referenceText?.trim() ||
    t('korean.sampleSentence', { defaultValue: '안녕하세요. 오늘도 또렷한 발음으로 연습해요.' });
  const romanized = 'annyeonghaseyo oneuldo ttoryeothan bareumeuro yeonseuphaeyo';
  const translated = 'Hello. Today again, I practice with clear pronunciation.';
  const { combinedTranscript, volumeLevel, micError, speechError, metrics } = useKoreanSpeechCoach({
    active: recording,
    referenceText: sampleSentence,
  });

  useEffect(() => {
    onSpeechUpdate?.({ transcript: combinedTranscript, metrics, isRecording: recording });
    onReportUpdate?.({
      mode: 'korean-pronunciation',
      recording,
      transcript: combinedTranscript,
      volumeLevel,
      metrics,
      updatedAt: Date.now(),
    });
  }, [combinedTranscript, metrics, onReportUpdate, onSpeechUpdate, recording, volumeLevel]);

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
      <p className="text-xl font-semibold text-[#111111]">{sampleSentence}</p>
      {showRomanized ? <p className="text-xs text-[#666666]">{romanized}</p> : null}
      {showTranslation ? <p className="text-xs text-[#666666]">{translated}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={() => setShowRomanized((v) => !v)} className="rounded-lg border border-[#E5E5E5] px-3 py-2 text-xs">
          {t('korean.toggleRomanized')}
        </button>
        <button type="button" onClick={() => setShowTranslation((v) => !v)} className="rounded-lg border border-[#E5E5E5] px-3 py-2 text-xs">
          {t('korean.toggleTranslation')}
        </button>
        <button
          type="button"
          onClick={() => setRecording((v) => !v)}
          className={`rounded-lg px-3 py-2 text-xs text-white ${recording ? 'bg-rose-500' : 'bg-[#FF1F8E]'}`}
        >
          {recording ? '녹음 중지' : t('korean.record')}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <Metric label="문장 일치" value={`${metrics.similarity}%`} />
        <Metric label="속도 안정" value={`${metrics.pace}%`} />
        <Metric label="발화 선명" value={`${metrics.clarity}%`} />
        <Metric label="종합" value={`${metrics.overall}`} />
      </div>
      <div className="rounded-lg bg-[#F5F5F7] p-3 text-sm text-[#888888]">
        <p className="text-xs text-[#666666]">실시간 인식 문장</p>
        <p className="text-sm text-[#111111] mt-1">{combinedTranscript || '말하면 여기에 실시간으로 인식됩니다.'}</p>
      </div>
      <div className="rounded-lg border border-[#E5E5E5] p-3 space-y-1">
        {metrics.feedbacks.map((feedback, idx) => (
          <p key={`${idx}-${feedback.slice(0, 10)}`} className="text-xs text-[#666666]">- {feedback}</p>
        ))}
      </div>
      <p className="text-xs text-[#777777]">{t('korean.syllableFeedback')} · 마이크 볼륨 {volumeLevel}%</p>
      {koreanFeedback?.coachLine ? (
        <div className="rounded-lg border border-[#1DB971]/30 bg-[#F0FFF7] p-3 text-sm text-[#111111]">
          <p className="text-[10px] font-semibold text-[#1DB971] mb-1">AI 발음 코치</p>
          {koreanFeedback.coachLine}
        </div>
      ) : null}
      {micError ? <p className="text-xs text-rose-500">{micError}</p> : null}
      {speechError ? <p className="text-xs text-rose-500">{speechError}</p> : null}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-2 py-1.5">
      <p className="text-[10px] text-[#888888]">{label}</p>
      <p className="text-sm font-semibold text-[#111111]">{value}</p>
    </div>
  );
}
