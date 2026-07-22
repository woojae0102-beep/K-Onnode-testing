// @ts-nocheck
/**
 * PHASE 21 — GX10 Real Execution Wiring tests (TEST 226~245)
 * Run: npx tsx src/modes/group/generation/productionMotionGenerationGx10Execution.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  ProductionPipelineExecutor,
  GX10ProductionMotionGenerationAdapter,
  createMockGx10AdapterBackendPort,
  createGx10ProductionMotionGenerationStack,
  createGx10RestAdapterBackendPort,
  GX10BackendSessionStore,
  ADAPTER_ERROR_CODES,
  EXECUTION_ERROR_CODES,
  scheduleRetry,
  ExecutionEventBus,
  ProductionMotionGenerationExecutionLock,
} from './index';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function seedJob(executor: ProductionPipelineExecutor, jobId: string) {
  executor.createJob({
    jobId,
    videoId: `vid-${jobId}`,
    groupId: 'grp-gx10',
    songId: 'song-gx10',
    memberId: 'm-gx10',
    inputVideoUrl: 'https://example.com/reference.mp4',
  });
}

async function test226MockBackendFullFlowToReady() {
  const stack = createGx10ProductionMotionGenerationStack({ useMock: true });
  seedJob(stack.executor, 'job-226');
  const result = await stack.executor.executeJob('job-226');
  assert(result.ok, 'TEST 226 execute');
  assert(result.job?.currentState === 'READY', 'TEST 226 READY');
  assert(result.job?.authorityStatus === 'registered', 'TEST 226 authority');
  console.log('TEST 226: PASS');
}

async function test227SubmitCalled() {
  const backend = createMockGx10AdapterBackendPort();
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({ adapter });
  seedJob(executor, 'job-227');
  await executor.executeJob('job-227');
  assert(backend.callOrder.includes('submitJob'), 'TEST 227 submit');
  console.log('TEST 227: PASS');
}

async function test228PollCompletesAfterProcessingTicks() {
  const backend = createMockGx10AdapterBackendPort({ pollProcessingTicks: 2 });
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({ adapter });
  seedJob(executor, 'job-228');
  const result = await executor.executeJob('job-228');
  assert(result.ok, 'TEST 228 ok');
  assert(backend.pollCalls >= 3, 'TEST 228 poll ticks');
  console.log('TEST 228: PASS');
}

async function test229DownloadCalled() {
  const backend = createMockGx10AdapterBackendPort();
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({ adapter });
  seedJob(executor, 'job-229');
  await executor.executeJob('job-229');
  const submitIdx = backend.callOrder.indexOf('submitJob');
  const downloadIdx = backend.callOrder.indexOf('downloadMotion');
  assert(downloadIdx > submitIdx, 'TEST 229 download after submit');
  console.log('TEST 229: PASS');
}

async function test230PersistCalled() {
  const backend = createMockGx10AdapterBackendPort();
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({ adapter });
  seedJob(executor, 'job-230');
  await executor.executeJob('job-230');
  assert(backend.callOrder.includes('persistMotion'), 'TEST 230 persist');
  console.log('TEST 230: PASS');
}

async function test231AuthorityRegistered() {
  const stack = createGx10ProductionMotionGenerationStack({ useMock: true });
  seedJob(stack.executor, 'job-231');
  const result = await stack.executor.executeJob('job-231');
  assert(result.job?.authorityStatus === 'registered', 'TEST 231 authority');
  assert(stack.backend.callOrder.includes('registerAuthority'), 'TEST 231 registerAuthority');
  console.log('TEST 231: PASS');
}

async function test232ReadyStateAndAssetId() {
  const stack = createGx10ProductionMotionGenerationStack({ useMock: true });
  seedJob(stack.executor, 'job-232');
  const result = await stack.executor.executeJob('job-232');
  assert(result.job?.currentState === 'READY', 'TEST 232 READY');
  assert(Boolean(result.job?.productionMotionAssetId), 'TEST 232 asset id');
  assert(Boolean(result.job?.outputMotionGlbUrl), 'TEST 232 motion url');
  console.log('TEST 232: PASS');
}

async function test233SubmitFailureThenRetrySucceeds() {
  let failSubmit = true;
  const sessionStore = new GX10BackendSessionStore();
  const base = createMockGx10AdapterBackendPort({ sessionStore });
  const backend = {
    ...base,
    callOrder: base.callOrder,
    get pollCalls() {
      return base.pollCalls;
    },
    async submitJob(input) {
      if (failSubmit) {
        base.callOrder.push('submitJob');
        return { ok: false, errorCode: ADAPTER_ERROR_CODES.SUBMIT_FAILED, recoverable: true };
      }
      return base.submitJob(input);
    },
  };
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({
    adapter,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, multiplier: 1 },
  });
  seedJob(executor, 'job-233');
  const first = await executor.executeJob('job-233');
  assert(!first.ok, 'TEST 233 first fail');
  assert(first.job?.currentState === 'FAILED', 'TEST 233 FAILED');
  assert(scheduleRetry(first.errorCode!, 0) != null, 'TEST 233 recoverable');

  failSubmit = false;
  const retried = await executor.retryJob('job-233');
  assert(retried.ok, 'TEST 233 retry ok');
  assert(retried.job?.currentState === 'READY', 'TEST 233 retry READY');
  console.log('TEST 233: PASS');
}

async function test234PollTimeoutRecoverable() {
  const backend = createMockGx10AdapterBackendPort({ pollTimeoutAfter: 0 });
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({ adapter });
  seedJob(executor, 'job-234');
  const result = await executor.executeJob('job-234');
  assert(!result.ok, 'TEST 234 fail');
  assert(
    result.errorCode === ADAPTER_ERROR_CODES.POLL_TIMEOUT
      || result.errorCode === ADAPTER_ERROR_CODES.POLL_FAILED,
    'TEST 234 timeout code',
  );
  assert(scheduleRetry(result.errorCode!, 0) != null, 'TEST 234 recoverable');
  console.log('TEST 234: PASS');
}

async function test235DownloadFailureRecoverable() {
  const backend = createMockGx10AdapterBackendPort({ failAt: 'download' });
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({ adapter });
  seedJob(executor, 'job-235');
  const result = await executor.executeJob('job-235');
  assert(!result.ok, 'TEST 235 fail');
  assert(result.errorCode === ADAPTER_ERROR_CODES.DOWNLOAD_FAILED, 'TEST 235 code');
  assert(scheduleRetry(result.errorCode!, 0) != null, 'TEST 235 recoverable');
  console.log('TEST 235: PASS');
}

async function test236PersistFailureBlocksAuthority() {
  const backend = createMockGx10AdapterBackendPort({ failAt: 'persist' });
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({ adapter });
  seedJob(executor, 'job-236');
  const result = await executor.executeJob('job-236');
  assert(!result.ok, 'TEST 236 fail');
  assert(result.errorCode === ADAPTER_ERROR_CODES.PERSIST_FAILED, 'TEST 236 code');
  assert(!backend.callOrder.includes('registerAuthority'), 'TEST 236 no authority');
  console.log('TEST 236: PASS');
}

async function test237AuthorityFailureNonRecoverable() {
  const backend = createMockGx10AdapterBackendPort({ failAt: 'authority' });
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({ adapter });
  seedJob(executor, 'job-237');
  const result = await executor.executeJob('job-237');
  assert(!result.ok, 'TEST 237 fail');
  assert(result.errorCode === ADAPTER_ERROR_CODES.AUTHORITY_FAILED, 'TEST 237 code');
  assert(scheduleRetry(result.errorCode!, 0) == null, 'TEST 237 not recoverable');
  console.log('TEST 237: PASS');
}

async function test238DuplicateExecuteBlocked() {
  const stack = createGx10ProductionMotionGenerationStack({ useMock: true });
  const lock = new ProductionMotionGenerationExecutionLock();
  const ownerA = 'owner-a';
  const ownerB = 'owner-b';
  assert(lock.tryAcquire('job-238', ownerA), 'TEST 238 lock A');
  const executor = new ProductionPipelineExecutor({
    adapter: stack.adapter,
    executionLock: lock,
    ownerId: ownerB,
  });
  seedJob(executor, 'job-238');
  const result = await executor.executeJob('job-238');
  assert(!result.ok, 'TEST 238 blocked');
  assert(
    result.errorCode === EXECUTION_ERROR_CODES.DUPLICATE_EXECUTE
      || result.errorCode === EXECUTION_ERROR_CODES.JOB_ALREADY_RUNNING,
    'TEST 238 code',
  );
  lock.release('job-238', ownerA);
  console.log('TEST 238: PASS');
}

async function test239CancellationAfterSubmit() {
  const stack = createGx10ProductionMotionGenerationStack({ useMock: true });
  seedJob(stack.executor, 'job-239');
  await stack.executor.executeStage('job-239', 'UPLOAD_VIDEO');
  assert(stack.backend.callOrder.includes('submitJob'), 'TEST 239 submit');
  const cancelled = stack.executor.cancelJob('job-239');
  assert(cancelled.ok, 'TEST 239 cancel');
  const resume = await stack.executor.resumeJob('job-239');
  assert(!resume.ok, 'TEST 239 resume blocked');
  console.log('TEST 239: PASS');
}

async function test240RealBackendSubmitRequiresVideoBuffer() {
  const sessionStore = new GX10BackendSessionStore();
  const backend = createGx10RestAdapterBackendPort({
    sessionStore,
    client: {
      submitJob: async () => ({ jobId: 'should-not-run', status: 'queued' }),
      getJobStatus: async () => ({ status: 'completed' }),
      getJobResult: async () => ({}),
      downloadMemberMotionGlb: async () => Buffer.from('x'),
      cancelJob: async () => {},
    },
  });
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const result = await adapter.submitJob({
    job: {
      jobId: 'job-240',
      videoId: 'v',
      groupId: 'g',
      songId: 's',
      memberId: 'm',
      inputVideoUrl: 'https://example.com/v.mp4',
      outputMotionGlbUrl: null,
      retryCount: 0,
      elapsedTimeMs: 0,
      startedAt: null,
      completedAt: null,
      currentStage: null,
      currentState: 'NEW',
      errorCode: null,
      progressPercent: 0,
      authorityStatus: 'pending',
      completedStages: [],
      productionMotionAssetId: null,
      cancelled: false,
    },
    inputVideoUrl: 'https://example.com/v.mp4',
  });
  assert(!result.ok, 'TEST 240 blocked without buffer');
  assert(result.errorCode === ADAPTER_ERROR_CODES.SUBMIT_FAILED, 'TEST 240 code');

  sessionStore.setJobInput('job-240', { videoBuffer: Buffer.from('fake-mp4') });
  const ok = await adapter.submitJob({
    job: {
      jobId: 'job-240',
      videoId: 'v',
      groupId: 'g',
      songId: 's',
      memberId: 'm',
      inputVideoUrl: 'https://example.com/v.mp4',
      outputMotionGlbUrl: null,
      retryCount: 0,
      elapsedTimeMs: 0,
      startedAt: null,
      completedAt: null,
      currentStage: null,
      currentState: 'NEW',
      errorCode: null,
      progressPercent: 0,
      authorityStatus: 'pending',
      completedStages: [],
      productionMotionAssetId: null,
      cancelled: false,
    },
    inputVideoUrl: 'https://example.com/v.mp4',
  });
  assert(ok.ok, 'TEST 240 submit with buffer');
  console.log('TEST 240: PASS');
}

async function test241BackendCallOrderEndToEnd() {
  const backend = createMockGx10AdapterBackendPort({ pollProcessingTicks: 1 });
  const adapter = new GX10ProductionMotionGenerationAdapter(backend);
  const executor = new ProductionPipelineExecutor({ adapter });
  seedJob(executor, 'job-241');
  await executor.executeJob('job-241');
  const order = backend.callOrder;
  const idx = (m: string) => order.indexOf(m);
  assert(idx('submitJob') < idx('pollJob'), 'TEST 241 submit<poll');
  assert(idx('pollJob') < idx('downloadMotion'), 'TEST 241 poll<download');
  assert(idx('downloadMotion') < idx('persistMotion'), 'TEST 241 download<persist');
  assert(idx('persistMotion') < idx('registerAuthority'), 'TEST 241 persist<authority');
  console.log('TEST 241: PASS');
}

async function test242StageEventsEmitted() {
  const events = new ExecutionEventBus();
  const stack = createGx10ProductionMotionGenerationStack({
    useMock: true,
    executor: { eventBus: events },
  });
  seedJob(stack.executor, 'job-242');
  const types: string[] = [];
  stack.executor.onEvent((e) => types.push(e.type));
  await stack.executor.executeJob('job-242');
  assert(types.includes('PipelineStarted'), 'TEST 242 started');
  assert(types.includes('StageCompleted'), 'TEST 242 stage completed');
  assert(types.includes('Completed'), 'TEST 242 completed');
  console.log('TEST 242: PASS');
}

async function test243Phase20AdapterRegression() {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('npx', ['tsx', 'src/modes/group/generation/productionMotionGenerationAdapter.test.ts'], {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
  });
  assert(r.status === 0, `TEST 243 phase20: ${r.stderr?.slice(-500)}`);
  console.log('TEST 243: PASS');
}

const FORBIDDEN_PATHS = [
  'src/components/group/three/AvatarCharacterAnimated3D.tsx',
  'src/components/group/three/GroupDanceStage3D.tsx',
  'src/modes/group/services/ProductionMotionAssetLoader.ts',
  'src/modes/group/runtime/runProductionMotionRetargetGate.ts',
  'src/gx10/ingest/verifyProductionAuthority.ts',
  'src/modes/group/benchmark/groupMotionBrowserBenchmarkHarness.ts',
  'src/modes/group/runtime/DefaultAvatarMotionRetargeter.ts',
];

function test244RuntimeFilesUnmodified() {
  const root = resolve(process.cwd());
  for (const rel of FORBIDDEN_PATHS) {
    const content = readFileSync(join(root, rel), 'utf8');
    assert(!content.includes('createGx10RestAdapterBackendPort'), `TEST 244 ${rel}`);
    assert(!content.includes('createMockGx10AdapterBackendPort'), `TEST 244 ${rel}`);
  }
  console.log('TEST 244: PASS');
}

function test245RestClientOnlyInBackendPortModule() {
  const root = resolve(process.cwd());
  const allowed = readFileSync(
    join(root, 'src/modes/group/generation/adapters/gx10/createGx10RestAdapterBackendPort.ts'),
    'utf8',
  );
  assert(allowed.includes('gx10RestClient'), 'TEST 245 backend has rest client');

  const forbidden = [
    'src/modes/group/generation/adapters/gx10/GX10ProductionMotionGenerationAdapter.ts',
    'src/modes/group/generation/adapters/createAdapterPipelineHandlers.ts',
    'src/modes/group/generation/productionMotionGenerationPipelineExecutor.ts',
  ];
  for (const rel of forbidden) {
    const content = readFileSync(join(root, rel), 'utf8');
    assert(!content.includes('gx10RestClient'), `TEST 245 ${rel} no direct rest`);
  }
  console.log('TEST 245: PASS');
}

async function main() {
  await test226MockBackendFullFlowToReady();
  await test227SubmitCalled();
  await test228PollCompletesAfterProcessingTicks();
  await test229DownloadCalled();
  await test230PersistCalled();
  await test231AuthorityRegistered();
  await test232ReadyStateAndAssetId();
  await test233SubmitFailureThenRetrySucceeds();
  await test234PollTimeoutRecoverable();
  await test235DownloadFailureRecoverable();
  await test236PersistFailureBlocksAuthority();
  await test237AuthorityFailureNonRecoverable();
  await test238DuplicateExecuteBlocked();
  await test239CancellationAfterSubmit();
  await test240RealBackendSubmitRequiresVideoBuffer();
  await test241BackendCallOrderEndToEnd();
  await test242StageEventsEmitted();
  await test243Phase20AdapterRegression();
  test244RuntimeFilesUnmodified();
  test245RestClientOnlyInBackendPortModule();
  console.log('productionMotionGenerationGx10Execution tests: ALL PASS (TEST 226~245)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
