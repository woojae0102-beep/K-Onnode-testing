// @ts-nocheck
import { useCallback, useRef, useState } from 'react';

function dist(a, b) {
  if (!a || !b) return 1;
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function useSyncScore(myMemberId, myDefault) {
  const [scores, setScores] = useState({
    overall: 0,
    position: 0,
    timing: 0,
    pose: 0,
    energy: 0,
    formation: 0,
  });
  const energyHistRef = useRef([]);
  const lastFrameTimeRef = useRef(0);

  const calculate = useCallback(
    (userPose, frame, elapsed) => {
      if (!userPose?.joints || !frame) return;

      const myFrame = frame.members.find((m) => m.estimatedMemberId === myMemberId);

      let poseTotal = 0;
      let poseCount = 0;
      if (myFrame?.joints) {
        Object.entries(userPose.joints).forEach(([name, joint]) => {
          const ref = myFrame.joints[name];
          if (!ref) return;
          poseTotal += Math.max(0, 100 - dist(joint, ref) * 400);
          poseCount += 1;
        });
      }
      const pose = poseCount > 0 ? Math.round(poseTotal / poseCount) : 0;

      const position = userPose.joints.nose
        ? Math.max(0, Math.round(100 - dist(userPose.joints.nose, myDefault) * 300))
        : 0;

      const frameTime = frame.timestamp || 0;
      const timingDrift = Math.abs(elapsed - frameTime);
      const timing = Math.max(0, Math.round(100 - timingDrift * 80));

      const movement =
        userPose.joints.left_wrist && userPose.joints.right_wrist
          ? dist(userPose.joints.left_wrist, userPose.joints.right_wrist)
          : 0;
      energyHistRef.current.push(movement);
      if (energyHistRef.current.length > 20) energyHistRef.current.shift();
      const avgMove =
        energyHistRef.current.reduce((a, b) => a + b, 0) / energyHistRef.current.length;
      const energy = Math.min(100, Math.round(avgMove * 500 + 40));

      let formationTotal = 0;
      let formationCount = 0;
      frame.members.forEach((m) => {
        if (m.estimatedMemberId === myMemberId) return;
        const refNose = m.joints?.nose;
        if (refNose && userPose.joints.nose) {
          formationTotal += Math.max(0, 100 - Math.abs(refNose.y - userPose.joints.nose.y) * 200);
          formationCount += 1;
        }
      });
      const formation = formationCount > 0 ? Math.round(formationTotal / formationCount) : pose;

      const overall = Math.round(
        position * 0.25 + timing * 0.2 + pose * 0.3 + energy * 0.1 + formation * 0.15,
      );

      lastFrameTimeRef.current = frameTime;

      setScores({ overall, position, timing, pose, energy, formation });
    },
    [myMemberId, myDefault],
  );

  const reset = useCallback(() => {
    energyHistRef.current = [];
    setScores({ overall: 0, position: 0, timing: 0, pose: 0, energy: 0, formation: 0 });
  }, []);

  return { scores, calculate, reset };
}

export default useSyncScore;
