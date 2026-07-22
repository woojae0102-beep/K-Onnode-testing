// @ts-nocheck
/**
 * GX10 Production Motion Generation stack factory (PHASE 21).
 * Wires Pipeline Executor → GX10 Adapter → Backend Port (REST or Mock).
 */
import { ProductionPipelineExecutor } from '../../productionMotionGenerationPipelineExecutor';
import type { ProductionPipelineExecutorOptions } from '../../productionMotionGenerationPipelineExecutor';
import { GX10ProductionMotionGenerationAdapter } from './GX10ProductionMotionGenerationAdapter';
import { GX10BackendSessionStore } from './GX10BackendSessionStore';
import { createGx10RestAdapterBackendPort, type Gx10RestAdapterBackendOptions } from './createGx10RestAdapterBackendPort';
import { createMockGx10AdapterBackendPort, type MockGx10BackendOptions } from './createMockGx10AdapterBackendPort';
import type { GX10AdapterBackendPort } from './GX10AdapterBackendPort';

export type Gx10GenerationStackOptions = {
  useMock?: boolean;
  mock?: MockGx10BackendOptions;
  rest?: Gx10RestAdapterBackendOptions;
  sessionStore?: GX10BackendSessionStore;
  executor?: Omit<ProductionPipelineExecutorOptions, 'adapter'>;
};

export type Gx10ProductionMotionGenerationStack = {
  sessionStore: GX10BackendSessionStore;
  backend: GX10AdapterBackendPort;
  adapter: GX10ProductionMotionGenerationAdapter;
  executor: ProductionPipelineExecutor;
};

export function createGx10ProductionMotionGenerationStack(
  options: Gx10GenerationStackOptions = {},
): Gx10ProductionMotionGenerationStack {
  const sessionStore = options.sessionStore ?? new GX10BackendSessionStore();

  const backend = options.useMock
    ? createMockGx10AdapterBackendPort({ sessionStore, ...options.mock })
    : createGx10RestAdapterBackendPort({ sessionStore, ...options.rest });

  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({
    ...options.executor,
    adapter,
  });

  return { sessionStore, backend, adapter, executor };
}

export default createGx10ProductionMotionGenerationStack;
