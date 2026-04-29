// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';

const LANG_MAP: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  th: 'th-TH',
  vi: 'vi-VN',
  es: 'es-ES',
  fr: 'fr-FR',
  zh: 'zh-CN',
};

function pickConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(language: string = 'ko') {
  const [transcript, setTranscript] = useState<string>('');
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [supported] = useState<boolean>(!!pickConstructor());
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const finalRef = useRef<string>('');

  const localeTag = LANG_MAP[language] || (language?.includes('-') ? language : LANG_MAP.ko);

  const stopListening = useCallback((): string => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch { /* noop */ }
      try { rec.onresult = null; rec.onerror = null; rec.onend = null; } catch { /* noop */ }
    }
    recognitionRef.current = null;
    setIsListening(false);
    return finalRef.current.trim();
  }, []);

  const startListening = useCallback(() => {
    const Ctor = pickConstructor();
    if (!Ctor) {
      setError('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return false;
    }
    setError(null);
    finalRef.current = '';
    setFinalTranscript('');
    setTranscript('');

    try {
      const rec = new Ctor();
      rec.lang = localeTag;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const piece = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            final += piece;
          } else {
            interim += piece;
          }
        }
        if (interim) setTranscript(interim);
        if (final) {
          finalRef.current = (finalRef.current + ' ' + final).trim();
          setFinalTranscript(finalRef.current);
          setTranscript('');
        }
      };

      rec.onerror = (e: any) => {
        const code = e?.error || 'unknown';
        // 'no-speech' / 'aborted' are routine; skip surfacing those.
        if (code !== 'no-speech' && code !== 'aborted') {
          setError(`음성 인식 오류: ${code}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
      return true;
    } catch (err: any) {
      setError(String(err?.message || err));
      setIsListening(false);
      return false;
    }
  }, [localeTag]);

  const resetTranscript = useCallback(() => {
    finalRef.current = '';
    setFinalTranscript('');
    setTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try { rec.abort(); } catch { /* noop */ }
      }
      recognitionRef.current = null;
    };
  }, []);

  return {
    transcript,
    finalTranscript,
    isListening,
    supported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}

export default useSpeechRecognition;
