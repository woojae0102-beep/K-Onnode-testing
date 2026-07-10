// @ts-nocheck
/**
 * Production Readiness Bootstrap — Telemetry, Feature Flags, GPU Monitor 등을
 * 앱 시작 시 한 번에 초기화한다.
 */
import { featureFlagManager } from './featureFlagManager';
import { initGpuResourceMonitor } from '../utils/gpuResourceMonitor';
import { initPipelineTelemetry } from '../utils/pipelineTelemetry';
import { initE2EPipelineHarness } from '../testing/e2ePipelineHarness';

let bootstrapped = false;

export function initProductionReadiness(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  featureFlagManager.applyQueryOverrides();
  initGpuResourceMonitor();
  initPipelineTelemetry();
  initE2EPipelineHarness();

  if (import.meta.env?.DEV) {
    console.info('[ProductionReadiness] Feature Flags', featureFlagManager.getAll());
  }
}

/** pipelineConfig 호환 — 런타임 Feature Flag 기반 getter */
export function isRendererWorkerEnabled(): boolean {
  return featureFlagManager.get('rendererWorkerEnabled');
}

export function isWebCodecsEnabled(): boolean {
  return featureFlagManager.get('webCodecsEnabled') && !featureFlagManager.get('forceRvfcOnly');
}

export function isForceMainThreadMediaPipe(): boolean {
  return featureFlagManager.get('forceMainThreadMediaPipe');
}

export function isGpuDelegatePreferred(): boolean {
  return featureFlagManager.get('gpuDelegatePreferred');
}

export function isMotionWorkerEnabled(): boolean {
  return featureFlagManager.get('motionWorkerEnabled');
}
