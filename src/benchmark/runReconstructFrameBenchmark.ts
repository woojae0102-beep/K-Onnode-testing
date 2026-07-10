// @ts-nocheck
/**
 * reconstructFrame() 163초 시뮬레이션 벤치마크 — 실제 계측값 출력.
 * 브라우저(Chrome) 또는 Node+playwright에서 실행.
 */
import { CHOREO_DEFAULT_SAMPLE_FPS } from '../config/choreoExtractConfig';
import { GroupMotionReconstructionEngine } from '../services/motion/GroupMotionReconstructionEngine';
import { POSE_MATCH_JOINTS } from '../services/skeleton/poseSimilarity';
import {
  jsonByteSize,
  readHeapBytes,
  reconstructFrameProfiler,
} from './reconstructFrameProfiler';

const MEMBER_IDS = ['jennie', 'lisa', 'rose', 'jisoo'];
const VIDEO_DURATION_SEC = 163;
const SAMPLE_FPS = CHOREO_DEFAULT_SAMPLE_FPS;

function makeJoints(frameIndex: number, memberIdx: number) {
  const phase = frameIndex * 0.08 + memberIdx * 0.5;
  const joints: Record<string, { x: number; y: number; z: number; visibility: number }> = {};
  POSE_MATCH_JOINTS.forEach((key, ji) => {
    joints[key] = {
      x: 0.3 + memberIdx * 0.12 + Math.sin(phase + ji * 0.2) * 0.02,
      y: 0.4 + Math.cos(phase + ji * 0.15) * 0.03,
      z: 0.1 * Math.sin(phase),
      visibility: 0.9,
    };
  });
  return joints;
}

function makeSyntheticFrame(frameIndex: number, timestamp: number) {
  const members = MEMBER_IDS.map((id, idx) => ({
    personIndex: idx,
    trackId: idx,
    estimatedMemberId: id,
    joints: makeJoints(frameIndex, idx),
    confidence: 0.85,
    isEstimated: false,
  }));
  return {
    timestamp,
    frameIndex,
    timestampMs: timestamp * 1000,
    members,
    videoWidth: 1920,
    videoHeight: 1080,
  };
}

function avg(rows: { totalMs: number }[], key: string) {
  if (!rows.length) return 0;
  return rows.reduce((s, r) => s + (r[key] || 0), 0) / rows.length;
}

function sum(rows: { totalMs: number }[], key: string) {
  return rows.reduce((s, r) => s + (r[key] || 0), 0);
}

function linearRegressionSlope(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return 0;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  points.forEach((p) => {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  });
  return den ? num / den : 0;
}

