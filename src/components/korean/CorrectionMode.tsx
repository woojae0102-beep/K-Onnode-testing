// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKoreanSpeechCoach } from '../../hooks/useKoreanSpeechCoach';

function buildCorrectionReply(userText, metrics) {
  if (!userText) return '말하기를 시작하면 AI가 실시간으로 교정 포인트를 안내해드릴게요.';
  const tips = [];
  if (metrics.similarity < 60) tips.push('문장 끝 어미를 기준 문장과 동일하게 맞춰보세요.');
  if (metrics.pace < 60) tips.push('속도를 조금 줄이고 음절마다 끊어 읽어보세요.');
  if (metrics.clarity < 60) tips.push('마이크에 조금 더 가깝게, 자음 발음을 더 강하게 내보세요.');
  if (metrics.confidence < 60) tips.push('입모양을 크게 벌리고 받침을 또렷하게 마무리해보세요.');
  if (!tips.length) tips.push('발음이 매우 안정적입니다. 억양과 감정을 더 실어보세요.');
  return tips.join(' ');
}

export default function CorrectionMode({ onReportUpdate, referenceText, onSpeechUpdate, koreanFeedback }) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const reference =
    referenceText?.trim() ||
    t('korean.correctionUser', { defaultValue: '오늘도 정확한 발음으로 연습하겠습니다.' });
  const { combinedTranscript, interimTranscript, metrics, micError, speechError } = useKoreanSpeechCoach({
    active: recording,
    referenceText: reference,
  });
  const aiReply = useMemo(
    () => koreanFeedback?.coachLine || buildCorrectionReply(combinedTranscript, metrics),
    [combinedTranscript, koreanFeedback?.coachLine, metrics]
  );

  useEffect(() => {
    onSpeechUpdate?.({ transcript: combinedTranscript || interimTranscript, metrics, isRecording: recording });
    onReportUpdate?.({
      mode: 'korean-correction',
      recording,
      transcript: combinedTranscript || interimTranscript,
      metrics,
      aiReply,
      updatedAt: Date.now(),
    });
  }, [aiReply, combinedTranscript, interimTranscript, metrics, onReportUpdate, onSpeechUpdate, recording]);

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#111111]">{t('korean.correctionTitle')}</p>
        <button
          type="button"
          onClick={() => setRecording((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-xs text-white ${recording ? 'bg-rose-500' : 'bg-[#FF1F8E]'}`}
        >
          {recording ? '녹음 중지' : t('korean.record')}
        </button>
      </div>
      <div className="space-y-2">
        <div className="ml-auto max-w-[85%] rounded-[16px_16px_4px_16px] bg-[#FF1F8E] text-white text-sm px-3 py-2">
          {combinedTranscript || interimTranscript || t('korean.correctionUser')}
        </div>
        <div className="max-w-[85%] rounded-[16px_16px_16px_4px] bg-[#F5F5F7] text-[#111111] text-sm px-3 py-2">{aiReply}</div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <Badge label="문장일치" value={`${metrics.similarity}%`} />
        <Badge label="속도" value={`${metrics.pace}%`} />
        <Badge label="선명도" value={`${metrics.clarity}%`} />
        <Badge label="종합" value={`${metrics.overall}`} />
      </div>
      {micError ? <p className="text-xs text-rose-500">{micError}</p> : null}
      {speechError ? <p className="text-xs text-rose-500">{speechError}</p> : null}
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-2 py-1.5">
      <p className="text-[10px] text-[#888888]">{label}</p>
      <p className="text-sm font-semibold text-[#111111]">{value}</p>
    </div>
  );
}
