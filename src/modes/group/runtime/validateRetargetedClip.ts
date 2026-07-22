// @ts-nocheck
import type { AnimationClip } from 'three';
import type { SkeletonBoneMapping } from '../types/skeletonRetargeting';
import { extractTrackTargetNodeName } from './analyzeMotionClipBinding';

/** SkeletonUtils.retargetClip → `.bones[BoneName].property` */
export function extractRetargetTrackBoneName(trackName: string): string {
  const bonesMatch = trackName.match(/\.bones\[([^\]]+)\]/);
  if (bonesMatch?.[1]) return bonesMatch[1];
  return extractTrackTargetNodeName(trackName);
}

export type RetargetClipValidation = {
  valid: boolean;
  reasons: string[];
  trackTargetNames: string[];
  unmatchedSourceTargets: string[];
};

export function validateRetargetedClip(input: {
  retargetedClip: AnimationClip;
  sourceClip: AnimationClip;
  targetBoneNames: string[];
  mapping: SkeletonBoneMapping[];
}): RetargetClipValidation {
  const { retargetedClip, sourceClip, targetBoneNames, mapping } = input;
  const reasons: string[] = [];
  const targetSet = new Set(targetBoneNames);
  const mappedTargets = new Set(mapping.map((m) => m.targetBoneName));

  if (!retargetedClip.tracks.length) {
    reasons.push('retargetedClip has zero tracks');
  }
  if (retargetedClip.duration <= 0) {
    reasons.push('retargetedClip duration <= 0');
  }

  const trackTargetNames = retargetedClip.tracks.map((t) => extractRetargetTrackBoneName(t.name));
  const uniqueTargets = [...new Set(trackTargetNames.filter(Boolean))];

  for (const target of uniqueTargets) {
    if (!targetSet.has(target)) {
      reasons.push(`track target "${target}" not in target skeleton`);
    }
  }

  const sourceTargets = new Set(
    sourceClip.tracks.map((t) => extractTrackTargetNodeName(t.name)).filter(Boolean),
  );
  const unmatchedSourceTargets: string[] = [];
  for (const st of sourceTargets) {
    const stillPresent = retargetedClip.tracks.some(
      (t) => extractRetargetTrackBoneName(t.name) === st,
    );
    if (stillPresent) {
      unmatchedSourceTargets.push(st);
      reasons.push(`source track target "${st}" still present in retargeted clip`);
    }
  }

  const mappedWithTracks = mapping.filter((m) =>
    retargetedClip.tracks.some((t) => extractRetargetTrackBoneName(t.name) === m.targetBoneName),
  );
  if (mapping.length > 0 && mappedWithTracks.length === 0) {
    reasons.push('mapping does not match any retargeted tracks');
  }

  return {
    valid: reasons.length === 0,
    reasons,
    trackTargetNames: uniqueTargets,
    unmatchedSourceTargets,
  };
}

export default validateRetargetedClip;
