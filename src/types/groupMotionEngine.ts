// @ts-nocheck
import type { FormationTimeline, MemberTrackMeta } from './danceDatabase';
import type { DanceDatabase } from './danceDatabase';
import type { SkeletonFrameData, SkeletonMemberData } from './groupPractice';
import type { MemberMotionTimeline } from '../services/motion/MotionTimelineEngine';
import type { BodyOrientation } from '../services/motion/OrientationEngine';
import type { MotionPipelineAudit } from '../services/motion/GroupMotionPipeline';

/** Group Motion Reconstruction Engine 실시간 디버그 */
export interface GroupMotionEngineDebugState {
  frameIndex: number;
  timestamp: number;
  pipelineStage: string;
  trackedCount: number;
  visibleCount: number;
  estimatedCount: number;
  occlusionRecoveries: number;
  activeTrackIds: number[];
  releasedTrackIds: number[];
  avgPoseConfidence: number;
  avgIdentityConfidence: number;
  formationType: string | null;
  formationTransition: string | null;
  orientationLabels: string[];
  avgMemberVelocity: number;
  motionTimelineCoverage: Record<string, number>;
  interpolationActive: boolean;
  cacheHit: boolean;
  singleDancerMode: boolean;
}

export const EMPTY_GROUP_MOTION_DEBUG: GroupMotionEngineDebugState = {
  frameIndex: 0,
  timestamp: 0,
  pipelineStage: 'idle',
  trackedCount: 0,
  visibleCount: 0,
  estimatedCount: 0,
  occlusionRecoveries: 0,
  activeTrackIds: [],
  releasedTrackIds: [],
  avgPoseConfidence: 0,
  avgIdentityConfidence: 0,
  formationType: null,
  formationTransition: null,
  orientationLabels: [],
  avgMemberVelocity: 0,
  motionTimelineCoverage: {},
  interpolationActive: false,
  cacheHit: false,
  singleDancerMode: false,
};

/** Motion Engine 메타데이터 — DanceDatabase / Cache 저장 */
export interface GroupMotionEngineMetadata {
  engineVersion: string;
  pipelineVersion: string;
  reconstructedAt: string;
  groupId: string;
  songId: string;
  userMemberId: string;
  frameCount: number;
  aiMemberIds: string[];
  memberTracks: MemberTrackMeta[];
  formationTimeline: FormationTimeline | null;
  motionTimelines: MemberMotionTimeline[];
  identityConfidence: Record<string, number>;
  singleDancerMode: boolean;
  occlusionRecoveryCount: number;
  cacheKey?: string;
  fromCache?: boolean;
  pipelineAudit?: MotionPipelineAudit;
}

export interface GroupMotionReconstructionOptions {
  groupId: string;
  songId?: string;
  userMemberId: string;
  allMemberIds: string[];
  bpm?: number;
  sampleFps?: number;
  motionDatabase?: DanceDatabase | null;
  formationTimeline?: FormationTimeline | null;
  trackToMember?: Record<number, string> | Map<number, string>;
  cacheKey?: string;
  skipCache?: boolean;
}

export interface GroupMotionReconstructionResult {
  frames: SkeletonFrameData[];
  metadata: GroupMotionEngineMetadata;
  debug: GroupMotionEngineDebugState;
  motionDatabase?: DanceDatabase | null;
}

export interface MemberVelocityState {
  memberId: string;
  trackId: number;
  velocity: number;
  orientation?: BodyOrientation;
}
