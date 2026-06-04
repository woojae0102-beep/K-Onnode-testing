// @ts-nocheck
import { FilesetResolver, HolisticLandmarker } from '@mediapipe/tasks-vision';
import type { FrameData, JointPosition } from '../types/teaching';

const JOINT_MAP = [
  ['nose', 0],
  ['left_shoulder', 11],
  ['right_shoulder', 12],
  ['left_elbow', 13],
  ['right_elbow', 14],
  ['left_wrist', 15],
  ['right_wrist', 16],
  ['left_hip', 23],
  ['right_hip', 24],
  ['left_knee', 25],
  ['right_knee', 26],
  ['left_ankle', 27],
  ['right_ankle', 28],
];

let landmarkerPromise = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const wasmPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
      const vision = await FilesetResolver.forVisionTasks(wasmPath);
      const opts = {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task',
        },
        runningMode: 'VIDEO',
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
      };
      try {
        return await HolisticLandmarker.createFromOptions(vision, {
          ...opts,
          baseOptions: { ...opts.baseOptions, delegate: 'GPU' },
        });
      } catch {
        return await HolisticLandmarker.createFromOptions(vision, {
          ...opts,
          baseOptions: { ...opts.baseOptions, delegate: 'CPU' },
        });
      }
    })();
  }
  return landmarkerPromise;
}

function landmarksToFrame(pose, timestamp) {
  if (!pose?.length) return null;
  const joints = {};
  JOINT_MAP.forEach(([name, idx]) => {
    const p = pose[idx];
    if (!p) return;
    joints[name] = {
      x: Number(p.x),
      y: Number(p.y),
      confidence: Number(p.visibility ?? 0.8),
    };
  });
  if (Object.keys(joints).length < 6) return null;
  return { timestamp, joints };
}

export async function extractSkeletonFromVideo(
  fileOrUrl,
  { sampleFps = 8, onProgress } = {}
) {
  const landmarker = await getLandmarker();
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
  if (typeof fileOrUrl !== 'string') video.src = url;
  else video.src = url;

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('영상을 불러올 수 없습니다.'));
  });

  const duration = video.duration || 1;
  const interval = 1 / sampleFps;
  const frames = [];
  let t = 0;
  let frameIdx = 0;

  while (t < duration) {
    video.currentTime = t;
    await new Promise((r) => {
      const done = () => {
        video.removeEventListener('seeked', done);
        r();
      };
      video.addEventListener('seeked', done);
    });

    const result = landmarker.detectForVideo(video, performance.now());
    const pose = result?.poseLandmarks?.[0];
    const frame = landmarksToFrame(pose, t);
    if (frame) frames.push(frame);

    frameIdx += 1;
    onProgress?.(Math.min(99, Math.round((t / duration) * 100)));
    t += interval;
  }

  if (typeof fileOrUrl !== 'string') URL.revokeObjectURL(url);
  onProgress?.(100);
  return frames;
}

export function alignFrameSeries(myFrames, refFrames) {
  if (!refFrames?.length) return { my: myFrames, ref: [] };
  const refByTime = refFrames;
  const aligned = myFrames.map((mf) => {
    let best = refByTime[0];
    let bestDist = Math.abs(best.timestamp - mf.timestamp);
    for (const rf of refByTime) {
      const d = Math.abs(rf.timestamp - mf.timestamp);
      if (d < bestDist) {
        bestDist = d;
        best = rf;
      }
    }
    return best;
  });
  return { my: myFrames, ref: aligned };
}
