// @ts-nocheck
import { useCallback, useState } from 'react';
import { buildKoreanPronunciationFallback } from '../utils/coachingFallbacks';

export function useKoreanPersonaCoach() {
  const [latest, setLatest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestCoaching = useCallback(async (args) => {
    setIsLoading(true);
    setError(null);
    const payload = {
      referenceText: args.referenceText || '',
      transcript: args.transcript || '',
      metrics: args.metrics || {},
      songAnalysis: args.songAnalysis || null,
      sessionPhase: args.sessionPhase || 'realtime',
      language: args.language || 'ko',
      coachTone: args.coachTone || 'friendly',
    };
    try {
      const res = await fetch('/api/coaching/korean-pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setLatest(data);
        return data;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      const fallback = buildKoreanPronunciationFallback(payload);
      setLatest(fallback);
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetCoach = useCallback(() => {
    setLatest(null);
    setError(null);
  }, []);

  return { latest, isLoading, error, requestCoaching, resetCoach };
}

export default useKoreanPersonaCoach;
