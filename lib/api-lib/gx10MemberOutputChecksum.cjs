/**
 * GX10 member output checksum — server-side (PHASE 14/15).
 */
const crypto = require('crypto');

function buildCanonicalGX10MemberChecksumPayload(fields) {
  return JSON.stringify({
    memberId: String(fields.memberId).trim(),
    avatarAssetId: String(fields.avatarAssetId).trim(),
    motionAssetId: String(fields.motionAssetId).trim(),
    motionUrl: String(fields.motionUrl).trim(),
    duration: Number(fields.duration),
    animationClipName: String(fields.animationClipName).trim(),
    sourceSkeletonProfile: fields.sourceSkeletonProfile,
    sourceSkeletonVersion: String(fields.sourceSkeletonVersion).trim(),
  });
}

function computeGX10MemberOutputChecksumSync(fields) {
  const canonical = buildCanonicalGX10MemberChecksumPayload(fields);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function memberRecordMatchesChecksum(record) {
  if (!record?.checksum) return false;
  return record.checksum === computeGX10MemberOutputChecksumSync(record);
}

module.exports = {
  buildCanonicalGX10MemberChecksumPayload,
  computeGX10MemberOutputChecksumSync,
  memberRecordMatchesChecksum,
};
