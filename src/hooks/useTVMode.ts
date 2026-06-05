// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRealtimeFeedback } from './useRealtimeFeedback';
import type { Agency, FeedbackItem, PoseData, ScoreData, SessionData, TrainingMode } from '../types/tv';
import { metricsToTVScores, vocalMeterToTVScores } from '../utils/poseMetrics';

const AGENCY_WEIGHTS = {
  jyp: { rhythm: 1.3, posture: 1.2, angle: 1.1, expression: 1.0, energy: 1.0, stability: 1.2 },
  hybe: { rhythm: 1.1, posture: 1.0, angle: 1.0, expression: 1.4, energy: 1.2, stability: 1.0 },
  sm: { rhythm: 1.1, posture: 1.2, angle: 1.3, expression: 1.2, energy: 1.0, stability: 1.1 },
  yg: { rhythm: 1.1, posture: 1.0, angle: 1.0, expression: 1.2, energy: 1.5, stability: 1.0 },
};

const SCORE_KEYS = ['rhythm', 'posture', 'angle', 'expression', 'energy', 'stability'];

function calcOverall(scores, agency) {
  const weights = AGENCY_WEIGHTS[agency];
  const weighted =
    SCORE_KEYS.reduce((sum, key) => sum + (scores[key] || 0) * (weights[key] || 1), 0) /
    SCORE_KEYS.length;
  return Math.min(100, Math.round(weighted));
}

function getStrengthsWeaknesses(scores) {
  const labels = {
    rhythm: '리듬',
    posture: '자세',
    angle: '각도',
    expression: '표현력',
    energy: '에너지',
    stability: '안정성',
  };
  const sorted = SCORE_KEYS.map((k) => ({ key: k, label: labels[k], score: scores[k] || 0 }))
    .sort((a, b) => b.score - a.score);

  return {
    strengths: sorted.slice(0, 2).map((s) => `${s.label} (${s.score}점)`),
    weaknesses: sorted
      .slice(-2)
      .reverse()
      .map((s) => `${s.label} — ${s.score < 60 ? '집중 연습 필요' : '미세 조정 필요'}`),
  };
}

function getRecommendations(scores, agency, mode) {
  const weak = SCORE_KEYS.map((k) => ({ k, v: scores[k] || 0 }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 2);

  const tips = {
    rhythm: '메트로놈 80BPM으로 박자 드릴 10분',
    posture: '거울 앞 코어 자세 교정 15분',
    angle: mode === 'vocal' ? '음정 스케일 반복 10분' : '팔·다리 각도 미러 체크 반복',
    expression: mode === 'vocal' ? '감정 표현 발성 연습 10분' : '감정 표현 미러 연습 10분',
    energy: mode === 'vocal' ? '복식 호흡 + 파워 발성 5분' : '파워 동작 3세트 × 8회',
    stability: mode === 'vocal' ? '호흡 안정화 롱톤 5분' : '밸런스 홀드 30초 × 5세트',
  };

  const agencyTip = {
    hybe: '표현력 중심 프리스타일 5분',
    jyp: '정확한 카운트 연습 10분',
    sm: '끝동작 디테일 집중 10분',
    yg: '무대 존재감 연습 5분',
  };

  return [
    tips[weak[0]?.k] || '기본 워밍업 10분',
    tips[weak[1]?.k] || '스트레칭 10분',
    mode === 'vocal' ? '발성 워밍업 + 피치 드릴' : agencyTip[agency],
  ];
}

export function useTVMode({
  poseData,
  vocalMetrics,
  agency,
  mode,
  playbackSpeed = 1,
}: {
  poseData: PoseData | null;
  vocalMetrics?: {
    volumeLevel: number;
    tuningState: string;
    pitchScore: number;
    pitchFeedback?: string;
  } | null;
  agency: Agency;
  mode: TrainingMode;
  playbackSpeed?: number;
}) {
  const [sessionTime, setSessionTime] = useState(0);
  const [scores, setScores] = useState({
    rhythm: 0,
    posture: 0,
    angle: 0,
    expression: 0,
    energy: 0,
    stability: 0,
  });
  const scoreHistory = useRef([]);
  const wristHistory = useRef([]);
  const startTime = useRef(Date.now());

  const { feedback } = useRealtimeFeedback(poseData, agency, mode, vocalMetrics, playbackSpeed, {
    silent: true,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let next = null;

    if (mode === 'vocal' && vocalMetrics?.pitchScore > 0) {
      next = vocalMeterToTVScores(vocalMetrics);
    } else if (mode === 'dance' && poseData?.metrics) {
      const lw = poseData.joints?.left_wrist;
      const rw = poseData.joints?.right_wrist;
      if (lw && rw) {
        const movement = Math.hypot(lw.x - rw.x, lw.y - rw.y);
        wristHistory.current.push(movement);
        if (wristHistory.current.length > 30) wristHistory.current.shift();
      }
      const wristDelta =
        wristHistory.current.length > 2
          ? Math.min(
              100,
              Math.abs(
                wristHistory.current[wristHistory.current.length - 1] -
                  wristHistory.current[0],
              ) * 200,
            )
          : 0;
      next = metricsToTVScores(poseData.metrics, wristDelta);
    }

    if (!next) return;

    setScores((prev) => {
      const blended = {};
      SCORE_KEYS.forEach((k) => {
        blended[k] = Math.round(prev[k] * 0.7 + next[k] * 0.3);
      });
      return blended;
    });
    scoreHistory.current.push(next);
    if (scoreHistory.current.length > 100) scoreHistory.current.shift();
  }, [poseData, vocalMetrics, mode]);

  const overallScore = useMemo(() => calcOverall(scores, agency), [scores, agency]);

  const buildSessionData = (extra: { feedback?: FeedbackItem[]; coachReview?: string } = {}): SessionData => {
    const { strengths, weaknesses } = getStrengthsWeaknesses(scores);
    const prevOverall =
      scoreHistory.current.length > 10
        ? calcOverall(scoreHistory.current[0], agency)
        : Math.max(0, overallScore - 5);
    const growthRate = Math.round(
      ((overallScore - prevOverall) / Math.max(prevOverall, 1)) * 100,
    );

    return {
      overallScore,
      scores,
      sessionTime,
      agency,
      mode,
      growthRate: Math.max(-20, Math.min(30, growthRate)),
      strengths,
      weaknesses,
      recommendations: getRecommendations(scores, agency, mode),
      passProbability: Math.min(
        95,
        Math.max(15, overallScore - 10 + (agency === 'sm' ? 5 : 0)),
      ),
      feedback: extra.feedback || feedback,
      coachReview: extra.coachReview,
    };
  };

  return {
    scores,
    feedback,
    sessionTime,
    overallScore,
    buildSessionData,
  };
}

export default useTVMode;
