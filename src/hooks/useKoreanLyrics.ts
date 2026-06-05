// @ts-nocheck
import { useCallback, useState } from 'react';
import { buildKoreanLyricsFallback } from '../utils/coachingFallbacks';

export function useKoreanLyrics() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchLyrics = useCallback(async (songTitle, songArtist = '') => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/coaching/korean-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songTitle, songArtist }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.lyrics || '';
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      const fallback = buildKoreanLyricsFallback({ songTitle, songArtist });
      return fallback.lyrics;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetchLyrics, isLoading, error };
}

export default useKoreanLyrics;
