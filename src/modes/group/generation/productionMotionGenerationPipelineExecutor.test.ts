// @ts-nocheck
/**
 * PHASE 19 — Production Motion Generation Execution Engine tests (TEST 191~210)
 * Run: npx tsx src/modes/group/generation/productionMotionGenerationPipelineExecutor.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  ProductionPipelineExecutor,
  ProductionMotionGenerationCheckpointStore,
  ProductionMotionGenerationExecutionLock,
  EXECUTION_ERROR_CODES,
  computeRetryDelayMs,
  isRecoverableError,
  DEFAULT_RETRY_POLICY,
} from './index';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function createExecutor(overrides = {}) {
  return new ProductionPipelineExecutor({
    retryPolicy: { ...DEFAULT_RETRY_POLICY, baseDelayMs: 1, maxDelayMs: 10 },
    stageTimeoutMs: 30_000,
    ...overrides,
  });
}

function seedJob(executor: ProductionPipelineExecutor, jobId: string) {
  executor.createJob({
    jobId,
    videoId: `vid-${jobId}`,
    groupId: 'grp-exec',
    songId: 'song-exec',
    memberId: 'm-exec',
    inputVideoUrl: 'https://example.com/video.mp4',
  });
}

async function test191ExecuteJobToReady() {
  const executor = createExecutor();
  seedJob(executor, 'job-191');
  const result = await executor.executeJob('job-191');
  assert(result.ok, 'TEST 191 execute');
  assert(result.job?.currentState === 'READY', 'TEST 191 READY');
  console.log('TEST 191: PASS');
}

async function test192CheckpointSavedPerStage() {
  const store = new ProductionMotionGenerationCheckpointStore();
  const executor = createExecutor({ checkpointStore: store });
  seedJob(executor, 'job-192');
  await executor.executeJob('job-192');
  const checkpoints = store.list('job-192');
  assert(checkpoints.length === 14, `TEST 192 checkpoint count=${checkpoints.length}`);
  const latest = store.getLatest('job-192')!;
  assert(latest.currentStage === 'READY', 'TEST 192 latest stage');
  assert(latest.completedStages.length === 14, 'TEST 192 completed');
  assert(latest.timestamp, 'TEST 192 timestamp');
  console.log('TEST 192: PASS');
}

async function test193ExecutionLockBlocksDuplicate() {
  const lock = new ProductionMotionGenerationExecutionLock();
  let releaseBlock: (() => void) | null = null;
  const blockPromise = new Promise<void>((resolve) => {
    releaseBlock = resolve;
  });

  const executor = createExecutor({
    executionLock: lock,
    handlers: {
      SKELETON_EXTRACTION: async () => {
        await blockPromise;
        return { ok: true };
      },
    },
  });
  seedJob(executor, 'job-193');

  const first = executor.executeJob('job-193');
  await new Promise((r) => setTimeout(r, 20));
  const second = await executor.executeJob('job-193');
  assert(!second.ok, 'TEST 193 duplicate blocked');
  assert(second.errorCode === EXECUTION_ERROR_CODES.DUPLICATE_EXECUTE
    || second.errorCode === EXECUTION_ERROR_CODES.JOB_ALREADY_RUNNING, 'TEST 193 code');

  releaseBlock!();
  await first;
  console.log('TEST 193: PASS');
}

async function test194ResumeFromCheckpoint() {
  const store = new ProductionMotionGenerationCheckpointStore();
  const executor = createExecutor({ checkpointStore: store });
  seedJob(executor, 'job-194');

  await executor.executeStage('job-194', 'UPLOAD_VIDEO');
  await executor.executeStage('job-194', 'SKELETON_EXTRACTION');
  assert(store.getLatest('job-194')?.currentStage === 'SKELETON_EXTRACTION', 'TEST 194 partial');

  const resumed = await executor.resumeJob('job-194');
  assert(resumed.ok, 'TEST 194 resume');
  assert(resumed.job?.currentState === 'READY', 'TEST 194 READY');
  console.log('TEST 194: PASS');
}

async function test195ResumeWithoutCheckpointForbidden() {
  const executor = createExecutor();
  seedJob(executor, 'job-195');
  const r = await executor.resumeJob('job-195');
  assert(!r.ok, 'TEST 195 blocked');
  assert(r.errorCode === EXECUTION_ERROR_CODES.RESUME_WITHOUT_CHECKPOINT, 'TEST 195 code');
  console.log('TEST 195: PASS');
}

async function test196RetryWithBackoff() {
  let attempts = 0;
  const events: string[] = [];
  const executor = createExecutor({
    retryPolicy: { maxAttempts: 3, baseDelayMs: 5, maxDelayMs: 20, multiplier: 2 },
    handlers: {
      STORAGE_UPLOAD: () => {
        attempts += 1;
        if (attempts === 1) {
          return { ok: false, errorCode: 'GENERATION_STORAGE_UPLOAD_FAILED' };
        }
        return { ok: true };
      },
    },
  });
  executor.onEvent((e) => events.push(e.type));
  seedJob(executor, 'job-196');

  const result = await executor.executeJob('job-196');
  assert(!result.ok, 'TEST 196 first run fails at storage');
  assert(result.job?.currentState === 'FAILED', 'TEST 196 FAILED');

  const retried = await executor.retryJob('job-196');
  assert(retried.ok, 'TEST 196 retry success');
  assert(retried.job?.currentState === 'READY', 'TEST 196 READY');
  assert(events.includes('RetryScheduled'), 'TEST 196 retry event');
  console.log('TEST 196: PASS');
}

async function test197RetryLimitExceeded() {
  const executor = createExecutor({
    retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 5, multiplier: 2 },
    handlers: {
      UPLOAD_VIDEO: () => ({ ok: false, errorCode: 'GENERATION_STORAGE_UPLOAD_FAILED' }),
    },
  });
  seedJob(executor, 'job-197');
  await executor.executeJob('job-197');
  const job = executor.getJob('job-197')!;
  job.retryCount = 1;
  executor.pipeline.restoreJobContext(job);

  const r = await executor.retryJob('job-197');
  assert(!r.ok, 'TEST 197 limit');
  assert(r.errorCode === EXECUTION_ERROR_CODES.RETRY_LIMIT_EXCEEDED, 'TEST 197 code');
  console.log('TEST 197: PASS');
}

async function test198CancelJob() {
  const events: string[] = [];
  const executor = createExecutor();
  executor.onEvent((e) => events.push(e.type));
  seedJob(executor, 'job-198');
  await executor.executeStage('job-198', 'UPLOAD_VIDEO');
  const cancelled = executor.cancelJob('job-198');
  assert(cancelled.ok, 'TEST 198 cancel');
  assert(cancelled.job?.currentState === 'CANCELLED', 'TEST 198 CANCELLED');
  assert(events.includes('Cancelled'), 'TEST 198 event');
  const resume = await executor.resumeJob('job-198');
  assert(!resume.ok, 'TEST 198 resume blocked');
  console.log('TEST 198: PASS');
}

async function test199ReadyJobExecuteForbidden() {
  const executor = createExecutor();
  seedJob(executor, 'job-199');
  await executor.executeJob('job-199');
  const again = await executor.executeJob('job-199');
  assert(!again.ok, 'TEST 199 blocked');
  assert(again.errorCode === EXECUTION_ERROR_CODES.READY_EXECUTE_FORBIDDEN, 'TEST 199 code');
  console.log('TEST 199: PASS');
}

async function test200CrashRecoveryViaStaticRecover() {
  const store = new ProductionMotionGenerationCheckpointStore();
  const executor1 = createExecutor({ checkpointStore: store });
  seedJob(executor1, 'job-200');

  for (const stage of ['UPLOAD_VIDEO', 'SKELETON_EXTRACTION', 'SKELETON_NORMALIZE'] as const) {
    await executor1.executeStage('job-200', stage);
  }

  const recovered = ProductionPipelineExecutor.recoverFromCheckpoint({
    checkpointStore: store,
    jobId: 'job-200',
    executorOptions: { retryPolicy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5, multiplier: 2 } },
  });
  assert(recovered != null, 'TEST 200 recovered executor');
  const result = await recovered!.resumeJob('job-200');
  assert(result.ok, 'TEST 200 resume after crash');
  assert(result.job?.currentState === 'READY', 'TEST 200 READY');
  console.log('TEST 200: PASS');
}

async function test201ExecutionEventsEmitted() {
  const types: string[] = [];
  const executor = createExecutor();
  executor.onEvent((e) => types.push(e.type));
  seedJob(executor, 'job-201');
  await executor.executeJob('job-201');
  assert(types.includes('PipelineStarted'), 'TEST 201 started');
  assert(types.includes('StageStarted'), 'TEST 201 stage started');
  assert(types.includes('StageCompleted'), 'TEST 201 stage completed');
  assert(types.includes('Completed'), 'TEST 201 completed');
  console.log('TEST 201: PASS');
}

function test202ExponentialBackoffMath() {
  const d1 = computeRetryDelayMs(1, { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1000, multiplier: 2 });
  const d2 = computeRetryDelayMs(2, { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1000, multiplier: 2 });
  const d3 = computeRetryDelayMs(3, { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1000, multiplier: 2 });
  assert(d1 === 100, 'TEST 202 d1');
  assert(d2 === 200, 'TEST 202 d2');
  assert(d3 === 400, 'TEST 202 d3');
  assert(!isRecoverableError(EXECUTION_ERROR_CODES.FATAL_STAGE_ERROR), 'TEST 202 fatal');
  assert(isRecoverableError('GENERATION_STORAGE_UPLOAD_FAILED'), 'TEST 202 recoverable');
  console.log('TEST 202: PASS');
}

async function test203ParallelDifferentJobs() {
  const executor = createExecutor();
  seedJob(executor, 'job-203a');
  seedJob(executor, 'job-203b');
  const [a, b] = await Promise.all([
    executor.executeJob('job-203a'),
    executor.executeJob('job-203b'),
  ]);
  assert(a.ok && b.ok, 'TEST 203 parallel');
  console.log('TEST 203: PASS');
}

async function test204FailedResumeRequiresRetry() {
  const store = new ProductionMotionGenerationCheckpointStore();
  const executor = createExecutor({
    checkpointStore: store,
    handlers: {
      MOTION_GLB_EXPORT: () => ({ ok: false, errorCode: 'GENERATION_EXPORT_FAILED' }),
    },
  });
  seedJob(executor, 'job-204');
  await executor.executeJob('job-204');
  assert(executor.getJob('job-204')?.currentState === 'FAILED', 'TEST 204 failed');
  const resume = await executor.resumeJob('job-204');
  assert(!resume.ok, 'TEST 204 resume blocked');
  assert(resume.errorCode === EXECUTION_ERROR_CODES.FAILED_RESUME_REQUIRES_RETRY, 'TEST 204 code');
  console.log('TEST 204: PASS');
}

async function test205RunUntilReadyIdempotentPartial() {
  const executor = createExecutor();
  seedJob(executor, 'job-205');
  await executor.executeStage('job-205', 'UPLOAD_VIDEO');
  const result = await executor.runUntilReady('job-205');
  assert(result.ok, 'TEST 205 runUntilReady');
  assert(result.job?.currentState === 'READY', 'TEST 205 READY');
  console.log('TEST 205: PASS');
}

const FORBIDDEN_RUNTIME_PATHS = [
  'src/components/group/three/AvatarCharacterAnimated3D.tsx',
  'src/components/group/three/GroupDanceStage3D.tsx',
  'src/modes/group/services/ProductionMotionAssetLoader.ts',
  'src/modes/group/runtime/runProductionMotionRetargetGate.ts',
  'src/gx10/ingest/verifyProductionAuthority.ts',
  'src/modes/group/benchmark/groupMotionBrowserBenchmarkHarness.ts',
  'src/modes/group/runtime/DefaultAvatarMotionRetargeter.ts',
];

function test206RuntimeFilesUnchanged() {
  const root = resolve(process.cwd());
  for (const rel of FORBIDDEN_RUNTIME_PATHS) {
    const content = readFileSync(join(root, rel), 'utf8');
    assert(!content.includes('ProductionPipelineExecutor'), `TEST 206 ${rel}`);
    assert(!content.includes('productionMotionGenerationPipelineExecutor'), `TEST 206 ${rel}`);
  }
  console.log('TEST 206: PASS');
}

async function test207Phase18Regression() {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('npx', ['tsx', 'src/modes/group/generation/productionMotionGenerationPipeline.test.ts'], {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
  });
  assert(r.status === 0, `TEST 207 phase18 regression: ${r.stderr || r.stdout}`);
  console.log('TEST 207: PASS');
}

async function test208BrowserBenchmarkRegression() {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('npx', ['tsx', 'src/modes/group/runtime/productionMotionBrowserBenchmark.test.ts'], {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
  });
  assert(r.status === 0, `TEST 208 benchmark regression: ${r.stderr?.slice(-500) || r.stdout?.slice(-500)}`);
  console.log('TEST 208: PASS (browser benchmark regression)');
}

async function main() {
  await test191ExecuteJobToReady();
  await test192CheckpointSavedPerStage();
  await test193ExecutionLockBlocksDuplicate();
  await test194ResumeFromCheckpoint();
  await test195ResumeWithoutCheckpointForbidden();
  await test196RetryWithBackoff();
  await test197RetryLimitExceeded();
  await test198CancelJob();
  await test199ReadyJobExecuteForbidden();
  await test200CrashRecoveryViaStaticRecover();
  await test201ExecutionEventsEmitted();
  test202ExponentialBackoffMath();
  await test203ParallelDifferentJobs();
  await test204FailedResumeRequiresRetry();
  await test205RunUntilReadyIdempotentPartial();
  test206RuntimeFilesUnchanged();
  await test207Phase18Regression();
  await test208BrowserBenchmarkRegression();
  console.log('productionMotionGenerationPipelineExecutor tests: ALL PASS (TEST 191~208)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
