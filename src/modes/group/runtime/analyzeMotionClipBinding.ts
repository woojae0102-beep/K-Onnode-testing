// @ts-nocheck
import type { AnimationClip } from 'three';
import type { Object3D } from 'three';
import type {
  MotionBindingDebugSnapshot,
  MotionBindingStatus,
  MotionBindingStrategy,
} from '../types/motionBindingDebug';

/** glTF track name → target node (e.g. "Hips.quaternion" → "Hips") */
export function extractTrackTargetNodeName(trackName: string): string {
  const trimmed = trackName.trim();
  if (!trimmed) return '';
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0) return trimmed;
  return trimmed.slice(0, dot);
}

export function collectAvatarHierarchyNames(root: Object3D): {
  avatarRootName: string;
  avatarBoneNames: string[];
  avatarHasSkeleton: boolean;
} {
  const names = new Set<string>();
  let avatarHasSkeleton = false;

  root.traverse((obj) => {
    if (obj.name) names.add(obj.name);
    if ((obj as { isBone?: boolean }).isBone) {
      avatarHasSkeleton = true;
    }
  });

  return {
    avatarRootName: root.name || root.type || 'Scene',
    avatarBoneNames: [...names].sort(),
    avatarHasSkeleton,
  };
}

export function nodeExistsInHierarchy(root: Object3D, nodeName: string): boolean {
  if (!nodeName) return false;
  if (root.name === nodeName) return true;
  let found = false;
  root.traverse((obj) => {
    if (obj.name === nodeName) found = true;
  });
  return found;
}

export function analyzeMotionClipBinding(input: {
  memberId: string;
  avatarRoot: Object3D;
  clip: AnimationClip;
}): MotionBindingDebugSnapshot {
  const { memberId, avatarRoot, clip } = input;
  const hierarchy = collectAvatarHierarchyNames(avatarRoot);
  const motionTrackTargetNames = clip.tracks.map((t) => extractTrackTargetNodeName(t.name));
  const uniqueTargets = [...new Set(motionTrackTargetNames.filter(Boolean))];

  let matchedTrackCount = 0;
  const unmatchedTrackTargets: string[] = [];

  for (const track of clip.tracks) {
    const target = extractTrackTargetNodeName(track.name);
    if (target && nodeExistsInHierarchy(avatarRoot, target)) {
      matchedTrackCount += 1;
    } else if (target) {
      unmatchedTrackTargets.push(target);
    }
  }

  const motionTrackCount = clip.tracks.length;
  const unmatchedTrackCount = motionTrackCount - matchedTrackCount;
  const bindingRatio = motionTrackCount > 0 ? matchedTrackCount / motionTrackCount : 0;

  const bindingStatus = resolveBindingStatus(matchedTrackCount, motionTrackCount);
  const motionBindingStrategy = resolveBindingStrategy(bindingStatus, bindingRatio);

  return {
    memberId,
    avatarRootName: hierarchy.avatarRootName,
    avatarHasSkeleton: hierarchy.avatarHasSkeleton,
    avatarBoneNames: hierarchy.avatarBoneNames,
    motionClipName: clip.name,
    motionTrackCount,
    motionTrackTargetNames: uniqueTargets,
    matchedTrackCount,
    unmatchedTrackCount,
    unmatchedTrackTargets: [...new Set(unmatchedTrackTargets)],
    bindingRatio,
    bindingStatus,
    motionBindingStrategy,
  };
}

export function resolveBindingStatus(
  matchedTrackCount: number,
  trackCount: number,
): MotionBindingStatus {
  if (trackCount <= 0) return 'not_checked';
  if (matchedTrackCount === trackCount) return 'fully_bound';
  if (matchedTrackCount === 0) return 'unbound';
  return 'partially_bound';
}

export function resolveBindingStrategy(
  bindingStatus: MotionBindingStatus,
  bindingRatio: number,
): MotionBindingStrategy {
  if (bindingStatus === 'fully_bound') return 'DIRECT_BINDING';
  if (bindingStatus === 'unbound') return 'RETARGET_REQUIRED';
  if (bindingStatus === 'partially_bound') return 'PARTIAL_BINDING';
  if (bindingRatio >= 0.9) return 'DIRECT_BINDING';
  if (bindingRatio <= 0.05) return 'RETARGET_REQUIRED';
  return 'PARTIAL_BINDING';
}

export default analyzeMotionClipBinding;
