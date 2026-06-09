// @ts-nocheck
import { useCallback, useMemo } from 'react';
import { GROUP_DATA } from '../data/groupPracticeData';

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function useFormationTracker(groupId, myMemberId) {
  const group = GROUP_DATA[groupId];

  const defaultPositions = useMemo(() => {
    if (!group) return {};
    const map = {};
    group.members.forEach((m) => {
      map[m.id] = { x: m.defaultX, y: m.defaultY };
    });
    return map;
  }, [group]);

  const myDefault = defaultPositions[myMemberId] || { x: 0.5, y: 0.5 };

  const scoreFormation = useCallback(
    (userJoints, frame) => {
      if (!userJoints || !frame) return 0;

      const myFrame = frame.members.find((m) => m.estimatedMemberId === myMemberId);
      if (!myFrame?.joints) return 0;

      let total = 0;
      let count = 0;

      Object.entries(userJoints).forEach(([name, joint]) => {
        const ref = myFrame.joints[name];
        if (!ref) return;
        const d = dist(joint, ref);
        total += Math.max(0, 100 - d * 400);
        count += 1;
      });

      return count > 0 ? Math.round(total / count) : 0;
    },
    [myMemberId],
  );

  const scorePosition = useCallback(
    (userJoints) => {
      if (!userJoints?.nose) return 0;
      const d = dist(userJoints.nose, myDefault);
      return Math.max(0, Math.round(100 - d * 300));
    },
    [myDefault],
  );

  return {
    defaultPositions,
    myDefault,
    scoreFormation,
    scorePosition,
    formationType: group?.defaultFormation || 'line',
  };
}

export default useFormationTracker;
