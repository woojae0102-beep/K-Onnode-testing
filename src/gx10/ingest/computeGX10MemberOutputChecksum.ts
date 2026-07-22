// @ts-nocheck
/**
 * GX10 member output checksum — canonical payload + SHA-256 (PHASE 14).
 */
import { createHash } from 'node:crypto';
import type { GX10ProductionMotionMemberOutputRecord } from '../contracts/GX10ProductionMotionOutputContract';

export type GX10MemberChecksumFields = Pick<
  GX10ProductionMotionMemberOutputRecord,
  | 'memberId'
  | 'avatarAssetId'
  | 'motionAssetId'
  | 'motionUrl'
  | 'duration'
  | 'animationClipName'
  | 'sourceSkeletonProfile'
  | 'sourceSkeletonVersion'
>;

export function buildCanonicalGX10MemberChecksumPayload(
  fields: GX10MemberChecksumFields,
): string {
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

export function computeGX10MemberOutputChecksumSync(
  fields: GX10MemberChecksumFields,
): string {
  const canonical = buildCanonicalGX10MemberChecksumPayload(fields);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export async function computeGX10MemberOutputChecksum(
  fields: GX10MemberChecksumFields,
): Promise<string> {
  const canonical = buildCanonicalGX10MemberChecksumPayload(fields);
  const data = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function memberRecordMatchesChecksum(
  record: GX10ProductionMotionMemberOutputRecord,
): boolean {
  const expected = computeGX10MemberOutputChecksumSync(record);
  return record.checksum === expected;
}

export default computeGX10MemberOutputChecksumSync;
