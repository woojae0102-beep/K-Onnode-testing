// @ts-nocheck
import type { SkeletonDefinition, SkeletonBoneMapping } from '../types/skeletonRetargeting';
import type {
  SemanticBoneName,
  SemanticBoneDefinition,
  SkeletonProfile,
  SkeletonValidationResult,
} from '../types/ProductionSkeletonContract';
import { REQUIRED_SEMANTIC_BONES } from '../types/ProductionSkeletonContract';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { normalizeBoneBaseName, detectBoneSide, sidesCompatible } from './normalizeBoneName';

function semanticSideToDetect(side: SemanticBoneDefinition['side']): 'L' | 'R' | null {
  if (side === 'left') return 'L';
  if (side === 'right') return 'R';
  return null;
}

function boneMatchesSemantic(boneName: string, def: SemanticBoneDefinition): boolean {
  const base = normalizeBoneBaseName(boneName);
  const side = detectBoneSide(boneName);
  const expectedSide = semanticSideToDetect(def.side);

  if (expectedSide && side && !sidesCompatible(side, expectedSide)) return false;
  if (def.side === 'left' && side === 'R') return false;
  if (def.side === 'right' && side === 'L') return false;

  return def.aliases.some((alias) => normalizeBoneBaseName(alias) === base);
}

export function resolveSemanticBoneMap(
  definition: SkeletonDefinition,
): Map<SemanticBoneName, string[]> {
  const result = new Map<SemanticBoneName, string[]>();

  for (const def of REQUIRED_SEMANTIC_BONES) {
    const matches: string[] = [];
    for (const bone of definition.bones) {
      if (boneMatchesSemantic(bone.name, def)) {
        matches.push(bone.name);
      }
    }
    if (matches.length) result.set(def.semanticName, matches);
  }

  return result;
}

export function validateProductionSkeleton(input: {
  targetDefinition: SkeletonDefinition;
  sourceDefinition?: SkeletonDefinition;
  mapping?: SkeletonBoneMapping[];
  profile: SkeletonProfile;
  mappingRatio?: number;
}): SkeletonValidationResult {
  const {
    targetDefinition,
    sourceDefinition,
    mapping = [],
    profile,
    mappingRatio = 0,
  } = input;

  const blockingReasons: string[] = [];
  const requiredDefs = REQUIRED_SEMANTIC_BONES.filter((b) => b.required);
  const targetSemanticMap = resolveSemanticBoneMap(targetDefinition);

  const duplicateSemanticBones: SemanticBoneName[] = [];
  const mappedSemanticBones: Partial<Record<SemanticBoneName, string>> = {};
  const missingRequiredBones: SemanticBoneName[] = [];

  for (const def of requiredDefs) {
    const matches = targetSemanticMap.get(def.semanticName) || [];
    if (matches.length > 1) {
      duplicateSemanticBones.push(def.semanticName);
      blockingReasons.push(`duplicate semantic bone: ${def.semanticName}`);
    } else if (matches.length === 1) {
      mappedSemanticBones[def.semanticName] = matches[0];
    } else {
      missingRequiredBones.push(def.semanticName);
      blockingReasons.push(`missing required bone: ${def.semanticName}`);
    }
  }

  if (sourceDefinition && mapping.length) {
    const sourceSemanticMap = resolveSemanticBoneMap(sourceDefinition);
    for (const def of requiredDefs) {
      const targetBone = mappedSemanticBones[def.semanticName];
      if (!targetBone) continue;

      const mapped = mapping.find((m) => m.targetBoneName === targetBone);
      if (!mapped) {
        missingRequiredBones.push(def.semanticName);
        blockingReasons.push(`required semantic not mapped: ${def.semanticName}`);
        continue;
      }

      const sourceMatches = sourceSemanticMap.get(def.semanticName) || [];
      if (!sourceMatches.includes(mapped.sourceBoneName)) {
        const sourceSide = detectBoneSide(mapped.sourceBoneName);
        const targetSide = detectBoneSide(mapped.targetBoneName);
        if (!sidesCompatible(sourceSide, targetSide)) {
          blockingReasons.push(`L/R flip detected: ${def.semanticName}`);
        } else {
          blockingReasons.push(`semantic mapping mismatch: ${def.semanticName}`);
        }
      }
    }
  }

  if (profile === 'UNKNOWN') {
    blockingReasons.push('unsupported skeleton profile');
  }

  const matchedRequiredBoneCount = requiredDefs.length - missingRequiredBones.length;
  const requiredBoneCount = requiredDefs.length;

  let status: SkeletonValidationResult['status'] = 'valid';
  if (profile === 'UNKNOWN') {
    status = 'unsupported';
  } else if (duplicateSemanticBones.length) {
    status = 'invalid';
  } else if (missingRequiredBones.length === requiredDefs.length) {
    status = 'invalid';
  } else if (missingRequiredBones.length > 0) {
    status = 'incomplete';
  } else if (blockingReasons.length) {
    status = 'invalid';
  }

  if (status !== 'valid' && mappingRatio > 0.9) {
    blockingReasons.push('mappingRatio alone does not grant valid status');
  }

  return {
    status,
    profile,
    requiredBoneCount,
    matchedRequiredBoneCount,
    missingRequiredBones: [...new Set(missingRequiredBones)],
    duplicateSemanticBones: [...new Set(duplicateSemanticBones)],
    mappedSemanticBones,
    mappingRatio,
    blockingReasons: [...new Set(blockingReasons)],
  };
}

export function assertProductionSkeletonValid(result: SkeletonValidationResult): void {
  if (result.status === 'valid') return;

  if (result.duplicateSemanticBones.length) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_BONE_MAPPING_AMBIGUOUS,
      `ambiguous bones: ${result.duplicateSemanticBones.join(', ')}`,
    );
  }
  if (result.profile === 'UNKNOWN' || result.status === 'unsupported') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_SKELETON_PROFILE_UNSUPPORTED,
      result.blockingReasons.join('; ') || 'unsupported profile',
    );
  }
  if (result.missingRequiredBones.length) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_REQUIRED_BONE_MISSING,
      `missing: ${result.missingRequiredBones.join(', ')}`,
    );
  }
  throw new ProductionMotionAssetError(
    PRODUCTION_MOTION_ERRORS.PRODUCTION_SKELETON_INVALID,
    result.blockingReasons.join('; ') || result.status,
  );
}

export default validateProductionSkeleton;
