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
} from '../../utils/groupSkeletonDraw';

export {
  buildSkeletonRenderTransform,
  applyTransformToJoints,
  computeSkeletonBBoxFromSets,
  type SkeletonRenderTransform,
} from '../../utils/SkeletonRenderTransform';

export { applySkeletonFormationPipeline } from './SkeletonFormationRender';
export { StageMotionEngine, getSharedStageMotionEngine } from './StageMotionEngine';

import { renderStageFrame } from '../../utils/groupSkeletonDraw';
export default renderStageFrame;
