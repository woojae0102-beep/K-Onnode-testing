// @ts-nocheck
/**
 * Stage Frame Renderer — 렌더 파이프라인 파사드.
 * Formation → Auto Fit BBox → Canvas Draw
 */
export {
  renderStageFrame,
  drawStageBackground,
  drawGhostSlot,
  drawAIAvatar,
  type StageFrameRenderInput,
  type StageFormationContext,
  type StageCanvasLogicalSize,
  type ReferenceFrameRenderOptions,
} from '../../utils/groupSkeletonDraw';

export {
  filterVisibleStageMembers,
  cloneMemberJointsForRender,
  assertDistinctMemberJoints,
  type GroupStudioRendererOptions,
} from './GroupStudioRenderer';

export {
  resolveReferenceFrameIndex,
  resolveReferenceFrameAtTime,
} from '../../utils/referenceFrameUtils';

export {
  logReferenceFrameBeforeRender,
  resetReferenceFrameRenderDebug,
} from '../../utils/referenceFrameRenderDebug';

export {
  buildSkeletonRenderTransform,
  applyTransformToJoints,
  computeSkeletonBBoxFromSets,
  type SkeletonRenderTransform,
} from '../../utils/SkeletonRenderTransform';

export { applySkeletonFormationPipeline } from './SkeletonFormationRender';
export { StageMotionEngine, getSharedStageMotionEngine } from './StageMotionEngine';

import { renderGroupStudioFrame } from './GroupStudioRenderer';
export default renderGroupStudioFrame;
