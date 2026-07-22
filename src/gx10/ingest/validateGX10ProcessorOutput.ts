// @ts-nocheck
/**
 * GX10 Processor Output Validator (PHASE 14).
 *
 * Validates job envelope + per-member records before mapping to ProductionMotionAssetV2.
 */
import type { AssetProvenance } from '../../modes/group/types/AssetProvenance';
import type { SkeletonProfile } from '../../modes/group/types/ProductionSkeletonContract';
import type { GX10ProductionMotionOutput } from '../contracts/GX10ProductionMotionOutput';
import type {
  GX10ProductionMotionJobOutputContract,
  GX10ProductionMotionMemberOutputRecord,
} from '../contracts/GX10ProductionMotionOutputContract';
import { GX10_OUTPUT_CONTRACT_VERSION } from '../contracts/GX10ProductionMotionOutputContract';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../../modes/group/types/ProductionMotionAssetV2';
import { memberRecordMatchesChecksum } from './computeGX10MemberOutputChecksum';

const SUPPORTED_SKELETON_PROFILES: SkeletonProfile[] = [
  'K_ONNODE_AVATAR_V1',
  'MIXAMO',
  'RPM',
];

function assertDistinct(values: string[], errorCode: string, label: string): void {
  const dup = values.find((value, index) => values.indexOf(value) !== index);
  if (dup) {
    throw new ProductionMotionAssetError(errorCode, `duplicate ${label}: ${dup}`);
  }
}

function requireNonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.GX10_PROCESSOR_OUTPUT_INVALID,
      `${label} required`,
    );
  }
  return value.trim();
}

function requirePositiveNumber(value: unknown, label: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.GX10_PROCESSOR_OUTPUT_INVALID,
      `${label} must be > 0`,
    );
  }
  return num;
}

function assertSkeletonProfile(profile: unknown, label: string): SkeletonProfile {
  const value = requireNonEmpty(profile, label) as SkeletonProfile;
  if (value === 'UNKNOWN' || !SUPPORTED_SKELETON_PROFILES.includes(value)) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_SKELETON_PROFILE_UNSUPPORTED,
      `${label} unsupported: ${value}`,
    );
  }
  return value;
}

function assertAnimationClipName(name: unknown, memberId: string, required: boolean): string {
  if (typeof name !== 'string' || !name.trim()) {
    if (required) {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.MOTION_CLIP_NOT_FOUND,
        `member ${memberId}: animationClipName required`,
      );
    }
    return '';
  }
  return name.trim();
}

function validateMemberRecord(
  member: GX10ProductionMotionMemberOutputRecord,
  assetProvenance: AssetProvenance,
): void {
  const memberId = requireNonEmpty(member.memberId, 'memberId');
  requireNonEmpty(member.memberName, `member ${memberId}.memberName`);
  requireNonEmpty(member.avatarAssetId, `member ${memberId}.avatarAssetId`);
  requireNonEmpty(member.avatarGlbUrl, `member ${memberId}.avatarGlbUrl`);
  requireNonEmpty(member.motionAssetId, `member ${memberId}.motionAssetId`);
  requireNonEmpty(member.motionUrl, `member ${memberId}.motionUrl`);
  requirePositiveNumber(member.duration, `member ${memberId}.duration`);
  requireNonEmpty(member.sourceSkeletonVersion, `member ${memberId}.sourceSkeletonVersion`);

  assertSkeletonProfile(member.sourceSkeletonProfile, `member ${memberId}.sourceSkeletonProfile`);

  const clipRequired = assetProvenance === 'real_production';
  assertAnimationClipName(member.animationClipName, memberId, clipRequired);

  if (assetProvenance === 'real_production') {
    assertSkeletonProfile(member.avatarSkeletonProfile, `member ${memberId}.avatarSkeletonProfile`);
    requireNonEmpty(member.avatarSkeletonVersion, `member ${memberId}.avatarSkeletonVersion`);
  }

  if (!member.checksum?.trim()) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.GX10_OUTPUT_CHECKSUM_MISMATCH,
      `member ${memberId}: checksum required`,
    );
  }

  if (!memberRecordMatchesChecksum(member)) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.GX10_OUTPUT_CHECKSUM_MISMATCH,
      `member ${memberId}: checksum mismatch`,
    );
  }
}

