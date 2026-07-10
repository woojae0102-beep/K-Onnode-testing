// @ts-nocheck
/**
 * Pipeline Event Bus — Motion Extraction / Renderer / (미래의) AI Dance Coach가
 * 서로 직접 import·호출하지 않고 이벤트로만 통신하도록 하는 초경량 pub/sub.
 *
 * 격리 원칙(항목 7):
 * - 각 서브시스템은 이 버스에만 의존하고, 다른 서브시스템의 내부 모듈을 직접 import하지 않는다.
 * - 한 구독자(subscriber)에서 발생한 예외가 다른 구독자의 실행을 막지 않는다(격리 실행).
 * - Worker/Queue 자체는 공유하지 않는다 — 이 버스는 "이벤트 전달"만 담당하고
 *   무거운 연산은 각 서브시스템이 자신의 Worker/Queue에서 수행해야 한다.
 */

export type PipelineEventMap = {
  'motion-frame-ready': {
    groupId: string;
    frameIndex: number;
    timestamp: number;
    detectedPeople?: unknown[];
  };
  'motion-extraction-complete': {
    groupId: string;
    songId: string;
    frameCount: number;
    coverage: number;
  };
  'motion-extraction-error': {
    groupId: string;
    songId?: string;
    message: string;
  };
  'renderer-frame-drawn': {
    surface: string;
    frameIndex: number;
    drawMs: number;
  };
  'pipeline-memory-report': {
    subsystem: string;
    usedJSHeapBytes: number | null;
    reportedAtMs: number;
  };
};

export type PipelineEventName = keyof PipelineEventMap;
type Listener<K extends PipelineEventName> = (payload: PipelineEventMap[K]) => void;

function createPipelineEventBus() {
  const listeners = new Map<PipelineEventName, Set<Listener<any>>>();

  const on = <K extends PipelineEventName>(event: K, listener: Listener<K>): (() => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(listener);
    return () => off(event, listener);
  };

  const off = <K extends PipelineEventName>(event: K, listener: Listener<K>): void => {
    listeners.get(event)?.delete(listener);
  };

  const emit = <K extends PipelineEventName>(event: K, payload: PipelineEventMap[K]): void => {
    const set = listeners.get(event);
    if (!set?.size) return;
    // 격리 실행 — 한 구독자의 예외가 다른 구독자/발행자(emit 호출부)에 전파되지 않도록 한다.
    set.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.warn(`[PipelineEventBus] "${event}" 구독자 실행 중 오류`, err);
      }
    });
  };

  const clear = (event?: PipelineEventName): void => {
    if (event) listeners.delete(event);
    else listeners.clear();
  };

  return { on, off, emit, clear };
}

/** 앱 전역에서 공유되는 단일 이벤트 버스 인스턴스 */
export const pipelineEventBus = createPipelineEventBus();

export type PipelineComponentKind = 'worker' | 'queue' | 'detector' | 'renderer' | 'other';

export type PipelineComponentInfo = {
  name: string;
  subsystem: string;
  kind: PipelineComponentKind;
  registeredAtMs: number;
  meta?: Record<string, unknown>;
};

/**
 * Pipeline Registry — 현재 활성화된 Worker/Queue/Detector를 서브시스템별로 등록해
 * Debug Overlay 등 한 곳에서 전체 파이프라인 상태를 조회할 수 있게 한다.
 * 등록/해제만 담당하며, 등록된 컴포넌트를 직접 제어하지 않는다(느슨한 결합 유지).
 */
function createPipelineRegistry() {
  const components = new Map<string, PipelineComponentInfo>();

  const register = (info: Omit<PipelineComponentInfo, 'registeredAtMs'>): (() => void) => {
    const key = `${info.subsystem}:${info.name}`;
    components.set(key, { ...info, registeredAtMs: Date.now() });
    return () => components.delete(key);
  };

  const list = (): PipelineComponentInfo[] => Array.from(components.values());

  const listBySubsystem = (subsystem: string): PipelineComponentInfo[] =>
    list().filter((c) => c.subsystem === subsystem);

  /** 두 서브시스템이 동일한 Worker/Queue 이름을 공유하고 있지 않은지 검증(격리 원칙 위반 감지) */
  const findCrossSubsystemNameCollisions = (): Array<{ name: string; subsystems: string[] }> => {
    const bySimpleName = new Map<string, Set<string>>();
    list().forEach((c) => {
      if (!bySimpleName.has(c.name)) bySimpleName.set(c.name, new Set());
      bySimpleName.get(c.name)!.add(c.subsystem);
    });
    const collisions: Array<{ name: string; subsystems: string[] }> = [];
    bySimpleName.forEach((subsystems, name) => {
      if (subsystems.size > 1) collisions.push({ name, subsystems: Array.from(subsystems) });
    });
    return collisions;
  };

  return { register, list, listBySubsystem, findCrossSubsystemNameCollisions };
}

export const pipelineRegistry = createPipelineRegistry();
