// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { useJudgeVoice } from './useJudgeVoice';
import type { Agency, FeedbackItem, PoseData } from '../types/tv';
import { AGENCY_JUDGE_IDS } from '../types/tv';

const JOINT_KR = {
  left_shoulder: '왼쪽 어깨',
  right_shoulder: '오른쪽 어깨',
  left_elbow: '왼쪽 팔꿈치',
  right_elbow: '오른쪽 팔꿈치',
  left_wrist: '왼쪽 손목',
  right_wrist: '오른쪽 손목',
  left_hip: '왼쪽 골반',
  right_hip: '오른쪽 골반',
  left_knee: '왼쪽 무릎',
  right_knee: '오른쪽 무릎',
  left_ankle: '왼쪽 발목',
  right_ankle: '오른쪽 발목',
  nose: '상체',
};

function getPoolFeedback(agency, joint, accuracy) {
  const jointKr = JOINT_KR[joint] || joint;

  if (accuracy > 80) {
    const praisePool = {
      hybe: [`${jointKr} 좋아요. 표현력이 살아있어요.`, '그 느낌 그대로 유지해요.'],
      jyp: [`${jointKr} 정확해요!`, '박자도 맞고 있어요. 계속!'],
      sm: [`${jointKr} 좋습니다. 디테일이 살았어요.`, 'SM 느낌이 나고 있어요.'],
      yg: [`${jointKr} 있어요. 카리스마가 보여요.`, '그 에너지 유지해요.'],
    };
    const pool = praisePool[agency];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const correctionPool = {
    hybe: [
      `${jointKr}에 더 감정을 실어요.`,
      `${jointKr} 각도가 표현을 방해하고 있어요.`,
    ],
    jyp: [
      `${jointKr}을 더 정확하게 맞춰요. 박자 신경써요.`,
      `${jointKr} 동작이 박자보다 늦어요.`,
    ],
    sm: [
      `${jointKr} 디테일이 부족해요. 끝처리 신경써요.`,
      `${jointKr} 각도를 더 선명하게 만들어요.`,
    ],
    yg: [
      `${jointKr}에 힘이 없어요. 더 강하게요.`,
      `${jointKr} 스타성이 부족해요. 믿고 던져요.`,
    ],
  };
  const pool = correctionPool[agency];
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatTime() {
  return new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function useRealtimeFeedback(
  poseData: PoseData | null,
  agency: Agency,
  mode = 'dance',
  vocalMetrics = null,
  playbackSpeed = 1,
  options: { silent?: boolean } = {},
) {
  const silent = options.silent === true;
  const [feedback, setFeedback] = useState([]);
  const lastFeedbackTime = useRef(0);
  const lastTimestamp = useRef(0);
  const { speakText } = useJudgeVoice();

  const fetchAIFeedback = async (pose, agencyId) => {
    try {
      const res = await fetch('/api/tv/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poseData: pose,
          agency: agencyId,
          language: 'ko',
        }),
      });
      const data = await res.json();
      if (data.feedback) {
        const aiFeedback = {
          type: 'coaching',
          message: data.feedback,
          accuracy: data.accuracy,
          timestamp: formatTime(),
          isAI: true,
        };
        setFeedback((prev) => [aiFeedback, ...prev].slice(0, 8));
      }
    } catch {
      /* pool fallback */
    }
  };

  const generateFeedback = (pose, agencyId) => {
    const worstJoint = Object.entries(pose.jointAccuracies || {}).sort(
      ([, a], [, b]) => a - b,
    )[0];

    if (!worstJoint) return;

    const [jointName, accuracy] = worstJoint;
    const poolFeedback = getPoolFeedback(agencyId, jointName, accuracy);

    const newFeedback = {
      type: accuracy > 70 ? 'praise' : 'correction',
      message: poolFeedback,
      accuracy: Math.round(accuracy),
      timestamp: formatTime(),
      joint: jointName,
    };

    setFeedback((prev) => [newFeedback, ...prev].slice(0, 8));

    if (!silent && Math.random() < 0.3) {
      speakText(poolFeedback, AGENCY_JUDGE_IDS[agencyId], playbackSpeed);
    }

    if (!silent && Math.random() < 0.3) {
      fetchAIFeedback(pose, agencyId);
    }
  };

  useEffect(() => {
    const now = Date.now();
    if (now - lastFeedbackTime.current < 5000) return;

    if (mode === 'vocal' && vocalMetrics?.pitchScore > 0) {
      lastFeedbackTime.current = now;
      const accuracy = vocalMetrics.pitchScore;
      const poolFeedback = getPoolFeedback(
        agency,
        'nose',
        accuracy,
      );
      const vocalMsg =
        vocalMetrics.tuningState === 'in-tune'
          ? `음정 좋아요! ${poolFeedback}`
          : vocalMetrics.pitchFeedback || poolFeedback;

      const newFeedback = {
        type: accuracy > 70 ? 'praise' : 'correction',
        message: vocalMsg,
        accuracy: Math.round(accuracy),
        timestamp: formatTime(),
      };
      setFeedback((prev) => [newFeedback, ...prev].slice(0, 8));
      if (!silent && Math.random() < 0.3) speakText(vocalMsg, AGENCY_JUDGE_IDS[agency], playbackSpeed);
      return;
    }

    if (!poseData) return;
    if (poseData.timestamp === lastTimestamp.current) return;
    lastTimestamp.current = poseData.timestamp;
    lastFeedbackTime.current = now;

    generateFeedback(poseData, agency);
  }, [poseData, agency, mode, vocalMetrics, playbackSpeed]);

  return { feedback };
}

export default useRealtimeFeedback;
