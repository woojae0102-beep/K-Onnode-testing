// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applySpeechRate } from '../../utils/playbackSpeed';
import { applySpeechRate } from '../../utils/playbackSpeed';

// Web Speech API (브라우저 내장 TTS) 기반 — 무료, 추가 비용 0원.
// 코치 페르소나마다 rate/pitch만 다르게 설정해 ‘목소리 톤’을 흉내냄.

type CoachPersonaKey =
  | 'jyp_jung'
  | 'jyp_park'
  | 'yg_lee'
  | 'yg_vocal'
  | 'sm_choi'
  | 'hybe_kim'
  | 'hybe_soul'
  | string;

const VOICE_SETTINGS: Record<string, { rate: number; pitch: number }> = {
  jyp_jung: { rate: 1.18, pitch: 1.2 },
  jyp_park: { rate: 0.96, pitch: 1.0 },
  yg_lee: { rate: 1.0, pitch: 0.85 },
  yg_vocal: { rate: 1.0, pitch: 0.9 },
  sm_choi: { rate: 0.92, pitch: 0.92 },
  hybe_kim: { rate: 1.08, pitch: 1.08 },
  hybe_soul: { rate: 1.0, pitch: 1.0 },
};

function pickLangCode(language?: string): string {
  switch (language) {
    case 'ja':
      return 'ja-JP';
    case 'en':
      return 'en-US';
    case 'zh':
      return 'zh-CN';
    case 'es':
      return 'es-ES';
    case 'fr':
      return 'fr-FR';
    case 'th':
      return 'th-TH';
    case 'vi':
      return 'vi-VN';
    case 'ko':
    default:
      return 'ko-KR';
  }
}

function isTTSSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

interface Props {
  coachLine: string;
  coachPersona?: CoachPersonaKey;
  language?: string;
  autoPlay?: boolean;
  compact?: boolean;
  playbackSpeed?: number;
}

export default function CoachVoicePlayer({
  coachLine,
  coachPersona = 'jyp_jung',
  language,
  autoPlay = false,
  compact = false,
  playbackSpeed = 1,
}: Props) {
  const { i18n, t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [supported, setSupported] = useState<boolean>(true);
  const lastSpokenRef = useRef<string>('');

  useEffect(() => {
    setSupported(isTTSSupported());
  }, []);

  const playCoachVoice = () => {
    if (!isTTSSupported() || !coachLine) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(coachLine);
      const settings = VOICE_SETTINGS[coachPersona] || { rate: 1.0, pitch: 1.0 };
      utterance.rate = applySpeechRate(settings.rate, playbackSpeed);
      utterance.pitch = settings.pitch;
      const langCode = pickLangCode(language || i18n.language);
      utterance.lang = langCode;

      const voices = window.speechSynthesis.getVoices();
      const langPrefix = langCode.split('-')[0];
      const matchedVoice =
        voices.find((v) => v.lang === langCode) ||
        voices.find((v) => v.lang?.startsWith(langPrefix));
      if (matchedVoice) utterance.voice = matchedVoice;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
      lastSpokenRef.current = coachLine;
    } catch {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (!autoPlay) return;
    if (!coachLine) return;
    if (lastSpokenRef.current === coachLine) return;
    if (!isTTSSupported()) return;
    const id = window.setTimeout(playCoachVoice, 400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachLine, autoPlay, playbackSpeed]);

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel?.();
      } catch {
        /* noop */
      }
    };
  }, []);

  if (!supported) {
    return (
      <span className="text-[11px] text-slate-400">
        {t('coaching.voice.unsupported')}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={playCoachVoice}
      disabled={!coachLine}
      className={`inline-flex items-center gap-1.5 rounded-full border transition disabled:opacity-50 ${
        isPlaying
          ? 'bg-[#FF1F8E] border-[#FF1F8E] text-white'
          : 'border-[#FF1F8E] text-[#FF1F8E] bg-transparent hover:bg-[#FF1F8E]/10'
      } ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'}`}
    >
      <span aria-hidden>{isPlaying ? '🔊' : '🎙'}</span>
      <span>{isPlaying ? t('coaching.voice.playing') : t('coaching.voice.listen')}</span>
    </button>
  );
}
