// @ts-nocheck
import type { SkeletonDefinition } from '../types/skeletonRetargeting';
import type { SkeletonProfile } from '../types/ProductionSkeletonContract';

export function detectSkeletonProfile(definition: SkeletonDefinition | null | undefined): SkeletonProfile {
  if (!definition?.bones?.length) return 'UNKNOWN';

  const names = definition.bones.map((b) => b.name);
  const lower = names.map((n) => n.toLowerCase()).join('|');

  if (names.some((n) => /^mixamorig/i.test(n) || n.includes('mixamorig:'))) {
    return 'MIXAMO';
  }

  const rpmMarkers = ['LeftUpLeg', 'RightUpLeg', 'LeftArm', 'RightArm', 'Hips'];
  if (rpmMarkers.every((m) => names.some((n) => n === m || n.endsWith(m)))) {
    return 'RPM';
  }

  if (lower.includes('gx10') || lower.includes('konnode') || lower.includes('k_onnode')) {
    return 'K_ONNODE_AVATAR_V1';
  }

  if (names.some((n) => /^Hips$/i.test(n)) && names.some((n) => /Left/i.test(n) || /_L$/i.test(n))) {
    return 'RPM';
  }

  return 'UNKNOWN';
}

export function resolveDeclaredSkeletonProfile(input: {
  declared?: SkeletonProfile;
  detected: SkeletonProfile;
  requireDeclaration?: boolean;
}): { profile: SkeletonProfile; supported: boolean; reason?: string } {
  const { declared, detected, requireDeclaration = false } = input;

  if (declared) {
    if (declared === 'UNKNOWN') {
      return { profile: 'UNKNOWN', supported: false, reason: 'declared profile is UNKNOWN' };
    }
    if (detected !== 'UNKNOWN' && declared !== detected) {
      return {
        profile: declared,
        supported: false,
        reason: `declared=${declared} detected=${detected}`,
      };
    }
    return { profile: declared, supported: true };
  }

  if (requireDeclaration) {
    return { profile: 'UNKNOWN', supported: false, reason: 'skeleton profile not declared' };
  }

  if (detected === 'UNKNOWN') {
    return { profile: 'UNKNOWN', supported: false, reason: 'skeleton profile undetected' };
  }

  return { profile: detected, supported: true };
}

export default detectSkeletonProfile;
