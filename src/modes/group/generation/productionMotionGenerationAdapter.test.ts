// @ts-nocheck
/**
 * PHASE 20 — GX10 Adapter Layer tests (TEST 209~225)
 * Run: npx tsx src/modes/group/generation/productionMotionGenerationAdapter.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  ProductionPipelineExecutor,
  MockProductionMotionGenerationAdapter,
  GX10ProductionMotionGenerationAdapter,
  createInMemoryGX10AdapterBackend,
  DeepMotionProductionMotionGenerationAdapter,
  ADAPTER_ERROR_CODES,
  blockRuntimeRegistrationBeforeReady,
  createAdapterPipelineHandlers,
  AdapterExecutionStateStore,
} from './index';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function seed(executor: ProductionPipelineExecutor, jobId: string) {
  executor.createJob({
    jobId,
    videoId: `vid-${jobId}`,
    groupId: 'grp-adapt',
    songId: 'song-adapt',
    memberId: 'm-adapt',
    inputVideoUrl: 'https://example.com/v.mp4',
  });
}

async function test209AdapterInterfaceMockExecuteToReady() {
  const mock = new MockProductionMotionGenerationAdapter('mock-gx10');
  const executor = new ProductionPipelineExecutor({ adapter: mock });
  seed(executor, 'job-209');
  const result = await executor.executeJob('job-209');
  assert(result.ok, 'TEST 209 execute');
  assert(result.job?.currentState === 'READY', 'TEST 209 READY');
  console.log('TEST 209: PASS');
}

async function test210SubmitPollDownloadPersistRegisterOrder() {
  const mock = new MockProductionMotionGenerationAdapter('mock-gx10');
  const executor = new ProductionPipelineExecutor({ adapter: mock });
  seed(executor, 'job-210');
  await executor.executeJob('job-210');

  const order = mock.callOrder;
  const submitIdx = order.indexOf('submitJob');
  const pollIdx = order.indexOf('pollJob');
  const downloadIdx = order.indexOf('downloadMotion');
  const persistIdx = order.indexOf('persistMotion');
  const authIdx = order.indexOf('registerAuthority');

  assert(submitIdx >= 0, 'TEST 210 submit');
  assert(pollIdx > submitIdx, 'TEST 210 poll after submit');
  assert(downloadIdx > pollIdx, 'TEST 210 download after poll');
  assert(persistIdx > downloadIdx, 'TEST 210 persist after download');
  assert(authIdx > persistIdx, 'TEST 210 authority after persist');
  console.log('TEST 210: PASS');
}

async function test211Gx10AdapterUsesBackendPort() {
  const backend = createInMemoryGX10AdapterBackend();
  const gx10 = new GX10ProductionMotionGenerationAdapter(backend);
  assert(gx10.adapterId === 'gx10', 'TEST 211 id');
  const executor = new ProductionPipelineExecutor({ adapter: gx10 });
  seed(executor, 'job-211');
  const result = await executor.executeJob('job-211');
  assert(result.ok, 'TEST 211 gx10 backend');
  assert(result.job?.authorityStatus === 'registered', 'TEST 211 authority');
  console.log('TEST 211: PASS');
}

async function test212DeepMotionAdapterNotInvokedByGx10Executor() {
  const deep = new DeepMotionProductionMotionGenerationAdapter();
  const result = await deep.submitJob({
    job: {
      jobId: 'dm-1',
      videoId: 'v',
      groupId: 'g',
      songId: 's',
      memberId: 'm',
      inputVideoUrl: null,
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
  });
  assert(!result.ok, 'TEST 212 deepmotion blocked');
  assert(result.errorCode === 'DEEPMOTION_ADAPTER_NOT_CONNECTED', 'TEST 212 code');

  const mock = new MockProductionMotionGenerationAdapter('mock-gx10');
  const executor = new ProductionPipelineExecutor({ adapter: mock });
  seed(executor, 'job-212');
  await executor.executeJob('job-212');
  assert(!mock.callOrder.includes('deepmotion'), 'TEST 212 no deepmotion call');
  console.log('TEST 212: PASS');
}

async function test213SubmitFailureFailClosed() {
  const mock = new MockProductionMotionGenerationAdapter('mock-gx10', { failAt: 'submit' });
  const executor = new ProductionPipelineExecutor({ adapter: mock });
  seed(executor, 'job-213');
  const result = await executor.executeJob('job-213');
  assert(!result.ok, 'TEST 213 fail');
  assert(result.errorCode === ADAPTER_ERROR_CODES.SUBMIT_FAILED, 'TEST 213 code');
  assert(result.job?.currentState === 'FAILED', 'TEST 213 FAILED');
  console.log('TEST 213: PASS');
}

async function test214PollTimeoutFailClosed() {
  const mock = new MockProductionMotionGenerationAdapter('mock-gx10', { failAt: 'poll' });
  const executor = new ProductionPipelineExecutor({ adapter: mock });
  seed(executor, 'job-214');
  const result = await executor.executeJob('job-214');
  assert(!result.ok, 'TEST 214 fail');
  assert(
    result.errorCode === ADAPTER_ERROR_CODES.POLL_FAILED
      || result.errorCode === ADAPTER_ERROR_CODES.POLL_TIMEOUT,
    'TEST 214 poll error',
  );
  console.log('TEST 214: PASS');
}

async function test215PersistFailureBlocksAuthority() {
  const mock = new MockProductionMotionGenerationAdapter('mock-gx10', { failAt: 'persist' });
  const executor = new ProductionPipelineExecutor({ adapter: mock });
  seed(executor, 'job-215');
  const result = await executor.executeJob('job-215');
  assert(!result.ok, 'TEST 215 fail');
  assert(result.errorCode === ADAPTER_ERROR_CODES.PERSIST_FAILED, 'TEST 215 code');
  assert(!mock.callOrder.includes('registerAuthority'), 'TEST 215 no authority');
  console.log('TEST 215: PASS');
}

async function test216AuthorityFailureBlocksReady() {
  const mock = new MockProductionMotionGenerationAdapter('mock-gx10', { failAt: 'authority' });
  const executor = new ProductionPipelineExecutor({ adapter: mock });
  seed(executor, 'job-216');
  const result = await executor.executeJob('job-216');
  assert(!result.ok, 'TEST 216 fail');
  assert(result.errorCode === ADAPTER_ERROR_CODES.AUTHORITY_FAILED, 'TEST 216 code');
  assert(result.job?.currentState !== 'READY', 'TEST 216 not READY');
  console.log('TEST 216: PASS');
}

function test217RuntimeRegisterBeforeReadyBlocked() {
  const blocked = blockRuntimeRegistrationBeforeReady('REGISTERING');
  assert(!blocked.ok, 'TEST 217 blocked');
  assert(blocked.errorCode === ADAPTER_ERROR_CODES.RUNTIME_REGISTER_BEFORE_READY, 'TEST 217 code');
  const allowed = blockRuntimeRegistrationBeforeReady('READY');
  assert(allowed.ok, 'TEST 217 allowed when READY');
  console.log('TEST 217: PASS');
}

async function test218PollProcessingThenComplete() {
  const mock = new MockProductionMotionGenerationAdapter('mock-gx10', {
    pollReturnsProcessingFirst: true,
  });
  const executor = new ProductionPipelineExecutor({ adapter: mock });
  seed(executor, 'job-218');
  const result = await executor.executeJob('job-218');
  assert(result.ok, 'TEST 218 complete after multi-poll');
  assert(mock.callOrder.filter((c) => c === 'pollJob').length >= 2, 'TEST 218 multi poll');
  console.log('TEST 218: PASS');
}

async function test219ExecutorAdapterDependencyInjection() {
  const mock = new MockProductionMotionGenerationAdapter('mock-gx10');
  const executor = new ProductionPipelineExecutor({ adapter: mock });
  assert(executor.adapter === mock, 'TEST 219 adapter injected');
  console.log('TEST 219: PASS');
}

function test220GenerationLayerNoDirectGx10RestImport() {
  const root = resolve(process.cwd());
  const files = [
    'src/modes/group/generation/adapters/createAdapterPipelineHandlers.ts',
    'src/modes/group/generation/adapters/gx10/GX10ProductionMotionGenerationAdapter.ts',
    'src/modes/group/generation/productionMotionGenerationPipelineExecutor.ts',
  ];
  for (const rel of files) {
    const content = readFileSync(join(root, rel), 'utf8');
    assert(!content.includes('gx10RestClient'), `TEST 220 ${rel} no rest client`);
    assert(!content.includes('gx10ProductionMotionOrchestrator'), `TEST 220 ${rel} no orchestrator`);
  }
  console.log('TEST 220: PASS');
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

function test221RuntimeFilesUnmodified() {
  const root = resolve(process.cwd());
  for (const rel of FORBIDDEN_PATHS) {
    const content = readFileSync(join(root, rel), 'utf8');
    assert(!content.includes('ProductionMotionGenerationAdapter'), `TEST 221 ${rel}`);
    assert(!content.includes('createAdapterPipelineHandlers'), `TEST 221 ${rel}`);
  }
  console.log('TEST 221: PASS');
}

async function test222Phase19ExecutorRegression() {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('npx', ['tsx', 'src/modes/group/generation/productionMotionGenerationPipelineExecutor.test.ts'], {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
  });
  assert(r.status === 0, `TEST 222 phase19: ${r.stderr?.slice(-400)}`);
  console.log('TEST 222: PASS');
}

async function test223AuthorityRegression() {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('npx', ['tsx', 'src/modes/group/runtime/productionAuthorityFailClosed.test.ts'], {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
  });
  assert(r.status === 0, `TEST 223 authority: ${r.stderr?.slice(-400)}`);
  console.log('TEST 223: PASS');
}

async function test224BenchmarkRegression() {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('npx', ['tsx', 'src/modes/group/runtime/productionMotionBrowserBenchmark.test.ts'], {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
  });
  assert(r.status === 0, `TEST 224 benchmark: ${r.stderr?.slice(-400)}`);
  console.log('TEST 224: PASS');
}

async function test225CancelAfterAdapterSubmit() {
  const mock = new MockProductionMotionGenerationAdapter('mock-gx10');
  const store = new AdapterExecutionStateStore();
  const handlers = createAdapterPipelineHandlers(mock, store);
  const executor = new ProductionPipelineExecutor({ handlers });
  seed(executor, 'job-225');
  await executor.executeStage('job-225', 'UPLOAD_VIDEO');
  assert(mock.callOrder.includes('submitJob'), 'TEST 225 submit called');
  const cancelled = executor.cancelJob('job-225');
  assert(cancelled.ok, 'TEST 225 cancel');
  const resume = await executor.resumeJob('job-225');
  assert(!resume.ok, 'TEST 225 resume after cancel blocked');
  console.log('TEST 225: PASS');
}

async function main() {
  await test209AdapterInterfaceMockExecuteToReady();
  await test210SubmitPollDownloadPersistRegisterOrder();
  await test211Gx10AdapterUsesBackendPort();
  await test212DeepMotionAdapterNotInvokedByGx10Executor();
  await test213SubmitFailureFailClosed();
  await test214PollTimeoutFailClosed();
  await test215PersistFailureBlocksAuthority();
  await test216AuthorityFailureBlocksReady();
  test217RuntimeRegisterBeforeReadyBlocked();
  await test218PollProcessingThenComplete();
  await test219ExecutorAdapterDependencyInjection();
  test220GenerationLayerNoDirectGx10RestImport();
  test221RuntimeFilesUnmodified();
  await test222Phase19ExecutorRegression();
  await test223AuthorityRegression();
  await test224BenchmarkRegression();
  await test225CancelAfterAdapterSubmit();
  console.log('productionMotionGenerationAdapter tests: ALL PASS (TEST 209~225)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
