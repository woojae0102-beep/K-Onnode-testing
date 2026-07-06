// @ts-nocheck
/**
 * Practice Motion Snapshot — 통일 스키마 (src 필드 없음).
 * Reference Video는 referenceVideo 객체 내부에만 존재.
 */
import type { FormationKeyframe } from './danceDatabase';
import type { ReferenceVideoMeta } from './practiceSession';
import type { SkeletonFrameData, SkeletonFrameMemberTrack } from './groupPractice';
import type { AIAvatarInstance, ChoreographyJoint, PersonaStyle } from './groupChoreography';

export interface PracticeMotionSnapshotTimeline {
  duration: number;
  fps: number;
  totalFrames: number;
  frameIndex: number;
  progress: number;
  currentTime: number;
}

export interface PracticeMotionSnapshotMember {
  memberId: string;
  displayName?: string;
  isUser: boolean;
  joints: Record<string, ChoreographyJoint>;
  persona?: PersonaStyle;
  boneRotations?: AIAvatarInstance['boneRotations'];
  orientation?: AIAvatarInstance['orientation'];
  worldOffset?: { x: number; y: number; z: number };
  isEstimated?: boolean;
}

export interface PracticeMotionSnapshotMotion {
  aiAvatars: AIAvatarInstance[];
  userMemberId: string;
  userJoints: Record<string, ChoreographyJoint> | null;
  userAnchor: { x: number; y: number; z: number };
  frame: SkeletonFrameData | null;
  confidence: number;
  bpm?: number;
  poseQuality?: number;
  beat?: number;
  beatIndex?: number;
  sourceVideoTime?: number;
}

export interface PracticeMotionSnapshotMetadata {
  memberTracks: SkeletonFrameMemberTrack[];
  groupId: string;
  songId: string;
  userMemberId: string;
}

/** GroupDanceSyncEngine tick 출력 — 내부용 (스키마 조립 전) */
export interface SyncEngineTickResult {
  timestamp: number;
  currentTime: number;
  sourceVideoTime?: number;
  bpm?: number;
  beat?: number;
  beatIndex?: number;
  poseQuality?: number;
  timeline: Omit<PracticeMotionSnapshotTimeline, 'currentTime'>;
  frame: SkeletonFrameData | null;
  formation: FormationKeyframe | null;
  memberTracks: SkeletonFrameMemberTrack[];
  confidence: number;
  userMemberId: string;
  userJoints: Record<string, ChoreographyJoint> | null;
  userAnchor: { x: number; y: number; z: number };
  aiAvatars: AIAvatarInstance[];
}

export interface SnapshotBuildContext {
  groupId: string;
  songId: string;
  userMemberId: string;
  videoDuration: number;
  frameCount: number;
  fps: number;
  referenceVideo?: ReferenceVideoMeta | null;
}

export interface PracticeMotionSnapshot {
  videoDuration: number;
  frameCount: number;
  fps: number;
  timeline: PracticeMotionSnapshotTimeline;
  members: PracticeMotionSnapshotMember[];
  formation: FormationKeyframe | null;
  motion: PracticeMotionSnapshotMotion;
  referenceVideo: ReferenceVideoMeta | null;
  metadata: PracticeMotionSnapshotMetadata;
  generatedAt: string;
}

export default PracticeMotionSnapshot;