export function validateGX10JobOutputContract(
  jobOutput: GX10ProductionMotionJobOutputContract,
  assetProvenance: AssetProvenance,
): void {
  if (!jobOutput || typeof jobOutput !== 'object') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.GX10_PROCESSOR_OUTPUT_INVALID,
      'job output required',
    );
  }

  if (jobOutput.contractVersion !== GX10_OUTPUT_CONTRACT_VERSION) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.GX10_PROCESSOR_OUTPUT_INVALID,
      `contractVersion must be ${GX10_OUTPUT_CONTRACT_VERSION}`,
    );
  }

  if (jobOutput.status !== 'completed') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_NOT_READY,
      `job ${jobOutput.jobId} status=${jobOutput.status}`,
    );
  }

  requireNonEmpty(jobOutput.jobId, 'jobId');
  requireNonEmpty(jobOutput.productionAssetId, 'productionAssetId');
  requireNonEmpty(jobOutput.groupId, 'groupId');
  requireNonEmpty(jobOutput.songId, 'songId');
  requireNonEmpty(jobOutput.provider, 'provider');
  requireNonEmpty(jobOutput.processorVersion, 'processorVersion');
  requireNonEmpty(jobOutput.generatedAt, 'generatedAt');
  requirePositiveNumber(jobOutput.fps, 'fps');

  if (!Array.isArray(jobOutput.members) || !jobOutput.members.length) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.GX10_PROCESSOR_OUTPUT_INVALID,
      'members required',
    );
  }

  if (assetProvenance === 'real_production' && !jobOutput.markAsRealProduction) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'real_production requires markAsRealProduction=true',
    );
  }

  if (assetProvenance !== 'real_production' && jobOutput.markAsRealProduction) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'markAsRealProduction cannot be used with non-real ingest provenance',
    );
  }

  const memberIds = jobOutput.members.map((m) => requireNonEmpty(m.memberId, 'memberId'));
  const avatarIds = jobOutput.members.map((m) => requireNonEmpty(m.avatarAssetId, 'avatarAssetId'));
  const motionIds = jobOutput.members.map((m) => requireNonEmpty(m.motionAssetId, 'motionAssetId'));
  const motionUrls = jobOutput.members.map((m) => requireNonEmpty(m.motionUrl, 'motionUrl'));
  const clipNames = jobOutput.members.map((m) => m.animationClipName?.trim() || '');

  assertDistinct(memberIds, PRODUCTION_MOTION_ERRORS.DUPLICATE_MEMBER_ID, 'memberId');
  assertDistinct(avatarIds, PRODUCTION_MOTION_ERRORS.DUPLICATE_AVATAR_ASSET_ID, 'avatarAssetId');
  assertDistinct(motionIds, PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_ASSET_ID, 'motionAssetId');
  assertDistinct(motionUrls, PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_URL, 'motionUrl');

  const nonEmptyClips = clipNames.filter(Boolean);
  assertDistinct(nonEmptyClips, PRODUCTION_MOTION_ERRORS.AMBIGUOUS_MOTION_CLIP, 'animationClipName');

  for (const member of jobOutput.members) {
    validateMemberRecord(member, assetProvenance);
  }
}

export function validateGX10ProductionMotionOutput(
  output: GX10ProductionMotionOutput,
  assetProvenance: AssetProvenance,
): void {
  if (!output.groupId || !output.songId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.GX10_PROCESSOR_OUTPUT_INVALID,
      'groupId/songId required on processor output',
    );
  }
  if (!Number.isFinite(output.durationSec) || output.durationSec <= 0) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.MOTION_DURATION_INVALID,
      'processor output durationSec must be > 0',
    );
  }
  if (!output.members?.length) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.GX10_PROCESSOR_OUTPUT_INVALID,
      'processor output members required',
    );
  }
  assertSkeletonProfile(output.sourceSkeletonProfile, 'sourceSkeletonProfile');
  requireNonEmpty(output.sourceSkeletonVersion, 'sourceSkeletonVersion');

  const memberIds = output.members.map((m) => m.memberId.trim());
  const avatarIds = output.members.map((m) => m.avatarAssetId.trim());
  const motionIds = output.members.map((m) => m.motion.motionAssetId.trim());
  const motionUrls = output.members.map((m) => m.motion.motionUrl.trim());

  assertDistinct(memberIds, PRODUCTION_MOTION_ERRORS.DUPLICATE_MEMBER_ID, 'memberId');
  assertDistinct(avatarIds, PRODUCTION_MOTION_ERRORS.DUPLICATE_AVATAR_ASSET_ID, 'avatarAssetId');
  assertDistinct(motionIds, PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_ASSET_ID, 'motionAssetId');
  assertDistinct(motionUrls, PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_URL, 'motionUrl');

  for (const member of output.members) {
    const memberId = requireNonEmpty(member.memberId, 'memberId');
    requireNonEmpty(member.avatarAssetId, `member ${memberId}.avatarAssetId`);
    requireNonEmpty(member.avatarGlbUrl, `member ${memberId}.avatarGlbUrl`);
    requireNonEmpty(member.motion.motionAssetId, `member ${memberId}.motionAssetId`);
    requireNonEmpty(member.motion.motionUrl, `member ${memberId}.motionUrl`);
    if (member.motion.motionFormat !== 'gltf_animation') {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.MOTION_FORMAT_UNSUPPORTED,
        `member ${memberId}: format=${member.motion.motionFormat}`,
      );
    }
    requirePositiveNumber(member.motion.durationSec, `member ${memberId}.motion.durationSec`);
    assertSkeletonProfile(member.motion.sourceSkeletonProfile, `member ${memberId}.sourceSkeletonProfile`);
    requireNonEmpty(member.motion.sourceSkeletonVersion, `member ${memberId}.sourceSkeletonVersion`);
    assertAnimationClipName(
      member.motion.animationClipName,
      memberId,
      assetProvenance === 'real_production',
    );

    if (assetProvenance === 'real_production') {
      assertSkeletonProfile(member.avatarSkeletonProfile, `member ${memberId}.avatarSkeletonProfile`);
      requireNonEmpty(member.avatarSkeletonVersion, `member ${memberId}.avatarSkeletonVersion`);
    }
  }
}

export default validateGX10JobOutputContract;
