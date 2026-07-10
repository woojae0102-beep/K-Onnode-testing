// @ts-nocheck
/**
 * E2E Pipeline Harness — Playwright 회귀 테스트에서 파이프라인 단계를 검증하기 위한
 * 브라우저 노출 API. 실제 MediaPipe 없이도 이벤트 버스·Telemetry·Benchmark 연동을 검증한다.
 */
import { pipelineEventBus } from '../utils/pipelineEventBus';
import { featureFlagManager } from '../config/featureFlagManager';
import { getTelemetryBuffer, recordTelemetry } from '../utils/pipelineTelemetry';
import { getGpuResourceSnapshot } from '../utils/gpuResourceMonitor';
import { getBenchmarkHistory } from '../utils/pipelineBenchmark';

export type E2EPipelineStep =
  | 'upload'
  | 'motion-extraction'
  | 'dance-database'
  | 'renderer'
  | 'group-studio';

const completedSteps = new Set<E2EPipelineStep>();

export function markE2EStep(step: E2EPipelineStep): void {
  completedSteps.add(step);
  recordTelemetry('info', `E2E step: ${step}`, { subsystem: 'e2e', meta: { step } });
}

export function getE2ECompletedSteps(): E2EPipelineStep[] {
  return Array.from(completedSteps);
}

export function resetE2ESteps(): void {
  completedSteps.clear();
}

export function runE2EPipelineSmoke(): {
  flagsOk: boolean;
  telemetryOk: boolean;
  gpuMonitorOk: boolean;
  eventBusOk: boolean;
  steps: E2EPipelineStep[];
} {
  resetE2ESteps();

  const flags = featureFlagManager.getAll();
  const flagsOk = typeof flags.motionWorkerEnabled === 'boolean';

  let eventBusOk = false;
  const unsub = pipelineEventBus.on('motion-extraction-complete', () => {
    markE2EStep('motion-extraction');
  });
  pipelineEventBus.emit('motion-extraction-complete', {
    groupId: 'e2e-smoke',
    songId: 'e2e-smoke',
    frameCount: 120,
    coverage: 0.95,
  });
  eventBusOk = completedSteps.has('motion-extraction');
  unsub();

  markE2EStep('upload');
  markE2EStep('dance-database');
  markE2EStep('renderer');
  markE2EStep('group-studio');

  const telemetryOk = getTelemetryBuffer().length > 0;
  const gpuMonitorOk = typeof getGpuResourceSnapshot().imageBitmapLive === 'number';

  return {
    flagsOk,
    telemetryOk,
    gpuMonitorOk,
    eventBusOk,
    steps: getE2ECompletedSteps(),
  };
}

export function initE2EPipelineHarness(): void {
  if (typeof window === 'undefined') return;
  (window as any).__K_ONNODE_E2E__ = {
    markStep: markE2EStep,
    getSteps: getE2ECompletedSteps,
    reset: resetE2ESteps,
    runSmoke: runE2EPipelineSmoke,
    getBenchmarkHistory,
  };
}
