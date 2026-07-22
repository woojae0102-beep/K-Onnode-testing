// @ts-nocheck
import type { AnimationClip } from 'three';
import { PRODUCTION_MOTION_ERRORS, ProductionMotionAssetError } from '../types/ProductionMotionAssetV2';

export type ResolveMotionClipResult = {
  clip: AnimationClip;
  selectedClipName: string;
  clipDurationSec: number;
  clipCount: number;
  clipNames: string[];
};

export function resolveMotionAnimationClip(
  clips: AnimationClip[],
  animationClipName?: string,
  memberId = 'unknown',
): ResolveMotionClipResult {
  const clipNames = clips.map((c) => c.name);
  const clipCount = clips.length;

  if (!clipCount) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.MOTION_CLIP_NOT_FOUND,
      `member ${memberId}: no animation clips in motion asset`,
    );
  }

  if (animationClipName?.trim()) {
    const clip = clips.find((c) => c.name === animationClipName.trim());
    if (!clip) {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.MOTION_CLIP_NOT_FOUND,
        `member ${memberId}: clip "${animationClipName}" not found in [${clipNames.join(', ')}]`,
      );
    }
    return {
      clip,
      selectedClipName: clip.name,
      clipDurationSec: clip.duration,
      clipCount,
      clipNames,
    };
  }

  if (clipCount === 1) {
    const clip = clips[0];
    return {
      clip,
      selectedClipName: clip.name,
      clipDurationSec: clip.duration,
      clipCount,
      clipNames,
    };
  }

  throw new ProductionMotionAssetError(
    PRODUCTION_MOTION_ERRORS.AMBIGUOUS_MOTION_CLIP,
    `member ${memberId}: ${clipCount} clips, animationClipName required [${clipNames.join(', ')}]`,
  );
}

export default resolveMotionAnimationClip;
