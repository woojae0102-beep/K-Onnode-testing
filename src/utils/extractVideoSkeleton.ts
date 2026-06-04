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

/** 분석에 사용할 최대 영상 길이(초) — 길수록 seek/추출이 오래 걸림 */
const MAX_ANALYZE_SEC = 75;
const SEEK_TIMEOUT_MS = 2200;
const MODEL_LOAD_TIMEOUT_MS = 90000;

let landmarkerPromise = null;

function isYoutubeOrEmbedUrl(src) {
  if (typeof src !== 'string') return false;
  return /youtube\.com|youtu\.be/i.test(src);
}

function isLikelyRecordedWebm(fileOrUrl) {
  if (typeof fileOrUrl === 'string') return /\.webm/i.test(fileOrUrl);
  const name = fileOrUrl?.name || '';
  const type = fileOrUrl?.type || '';
  return /webm/i.test(name) || /webm/i.test(type);
}

function clampDuration(raw) {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.min(raw, MAX_ANALYZE_SEC);
}

async function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function getLandmarker() {
  if (!landmarkerPromise) {
    const load = withTimeout(
      (async () => {
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
      })(),
      MODEL_LOAD_TIMEOUT_MS,
      'AI 포즈 모델 로딩 시간이 초과되었습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.'
    );
    landmarkerPromise = load.catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
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

function detectFrame(landmarker, video, timestamp) {
  const result = landmarker.detectForVideo(video, performance.now());
  const pose = result?.poseLandmarks?.[0];
  return landmarksToFrame(pose, timestamp);
}

async function waitForVideoMetadata(video, timeoutMs = 15000) {
  if (video.readyState >= 1 && Number.isFinite(video.duration)) return;
  await withTimeout(
    new Promise((resolve, reject) => {
      const onMeta = () => {
        cleanup();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new Error('영상을 불러올 수 없습니다.'));
      };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('error', onErr);
      };
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('error', onErr);
    }),
    timeoutMs,
    '영상 메타데이터 로딩 시간이 초과되었습니다.'
  );
}

async function seekVideoTime(video, timeSec) {
  const target = Math.max(0, timeSec);
  if (Math.abs((video.currentTime || 0) - target) < 0.04) return;

  await withTimeout(
    new Promise((resolve, reject) => {
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('영상 탐색(seek)에 실패했습니다.'));
      };
      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      try {
        video.currentTime = target;
      } catch (e) {
        cleanup();
        reject(e);
      }
    }),
    SEEK_TIMEOUT_MS,
    '영상 프레임 이동 시간이 초과되었습니다.'
  );
}

/** MediaRecorder webm 등 seek 불안정 포맷용 — 재생하면서 샘플링 */
async function extractViaPlayback(landmarker, video, duration, sampleFps, onProgress) {
  const frames = [];
  const interval = 1 / sampleFps;
  let lastSampleAt = -interval;

  video.pause();
  video.currentTime = 0;
  video.playbackRate = Math.min(4, sampleFps >= 6 ? 3 : 2);

  await video.play().catch(() => {});

  await withTimeout(
    new Promise((resolve, reject) => {
      const maxMs = (duration / video.playbackRate + 15) * 1000;
      const started = performance.now();

      const tick = () => {
        if (performance.now() - started > maxMs) {
          video.pause();
          reject(new Error('영상 분석 시간이 초과되었습니다. 더 짧은 영상으로 시도해 주세요.'));
          return;
        }

        const t = video.currentTime;
        if (t >= duration - 0.05 || video.ended) {
          video.pause();
          onProgress?.(100);
          resolve();
          return;
        }

        if (t - lastSampleAt >= interval - 0.02) {
          const frame = detectFrame(landmarker, video, t);
          if (frame) frames.push(frame);
          lastSampleAt = t;
          onProgress?.(Math.min(99, Math.round((t / duration) * 100)));
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }),
    (duration / video.playbackRate + 20) * 1000,
    '영상 재생 분석 시간이 초과되었습니다.'
  );

  return frames;
}

async function extractViaSeek(landmarker, video, duration, sampleFps, onProgress) {
  const frames = [];
  const interval = 1 / sampleFps;
  let t = 0;
  let seekFailures = 0;

  while (t < duration) {
    try {
      await seekVideoTime(video, t);
      seekFailures = 0;
    } catch {
      seekFailures += 1;
      if (seekFailures >= 2) {
        video.pause();
        video.currentTime = 0;
        return extractViaPlayback(landmarker, video, duration, sampleFps, onProgress);
      }
    }

    const frame = detectFrame(landmarker, video, t);
    if (frame) frames.push(frame);
    onProgress?.(Math.min(99, Math.round((t / duration) * 100)));
    t += interval;
  }

  onProgress?.(100);
  return frames;
}

async function loadVideoElement(fileOrUrl) {
  if (isYoutubeOrEmbedUrl(fileOrUrl)) {
    throw new Error(
      '유튜브 URL은 스켈레톤 분석에 사용할 수 없습니다. 레퍼런스 영상을 mp4/webm 파일로 업로드해 주세요.'
    );
  }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', 'true');

  const blobUrl = typeof fileOrUrl !== 'string' ? URL.createObjectURL(fileOrUrl) : null;
  video.src = typeof fileOrUrl === 'string' ? fileOrUrl : blobUrl;

  await waitForVideoMetadata(video);
  return { video, blobUrl };
}

export async function extractSkeletonFromVideo(
  fileOrUrl,
  { sampleFps = 6, onProgress, preferPlayback } = {}
) {
  const landmarker = await getLandmarker();
  const { video, blobUrl } = await loadVideoElement(fileOrUrl);

  try {
    const duration = clampDuration(video.duration);
    const usePlayback =
      preferPlayback === true || isLikelyRecordedWebm(fileOrUrl) || !Number.isFinite(video.duration);

    onProgress?.(0);
    const frames = usePlayback
      ? await extractViaPlayback(landmarker, video, duration, sampleFps, onProgress)
      : await extractViaSeek(landmarker, video, duration, sampleFps, onProgress);

    if (!frames.length) {
      throw new Error('영상에서 포즈를 인식하지 못했습니다. 전신이 보이도록 다시 촬영해 주세요.');
    }

    return frames;
  } finally {
    video.pause();
    video.src = '';
    video.load();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }
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
