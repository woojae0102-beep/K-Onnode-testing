// @ts-nocheck
import { useCallback, useState } from 'react';
import type { SongAnalysis } from './useSpotifyAnalysis';

export type VocalSessionPhase = 'start' | 'mid' | 'end' | 'realtime';
export type VocalCoachPersona = 'jyp_park' | 'sm_choi' | 'hybe_soul' | 'yg_vocal';

export interface VocalCharacteristics {
  avgPitch: number;
  range: string;
  type: string;
  stability: number;
  strength: string;
  weakness: string;
}

export interface PitchDataInput {
  avgAccuracy?: number;
  problemSections?: string[];
  bestMoments?: string[];
  breathingStability?: number;
  emotionScore?: number;
}

export interface VocalSoulFeedback {
  coachLine: string;
  emotionImage: string;
  soulDirection: string;
  technicalAsEmotion: string;
  breathingTip: string;
  visualizationExercise: string;
  encouragement: string;
  soulScore: number;
  pitchScore: number;
  source?: string;
}

interface RequestArgs {
  songAnalysis: SongAnalysis | null;
  pitchData?: PitchDataInput | null;
  sessionPhase: VocalSessionPhase;
  coachPersona: VocalCoachPersona;
  userVocalCharacteristics?: VocalCharacteristics | null;
  language?: string;
  coachTone?: string;
  feedbackSensitivity?: number;
  coachMode?: string;
}

export function useVocalSoulCoach() {
  const [vocalCharacteristics, setVocalCharacteristics] = useState<VocalCharacteristics | null>(
    null
  );
  const [latest, setLatest] = useState<VocalSoulFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 첫 녹음의 음정 시계열에서 자동으로 보이스 특성 추출
  const analyzeVocalCharacteristics = useCallback(
    (pitchHistory: number[]): VocalCharacteristics | null => {
      if (!Array.isArray(pitchHistory) || pitchHistory.length < 10) return null;
      const valid = pitchHistory.filter((p) => typeof p === 'number' && p > 0);
      if (valid.length < 10) return null;

      const avgPitch = valid.reduce((a, b) => a + b, 0) / valid.length;
      const maxPitch = Math.max(...valid);
      const minPitch = Math.min(...valid);
      const range = maxPitch - minPitch;
      const variance =
        valid.reduce((sum, p) => sum + Math.pow(p - avgPitch, 2), 0) / valid.length;
      const stability = Math.max(0, 100 - Math.sqrt(variance) / 2);

      const pitchRange =
        avgPitch > 300 ? '고음역' : avgPitch > 200 ? '중고음역' : avgPitch > 150 ? '중음역' : '저음역';
      const voiceType =
        avgPitch > 280
          ? '맑고 높은 소프라노형'
          : avgPitch > 220
          ? '중고음의 메조소프라노형'
          : avgPitch > 160
          ? '안정적인 중음형'
          : '깊고 낮은 저음형';

      const characteristics: VocalCharacteristics = {
        avgPitch: Math.round(avgPitch),
        range: pitchRange,
        type: voiceType,
        stability: Math.round(stability),
        strength:
          stability > 70 ? '음정 안정성' : range > 200 ? '음역대 폭' : '감정 표현',
        weakness:
          stability < 50 ? '음정 안정성' : avgPitch > 250 ? '저음 파워' : '고음 처리',
      };
      setVocalCharacteristics(characteristics);
      return characteristics;
    },
    []
  );

  const requestCoaching = useCallback(
    async (args: RequestArgs): Promise<VocalSoulFeedback | null> => {
      if (!args.songAnalysis) return null;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/coaching/vocal-soul', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songAnalysis: args.songAnalysis,
            pitchData: args.pitchData || null,
            sessionPhase: args.sessionPhase,
            coachPersona: args.coachPersona,
            userVocalCharacteristics:
              args.userVocalCharacteristics || vocalCharacteristics || null,
            language: args.language || 'ko',
            coachTone: args.coachTone || 'friendly',
            feedbackSensitivity: args.feedbackSensitivity || 3,
            coachMode: args.coachMode || 'single',
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as VocalSoulFeedback;
        setLatest(data);
        return data;
      } catch (err: any) {
        setError(String(err?.message || err));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [vocalCharacteristics]
  );

  const resetCoach = useCallback(() => {
    setLatest(null);
    setError(null);
  }, []);

  return {
    vocalCharacteristics,
    analyzeVocalCharacteristics,
    latest,
    isLoading,
    error,
    requestCoaching,
    resetCoach,
  };
}
