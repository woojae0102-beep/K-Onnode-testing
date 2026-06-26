// @ts-nocheck
import React, { Component } from 'react';
import { AvatarCharacter3D } from './AvatarCharacter3D';
import { SkeletonAvatar3D } from './SkeletonAvatar3D';
import type { ChoreographyJoint, PersonaStyle } from '../../../types/groupChoreography';

class GLBErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/** GLB 로드/리타겟 실패 시 SkeletonAvatar3D 라인 렌더로 즉시 폴백 */
export function AvatarCharacterWithFallback({
  glbUrl,
  joints,
  persona,
  label,
}: {
  glbUrl?: string;
  joints: Record<string, ChoreographyJoint>;
  persona?: PersonaStyle;
  label?: string;
}) {
  const skeletonFallback = (
    <SkeletonAvatar3D joints={joints} persona={persona} label={label} lineWidth={2.5} />
  );

  if (!glbUrl) return skeletonFallback;

  return (
    <GLBErrorBoundary fallback={skeletonFallback}>
      <AvatarCharacter3D glbUrl={glbUrl} joints={joints} persona={persona} label={label} />
    </GLBErrorBoundary>
  );
}

export default AvatarCharacterWithFallback;
