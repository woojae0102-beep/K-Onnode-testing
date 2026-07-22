// @ts-nocheck
/**
 * GX10 ↔ K-ONNODE architecture boundary (PHASE 9B).
 *
 * GX10 OWNS:
 * - source motion processing (video → motion GLB generation)
 * - member motion generation per job
 * - source skeleton metadata declaration
 * - motion asset URL generation / storage handoff
 * - async processing job lifecycle (queued → processing → completed | failed)
 *
 * K-ONNODE OWNS:
 * - ProductionMotionAssetV2 contract + assetProvenance
 * - ProductionMotionAssetLoader (consumer)
 * - Production Skeleton Contract + required semantic bone validation
 * - Avatar/motion skeleton profile gate
 * - Retarget gate (SkeletonUtils.retargetClip)
 * - Transform proof + VERIFIED_* / BLOCKED_* finalStatus
 * - Group Runtime playback (AvatarCharacterAnimated3D, AnimationMixer)
 * - Member isolation (getVisibleGroupMembers)
 * - Formation runtime
 *
 * GX10 MUST NOT OWN:
 * - GroupPracticeSession
 * - AvatarCharacterAnimated3D
 * - GroupDanceSyncEngine
 * - getVisibleGroupMembers()
 * - K-ONNODE final playback verification
 *
 * K-ONNODE MUST NOT:
 * - inspect GX10 internal motion extraction frames
 * - call GX10 hardware/API (PHASE 15: server admin proxy only — Group Runtime does not import REST client)
 * - reintroduce MediaPipe / SkeletonFrameData into Group Runtime
 *
 * DATA FLOW:
 *   GX10ProductionMotionProcessor.submitJob()
 *     → GX10ProductionMotionJob (async)
 *     → GX10ProductionMotionJobResult { productionAssetId }
 *     → GX10ProductionMotionJobOutputContract (PHASE 14 wire format)
 *     → runGX10ProductionMotionPipeline() / ProductionMotionAssetIngestor
 *     → ProductionMotionAssetV2 { assetProvenance }
 *     → ProductionMotionAssetLoader
 *     → Group Runtime
 *     → realProductionMotionValidationHarness (real_production only)
 */

export const GX10_K_ONNODE_BOUNDARY_VERSION = '1.0';

export default GX10_K_ONNODE_BOUNDARY_VERSION;
