// @ts-nocheck
/**
 * Production motion AnimationMixer lifecycle disposal (PHASE 16).
 */
import type { AnimationClip, Object3D } from 'three';
import type { AnimationMixer } from 'three';
import { recordMixerDisposed } from './productionMotionRuntimeCache';

export function disposeProductionMotionMixer(input: {
  mixer: AnimationMixer;
  root?: Object3D | null;
  clip?: AnimationClip | null;
  actionCount?: number;
}): void {
  const { mixer, root, clip, actionCount = 1 } = input;
  if (!mixer) return;

  mixer.stopAllAction();
  if (clip) {
    try {
      mixer.uncacheClip(clip);
    } catch {
      /* uncacheClip optional */
    }
  }
  if (root) {
    try {
      mixer.uncacheRoot(root);
    } catch {
      /* uncacheRoot optional */
    }
  }

  recordMixerDisposed(actionCount);
}

export default disposeProductionMotionMixer;
