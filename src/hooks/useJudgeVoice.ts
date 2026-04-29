// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';

// Per-judge voice tuning. Each entry tweaks rate/pitch/lang so the same
// browser TTS engine still feels distinct between Yang Taejun and Jung Minji.
const VOICE_SETTINGS: Record<string, { rate: number; pitch: number; lang: string }> = {
  // HYBE
  'hybe-junhyuk': { rate: 0.95, pitch: 0.85, lang: 'ko-KR' },
  'hybe-soyeon': { rate: 1.0, pitch: 1.1, lang: 'ko-KR' },
  'hybe-david': { rate: 1.05, pitch: 0.9, lang: 'en-US' },
  // YG
  'yg-taejun': { rate: 0.85, pitch: 0.7, lang: 'ko-KR' },
  'yg-narae': { rate: 1.0, pitch: 0.95, lang: 'ko-KR' },
  'yg-marcus': { rate: 1.05, pitch: 0.85, lang: 'en-US' },
  // JYP
  'jyp-jaewon': { rate: 1.0, pitch: 1.0, lang: 'ko-KR' },
  'jyp-minji': { rate: 1.1, pitch: 1.2, lang: 'ko-KR' },
  'jyp-soojin': { rate: 0.95, pitch: 1.0, lang: 'ko-KR' },
  // SM
  'sm-seongho': { rate: 0.85, pitch: 0.8, lang: 'ko-KR' },
  'sm-yujin': { rate: 0.95, pitch: 0.95, lang: 'ko-KR' },
  'sm-taeeun': { rate: 1.0, pitch: 1.05, lang: 'ko-KR' },
  // STARSHIP
  'starship-seunghoon': { rate: 1.0, pitch: 0.9, lang: 'ko-KR' },
  'starship-nari': { rate: 1.0, pitch: 1.0, lang: 'ko-KR' },
  'starship-jisoo': { rate: 1.05, pitch: 1.1, lang: 'ko-KR' },
};

const DEFAULT_SETTINGS = { rate: 1.0, pitch: 1.0, lang: 'ko-KR' };

function isSupported() {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing && existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (resolved) return;
      resolved = true;
      resolve(voices);
    };
    const handler = () => finish(synth.getVoices());
    synth.addEventListener?.('voiceschanged', handler, { once: true });
    setTimeout(() => finish(synth.getVoices()), 800);
  });
}

export function useJudgeVoice() {
  const [supported] = useState<boolean>(isSupported());
  const [enabled, setEnabled] = useState<boolean>(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const currentResolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    loadVoices().then((voices) => {
      if (!cancelled) voicesRef.current = voices || [];
    });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const stopSpeaking = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    if (currentResolveRef.current) {
      currentResolveRef.current();
      currentResolveRef.current = null;
    }
    setSpeakingId(null);
  }, [supported]);

  const speakText = useCallback(
    (text: string, judgeId: string): Promise<void> => {
      return new Promise<void>((resolve) => {
        if (!supported || !enabled || !text) {
          resolve();
          return;
        }
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* noop */
        }
        const settings = VOICE_SETTINGS[judgeId] ?? DEFAULT_SETTINGS;
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch;
        utterance.lang = settings.lang;

        const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
        if (voices && voices.length) {
          const matched = voices.find((v) => v.lang?.toLowerCase().startsWith(settings.lang.slice(0, 2).toLowerCase()));
          if (matched) utterance.voice = matched;
        }

        const finish = () => {
          if (currentResolveRef.current === finish) currentResolveRef.current = null;
          setSpeakingId((prev) => (prev === judgeId ? null : prev));
          resolve();
        };
        currentResolveRef.current = finish;

        utterance.onend = finish;
        utterance.onerror = finish;

        setSpeakingId(judgeId);
        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          finish();
        }
        // Safety: if for some reason onend never fires, resolve after a max delay
        const safety = Math.min(12000, 1500 + text.length * 80);
        setTimeout(() => finish(), safety);
      });
    },
    [supported, enabled],
  );

  const setVoiceEnabled = useCallback((next: boolean) => {
    setEnabled(next);
    if (!next) {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* noop */
      }
      setSpeakingId(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* noop */
      }
    };
  }, []);

  return {
    supported,
    enabled,
    speakingId,
    speakText,
    stopSpeaking,
    setVoiceEnabled,
  };
}

export default useJudgeVoice;
