/**
 * GX10 Processor Output Validator — server-side (PHASE 14/15).
 */
const { GX10_OUTPUT_CONTRACT_VERSION } = require('./gx10RestApiContract.cjs');
const { memberRecordMatchesChecksum } = require('./gx10MemberOutputChecksum.cjs');

const SUPPORTED_SKELETON_PROFILES = new Set(['K_ONNODE_AVATAR_V1', 'MIXAMO', 'RPM']);

class GX10ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GX10ValidationError';
    this.code = code;
  }
}

function assertDistinct(values, code, label) {
  const dup = values.find((value, index) => values.indexOf(value) !== index);
  if (dup) throw new GX10ValidationError(code, `duplicate ${label}: ${dup}`);
}

function requireNonEmpty(value, label, code = 'GX10_PROCESSOR_OUTPUT_INVALID') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new GX10ValidationError(code, `${label} required`);
  }
  return value.trim();
}

function requirePositiveNumber(value, label) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new GX10ValidationError('GX10_PROCESSOR_OUTPUT_INVALID', `${label} must be > 0`);
  }
  return num;
}

function assertSkeletonProfile(profile, label) {
  const value = requireNonEmpty(profile, label, 'PRODUCTION_SKELETON_PROFILE_UNSUPPORTED');
  if (value === 'UNKNOWN' || !SUPPORTED_SKELETON_PROFILES.has(value)) {
    throw new GX10ValidationError('PRODUCTION_SKELETON_PROFILE_UNSUPPORTED', `${label} unsupported: ${value}`);
  }
  return value;
}

function validateMemberRecord(member, assetProvenance) {
  const memberId = requireNonEmpty(member.memberId, 'memberId');
  requireNonEmpty(member.memberName, `member ${memberId}.memberName`);
  requireNonEmpty(member.avatarAssetId, `member ${memberId}.avatarAssetId`);
  requireNonEmpty(member.avatarGlbUrl, `member ${memberId}.avatarGlbUrl`);
  requireNonEmpty(member.motionAssetId, `member ${memberId}.motionAssetId`);
  requireNonEmpty(member.motionUrl, `member ${memberId}.motionUrl`);
  requirePositiveNumber(member.duration, `member ${memberId}.duration`);
  requireNonEmpty(member.sourceSkeletonVersion, `member ${memberId}.sourceSkeletonVersion`);
  assertSkeletonProfile(member.sourceSkeletonProfile, `member ${memberId}.sourceSkeletonProfile`);

  if (assetProvenance === 'real_production') {
    requireNonEmpty(member.animationClipName, `member ${memberId}.animationClipName`, 'MOTION_CLIP_NOT_FOUND');
    assertSkeletonProfile(member.avatarSkeletonProfile, `member ${memberId}.avatarSkeletonProfile`);
    requireNonEmpty(member.avatarSkeletonVersion, `member ${memberId}.avatarSkeletonVersion`);
  }

  if (!member.checksum?.trim()) {
    throw new GX10ValidationError('GX10_OUTPUT_CHECKSUM_MISMATCH', `member ${memberId}: checksum required`);
  }
  if (!memberRecordMatchesChecksum(member)) {
    throw new GX10ValidationError('GX10_OUTPUT_CHECKSUM_MISMATCH', `member ${memberId}: checksum mismatch`);
  }
}

function validateGX10JobOutputContract(jobOutput, assetProvenance = 'real_production') {
  if (!jobOutput || typeof jobOutput !== 'object') {
    throw new GX10ValidationError('GX10_PROCESSOR_OUTPUT_INVALID', 'job output required');
  }
  if (jobOutput.contractVersion !== GX10_OUTPUT_CONTRACT_VERSION) {
    throw new GX10ValidationError(
      'GX10_PROCESSOR_OUTPUT_INVALID',
      `contractVersion must be ${GX10_OUTPUT_CONTRACT_VERSION}`,
    );
  }
  if (jobOutput.status !== 'completed') {
    throw new GX10ValidationError('PRODUCTION_ASSET_NOT_READY', `job ${jobOutput.jobId} status=${jobOutput.status}`);
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
    throw new GX10ValidationError('GX10_PROCESSOR_OUTPUT_INVALID', 'members required');
  }

  if (assetProvenance === 'real_production' && !jobOutput.markAsRealProduction) {
    throw new GX10ValidationError('PRODUCTION_ASSET_PROVENANCE_INVALID', 'real_production requires markAsRealProduction=true');
  }

  const memberIds = jobOutput.members.map((m) => requireNonEmpty(m.memberId, 'memberId'));
  const avatarIds = jobOutput.members.map((m) => requireNonEmpty(m.avatarAssetId, 'avatarAssetId'));
  const motionIds = jobOutput.members.map((m) => requireNonEmpty(m.motionAssetId, 'motionAssetId'));
  const motionUrls = jobOutput.members.map((m) => requireNonEmpty(m.motionUrl, 'motionUrl'));
  const clipNames = jobOutput.members.map((m) => (m.animationClipName || '').trim()).filter(Boolean);

  assertDistinct(memberIds, 'DUPLICATE_MEMBER_ID', 'memberId');
  assertDistinct(avatarIds, 'DUPLICATE_AVATAR_ASSET_ID', 'avatarAssetId');
  assertDistinct(motionIds, 'DUPLICATE_MOTION_ASSET_ID', 'motionAssetId');
  assertDistinct(motionUrls, 'DUPLICATE_MOTION_URL', 'motionUrl');
  assertDistinct(clipNames, 'AMBIGUOUS_MOTION_CLIP', 'animationClipName');

  for (const member of jobOutput.members) {
    validateMemberRecord(member, assetProvenance);
  }
}

module.exports = {
  GX10ValidationError,
  validateGX10JobOutputContract,
};
