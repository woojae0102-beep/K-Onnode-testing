// @ts-nocheck
/**
 * Feature Flag Manager — VITE_* 빌드타임 값을 기본값으로 하되,
 * 런타임(localStorage)에서 Motion Worker / Renderer Worker / WebCodecs / GPU Delegate 등을
 * 중앙에서 켜고 끌 수 있다.
 *
 * 사용 예 (브라우저 콘솔):
 *   __K_ONNODE_FLAGS__.set('rendererWorkerEnabled', true)
 *   __K_ONNODE_FLAGS__.getAll()
 *   __K_ONNODE_FLAGS__.reset()
 */

export type FeatureFlagKey =
  | 'motionWorkerEnabled'
  | 'rendererWorkerEnabled'
  | 'webCodecsEnabled'
  | 'gpuDelegatePreferred'
  | 'forceMainThreadMediaPipe'
  | 'forceRvfcOnly'
  | 'telemetryEnabled'
  | 'telemetryUploadEnabled'
  | 'workerRecoveryEnabled'
  | 'gpuResourceMonitoringEnabled'
  | 'benchmarkModeEnabled';

export type FeatureFlagValues = Record<FeatureFlagKey, boolean>;

const STORAGE_KEY = 'k-onnode:feature-flags:v1';

const ENV_DEFAULTS: FeatureFlagValues = {
  motionWorkerEnabled: true,
  rendererWorkerEnabled: import.meta.env.VITE_RENDERER_WORKER_ENABLED === 'true',
  webCodecsEnabled: import.meta.env.VITE_FORCE_RVFC !== 'true',
  gpuDelegatePreferred: import.meta.env.VITE_GPU_DELEGATE_PREFERRED !== 'false',
  forceMainThreadMediaPipe: import.meta.env.VITE_FORCE_MAIN_THREAD_MEDIAPIPE === 'true',
  forceRvfcOnly: import.meta.env.VITE_FORCE_RVFC === 'true',
  telemetryEnabled: import.meta.env.VITE_TELEMETRY_ENABLED !== 'false',
  telemetryUploadEnabled: import.meta.env.VITE_TELEMETRY_UPLOAD === 'true',
  workerRecoveryEnabled: import.meta.env.VITE_WORKER_RECOVERY !== 'false',
  gpuResourceMonitoringEnabled: import.meta.env.VITE_GPU_MONITORING !== 'false',
  benchmarkModeEnabled: false,
};

type FlagListener = (flags: FeatureFlagValues) => void;

function readStoredOverrides(): Partial<FeatureFlagValues> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredOverrides(overrides: Partial<FeatureFlagValues>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!Object.keys(overrides).length) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // quota / private mode — 무시
  }
}

function createFeatureFlagManager() {
  let overrides = readStoredOverrides();
  const listeners = new Set<FlagListener>();

  const merge = (): FeatureFlagValues => ({
    ...ENV_DEFAULTS,
    ...overrides,
  });

  const notify = () => {
    const snapshot = merge();
    listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.warn('[FeatureFlags] listener error', err);
      }
    });
  };

  const get = (key: FeatureFlagKey): boolean => merge()[key];

  const getAll = (): FeatureFlagValues => ({ ...merge() });

  const set = (key: FeatureFlagKey, value: boolean): void => {
    overrides = { ...overrides, [key]: value };
    writeStoredOverrides(overrides);
    notify();
  };

  const setMany = (patch: Partial<FeatureFlagValues>): void => {
    overrides = { ...overrides, ...patch };
    writeStoredOverrides(overrides);
    notify();
  };

  const reset = (key?: FeatureFlagKey): void => {
    if (key) {
      const next = { ...overrides };
      delete next[key];
      overrides = next;
    } else {
      overrides = {};
    }
    writeStoredOverrides(overrides);
    notify();
  };

  const subscribe = (listener: FlagListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  /** URL 쿼리 ?flags=rendererWorker,webCodecs — DEV 전용 빠른 토글 */
  const applyQueryOverrides = (): void => {
    if (typeof window === 'undefined' || !import.meta.env?.DEV) return;
    const raw = new URLSearchParams(window.location.search).get('flags');
    if (!raw) return;
    const patch: Partial<FeatureFlagValues> = {};
    raw.split(',').map((s) => s.trim()).filter(Boolean).forEach((token) => {
      const off = token.startsWith('!');
      const name = off ? token.slice(1) : token;
      const map: Record<string, FeatureFlagKey> = {
        motionWorker: 'motionWorkerEnabled',
        rendererWorker: 'rendererWorkerEnabled',
        webCodecs: 'webCodecsEnabled',
        gpuDelegate: 'gpuDelegatePreferred',
        mainThreadMediaPipe: 'forceMainThreadMediaPipe',
        rvfc: 'forceRvfcOnly',
        telemetry: 'telemetryEnabled',
        telemetryUpload: 'telemetryUploadEnabled',
        workerRecovery: 'workerRecoveryEnabled',
        gpuMonitor: 'gpuResourceMonitoringEnabled',
        benchmark: 'benchmarkModeEnabled',
      };
      const key = map[name];
      if (key) patch[key] = !off;
    });
    if (Object.keys(patch).length) setMany(patch);
  };

  return { get, getAll, set, setMany, reset, subscribe, applyQueryOverrides };
}

export const featureFlagManager = createFeatureFlagManager();

if (typeof window !== 'undefined') {
  (window as any).__K_ONNODE_FLAGS__ = featureFlagManager;
}
