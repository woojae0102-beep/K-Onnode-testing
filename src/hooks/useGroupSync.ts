// @ts-nocheck
import { useCallback, useRef, useState } from 'react';
import type { GroupMember, SkeletonFrameData } from '../types/groupPractice';

export function useGroupSync(myMemberId: string, _groupData: GroupMember[]) {
  const [syncScore, setSyncScore] = useState(0);
  const [missedBeats, setMissedBeats] = useState(0);
  const [scoreHistory, setScoreHistory] = useState<{ time: number; score: number }[]>([]);
  const lastScoreUpdateRef = useRef(0);

  const updateSyncScore = useCallback(
    (userPose: { joints?: Record<string, { x: number; y: number; z?: number }> }, currentFrame: SkeletonFrameData, currentTime: number) => {
      if (!userPose?.joints || !currentFrame) return null;

      const myFrameData = currentFrame.members.find((m) => m.estimatedMemberId === myMemberId);
      if (!myFrameData) return null;

      let totalAccuracy = 0;
      let jointCount = 0;

      Object.entries(userPose.joints).forEach(([jointName, userJoint]) => {
        const refJoint = myFrameData.joints[jointName];
        if (!refJoint) return;

        const distance = Math.sqrt(
          (userJoint.x - refJoint.x) ** 2 + (userJoint.y - refJoint.y) ** 2,
        );
        totalAccuracy += Math.max(0, 100 - distance * 400);
        jointCount += 1;
      });

      if (jointCount === 0) return null;

      const currentAccuracy = totalAccuracy / jointCount;

      if (currentTime - lastScoreUpdateRef.current > 0.5) {
        lastScoreUpdateRef.current = currentTime;

        if (currentAccuracy < 30) {
          setMissedBeats((prev) => prev + 1);
        }

        setScoreHistory((prev) => [...prev, { time: currentTime, score: currentAccuracy }]);
      }

      setSyncScore((prev) => prev * 0.7 + currentAccuracy * 0.3);
      return currentAccuracy;
    },
    [myMemberId],
  );

  const getFinalStats = useCallback(() => {
    if (scoreHistory.length === 0) {
      return { avgScore: 0, missedBeats, worstMoments: [] as number[], bestMoments: [] as number[], scoreHistory };
    }

    const avgScore =
      scoreHistory.reduce((sum, s) => sum + s.score, 0) / scoreHistory.length;
    const sorted = [...scoreHistory].sort((a, b) => a.score - b.score);

    return {
      avgScore: Math.round(avgScore),
      missedBeats,
      worstMoments: sorted.slice(0, 3).map((s) => s.time),
      bestMoments: sorted.slice(-3).map((s) => s.time),
      scoreHistory,
    };
  }, [scoreHistory, missedBeats]);

  return { syncScore, missedBeats, updateSyncScore, getFinalStats };
}

export default useGroupSync;