export function runReconstructFrameBenchmark() {
  globalThis.__RECONSTRUCT_FRAME_PROFILE__ = true;
  reconstructFrameProfiler.reset();

  const totalFrames = Math.round(VIDEO_DURATION_SEC * SAMPLE_FPS);
  const engine = new GroupMotionReconstructionEngine();
  engine.reset();

  const options = {
    groupId: 'blackpink',
    songId: 'bench',
    userMemberId: 'jennie',
    allMemberIds: MEMBER_IDS,
    bpm: 128,
    sampleFps: SAMPLE_FPS,
  };

  const cacheSnapshots: {
    frameIndex: number;
    motionTimelineSamples: number;
    predictors: number;
    occlusionByTrack: number;
    identityConfidence: number;
    memberVelocity: number;
    previousFrameBytes: number;
    heapBytes: number | null;
  }[] = [];

  let previousFrameRefTest: { isDeepClone: boolean; isReference: boolean; sharesMembersArray: boolean } | null = null;

  const benchStart = performance.now();

  for (let i = 0; i < totalFrames; i += 1) {
    const timestamp = i / SAMPLE_FPS;
    const frame = makeSyntheticFrame(i, timestamp);

    const out = engine.reconstructFrame(frame, options, MEMBER_IDS.length);

    if (i === 50) {
      const prev = (engine as { previousFrame: typeof out }).previousFrame;
      const prevMembers = prev?.members;
      const outMembers = out.members;
      const sharesMembersArray = prevMembers === outMembers;
      const marker = prev?.members?.[0]?.joints?.nose?.x;
      if (marker != null && prev?.members?.[0]?.joints?.nose) {
        prev.members[0].joints.nose.x = marker + 999;
      }
      const mutatedVisibleOnOut = out.members?.[0]?.joints?.nose?.x === (marker != null ? marker + 999 : null);
      previousFrameRefTest = {
        isDeepClone: false,
        isReference: prev === out,
        sharesMembersArray,
      };
      previousFrameRefTest.isDeepClone = !previousFrameRefTest.isReference && !mutatedVisibleOnOut;
      if (marker != null && prev?.members?.[0]?.joints?.nose) {
        prev.members[0].joints.nose.x = marker;
      }
    }

    if (i % 100 === 0 || i === totalFrames - 1) {
      const tracker = (engine as { tracker: {
        predictors: Map<unknown, unknown>;
        occlusionByTrack: Map<unknown, unknown>;
        identityConfidence: Map<unknown, unknown>;
        memberVelocity: Map<unknown, unknown>;
      } }).tracker;
      const motionTimelines = (engine as { motionTimelines: Map<string, { samples: unknown[] }> }).motionTimelines;
      let timelineSamples = 0;
      motionTimelines.forEach((t) => { timelineSamples += t.samples.length; });
      const prevFrame = (engine as { previousFrame: unknown }).previousFrame;
      cacheSnapshots.push({
        frameIndex: i,
        motionTimelineSamples: timelineSamples,
        predictors: tracker.predictors.size,
        occlusionByTrack: tracker.occlusionByTrack.size,
        identityConfidence: tracker.identityConfidence.size,
        memberVelocity: tracker.memberVelocity.size,
        previousFrameBytes: jsonByteSize(prevFrame),
        heapBytes: readHeapBytes(),
      });
    }
  }

  const benchTotalMs = performance.now() - benchStart;
  const rows = reconstructFrameProfiler.frameRows;
  const first30 = rows.filter((r) => r.timestamp <= 30);
  const after30 = rows.filter((r) => r.timestamp > 30);
  const slope = linearRegressionSlope(rows.map((r) => ({ x: r.frameIndex, y: r.totalMs })));

  const stepSummary = [
    { step: 'Total (all frames)', totalMs: sum(rows, 'totalMs'), avgMs: avg(rows, 'totalMs'), pct: 100 },
    { step: 'Member Matching', totalMs: sum(rows, 'memberMatchingMs'), avgMs: avg(rows, 'memberMatchingMs'), pct: (sum(rows, 'memberMatchingMs') / sum(rows, 'totalMs')) * 100 },
    { step: 'Hungarian Matching', totalMs: sum(rows, 'hungarianMatchingMs'), avgMs: avg(rows, 'hungarianMatchingMs'), pct: (sum(rows, 'hungarianMatchingMs') / sum(rows, 'totalMs')) * 100 },
    { step: 'Formation', totalMs: sum(rows, 'formationMs'), avgMs: avg(rows, 'formationMs'), pct: (sum(rows, 'formationMs') / sum(rows, 'totalMs')) * 100 },
    { step: 'Missing Member Fill', totalMs: sum(rows, 'missingMemberFillMs'), avgMs: avg(rows, 'missingMemberFillMs'), pct: (sum(rows, 'missingMemberFillMs') / sum(rows, 'totalMs')) * 100 },
    { step: 'Pose Merge', totalMs: sum(rows, 'poseMergeMs'), avgMs: avg(rows, 'poseMergeMs'), pct: (sum(rows, 'poseMergeMs') / sum(rows, 'totalMs')) * 100 },
    { step: 'Timeline', totalMs: sum(rows, 'timelineMs'), avgMs: avg(rows, 'timelineMs'), pct: (sum(rows, 'timelineMs') / sum(rows, 'totalMs')) * 100 },
    { step: 'Final Skeleton', totalMs: sum(rows, 'finalSkeletonMs'), avgMs: avg(rows, 'finalSkeletonMs'), pct: (sum(rows, 'finalSkeletonMs') / sum(rows, 'totalMs')) * 100 },
    { step: 'Tracking Total', totalMs: sum(rows, 'trackingTotalMs'), avgMs: avg(rows, 'trackingTotalMs'), pct: (sum(rows, 'trackingTotalMs') / sum(rows, 'totalMs')) * 100 },
  ].map((r) => ({
    ...r,
    totalMs: Number(r.totalMs.toFixed(3)),
    avgMs: Number(r.avgMs.toFixed(4)),
    pct: Number(r.pct.toFixed(2)),
  }));

  const objectSizeSummary = [
    { object: 'members (avg/frame)', bytes: Math.round(rows.reduce((s, r) => s + r.membersOutBytes, 0) / Math.max(1, rows.length)) },
    { object: 'timeline delta (avg/frame)', bytes: Math.round(rows.reduce((s, r) => s + r.timelineOutBytes, 0) / Math.max(1, rows.length)) },
    { object: 'final out (avg/frame)', bytes: Math.round(rows.reduce((s, r) => s + r.finalOutBytes, 0) / Math.max(1, rows.length)) },
    { object: 'previousFrame @ end', bytes: cacheSnapshots[cacheSnapshots.length - 1]?.previousFrameBytes ?? 0 },
  ];

  const cacheGrowth = [
    { cache: 'track cache (predictors Map)', start: cacheSnapshots[0]?.predictors, end: cacheSnapshots[cacheSnapshots.length - 1]?.predictors, grows: cacheSnapshots[cacheSnapshots.length - 1]?.predictors > cacheSnapshots[0]?.predictors },
    { cache: 'occlusionByTrack Map', start: cacheSnapshots[0]?.occlusionByTrack, end: cacheSnapshots[cacheSnapshots.length - 1]?.occlusionByTrack, grows: cacheSnapshots[cacheSnapshots.length - 1]?.occlusionByTrack !== cacheSnapshots[0]?.occlusionByTrack },
    { cache: 'identityConfidence Map', start: cacheSnapshots[0]?.identityConfidence, end: cacheSnapshots[cacheSnapshots.length - 1]?.identityConfidence, grows: cacheSnapshots[cacheSnapshots.length - 1]?.identityConfidence > cacheSnapshots[0]?.identityConfidence },
    { cache: 'memberVelocity Map', start: cacheSnapshots[0]?.memberVelocity, end: cacheSnapshots[cacheSnapshots.length - 1]?.memberVelocity, grows: cacheSnapshots[cacheSnapshots.length - 1]?.memberVelocity > cacheSnapshots[0]?.memberVelocity },
    { cache: 'timeline cache (motionTimelines samples)', start: cacheSnapshots[0]?.motionTimelineSamples, end: cacheSnapshots[cacheSnapshots.length - 1]?.motionTimelineSamples, grows: true },
    { cache: 'formation cache', start: 'N/A (per-frame resolve, no accumulation)', end: 'N/A', grows: false },
    { cache: 'member cache (liveById in generateAI)', start: 'N/A (multi-member path)', end: 'N/A', grows: false },
    { cache: 'frame cache (previousFrame)', start: 1, end: 1, grows: false },
  ];

  const structuralAnalysis = [
    { item: 'previousFrame deep clone?', value: previousFrameRefTest?.isDeepClone ? 'YES' : 'NO' },
    { item: 'previousFrame same reference as out?', value: previousFrameRefTest?.isReference ? 'YES' : 'NO' },
    { item: 'previousFrame shares members[] with out?', value: previousFrameRefTest?.sharesMembersArray ? 'YES' : 'NO' },
    { item: 'WeakMap usage in reconstructFrame path', value: 'NONE (all Map/Set/Array)' },
    { item: 'Recursion in reconstructFrame path', value: 'NONE (hungarian iterative)' },
    { item: 'O(N²) loops', value: 'YES — costMatrix O(nPrev×nCurr), reId loop O(nCurr×nPrev), timeline sample scan O(samples) per AI frame' },
    { item: 'GC-uncollectable growth risk', value: cacheSnapshots[cacheSnapshots.length - 1]?.motionTimelineSamples > totalFrames ? 'YES — motionTimelines.samples unbounded' : 'LOW for Maps (bounded by member count)' },
  ];

  const timingTrend = [
    { metric: '163s video frames', value: totalFrames },
    { metric: 'sampleFps', value: SAMPLE_FPS },
    { metric: 'bench total ms', value: Number(benchTotalMs.toFixed(2)) },
    { metric: 'avg ms/frame (measured)', value: Number(avg(rows, 'totalMs').toFixed(4)) },
    { metric: 'avg ms/frame first 30s', value: Number(avg(first30, 'totalMs').toFixed(4)) },
    { metric: 'avg ms/frame after 30s', value: Number(avg(after30, 'totalMs').toFixed(4)) },
    { metric: '30s 후 증가율 (after/before)', value: Number((avg(after30, 'totalMs') / Math.max(1e-9, avg(first30, 'totalMs'))).toFixed(4)) },
    { metric: 'frameIndex vs totalMs slope (ms/frameIndex)', value: Number(slope.toFixed(6)) },
    { metric: 'heap start bytes', value: cacheSnapshots[0]?.heapBytes ?? 'n/a (Chrome only)' },
    { metric: 'heap end bytes', value: cacheSnapshots[cacheSnapshots.length - 1]?.heapBytes ?? 'n/a (Chrome only)' },
    { metric: 'heap monotonic increase', value: (cacheSnapshots[0]?.heapBytes != null && cacheSnapshots[cacheSnapshots.length - 1]?.heapBytes != null)
      ? (cacheSnapshots[cacheSnapshots.length - 1].heapBytes > cacheSnapshots[0].heapBytes ? 'YES' : 'NO')
      : 'n/a (Chrome only)' },
  ];

  const perFrameSample = rows.filter((_, idx) => idx % 163 === 0 || idx === rows.length - 1).map((r) => ({
    frameIndex: r.frameIndex,
    timestamp: Number(r.timestamp.toFixed(2)),
    totalMs: Number(r.totalMs.toFixed(3)),
    timelineMs: Number(r.timelineMs.toFixed(3)),
    heapBytes: r.heapBytes,
  }));

  const top10 = reconstructFrameProfiler.getTopFunctions(10).map((f) => ({
    function: f.name,
    totalMs: Number(f.totalMs.toFixed(3)),
    calls: f.calls,
    avgMs: Number(f.avgMs.toFixed(4)),
  }));

  console.log('\n========== reconstructFrame() 163s BENCHMARK ==========');
  console.table(stepSummary);
  console.table(objectSizeSummary);
  console.table(cacheGrowth);
  console.table(structuralAnalysis);
  console.table(timingTrend);
  console.table(perFrameSample);
  console.log('\n--- Top 10 Functions (by totalMs) ---');
  console.table(top10);

  globalThis.__RECONSTRUCT_FRAME_PROFILE__ = false;

  return {
    stepSummary,
    objectSizeSummary,
    cacheGrowth,
    structuralAnalysis,
    timingTrend,
    perFrameSample,
    top10,
    totalFrames,
    benchTotalMs,
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.runReconstructFrameBenchmark = runReconstructFrameBenchmark;
}
