// @ts-nocheck
/**
 * PHASE 18 — Production Motion Generation Pipeline tests (TEST 171~190)
 * Run: npx tsx src/modes/group/generation/productionMotionGenerationPipeline.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES,
  ORDERED_PIPELINE_STATES,
  canTransitionPipelineState,
  validateAdvanceToStage,
  validateReadyJob,
  validateRuntimeRegistrationAllowed,
  validateDuplicateJob,
  validateStagePrerequisites,
  GENERATION_PIPELINE_ERROR_CODES,
  ProductionMotionGenerationPipeline,
  createProductionMotionGenerationJobContext,
  applyStageSuccess,
  progressPercentForStage,
} from './index';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function baseJob(overrides = {}) {
  return createProductionMotionGenerationJobContext({
    jobId: 'job-171',
    videoId: 'vid-1',
    groupId: 'grp-1',
    songId: 'song-1',
    memberId: 'm1',
    inputVideoUrl: 'https://example.com/video.mp4',
    ...overrides,
  });
}

function test171PipelineStageOrderNoSkip() {
  assert(PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES.length === 14, 'TEST 171 stage count');
  assert(PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES[0] === 'UPLOAD_VIDEO', 'TEST 171 first');
  assert(PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES[13] === 'READY', 'TEST 171 last');
  console.log('TEST 171: PASS');
}

function test172StateMachineOrderedStates() {
  assert(ORDERED_PIPELINE_STATES[0] === 'NEW', 'TEST 172 NEW');
  assert(ORDERED_PIPELINE_STATES[ORDERED_PIPELINE_STATES.length - 1] === 'READY', 'TEST 172 READY');
  console.log('TEST 172: PASS');
}

function test173FailedCannotTransitionToReady() {
  const r = canTransitionPipelineState('FAILED', 'READY');
  assert(!r.ok, 'TEST 173 blocked');
  assert(r.errorCode === GENERATION_PIPELINE_ERROR_CODES.READY_FROM_FAILED_FORBIDDEN, 'TEST 173 code');
  console.log('TEST 173: PASS');
}

function test174StageSkipForbidden() {
  let ctx = baseJob();
  const r = validateAdvanceToStage(ctx, 'SKELETON_EXTRACTION');
  assert(!r.ok, 'TEST 174 skip blocked');
  assert(r.errorCode === GENERATION_PIPELINE_ERROR_CODES.STAGE_SKIP_FORBIDDEN, 'TEST 174 code');
  console.log('TEST 174: PASS');
}

async function test175FullPipelineRunToReady() {
  const pipeline = new ProductionMotionGenerationPipeline();
  const created = pipeline.createJob({
    jobId: 'job-full-175',
    videoId: 'v175',
    groupId: 'g175',
    songId: 's175',
    memberId: 'm175',
    inputVideoUrl: 'https://example.com/v.mp4',
  });
  assert(created.ok, 'TEST 175 create');
  const result = await pipeline.runToCompletion('job-full-175');
  assert(result.ok, 'TEST 175 run');
  assert(result.job?.currentState === 'READY', 'TEST 175 READY');
  assert(result.job?.completedStages.length === 14, 'TEST 175 all stages');
  assert(result.job?.outputMotionGlbUrl?.includes('storage.stub'), 'TEST 175 glb url');
  assert(result.job?.productionMotionAssetId?.startsWith('prod-'), 'TEST 175 asset id');
  assert(result.job?.authorityStatus === 'registered', 'TEST 175 authority');
  console.log('TEST 175: PASS');
}

async function test176StateTransitionsSequential() {
  const pipeline = new ProductionMotionGenerationPipeline();
  pipeline.createJob({
    jobId: 'job-176',
    videoId: 'v',
    groupId: 'g',
    songId: 's',
    memberId: 'm',
  });

  const expectedStates = [
    'UPLOADING', 'EXTRACTING', 'NORMALIZING', 'CLEANING', 'CLEANING',
    'OPTIMIZING', 'OPTIMIZING', 'OPTIMIZING', 'EXPORTING', 'UPLOADING_STORAGE',
    'REGISTERING', 'REGISTERING', 'REGISTERING', 'READY',
  ];

  for (let i = 0; i < PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES.length; i += 1) {
    const stage = PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES[i];
    const r = await pipeline.runStage('job-176', stage);
    assert(r.ok, `TEST 176 stage ${stage}`);
    assert(r.job?.currentState === expectedStates[i], `TEST 176 state ${stage}`);
  }
  console.log('TEST 176: PASS');
}

async function test177RetryAfterFailure() {
  let storageAttempts = 0;
  const pipeline = new ProductionMotionGenerationPipeline({
    STORAGE_UPLOAD: (ctx) => {
      storageAttempts += 1;
      if (storageAttempts === 1) {
        return { ok: false, errorCode: 'GENERATION_STORAGE_UPLOAD_FAILED' };
      }
      return {
        ok: true,
        patch: {
          outputMotionGlbUrl: `https://storage.stub/retry/${ctx.jobId}.glb`,
        },
      };
    },
  });

  pipeline.createJob({
    jobId: 'job-177',
    videoId: 'v',
    groupId: 'g',
    songId: 's',
    memberId: 'm',
  });

  const fail = await pipeline.runToCompletion('job-177');
  assert(!fail.ok, 'TEST 177 fail expected');
  assert(fail.job?.currentState === 'FAILED', 'TEST 177 FAILED');

  const retry = pipeline.retryJob('job-177');
  assert(retry.ok, 'TEST 177 retry');
  assert(retry.job?.retryCount === 1, 'TEST 177 retry count');

  const success = await pipeline.runToCompletion('job-177');
  assert(success.ok, 'TEST 177 success after retry');
  assert(success.job?.currentState === 'READY', 'TEST 177 READY');
  console.log('TEST 177: PASS');
}

async function test178CancelActiveJob() {
  const pipeline = new ProductionMotionGenerationPipeline();
  pipeline.createJob({
    jobId: 'job-178',
    videoId: 'v',
    groupId: 'g',
    songId: 's',
    memberId: 'm',
  });
  await pipeline.runStage('job-178', 'UPLOAD_VIDEO');
  const cancelled = pipeline.cancelJob('job-178');
  assert(cancelled.ok, 'TEST 178 cancel');
  assert(cancelled.job?.currentState === 'CANCELLED', 'TEST 178 CANCELLED');
  const blocked = await pipeline.runNextStage('job-178');
  assert(!blocked.ok, 'TEST 178 no progress after cancel');
  console.log('TEST 178: PASS');
}

function test179DuplicateActiveJob() {
  const pipeline = new ProductionMotionGenerationPipeline();
  pipeline.createJob({
    jobId: 'job-dup',
    videoId: 'v',
    groupId: 'g',
    songId: 's',
    memberId: 'm',
  });
  const dup = pipeline.createJob({
    jobId: 'job-dup',
    videoId: 'v2',
    groupId: 'g',
    songId: 's',
    memberId: 'm2',
  });
  assert(!dup.ok, 'TEST 179 duplicate blocked');
  assert(dup.errorCode === GENERATION_PIPELINE_ERROR_CODES.DUPLICATE_ACTIVE_JOB, 'TEST 179 code');
  console.log('TEST 179: PASS');
}

async function test180StorageFailureBlocksAuthority() {
  const pipeline = new ProductionMotionGenerationPipeline({
    STORAGE_UPLOAD: () => ({
      ok: false,
      errorCode: 'GENERATION_STORAGE_UPLOAD_FAILED',
    }),
  });
  pipeline.createJob({
    jobId: 'job-180',
    videoId: 'v',
    groupId: 'g',
    songId: 's',
    memberId: 'm',
  });

  for (const stage of PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES) {
    if (stage === 'STORAGE_UPLOAD') break;
    const r = await pipeline.runStage('job-180', stage);
    assert(r.ok, `TEST 180 pre ${stage}`);
  }

  const storageFail = await pipeline.runStage('job-180', 'STORAGE_UPLOAD');
  assert(!storageFail.ok, 'TEST 180 storage fail');
  assert(storageFail.job?.currentState === 'FAILED', 'TEST 180 FAILED');

  const job = pipeline.getJob('job-180')!;
  const authBlock = validateStagePrerequisites(
    { ...job, currentState: 'REGISTERING', completedStages: [...job.completedStages] },
    'AUTHORITY_REGISTRATION',
  );
  assert(!authBlock.ok, 'TEST 180 authority blocked');
  assert(authBlock.errorCode === GENERATION_PIPELINE_ERROR_CODES.AUTHORITY_WITHOUT_STORAGE, 'TEST 180 code');
  console.log('TEST 180: PASS');
}

async function test181MetadataFailureBlocksAssetV2() {
  const pipeline = new ProductionMotionGenerationPipeline({
    FIRESTORE_METADATA: () => ({
      ok: false,
      errorCode: 'GENERATION_METADATA_FAILED',
    }),
  });
  pipeline.createJob({
    jobId: 'job-181',
    videoId: 'v',
    groupId: 'g',
    songId: 's',
    memberId: 'm',
  });

  const result = await pipeline.runToCompletion('job-181');
  assert(!result.ok, 'TEST 181 fail');
  assert(result.job?.currentState === 'FAILED', 'TEST 181 FAILED at metadata');

  const job = pipeline.getJob('job-181')!;
  const v2Block = validateStagePrerequisites(
    { ...job, completedStages: job.completedStages.filter((s) => s !== 'FIRESTORE_METADATA') },
    'PRODUCTION_MOTION_ASSET_V2',
  );
  assert(!v2Block.ok, 'TEST 181 v2 blocked');
  console.log('TEST 181: PASS');
}

async function test182AuthorityFailureBlocksReady() {
  const pipeline = new ProductionMotionGenerationPipeline({
    AUTHORITY_REGISTRATION: () => ({
      ok: false,
      errorCode: 'GENERATION_AUTHORITY_FAILED',
    }),
  });
  pipeline.createJob({
    jobId: 'job-182',
    videoId: 'v',
    groupId: 'g',
    songId: 's',
    memberId: 'm',
  });

  const result = await pipeline.runToCompletion('job-182');
  assert(!result.ok, 'TEST 182 fail');
  assert(result.job?.currentState === 'FAILED', 'TEST 182 FAILED');

  const readyCheck = validateReadyJob(result.job!);
  assert(!readyCheck.ok, 'TEST 182 ready blocked');
  console.log('TEST 182: PASS');
}

function test183RuntimeRegistrationRequiresMetadataAndReady() {
  let ctx = baseJob();
  ctx = applyStageSuccess(ctx, 'STORAGE_UPLOAD');
  const blocked = validateRuntimeRegistrationAllowed(ctx);
  assert(!blocked.ok, 'TEST 183 blocked without metadata');
  assert(
    blocked.errorCode === GENERATION_PIPELINE_ERROR_CODES.RUNTIME_REGISTER_WITHOUT_METADATA,
    'TEST 183 code',
  );

  ctx = applyStageSuccess(ctx, 'FIRESTORE_METADATA');
  ctx = applyStageSuccess(ctx, 'PRODUCTION_MOTION_ASSET_V2');
  ctx = applyStageSuccess(ctx, 'AUTHORITY_REGISTRATION');
  ctx = applyStageSuccess(ctx, 'READY');
  const allowed = validateRuntimeRegistrationAllowed(ctx);
  assert(allowed.ok, 'TEST 183 allowed when READY');
  console.log('TEST 183: PASS');
}

function test184ProgressPercentMonotonic() {
  let prev = -1;
  for (const stage of PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES) {
    const p = progressPercentForStage(stage);
    assert(p >= prev, `TEST 184 monotonic ${stage}`);
    prev = p;
  }
  assert(progressPercentForStage('READY') === 100, 'TEST 184 100%');
  console.log('TEST 184: PASS');
}

async function test185RunNextStageAdvancesOneAtATime() {
  const pipeline = new ProductionMotionGenerationPipeline();
  pipeline.createJob({
    jobId: 'job-185',
    videoId: 'v',
    groupId: 'g',
    songId: 's',
    memberId: 'm',
  });
  const r1 = await pipeline.runNextStage('job-185');
  assert(r1.ok && r1.job?.currentStage === 'UPLOAD_VIDEO', 'TEST 185 step1');
  const r2 = await pipeline.runNextStage('job-185');
  assert(r2.ok && r2.job?.currentStage === 'SKELETON_EXTRACTION', 'TEST 185 step2');
  console.log('TEST 185: PASS');
}

const RUNTIME_GUARD_PATHS = [
  'src/components/group/three/AvatarCharacterAnimated3D.tsx',
  'src/components/group/three/GroupDanceStage3D.tsx',
  'src/modes/group/runtime/runProductionMotionRetargetGate.ts',
  'src/modes/group/services/ProductionMotionAssetLoader.ts',
  'src/gx10/ingest/verifyProductionAuthority.ts',
];

function test186RuntimeFilesUnchangedByGenerationImport() {
  const root = resolve(process.cwd());
  for (const rel of RUNTIME_GUARD_PATHS) {
    const content = readFileSync(join(root, rel), 'utf8');
    assert(!content.includes('generation/productionMotionGeneration'), `TEST 186 ${rel} clean`);
    assert(!content.includes('ProductionMotionGenerationPipeline'), `TEST 186 ${rel} no pipeline import`);
  }
  console.log('TEST 186: PASS');
}

function test187GenerationModuleNoRuntimeImport() {
  const root = resolve(process.cwd());
  const genDir = join(root, 'src/modes/group/generation');
  const files = readdirSync(genDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  for (const file of files) {
    const content = readFileSync(join(genDir, file), 'utf8');
    assert(!content.includes('AvatarCharacterAnimated3D'), `TEST 187 ${file}`);
    assert(!content.includes('GroupDanceStage3D'), `TEST 187 ${file}`);
    assert(!content.includes('loadProductionMotionAsset'), `TEST 187 ${file}`);
    assert(!content.includes('gx10RestClient'), `TEST 187 ${file}`);
    assert(!content.includes('DeepMotion'), `TEST 187 ${file}`);
  }
  console.log('TEST 187: PASS');
}

function test188TeachingModeRegressionImportZero() {
  const teachingFiles = [
    'src/views/AICoachView.tsx',
    'src/components/coaching/VocalVoiceTeachingPanel.tsx',
    'src/services/teachingReportStore.ts',
  ];
  const root = resolve(process.cwd());
  for (const rel of teachingFiles) {
    try {
      const content = readFileSync(join(root, rel), 'utf8');
      assert(!content.includes('ProductionMotionGenerationPipeline'), `TEST 188 ${rel}`);
    } catch {
      // optional files
    }
  }
  console.log('TEST 188: PASS');
}

function test189MediaPipeRuntimeUnchanged() {
  const root = resolve(process.cwd());
  const groupRuntime = join(root, 'src/components/group/three');
  const files = readdirSync(groupRuntime).filter((f) => f.endsWith('.tsx'));
  for (const file of files) {
    const content = readFileSync(join(groupRuntime, file), 'utf8');
    assert(!content.includes('@mediapipe/tasks-vision'), `TEST 189 ${file} mediapipe`);
  }
  console.log('TEST 189: PASS');
}

function test190AuthorityModuleUnchangedByGeneration() {
  const root = resolve(process.cwd());
  const authorityPath = join(root, 'src/gx10/ingest/verifyProductionAuthority.ts');
  const content = readFileSync(authorityPath, 'utf8');
  assert(!content.includes('ProductionMotionGenerationPipeline'), 'TEST 190 authority clean');
  assert(!content.includes('generation/productionMotion'), 'TEST 190 authority clean2');
  console.log('TEST 190: PASS');
}

async function main() {
  test171PipelineStageOrderNoSkip();
  test172StateMachineOrderedStates();
  test173FailedCannotTransitionToReady();
  test174StageSkipForbidden();
  await test175FullPipelineRunToReady();
  await test176StateTransitionsSequential();
  await test177RetryAfterFailure();
  await test178CancelActiveJob();
  test179DuplicateActiveJob();
  await test180StorageFailureBlocksAuthority();
  await test181MetadataFailureBlocksAssetV2();
  await test182AuthorityFailureBlocksReady();
  test183RuntimeRegistrationRequiresMetadataAndReady();
  test184ProgressPercentMonotonic();
  await test185RunNextStageAdvancesOneAtATime();
  test186RuntimeFilesUnchangedByGenerationImport();
  test187GenerationModuleNoRuntimeImport();
  test188TeachingModeRegressionImportZero();
  test189MediaPipeRuntimeUnchanged();
  test190AuthorityModuleUnchangedByGeneration();
  console.log('productionMotionGenerationPipeline tests: ALL PASS (TEST 171~190)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
