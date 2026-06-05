// @ts-nocheck
/** MediaPipe 관절 좌표 → 실제 각도·점수 메트릭 (usePoseDetection과 동일 로직) */

function angleDeg(ax, ay, bx, by, cx, cy) {
  const v1x = ax - bx;
  const v1y = ay - by;
  const v2x = cx - bx;
  const v2y = cy - by;
  const d1 = Math.hypot(v1x, v1y);
  const d2 = Math.hypot(v2x, v2y);
  if (d1 < 1e-6 || d2 < 1e-6) return null;
  let cos = (v1x * v2x + v1y * v2y) / (d1 * d2);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

function toScoreFromAngle(angle, target = 155, tolerance = 35) {
  if (angle == null) return 0;
  const delta = Math.abs(angle - target);
  const ratio = Math.max(0, 1 - delta / tolerance);
  return Math.round(ratio * 100);
}

function lineTiltDeg(a, b) {
  if (!a || !b) return null;
  return Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
}

function torsoLeanDeg(ls, rs, lh, rh) {
  if (!(ls && rs && lh && rh)) return null;
  const sc = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const hc = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  const dx = sc.x - hc.x;
  const dy = sc.y - hc.y;
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
}

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computePoseMetrics(joints) {
  if (!joints || !Object.keys(joints).length) {
    return {
      poseConfidence: 0,
      armAccuracy: 0,
      legAccuracy: 0,
      postureBalance: 0,
      symmetry: 0,
      danceActivity: 0,
      jointAccuracies: {},
    };
  }

  const j = joints;
  const vis = (name) => (j[name]?.visibility ?? 0) * 100;

  const leftElbowDeg = angleDeg(
    j.left_shoulder?.x,
    j.left_shoulder?.y,
    j.left_elbow?.x,
    j.left_elbow?.y,
    j.left_wrist?.x,
    j.left_wrist?.y,
  );
  const rightElbowDeg = angleDeg(
    j.right_shoulder?.x,
    j.right_shoulder?.y,
    j.right_elbow?.x,
    j.right_elbow?.y,
    j.right_wrist?.x,
    j.right_wrist?.y,
  );
  const leftKneeDeg = angleDeg(
    j.left_hip?.x,
    j.left_hip?.y,
    j.left_knee?.x,
    j.left_knee?.y,
    j.left_ankle?.x,
    j.left_ankle?.y,
  );
  const rightKneeDeg = angleDeg(
    j.right_hip?.x,
    j.right_hip?.y,
    j.right_knee?.x,
    j.right_knee?.y,
    j.right_ankle?.x,
    j.right_ankle?.y,
  );

  const armAccuracy = clamp(
    (toScoreFromAngle(leftElbowDeg) + toScoreFromAngle(rightElbowDeg)) / 2,
  );
  const legAccuracy = clamp(
    (toScoreFromAngle(leftKneeDeg, 160, 40) + toScoreFromAngle(rightKneeDeg, 160, 40)) / 2,
  );

  const shoulderTiltDeg = lineTiltDeg(j.left_shoulder, j.right_shoulder);
  const hipTiltDeg = lineTiltDeg(j.left_hip, j.right_hip);
  const torsoLean = torsoLeanDeg(j.left_shoulder, j.right_shoulder, j.left_hip, j.right_hip);

  const postureBalance = clamp(
    100 -
      (shoulderTiltDeg || 0) * 2 -
      (hipTiltDeg || 0) * 2 -
      (torsoLean || 0) * 1.5,
  );

  const leftArmVis = (vis('left_shoulder') + vis('left_elbow') + vis('left_wrist')) / 3;
  const rightArmVis = (vis('right_shoulder') + vis('right_elbow') + vis('right_wrist')) / 3;
  const symmetry = clamp(100 - Math.abs(leftArmVis - rightArmVis) * 1.2);

  const poseConfidence = clamp(
    Object.values(j).reduce((s, p) => s + (p.visibility || 0), 0) /
      Math.max(1, Object.keys(j).length) *
      100,
  );

  const danceActivity = clamp((armAccuracy + legAccuracy) / 2 + poseConfidence * 0.1);

  const jointAccuracies = {
    nose: clamp(vis('nose')),
    left_shoulder: clamp((vis('left_shoulder') + toScoreFromAngle(leftElbowDeg) * 0.3) / 1.3),
    right_shoulder: clamp((vis('right_shoulder') + toScoreFromAngle(rightElbowDeg) * 0.3) / 1.3),
    left_elbow: clamp((vis('left_elbow') + toScoreFromAngle(leftElbowDeg)) / 2),
    right_elbow: clamp((vis('right_elbow') + toScoreFromAngle(rightElbowDeg)) / 2),
    left_wrist: clamp(vis('left_wrist')),
    right_wrist: clamp(vis('right_wrist')),
    left_hip: clamp(vis('left_hip')),
    right_hip: clamp(vis('right_hip')),
    left_knee: clamp((vis('left_knee') + toScoreFromAngle(leftKneeDeg, 160, 40)) / 2),
    right_knee: clamp((vis('right_knee') + toScoreFromAngle(rightKneeDeg, 160, 40)) / 2),
    left_ankle: clamp(vis('left_ankle')),
    right_ankle: clamp(vis('right_ankle')),
  };

  return {
    poseConfidence,
    armAccuracy,
    legAccuracy,
    postureBalance,
    symmetry,
    danceActivity,
    leftElbowDeg,
    rightElbowDeg,
    leftKneeDeg,
    rightKneeDeg,
    shoulderTiltDeg,
    hipTiltDeg,
    torsoLeanDeg: torsoLean,
    jointAccuracies,
  };
}

export function metricsToTVScores(metrics, wristDelta = 0) {
  const rhythm = clamp(metrics.symmetry * 0.4 + metrics.danceActivity * 0.35 + wristDelta * 0.25);
  const posture = clamp(metrics.postureBalance * 0.5 + metrics.poseConfidence * 0.5);
  const angle = clamp(metrics.armAccuracy * 0.55 + metrics.legAccuracy * 0.45);
  const expression = clamp(metrics.poseConfidence * 0.35 + metrics.armAccuracy * 0.35 + metrics.symmetry * 0.3);
  const energy = clamp(metrics.danceActivity * 0.6 + metrics.armAccuracy * 0.4);
  const stability = clamp(metrics.postureBalance * 0.45 + metrics.legAccuracy * 0.35 + metrics.poseConfidence * 0.2);

  return { rhythm, posture, angle, expression, energy, stability };
}

export function vocalMeterToTVScores({ volumeLevel, tuningState, pitchScore }) {
  const pitch = pitchScore ?? (tuningState === 'in-tune' ? 85 : tuningState === 'idle' ? 0 : 55);
  const rhythm = clamp(volumeLevel * 0.35 + pitch * 0.25 + 40);
  const posture = clamp(70 + volumeLevel * 0.15);
  const angle = clamp(pitch * 0.9);
  const expression = clamp(volumeLevel * 0.4 + pitch * 0.35);
  const energy = clamp(volumeLevel * 0.7 + pitch * 0.2);
  const stability = clamp(pitch * 0.55 + (tuningState === 'in-tune' ? 35 : 15));

  return { rhythm, posture, angle, expression, energy, stability };
}
