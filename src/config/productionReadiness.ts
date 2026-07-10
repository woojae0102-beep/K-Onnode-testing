// @ts-nocheck
/**
 * Production Readiness Bootstrap — Telemetry, Feature Flags, GPU Monitor 등을
 * 앱 시작 시 한 번에 초기화한다.
 */
import { featureFlagManager } from './featureFlagManager';
import { initGpuResourceMonitor } from '../utils/gpuResourceMonitor';
import { initPipelineTelemetry } from '../utils/pipelineTelemetry';
import { initE2EPipelineHarness } from '../testing/e2ePipelineHarness';
import { pipelineDiagnostics } from '../utils/pipelineDiagnostics';
import { pipelineEventBus } from '../utils/pipelineEventBus';
import { setWorkerHungCallback } from '../utils/workerHealthMonitor';

let bootstrapped = false;

export function initProductionReadiness(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  featureFlagManager.applyQueryOverrides();
  initGpuResourceMonitor();
  initPipelineTelemetry();
  initE2EPipelineHarness();

  pipelineEventBus.on('renderer-frame-drawn', (p) => {
    const t = (p.frameIndex ?? 0) / 30;
    pipelineDiagnostics.markTimeline(t, 'renderer-end', p.frameIndex);
  });

  setWorkerHungCallback((name, status) => {
    console.error('[PipelineDiag] Worker HUNG — queue dump', { name, status });
    pipelineDiagnostics.dumpSnapshots(30);
  });

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
