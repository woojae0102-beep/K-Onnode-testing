// @ts-nocheck
import { useCallback, useState } from 'react';
import { buildVocalCloneFallback, buildVocalCoverFallback } from '../utils/coachingFallbacks';

export function useVocalVoiceClone() {
  const [cloneProfile, setCloneProfile] = useState(null);
  const [cover, setCover] = useState(null);
  const [isCloning, setIsCloning] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [error, setError] = useState('');

  const cloneVoice = useCallback(async ({ vocalCharacteristics, songAnalysis, pitchHistory = [] }) => {
    setIsCloning(true);
    setError('');
    try {
      const res = await fetch('/api/coaching/vocal-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vocalCharacteristics,
          songAnalysis,
          pitchHistory: pitchHistory.slice(-60),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCloneProfile(data);
        return data;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch {
      const fallback = buildVocalCloneFallback({ vocalCharacteristics, songAnalysis });
      setCloneProfile(fallback);
      return fallback;
    } finally {
      setIsCloning(false);
    }
  }, []);

  const generateCover = useCallback(async ({ songAnalysis, cloneProfile: profile, lyrics = [] }) => {
    setIsGeneratingCover(true);
    setError('');
    try {
      const res = await fetch('/api/coaching/vocal-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songAnalysis,
          voiceProfile: profile || cloneProfile,
          lyrics,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCover(data);
        return data;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch {
      const fallback = buildVocalCoverFallback({ songAnalysis, lyrics });
      setCover(fallback);
      return fallback;
    } finally {
      setIsGeneratingCover(false);
    }
  }, [cloneProfile]);

  const reset = useCallback(() => {
    setCloneProfile(null);
    setCover(null);
    setError('');
  }, []);

  return {
    cloneProfile,
    cover,
    isCloning,
    isGeneratingCover,
    error,
    cloneVoice,
    generateCover,
    reset,
  };
}

export default useVocalVoiceClone;
