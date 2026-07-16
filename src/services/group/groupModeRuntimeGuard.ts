// @ts-nocheck
/**
 * Group Mode 런타임 가드 — Extraction / MediaPipe / MoCap 차단·검증.
 */
import { PRODUCTION_ERRORS } from '../../types/productionDanceAsset';

let groupModeActive = false;
const blockedCalls: string[] = [];
let mediaPipeCallCount = 0;
let motionExtractionCallCount = 0;

export function setGroupModeActive(active: boolean): void {
  groupModeActive = active;
  if (!active) {
    blockedCalls.length = 0;
    mediaPipeCallCount = 0;
    motionExtractionCallCount = 0;
  }
}

export function isGroupModeActive(): boolean {
  return groupModeActive;
}

function assertForbidden(caller: string, code: string): void {
  if (!groupModeActive) return;
  blockedCalls.push(caller);
  const msg = `[GroupMode GUARD] ${code}: ${caller}`;
  console.error(msg);
  throw new Error(msg);
}

export function guardGroupModeNoExtraction(caller: string): void {
  if (!groupModeActive) return;
  motionExtractionCallCount += 1;
  assertForbidden(caller, PRODUCTION_ERRORS.GROUP_MODE_MOTION_EXTRACTION_FORBIDDEN);
}

export function guardGroupModeNoMediaPipe(caller: string): void {
  if (!groupModeActive) return;
  mediaPipeCallCount += 1;
  assertForbidden(caller, PRODUCTION_ERRORS.GROUP_MODE_MEDIAPIPE_FORBIDDEN);
}

export function recordGroupModeMediaPipeBlocked(caller: string): void {
  if (!groupModeActive) return;
  mediaPipeCallCount += 1;
  blockedCalls.push(`MediaPipe:${caller}`);
}

export function getGroupModeRuntimeReport() {
  return {
    groupModeActive,
    mediaPipeCalls: mediaPipeCallCount,
    motionExtractionCalls: motionExtractionCallCount,
    skeletonExtractionCalls: motionExtractionCallCount,
    mocapApiCalls: 0,
    blockedCallers: [...blockedCalls],
  };
}

export function logGroupModeRuntimeVerification(): void {
  const r = getGroupModeRuntimeReport();
  console.info('[GroupMode] Runtime verification', {
    ...r,
    mediaPipe: r.mediaPipeCalls === 0 ? 'PASS' : 'FAIL',
    skeletonExtraction: r.skeletonExtractionCalls === 0 ? 'PASS' : 'FAIL',
  });
  if (groupModeActive && (r.mediaPipeCalls > 0 || r.motionExtractionCalls > 0)) {
    console.error('[GroupMode] ASSERTION FAILED — forbidden pipeline invoked in Group Mode');
  }
}

export function assertGroupModeClean(): void {
  const r = getGroupModeRuntimeReport();
  if (!groupModeActive) return;
  if (r.mediaPipeCalls > 0 || r.motionExtractionCalls > 0) {
    throw new Error(PRODUCTION_ERRORS.GROUP_MODE_MOTION_EXTRACTION_FORBIDDEN);
  }
}
