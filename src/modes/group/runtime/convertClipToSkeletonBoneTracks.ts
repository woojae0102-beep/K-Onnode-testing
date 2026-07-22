// @ts-nocheck
import * as THREE from 'three';
import type { AnimationClip } from 'three';
import { extractTrackTargetNodeName } from './analyzeMotionClipBinding';

/** PropertyBinding이 source skeleton bone에 bind되도록 track path 정규화 */
export function convertClipToSkeletonBoneTracks(
  clip: AnimationClip,
  boneNames: string[],
): AnimationClip {
  const boneSet = new Set(boneNames);
  const tracks = clip.tracks.map((track) => {
    if (track.name.includes('.bones[')) return track.clone();

    const dot = track.name.lastIndexOf('.');
    if (dot <= 0) return track.clone();

    const nodeName = track.name.slice(0, dot);
    const property = track.name.slice(dot + 1);
    if (!boneSet.has(nodeName)) return track.clone();

    const TrackCtor = track.constructor as typeof THREE.KeyframeTrack;
    return new TrackCtor(
      `.bones[${nodeName}].${property}`,
      track.times.slice(),
      track.values.slice(),
    );
  });

  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export function collectClipTrackBoneNames(clip: AnimationClip): string[] {
  const names = new Set<string>();
  for (const track of clip.tracks) {
    const bonesMatch = track.name.match(/\.bones\[([^\]]+)\]/);
    if (bonesMatch?.[1]) {
      names.add(bonesMatch[1]);
      continue;
    }
    const target = extractTrackTargetNodeName(track.name);
    if (target) names.add(target);
  }
  return [...names];
}

export default convertClipToSkeletonBoneTracks;
