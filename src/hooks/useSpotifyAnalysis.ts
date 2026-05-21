// @ts-nocheck
import { useCallback, useState } from 'react';

export interface SongAnalysis {
  trackId: string;
  trackName: string;
  artistName: string;
  albumArt: string;

  bpm: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  loudness: number;

  genre: string;
  mood: string;
  danceStyle: string;
  vocalStyle: string;
  emotionKeywords: string[];
  colorPalette: string[];
  movementKeywords: string[];
  personaName: string;
  personaDescription: string;
  danceAttitude: string;
  vocalAttitude: string;

  source?: string;
}

// Heuristic defaults used when Spotify is unreachable (no client id /
// network error). They are intentionally vague so Claude can still
// produce a useful persona from just the song/artist text.
function buildHeuristicFeatures(query: string) {
  const q = (query || '').toLowerCase();
  const energy =
    /(power|hype|fire|fight|kill|attack|killer|loud|hot|burning|쾅|폭|불|hot)/i.test(q)
      ? 0.85
      : /(love|together|forever|memory|dream|moon|night|cry|tears|어쩌|봄|봄날|혼자|혼)/i.test(q)
      ? 0.4
      : 0.6;
  const valence =
    /(sad|cry|tear|alone|gone|miss|empty|혼자|슬|이별|울|미안)/i.test(q)
      ? 0.25
      : /(love|happy|smile|sunshine|dance|party|봄|꽃|빛|하늘|행복)/i.test(q)
      ? 0.8
      : 0.55;
  const danceability = /(dance|club|party|move|groove|swing|disco|bass)/i.test(q)
    ? 0.85
    : 0.6;
  return {
    bpm: 110,
    energy,
    danceability,
    valence,
    acousticness: 0.2,
    instrumentalness: 0.05,
    loudness: -6,
  };
}

async function fetchSpotifyToken(): Promise<string> {
  try {
    const res = await fetch('/api/spotify/token', { method: 'POST' });
    if (!res.ok) return '';
    const data = await res.json();
    return data?.access_token || '';
  } catch {
    return '';
  }
}

async function searchTrack(token: string, query: string) {
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1&market=KR`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.tracks?.items?.[0] || null;
  } catch {
    return null;
  }
}

async function fetchAudioFeatures(token: string, trackId: string) {
  if (!token || !trackId) return null;
  try {
    const res = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function useSpotifyAnalysis() {
  const [songAnalysis, setSongAnalysis] = useState<SongAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeSong = useCallback(
    async (query: string, opts: { language?: string } = {}): Promise<SongAnalysis | null> => {
      const trimmed = (query || '').trim();
      if (!trimmed) return null;

      setIsAnalyzing(true);
      setError(null);
      try {
        const token = await fetchSpotifyToken();
        const track = token ? await searchTrack(token, trimmed) : null;
        const features = track ? await fetchAudioFeatures(token, track.id) : null;

        const featurePayload = features
          ? {
              bpm: Math.round(Number(features.tempo) || 0),
              energy: Number(features.energy) || 0.5,
              danceability: Number(features.danceability) || 0.5,
              valence: Number(features.valence) || 0.5,
              acousticness: Number(features.acousticness) || 0.2,
              loudness: Number(features.loudness) || -8,
            }
          : buildHeuristicFeatures(trimmed);

        let trackName = trimmed;
        let artistName = '';
        let albumArt = '';
        let trackId = '';
        let instrumentalness = 0.05;

        if (track) {
          trackId = track.id || '';
          trackName = track.name || trimmed;
          artistName = track.artists?.[0]?.name || '';
          albumArt = track.album?.images?.[0]?.url || '';
        } else {
          const parts = trimmed.split(/\s*[-—–]\s*/);
          if (parts.length >= 2) {
            trackName = parts[0];
            artistName = parts.slice(1).join(' - ');
          }
        }

        if (features) instrumentalness = Number(features.instrumentalness) || 0.05;

        const analysisRes = await fetch('/api/coaching/analyze-song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackName,
            artistName,
            features: featurePayload,
            language: opts.language || 'ko',
          }),
        });
        const analysis = analysisRes.ok ? await analysisRes.json() : {};

        const result: SongAnalysis = {
          trackId,
          trackName,
          artistName,
          albumArt,
          bpm: featurePayload.bpm,
          energy: featurePayload.energy,
          danceability: featurePayload.danceability,
          valence: featurePayload.valence,
          acousticness: featurePayload.acousticness,
          instrumentalness,
          loudness: featurePayload.loudness,
          genre: analysis.genre || 'K-POP',
          mood: analysis.mood || '감성',
          danceStyle: analysis.danceStyle || '감성적',
          vocalStyle: analysis.vocalStyle || '부드러운',
          emotionKeywords: Array.isArray(analysis.emotionKeywords)
            ? analysis.emotionKeywords
            : ['감정', '몰입', '표현'],
          colorPalette: Array.isArray(analysis.colorPalette)
            ? analysis.colorPalette
            : ['파랑', '흰색'],
          movementKeywords: Array.isArray(analysis.movementKeywords)
            ? analysis.movementKeywords
            : ['부드러운', '흐르는', '섬세한'],
          personaName: analysis.personaName || '이 곡의 주인공',
          personaDescription:
            analysis.personaDescription || '곡의 감정을 무대 위에 그대로 옮기는 존재',
          danceAttitude:
            analysis.danceAttitude || '곡의 감정선에 몸을 맡기고 자연스럽게 표현하세요.',
          vocalAttitude:
            analysis.vocalAttitude || '가사의 감정을 먼저 떠올린 후 목소리를 내세요.',
          source: track ? 'spotify' : 'heuristic',
        };

        setSongAnalysis(result);
        return result;
      } catch (err: any) {
        setError(String(err?.message || err));
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const getSongVibeDescription = useCallback((analysis: SongAnalysis): string => {
    const energy =
      analysis.energy > 0.7 ? '강렬한' : analysis.energy > 0.4 ? '중간 에너지의' : '잔잔한';
    const mood =
      analysis.valence > 0.6 ? '밝고 긍정적인' : analysis.valence > 0.3 ? '복합적인' : '어둡고 진중한';
    return `${energy} ${mood} ${analysis.danceStyle} 스타일`;
  }, []);

  const resetSongAnalysis = useCallback(() => {
    setSongAnalysis(null);
    setError(null);
  }, []);

  return {
    songAnalysis,
    isAnalyzing,
    error,
    analyzeSong,
    getSongVibeDescription,
    resetSongAnalysis,
  };
}
