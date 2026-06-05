// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HolisticLandmarker } from '@mediapipe/tasks-vision';
import {
  cancelVideoFrame,
  getOptimizedCanvasContext,
  scheduleVideoFrame,
  syncCanvasToVideo,
} from '../utils/cameraFrameLoop';

const ANALYZE_INTERVAL_MS = 1000 / 15;
const STATE_UPDATE_INTERVAL_MS = 100;
const WRIST_HISTORY_WINDOW_MS = 1800;
const POSE_EDGES = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];
const HAND_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

function toScoreFromAngle(angle, target = 155, tolerance = 35) {
  if (angle == null) return 0;
  const delta = Math.abs(angle - target);
  const ratio = Math.max(0, 1 - delta / tolerance);
  return Math.round(ratio * 100);
}

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

function toClockText(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function lineTiltDeg(a, b) {
  if (!a || !b) return null;
  return Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
}

function torsoLeanDeg(leftShoulder, rightShoulder, leftHip, rightHip) {
  if (!(leftShoulder && rightShoulder && leftHip && rightHip)) return null;
  const shoulderCenter = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
  const hipCenter = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
  const dx = shoulderCenter.x - hipCenter.x;
  const dy = shoulderCenter.y - hipCenter.y;
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildIssue(metrics) {
  if (metrics.poseConfidence < 45) return '전신이 프레임 안에 들어오도록 카메라 거리와 각도를 먼저 맞춰주세요.';
  if (metrics.armAccuracy < 60) return '팔꿈치 각도가 작습니다. 팔을 더 크게 펴서 동작을 또렷하게 만드세요.';
  if (metrics.legAccuracy < 60) return '무릎 각도가 충분히 나오지 않습니다. 하체 굽힘/신전을 더 크게 써주세요.';
  if (metrics.postureBalance < 60) return '상체 기울기가 큽니다. 어깨-골반 라인을 수평에 가깝게 유지해보세요.';
  if (metrics.danceActivity < 45) return '손 이동량이 적습니다. 박자에 맞춰 팔 스윙 크기를 키워주세요.';
  return '좋아요! 현재 자세 안정성이 높습니다. 타이밍 정확도만 더 끌어올려 보세요.';
}

function buildFeedbackList(metrics) {
  const tips = [];
  if (metrics.poseConfidence < 55) tips.push('카메라가 전신을 놓치고 있어요. 발끝까지 화면에 들어오게 1~2걸음 뒤로 가보세요.');
  if (metrics.leftElbowDeg != null && metrics.leftElbowDeg < 140) tips.push(`왼팔 각도 ${Math.round(metrics.leftElbowDeg)}도: 팔꿈치를 더 펴서 150~170도를 목표로 맞춰보세요.`);
  if (metrics.rightElbowDeg != null && metrics.rightElbowDeg < 140) tips.push(`오른팔 각도 ${Math.round(metrics.rightElbowDeg)}도: 어깨부터 손끝까지 직선을 길게 만들어주세요.`);
  if (metrics.leftKneeDeg != null && metrics.leftKneeDeg < 145) tips.push(`왼무릎 각도 ${Math.round(metrics.leftKneeDeg)}도: 무릎 굽힘 타이밍을 더 분명하게 주세요.`);
  if (metrics.rightKneeDeg != null && metrics.rightKneeDeg < 145) tips.push(`오른무릎 각도 ${Math.round(metrics.rightKneeDeg)}도: 하체 중심을 낮춰 안정적으로 동작해보세요.`);
  if (metrics.shoulderTiltDeg != null && metrics.shoulderTiltDeg > 12) tips.push(`어깨 기울기 ${Math.round(metrics.shoulderTiltDeg)}도: 좌우 어깨 높이를 맞춰 상체를 수평에 가깝게 유지하세요.`);
  if (metrics.hipTiltDeg != null && metrics.hipTiltDeg > 10) tips.push(`골반 기울기 ${Math.round(metrics.hipTiltDeg)}도: 골반 중심을 정면으로 고정해 흔들림을 줄여보세요.`);
  if (metrics.torsoLeanDeg != null && metrics.torsoLeanDeg > 14) tips.push(`상체 기울기 ${Math.round(metrics.torsoLeanDeg)}도: 코어를 조여 몸통이 한쪽으로 기울지 않게 해보세요.`);
  if (metrics.danceActivity < 55) tips.push('동작 크기가 작아요. 손목 궤적을 더 크게 써서 에너지를 올려주세요.');
  if (!tips.length) tips.push('현재 관절 정렬이 안정적입니다. 다음은 박자 타이밍과 디테일 표현을 다듬어 보세요.');
  return tips.slice(0, 5);
}

function buildNeeds(metrics) {
  const needs = [];
  if (metrics.poseConfidence < 60) needs.push('전신 프레이밍');
  if (metrics.armAccuracy < 70) needs.push('팔 각도');
  if (metrics.legAccuracy < 70) needs.push('무릎 각도');
  if (metrics.postureBalance < 70) needs.push('상체 정렬');
  if (metrics.symmetry < 70) needs.push('좌우 대칭');
  if (metrics.danceActivity < 70) needs.push('동작 크기');
  return needs.length ? needs.join(' · ') : '박자 정확도 · 코어 고정';
}

function drawConnections(ctx, landmarks, edges, width, height, color, minVis = 0.2, lineWidth = 2) {
  if (!landmarks?.length) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  for (const [a, b] of edges) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    const va = pa.visibility ?? pa.v ?? 1;
    const vb = pb.visibility ?? pb.v ?? 1;
    if (va < minVis || vb < minVis) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
    ctx.stroke();
  }
}

function drawPoints(ctx, landmarks, width, height, color, radius, minVis = 0.2) {
  if (!landmarks?.length) return;
  ctx.fillStyle = color;
  for (let i = 0; i < landmarks.length; i += 1) {
    const p = landmarks[i];
    if (!p) continue;
    const v = p.visibility ?? p.v ?? 1;
    if (v < minVis) continue;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderOverlay(canvas, video, poseLandmarks, leftHandLandmarks, rightHandLandmarks) {
  if (!canvas || !video) return;
  const w = video.videoWidth || 0;
  const h = video.videoHeight || 0;
  if (!w || !h) return;
  syncCanvasToVideo(canvas, video);
  const ctx = getOptimizedCanvasContext(canvas);
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!poseLandmarks?.length) return;

  drawConnections(ctx, poseLandmarks, POSE_EDGES, w, h, 'rgba(34, 211, 238, 0.9)', 0.2, 2.5);
  drawPoints(ctx, poseLandmarks, w, h, 'rgba(255, 255, 255, 0.95)', 3.3, 0.2);
  drawConnections(ctx, leftHandLandmarks, HAND_EDGES, w, h, 'rgba(251, 191, 36, 0.9)', 0.15, 1.8);
  drawConnections(ctx, rightHandLandmarks, HAND_EDGES, w, h, 'rgba(251, 191, 36, 0.9)', 0.15, 1.8);
  drawPoints(ctx, leftHandLandmarks, w, h, 'rgba(252, 211, 77, 0.95)', 2.1, 0.15);
  drawPoints(ctx, rightHandLandmarks, w, h, 'rgba(252, 211, 77, 0.95)', 2.1, 0.15);
}

export function usePoseDetection({ active = false, videoRef = null, overlayCanvasRef = null } = {}) {
  const [score, setScore] = useState(0);
  const [issue, setIssue] = useState('카메라를 켜고 자세 분석을 시작하세요.');
  const [history, setHistory] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [metrics, setMetrics] = useState({
    leftElbowDeg: null,
    rightElbowDeg: null,
    leftKneeDeg: null,
    rightKneeDeg: null,
    shoulderTiltDeg: null,
    hipTiltDeg: null,
    torsoLeanDeg: null,
    armAccuracy: 0,
    legAccuracy: 0,
    symmetry: 0,
    postureBalance: 0,
    danceActivity: 0,
    poseConfidence: 0,
    trackedPoints: 0,
    handPoints: 0,
  });
  const [summary, setSummary] = useState({
    totalScore: 0,
    bestMoment: '00:00',
    needs: '전신 프레이밍',
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const landmarkerRef = useRef(null);
  const frameHandleRef = useRef(null);
  const lastAnalyzeAtRef = useRef(0);
  const lastStateUpdateAtRef = useRef(0);
  const isDetectingRef = useRef(false);
  const overlayCacheRef = useRef({ pose: null, leftHand: null, rightHand: null });
  const startAtRef = useRef(0);
  const bestScoreRef = useRef(0);
  const bestMomentMsRef = useRef(0);
  const leftWristHistRef = useRef([]);
  const rightWristHistRef = useRef([]);

  useEffect(() => {
    if (!active || !videoRef?.current) {
      setIsAnalyzing(false);
      setHistory([]);
      setScore(0);
      setIssue('카메라를 켜고 자세 분석을 시작하세요.');
      setSummary({
        totalScore: 0,
        bestMoment: '00:00',
        needs: '전신 프레이밍',
      });
      setFeedbackList([]);
      setMetrics({
        leftElbowDeg: null,
        rightElbowDeg: null,
        leftKneeDeg: null,
        rightKneeDeg: null,
        shoulderTiltDeg: null,
        hipTiltDeg: null,
        torsoLeanDeg: null,
        armAccuracy: 0,
        legAccuracy: 0,
        symmetry: 0,
        postureBalance: 0,
        danceActivity: 0,
        poseConfidence: 0,
        trackedPoints: 0,
        handPoints: 0,
      });
      const canvas = overlayCanvasRef?.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return undefined;
    }

    let cancelled = false;
    const video = videoRef.current;

    const measureActivity = (hist, now) => {
      while (hist.length && now - hist[0].t > WRIST_HISTORY_WINDOW_MS) hist.shift();
      if (hist.length < 4) return 0;
      let sum = 0;
      for (let i = 1; i < hist.length; i += 1) {
        sum += Math.hypot(hist[i].x - hist[i - 1].x, hist[i].y - hist[i - 1].y);
      }
      return Math.min(100, Math.round(sum * 4500));
    };

    const loop = (now) => {
      if (cancelled || !landmarkerRef.current) return;

      const cached = overlayCacheRef.current;
      renderOverlay(
        overlayCanvasRef?.current,
        video,
        cached.pose,
        cached.leftHand,
        cached.rightHand,
      );

      if (
        video.videoWidth > 0 &&
        !isDetectingRef.current &&
        now - lastAnalyzeAtRef.current >= ANALYZE_INTERVAL_MS
      ) {
        isDetectingRef.current = true;
        lastAnalyzeAtRef.current = now;

        const result = landmarkerRef.current.detectForVideo(video, now);
        const pl = result?.poseLandmarks?.[0] || null;
        const leftHand = result?.leftHandLandmarks?.[0] || null;
        const rightHand = result?.rightHandLandmarks?.[0] || null;

        overlayCacheRef.current = { pose: pl, leftHand, rightHand };
        renderOverlay(overlayCanvasRef?.current, video, pl, leftHand, rightHand);

        if (pl?.length) {
          const leftElbowDeg = pl[11] && pl[13] && pl[15] ? angleDeg(pl[11].x, pl[11].y, pl[13].x, pl[13].y, pl[15].x, pl[15].y) : null;
          const rightElbowDeg = pl[12] && pl[14] && pl[16] ? angleDeg(pl[12].x, pl[12].y, pl[14].x, pl[14].y, pl[16].x, pl[16].y) : null;
          const leftKneeDeg = pl[23] && pl[25] && pl[27] ? angleDeg(pl[23].x, pl[23].y, pl[25].x, pl[25].y, pl[27].x, pl[27].y) : null;
          const rightKneeDeg = pl[24] && pl[26] && pl[28] ? angleDeg(pl[24].x, pl[24].y, pl[26].x, pl[26].y, pl[28].x, pl[28].y) : null;
          const shoulderTiltDeg = lineTiltDeg(pl[11], pl[12]);
          const hipTiltDeg = lineTiltDeg(pl[23], pl[24]);
          const torsoLean = torsoLeanDeg(pl[11], pl[12], pl[23], pl[24]);

          const lw = pl[15];
          const rw = pl[16];
          if (lw) leftWristHistRef.current.push({ x: lw.x, y: lw.y, t: now });
          if (rw) rightWristHistRef.current.push({ x: rw.x, y: rw.y, t: now });

          const danceActivity = Math.round(
            (measureActivity(leftWristHistRef.current, now) + measureActivity(rightWristHistRef.current, now)) / 2
          );
          const armAccuracy = Math.round((toScoreFromAngle(leftElbowDeg) + toScoreFromAngle(rightElbowDeg)) / 2);
          const legAccuracy = Math.round((toScoreFromAngle(leftKneeDeg, 165, 40) + toScoreFromAngle(rightKneeDeg, 165, 40)) / 2);
          const symmetry =
            leftElbowDeg != null && rightElbowDeg != null ? Math.max(0, 100 - Math.round(Math.abs(leftElbowDeg - rightElbowDeg))) : 0;
          const postureBalance = clampScore(
            100 - (Number(shoulderTiltDeg || 0) * 2.7 + Number(hipTiltDeg || 0) * 2.2 + Number(torsoLean || 0) * 2.0)
          );
          const visTargets = [11, 12, 13, 14, 15, 16]
            .map((idx) => pl[idx]?.visibility ?? 0)
            .filter((v) => Number.isFinite(v));
          const poseConfidence = visTargets.length
            ? Math.round((visTargets.reduce((acc, cur) => acc + cur, 0) / visTargets.length) * 100)
            : 0;
          const trackedPoints = pl.filter((p) => (p?.visibility ?? 0) > 0.2).length;
          const handPoints = (leftHand?.length || 0) + (rightHand?.length || 0);
          const totalScore = Math.round(
            danceActivity * 0.2 + armAccuracy * 0.22 + legAccuracy * 0.2 + postureBalance * 0.18 + symmetry * 0.1 + poseConfidence * 0.1
          );
          const nextMetrics = {
            leftElbowDeg,
            rightElbowDeg,
            leftKneeDeg,
            rightKneeDeg,
            shoulderTiltDeg,
            hipTiltDeg,
            torsoLeanDeg: torsoLean,
            armAccuracy,
            legAccuracy,
            symmetry,
            postureBalance,
            danceActivity,
            poseConfidence,
            trackedPoints,
            handPoints,
          };
          const elapsed = now - startAtRef.current;

          if (totalScore > bestScoreRef.current) {
            bestScoreRef.current = totalScore;
            bestMomentMsRef.current = elapsed;
          }

          if (now - lastStateUpdateAtRef.current >= STATE_UPDATE_INTERVAL_MS) {
            lastStateUpdateAtRef.current = now;
            setScore(totalScore);
            setIssue(buildIssue(nextMetrics));
            setHistory((prev) => [...prev.slice(-79), totalScore]);
            setMetrics(nextMetrics);
            setFeedbackList(buildFeedbackList(nextMetrics));
            setSummary({
              totalScore,
              bestMoment: toClockText(bestMomentMsRef.current),
              needs: buildNeeds(nextMetrics),
            });
          }
        } else if (now - lastStateUpdateAtRef.current >= STATE_UPDATE_INTERVAL_MS) {
          lastStateUpdateAtRef.current = now;
          setIssue('포즈를 찾는 중입니다. 화면에 전신이 보이도록 위치를 조정해주세요.');
        }

        isDetectingRef.current = false;
      }

      frameHandleRef.current = scheduleVideoFrame(video, loop);
    };

    (async () => {
      try {
        const wasmPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        let landmarker;
        try {
          landmarker = await HolisticLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            minPoseDetectionConfidence: 0.3,
            minPosePresenceConfidence: 0.3,
          });
        } catch {
          landmarker = await HolisticLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            minPoseDetectionConfidence: 0.3,
            minPosePresenceConfidence: 0.3,
          });
        }
        if (cancelled) {
          landmarker.close?.();
          return;
        }
        landmarkerRef.current = landmarker;
        setIsAnalyzing(true);
        startAtRef.current = performance.now();
        bestScoreRef.current = 0;
        bestMomentMsRef.current = 0;
        leftWristHistRef.current = [];
        rightWristHistRef.current = [];
        overlayCacheRef.current = { pose: null, leftHand: null, rightHand: null };
        lastStateUpdateAtRef.current = 0;
        frameHandleRef.current = scheduleVideoFrame(video, loop);
      } catch (error) {
        setIsAnalyzing(false);
        setIssue('AI 포즈 모델을 불러오지 못했습니다. 네트워크 상태를 확인해주세요.');
        console.error(error);
      }
    })();

    return () => {
      cancelled = true;
      setIsAnalyzing(false);
      cancelVideoFrame(frameHandleRef.current);
      frameHandleRef.current = null;
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
      leftWristHistRef.current = [];
      rightWristHistRef.current = [];
      lastAnalyzeAtRef.current = 0;
      lastStateUpdateAtRef.current = 0;
      isDetectingRef.current = false;
      overlayCacheRef.current = { pose: null, leftHand: null, rightHand: null };
      const canvas = overlayCanvasRef?.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [active, overlayCanvasRef, videoRef]);

  return { score, issue, history, summary, feedbackList, metrics, isAnalyzing };
}
