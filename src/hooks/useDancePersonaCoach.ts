// @ts-nocheck
import { useCallback, useState } from 'react';
import type { SongAnalysis } from './useSpotifyAnalysis';

export type DanceSessionPhase = 'start' | 'mid' | 'end' | 'realtime';
export type DanceCoachPersona = 'jyp_jung' | 'yg_lee' | 'hybe_kim' | 'sm_choi';

export interface PoseDataInput {
  overallScore?: number;
  rhythmScore?: number;
  expressionScore?: number;
  mainIssues?: string[];
  strengths?: string[];
}

export interface DanceCoachFeedback {
  coachLine: string;
  personaActivated: boolean;
  personaComment: string;
  keyCorrection: string;
  encouragement: string;
  nextFocus: string;
  emotionalScore: number;
  technicalScore: number;
  source?: string;
}

interface RequestArgs {
  songAnalysis: SongAnalysis | null;
  poseData?: PoseDataInput | null;
  sessionPhase: DanceSessionPhase;
  coachPersona: DanceCoachPersona;
  language?: string;
  coachTone?: string;
  feedbackSensitivity?: number;
  coachMode?: string;
}

export function useDancePersonaCoach() {
  const [latest, setLatest] = useState<DanceCoachFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCoaching = useCallback(
    async (args: RequestArgs): Promise<DanceCoachFeedback | null> => {
      if (!args.songAnalysis) return null;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/coaching/dance-persona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songAnalysis: args.songAnalysis,
            poseData: args.poseData || null,
            sessionPhase: args.sessionPhase,
            coachPersona: args.coachPersona,
            language: args.language || 'ko',
            coachTone: args.coachTone || 'friendly',
            feedbackSensitivity: args.feedbackSensitivity || 3,
            coachMode: args.coachMode || 'single',
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DanceCoachFeedback;
        setLatest(data);
        return data;
      } catch (err: any) {
        setError(String(err?.message || err));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const resetCoach = useCallback(() => {
    setLatest(null);
    setError(null);
  }, []);

  return { latest, isLoading, error, requestCoaching, resetCoach };
}
