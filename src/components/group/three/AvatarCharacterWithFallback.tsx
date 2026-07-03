// @ts-nocheck
import React, { Component } from 'react';
import { AvatarCharacter3D } from './AvatarCharacter3D';
import { SkeletonAvatar3D } from './SkeletonAvatar3D';
import { EmptyJointsMarker } from './EmptyJointsMarker';
import type { ChoreographyJoint, PersonaStyle } from '../../../types/groupChoreography';

class GLBErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[Avatar] GLB load/retarget failed, falling back to skeleton:', error?.message);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function countJoints(joints: Record<string, ChoreographyJoint> | undefined) {
  return Object.keys(joints || {}).length;
}

/** GLB 로드/리타겟 실패 시 SkeletonAvatar3D 라인 렌더로 즉시 폴백 */
export function AvatarCharacterWithFallback({
  glbUrl,
  joints,
  boneRotations,
  persona,
  label,
  memberId,
  worldOffset,
}: {
  glbUrl?: string;
  joints: Record<string, ChoreographyJoint>;
  boneRotations?: Record<string, { x: number; y: number; z: number; w: number }>;
  persona?: PersonaStyle;
  label?: string;
  memberId?: string;
  worldOffset?: { x: number; y: number; z: number };
}) {
  const jointCount = countJoints(joints);

  if (jointCount === 0) {
    return (
      <EmptyJointsMarker
        memberId={memberId || label || 'unknown'}
        label={label}
        worldOffset={worldOffset}
      />
    );
  }

  const skeletonFallback = (
    <SkeletonAvatar3D joints={joints} persona={persona} label={label} lineWidth={2.5} />
  );

  if (!glbUrl) return skeletonFallback;

  return (
    <GLBErrorBoundary fallback={skeletonFallback}>
      <AvatarCharacter3D glbUrl={glbUrl} joints={joints} boneRotations={boneRotations} persona={persona} label={label} />
    </GLBErrorBoundary>
  );
}

export default AvatarCharacterWithFallback;
