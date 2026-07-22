// @ts-nocheck
/**
 * PHASE 14 — GX10 Production Output Contract tests (TEST 128~139)
 * Run: npx tsx src/modes/group/runtime/gx10ProductionOutputContract.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { validateProductionMotionAssetV2 } from '../services/ProductionMotionAssetLoader';
import { DefaultProductionMotionAssetIngestor } from '../../../gx10/ingest/DefaultProductionMotionAssetIngestor';
import {
  GX10_OUTPUT_CONTRACT_VERSION,
  type GX10ProductionMotionJobOutputContract,
  type GX10ProductionMotionMemberOutputRecord,
} from '../../../gx10/contracts/GX10ProductionMotionOutputContract';
import { computeGX10MemberOutputChecksumSync } from '../../../gx10/ingest/computeGX10MemberOutputChecksum';
import { validateGX10JobOutputContract } from '../../../gx10/ingest/validateGX10ProcessorOutput';
import { runGX10ProductionMotionPipeline } from '../../../gx10/ingest/GX10ProductionMotionPipeline';
import { mapGX10JobOutputToProductionMotionAssetV2 } from '../../../gx10/ingest/mapGX10OutputToProductionMotionAssetV2';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildMember(
  overrides: Partial<GX10ProductionMotionMemberOutputRecord> = {},
): GX10ProductionMotionMemberOutputRecord {
  const base = {
    memberId: 'm1',
    memberName: 'M1',
    avatarAssetId: 'av-1',
    avatarGlbUrl: 'https://example.com/avatar.glb',
    avatarSkeletonProfile: 'RPM' as const,
    avatarSkeletonVersion: '1.0',
    motionAssetId: 'motion-1',
    motionUrl: 'https://example.com/motion.glb',
    duration: 30,
    animationClipName: 'Dance',
    sourceSkeletonProfile: 'MIXAMO' as const,
    sourceSkeletonVersion: '1.0',
  };
  const merged = { ...base, ...overrides };
  const checksum = overrides.checksum ?? computeGX10MemberOutputChecksumSync(merged);
  return { ...merged, checksum };
}

function buildJobOutput(
  overrides: Partial<GX10ProductionMotionJobOutputContract> = {},
): GX10ProductionMotionJobOutputContract {
  return {
    contractVersion: GX10_OUTPUT_CONTRACT_VERSION,
    jobId: 'job-gx14-1',
    status: 'completed',
    productionAssetId: 'prod-gx14-001',
    groupId: 'gx14-group',
    songId: 'gx14-song',
    fps: 30,
    provider: 'gx10',
    processorVersion: '1.0.0',
    generatedAt: '2026-07-21T00:00:00.000Z',
    markAsRealProduction: true,
    members: [buildMember()],
    ...overrides,
  };
}

function expectError(fn: () => void, code: string, label: string) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError && err.code === code,
      `${label} expected ${code}, got ${err?.code ?? err}`,
    );
  }
  assert(threw, `${label} must throw`);
}

function test128PipelineProducesV2() {
  const result = runGX10ProductionMotionPipeline({
    jobOutput: buildJobOutput(),
    assetProvenance: 'real_production',
  });
  assert(result.asset.schemaVersion === 2, 'TEST 128 schema');
  assert(result.asset.assetProvenance === 'real_production', 'TEST 128 provenance');
  assert(result.asset.productionAssetId === 'prod-gx14-001', 'TEST 128 id');
  assert(result.asset.productionAuthorityProof?.ingestJobId === 'job-gx14-1', 'TEST 128 authority');
  assert(result.asset.members[0].motion.animationClipName === 'Dance', 'TEST 128 clip');
  validateProductionMotionAssetV2(result.asset);
  console.log('TEST 128: PASS');
}

function test129MissingJobIdBlocked() {
  const job = buildJobOutput({ jobId: '' });
  expectError(
    () => validateGX10JobOutputContract(job, 'real_production'),
    PRODUCTION_MOTION_ERRORS.GX10_PROCESSOR_OUTPUT_INVALID,
    'TEST 129',
  );
  console.log('TEST 129: PASS');
}

function test130DuplicateMemberIdBlocked() {
  const job = buildJobOutput({
    members: [
      buildMember({ memberId: 'm1', motionAssetId: 'motion-1' }),
      buildMember({
        memberId: 'm1',
        motionAssetId: 'motion-2',
        motionUrl: 'https://example.com/motion-2.glb',
      }),
    ],
  });
  expectError(
    () => validateGX10JobOutputContract(job, 'real_production'),
    PRODUCTION_MOTION_ERRORS.DUPLICATE_MEMBER_ID,
    'TEST 130',
  );
  console.log('TEST 130: PASS');
}

function test131DuplicateMotionAssetIdBlocked() {
  const job = buildJobOutput({
    members: [
      buildMember({ memberId: 'm1', motionAssetId: 'motion-dup' }),
      buildMember({
        memberId: 'm2',
        memberName: 'M2',
        avatarAssetId: 'av-2',
        motionAssetId: 'motion-dup',
        motionUrl: 'https://example.com/motion-2.glb',
      }),
    ],
  });
  expectError(
    () => validateGX10JobOutputContract(job, 'real_production'),
    PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_ASSET_ID,
    'TEST 131',
  );
  console.log('TEST 131: PASS');
}

function test132UnsupportedSkeletonBlocked() {
  const job = buildJobOutput({
    members: [buildMember({ sourceSkeletonProfile: 'UNKNOWN' as never })],
  });
  expectError(
    () => validateGX10JobOutputContract(job, 'real_production'),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_SKELETON_PROFILE_UNSUPPORTED,
    'TEST 132',
  );
  console.log('TEST 132: PASS');
}

function test133MissingAnimationClipBlocked() {
  const job = buildJobOutput({
    members: [buildMember({ animationClipName: '' })],
  });
  expectError(
    () => validateGX10JobOutputContract(job, 'real_production'),
    PRODUCTION_MOTION_ERRORS.MOTION_CLIP_NOT_FOUND,
    'TEST 133',
  );
  console.log('TEST 133: PASS');
}

function test134InvalidDurationBlocked() {
  const job = buildJobOutput({
    members: [buildMember({ duration: 0 })],
  });
  expectError(
    () => validateGX10JobOutputContract(job, 'real_production'),
    PRODUCTION_MOTION_ERRORS.GX10_PROCESSOR_OUTPUT_INVALID,
    'TEST 134',
  );
  console.log('TEST 134: PASS');
}

function test135ChecksumMismatchBlocked() {
  const job = buildJobOutput({
    members: [buildMember({ checksum: 'deadbeef'.repeat(8) })],
  });
  expectError(
    () => validateGX10JobOutputContract(job, 'real_production'),
    PRODUCTION_MOTION_ERRORS.GX10_OUTPUT_CHECKSUM_MISMATCH,
    'TEST 135',
  );
  console.log('TEST 135: PASS');
}

function test136ValidChecksumAccepted() {
  const member = buildMember();
  assert(memberRecordValid(member), 'TEST 136 checksum valid');
  const job = buildJobOutput({ members: [member] });
  validateGX10JobOutputContract(job, 'real_production');
  console.log('TEST 136: PASS');
}

function memberRecordValid(member: GX10ProductionMotionMemberOutputRecord): boolean {
  return member.checksum === computeGX10MemberOutputChecksumSync(member);
}

function test137IngestorGX10JobOutputPath() {
  const ingestor = new DefaultProductionMotionAssetIngestor();
  const result = ingestor.ingestGX10JobOutput({
    jobOutput: buildJobOutput(),
    assetProvenance: 'real_production',
  });
  assert(result.productionAssetId === 'prod-gx14-001', 'TEST 137 id');
  assert(result.asset.trustedProvenance?.source === 'production_ingest', 'TEST 137 seal');
  console.log('TEST 137: PASS');
}

function test138MapperDirectV2() {
  const asset = mapGX10JobOutputToProductionMotionAssetV2(
    buildJobOutput(),
    'real_production',
  );
  assert(asset.members[0].motion.durationSec === 30, 'TEST 138 duration mapped');
  assert(asset.durationSec === 30, 'TEST 138 asset duration');
  console.log('TEST 138: PASS');
}

const GROUP_RUNTIME_PATHS = [
  'src/modes/group',
  'src/components/group/GroupStudioSession.tsx',
  'src/components/group/three',
  'src/hooks/useGroupStudio.ts',
  'src/hooks/useGroupDanceEngine.ts',
];

function collectSourceFiles(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      collectSourceFiles(full, acc);
    } else if (/\.(tsx?|jsx?|md)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function countGroupRuntimeImport(pattern: string): number {
  const root = resolve(process.cwd());
  let count = 0;
  for (const rel of GROUP_RUNTIME_PATHS) {
    const abs = join(root, rel);
    let files: string[] = [];
    try {
      const st = statSync(abs);
      files = st.isDirectory() ? collectSourceFiles(abs) : [abs];
    } catch {
      continue;
    }
    for (const file of files) {
      if (/\.test\.(tsx?|jsx?)$/.test(file)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*')) continue;
        if (!t.includes('import ') && !t.includes('from ')) continue;
        if (line.includes(pattern)) count += 1;
      }
    }
  }
  return count;
}

function stripComments(content: string): string {
  return content
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/**');
    })
    .join('\n');
}

function test139Gx14Regression() {
  const gx10Dir = resolve('src/gx10');
  for (const file of collectSourceFiles(gx10Dir)) {
    if (!/\.(tsx?|jsx?)$/.test(file)) continue;
    const content = stripComments(readFileSync(file, 'utf8'));
    for (const token of ['SkeletonFrameData', 'skeletonFrames', '@mediapipe']) {
      assert(!content.includes(token), `TEST 139 gx10 ${file} ${token}`);
    }
  }
  assert(countGroupRuntimeImport('GX10ProductionMotionPipeline') === 0, 'TEST 139 pipeline not in runtime');
  assert(countGroupRuntimeImport('runGX10ProductionMotionPipeline') === 0, 'TEST 139 pipeline fn not in runtime');
  console.log('TEST 139: PASS');
}

function run() {
  test128PipelineProducesV2();
  test129MissingJobIdBlocked();
  test130DuplicateMemberIdBlocked();
  test131DuplicateMotionAssetIdBlocked();
  test132UnsupportedSkeletonBlocked();
  test133MissingAnimationClipBlocked();
  test134InvalidDurationBlocked();
  test135ChecksumMismatchBlocked();
  test136ValidChecksumAccepted();
  test137IngestorGX10JobOutputPath();
  test138MapperDirectV2();
  test139Gx14Regression();
  console.log('gx10ProductionOutputContract tests: ALL PASS (TEST 128~139)');
}

run();
