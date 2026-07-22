// @ts-nocheck
import type { SkeletonDefinition, SkeletonBoneMapping } from '../types/skeletonRetargeting';
import {
  normalizeBoneBaseName,
  detectBoneSide,
  sidesCompatible,
} from './normalizeBoneName';

/** Vendor-neutral humanoid profile — GX10/RPM/mixamo 공통 role */
const HUMANOID_PROFILE: Array<{ role: string; patterns: string[] }> = [
  { role: 'hips', patterns: ['hips', 'pelvis', 'hip', 'root'] },
  { role: 'spine', patterns: ['spine', 'spine1', 'spine2', 'chest', 'torso'] },
  { role: 'neck', patterns: ['neck'] },
  { role: 'head', patterns: ['head'] },
  { role: 'shoulder_l', patterns: ['leftshoulder', 'shoulder_l', 'shoulderl'] },
  { role: 'shoulder_r', patterns: ['rightshoulder', 'shoulder_r', 'shoulderr'] },
  { role: 'arm_l', patterns: ['leftarm', 'upperarm_l', 'arm_l'] },
  { role: 'arm_r', patterns: ['rightarm', 'upperarm_r', 'arm_r'] },
  { role: 'leg_l', patterns: ['leftleg', 'upperleg_l', 'thigh_l', 'leg_l'] },
  { role: 'leg_r', patterns: ['rightleg', 'upperleg_r', 'thigh_r', 'leg_r'] },
];

function roleForBone(normalizedBase: string, side: ReturnType<typeof detectBoneSide>): string | null {
  for (const entry of HUMANOID_PROFILE) {
    if (entry.patterns.some((p) => normalizedBase === p || normalizedBase.endsWith(p))) {
      if (entry.role.endsWith('_l') && side !== 'L') continue;
      if (entry.role.endsWith('_r') && side !== 'R') continue;
      return entry.role;
    }
  }
  return null;
}

export function computeSkeletonBoneMapping(
  source: SkeletonDefinition,
  target: SkeletonDefinition,
  manualMappings: SkeletonBoneMapping[] = [],
): SkeletonBoneMapping[] {
  const mappings: SkeletonBoneMapping[] = [];
  const usedSource = new Set<string>();
  const usedTarget = new Set<string>();

  for (const manual of manualMappings) {
    if (usedSource.has(manual.sourceBoneName) || usedTarget.has(manual.targetBoneName)) continue;
    mappings.push({ ...manual, mappingMethod: 'MANUAL_PROFILE' });
    usedSource.add(manual.sourceBoneName);
    usedTarget.add(manual.targetBoneName);
  }

  for (const targetBone of target.bones) {
    if (usedTarget.has(targetBone.name)) continue;

    const exact = source.bones.find((s) => s.name === targetBone.name);
    if (exact && !usedSource.has(exact.name)) {
      mappings.push({
        sourceBoneName: exact.name,
        targetBoneName: targetBone.name,
        confidence: 1,
        mappingMethod: 'EXACT_NAME',
      });
      usedSource.add(exact.name);
      usedTarget.add(targetBone.name);
    }
  }

  for (const targetBone of target.bones) {
    if (usedTarget.has(targetBone.name)) continue;
    const targetBase = normalizeBoneBaseName(targetBone.name);
    const targetSide = detectBoneSide(targetBone.name);

    for (const sourceBone of source.bones) {
      if (usedSource.has(sourceBone.name)) continue;
      const sourceBase = normalizeBoneBaseName(sourceBone.name);
      const sourceSide = detectBoneSide(sourceBone.name);
      if (sourceBase !== targetBase) continue;
      if (!sidesCompatible(sourceSide, targetSide)) continue;

      mappings.push({
        sourceBoneName: sourceBone.name,
        targetBoneName: targetBone.name,
        confidence: 0.85,
        mappingMethod: 'NORMALIZED_NAME',
      });
      usedSource.add(sourceBone.name);
      usedTarget.add(targetBone.name);
      break;
    }
  }

  const sourceRoles = new Map<string, string>();
  const targetRoles = new Map<string, string>();

  for (const b of source.bones) {
    const role = roleForBone(normalizeBoneBaseName(b.name), detectBoneSide(b.name));
    if (role) sourceRoles.set(b.name, role);
  }
  for (const b of target.bones) {
    const role = roleForBone(normalizeBoneBaseName(b.name), detectBoneSide(b.name));
    if (role) targetRoles.set(b.name, role);
  }

  for (const [targetName, targetRole] of targetRoles.entries()) {
    if (usedTarget.has(targetName)) continue;
    for (const [sourceName, sourceRole] of sourceRoles.entries()) {
      if (usedSource.has(sourceName)) continue;
      if (sourceRole !== targetRole) continue;
      if (!sidesCompatible(detectBoneSide(sourceName), detectBoneSide(targetName))) continue;

      mappings.push({
        sourceBoneName: sourceName,
        targetBoneName: targetName,
        confidence: 0.65,
        mappingMethod: 'PROFILE',
      });
      usedSource.add(sourceName);
      usedTarget.add(targetName);
      break;
    }
  }

  return mappings;
}

export function mappingToRetargetNames(mappings: SkeletonBoneMapping[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const m of mappings) {
    names[m.targetBoneName] = m.sourceBoneName;
  }
  return names;
}

export default computeSkeletonBoneMapping;
