/**
 * Skeleton Playback Engine 검증
 */
import assert from 'node:assert/strict';
import {
  buildPlaybackSnapshot,
  buildSkeletonTimeline,
  findBracket,
  frameSourceTime,
} from '../src/studio/skeletonDebug/render/skeletonPlaybackEngine.ts';

const OVERLAY = {
  showEstimated: true,
  prediction: true,
  kalmanPrediction: true,
  bbox: false,
  trackId: true,
  confidence: false,
  joints: true,
  bones: true,
  velocity: false,
  occlusion: false,
};

function makeFrame(t: number, x: number, trackId = 1) {
  return {
    timestamp: t,
    sourceVideoTime: t,
    detectedPeople: [{
      trackId,
      confidence: 0.9,
      isEstimated: false,
      joints: {
        nose: { x, y: 0.5 },
        left_hip: { x: x - 0.05, y: 0.6 },
        right_hip: { x: x + 0.05, y: 0.6 },
      },
    }],
  };
}

function testAnalyzingDisablesPlayback() {
  const timeline = buildSkeletonTimeline([makeFrame(0, 0.3), makeFrame(1, 0.7)], 2);
  const snap = buildPlaybackSnapshot(timeline, 0.5, OVERLAY, 'ANALYZING');
  assert.equal(snap.renderStatus, 'ANALYZING_DISABLED');
  assert.equal(snap.people.length, 0);
  console.log('  ✓ ANALYZING mode disables skeleton playback');
}

function testTimestampInterpolation() {
  const timeline = buildSkeletonTimeline([makeFrame(12.1, 0.2), makeFrame(12.5, 0.8)], 2);
  const snap = buildPlaybackSnapshot(timeline, 12.34, OVERLAY, 'PLAYBACK');
  assert.equal(snap.renderStatus, 'INTERPOLATING');
  assert.ok(snap.state.interpolationAlpha > 0.55 && snap.state.interpolationAlpha < 0.65);
  const noseX = snap.people[0]?.joints?.nose?.x;
  assert.ok(noseX > 0.4 && noseX < 0.72, `expected between keyframes, got ${noseX}`);
  console.log('  ✓ PLAYBACK interpolates by sourceVideoTime');
}

function testLowDataGap() {
  const timeline = buildSkeletonTimeline([makeFrame(0, 0.2), makeFrame(2.5, 0.8)], 2);
  const bracket = findBracket(timeline.times, 1.25);
  assert.ok(bracket && bracket.frameGapSec > 1);
  const snap = buildPlaybackSnapshot(timeline, 1.25, OVERLAY, 'PLAYBACK');
  assert.equal(snap.renderStatus, 'LOW_DATA_GAP');
  console.log('  ✓ gap > 1s reports LOW_DATA_GAP (not HOLD freeze)');
}

function testNoCrossTrackInterpolation() {
  const frames = [
    { ...makeFrame(0, 0.2, 1), detectedPeople: [makeFrame(0, 0.2, 1).detectedPeople[0]] },
    { ...makeFrame(1, 0.8, 2), detectedPeople: [makeFrame(1, 0.8, 2).detectedPeople[0]] },
  ];
  const timeline = buildSkeletonTimeline(frames, 2);
  const snap = buildPlaybackSnapshot(timeline, 0.5, OVERLAY, 'PLAYBACK');
  assert.equal(snap.people.length, 2);
  assert.ok(snap.people.every((p) => p.isEstimated));
  console.log('  ✓ different trackIds are not blended');
}

function testPlaybackUsesPreviewTimeOnly() {
  const timeline = buildSkeletonTimeline([makeFrame(10, 0.3), makeFrame(11, 0.7)], 2);
  const snap = buildPlaybackSnapshot(timeline, 10.5, OVERLAY, 'PLAYBACK');
  assert.equal(snap.playbackTime, 10.5);
  assert.notEqual(snap.renderStatus, 'STALE');
  console.log('  ✓ playbackTime independent of analysis wall clock');
}

function testSmoothSplineInterpolation() {
  const frames = [
    makeFrame(0, 0.1),
    makeFrame(0.5, 0.3),
    makeFrame(1.0, 0.7),
    makeFrame(1.5, 0.9),
  ];
  const timeline = buildSkeletonTimeline(frames, 4);
  const snap = buildPlaybackSnapshot(timeline, 0.75, OVERLAY, 'PLAYBACK');
  assert.equal(snap.renderStatus, 'INTERPOLATING');
  const noseX = snap.people[0]?.joints?.nose?.x;
  assert.ok(noseX > 0.45 && noseX < 0.65, `expected smooth mid ~0.5-0.6, got ${noseX}`);
  console.log('  ✓ Catmull-Rom smooth interpolation between sparse keyframes');
}

function main() {
  console.log('Skeleton Playback Verification\n');
  testAnalyzingDisablesPlayback();
  testTimestampInterpolation();
  testLowDataGap();
  testNoCrossTrackInterpolation();
  testPlaybackUsesPreviewTimeOnly();
  testSmoothSplineInterpolation();
  console.log('\nAll playback checks passed.');
}

main();
