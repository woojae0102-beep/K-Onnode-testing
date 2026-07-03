// @ts-nocheck
import type { FormationKeyframe, FormationSlot, MemberTrackMeta } from './danceDatabase';
import type { BodyOrientation } from '../services/motion/OrientationEngine';
import type { BoneQuaternion } from '../utils/quaternionInterpolation';

export interface JointPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
  confidence?: number;
}

export interface SkeletonBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SkeletonWorldPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
  confidence?: number;
}

/** Hand Landmarker 21점 세트 */
export interface SkeletonHandLandmarks {
  landmarks: SkeletonWorldPoint[];
  worldLandmarks?: SkeletonWorldPoint[];
  handedness: 'Left' | 'Right';
  confidence: number;
}

/** Face Landmarker 468점 세트 */
export interface SkeletonFaceLandmarks {
  landmarks: SkeletonWorldPoint[];
  confidence: number;
}

/** 프레임 단위 멤버 트랙 스냅샷 */
export interface SkeletonFrameMemberTrack {
  trackId: number;
  memberId: string | null;
  confidence: number;
  initialPosition?: { x: number; y: number };
}

export interface SkeletonMemberData {
  personIndex: number;
  trackId?: number;
  joints: Record<string, JointPoint>;
  estimatedMemberId: string | null;
  /** 가려짐 보강 프레임 여부 */
  isEstimated?: boolean;
  confidence?: number;
  boundingBox?: SkeletonBoundingBox;
  worldCoordinates?: Record<string, SkeletonWorldPoint>;
  /** Hand Landmarker — 포인트·하트·그룹 손동작 */
  leftHand?: SkeletonHandLandmarks;
  rightHand?: SkeletonHandLandmarks;
  /** Face Landmarker — 표정·고개 방향 */
  face?: SkeletonFaceLandmarks;
  /** Body facing — front/back/45°/90° */
  orientation?: BodyOrientation;
  /** 본별 Quaternion — GLB Avatar Retarget */
  boneRotations?: Record<string, BoneQuaternion>;
}

export interface SkeletonFrameData {
  timestamp: number;
  timestampMs?: number;
  frameIndex?: number;
  /** 원본 영상 시각(초) — RVFC mediaTime */
  sourceVideoTime?: number;
  bpm?: number;
  /** BPM 기준 fractional beat */
  beat?: number;
  beatIndex?: number;
  videoWidth?: number;
  videoHeight?: number;
  members: SkeletonMemberData[];
  memberTracks?: SkeletonFrameMemberTrack[];
  formation?: FormationKeyframe;
  /** 구간 대형 타입 — diamond/line/circle/triangle 등 */
  formationType?: string;
  /** 프레임 평균 감지 신뢰도 */
  confidence?: number;
  /** Pose Quality 0~1 */
  poseQuality?: number;
  boundingBox?: SkeletonBoundingBox;
  worldCoordinates?: Record<string, SkeletonWorldPoint>;
}

export interface MemberPosition {
  default: { x: number; y: number };
}

export interface GroupMember {
  id: string;
  name: string;
  nameKr: string;
  position: MemberPosition;
  color: string;
  defaultX: number;
  defaultY: number;
  avatar: string;
}

export type FormationType = 'line' | 'v_shape' | 'diamond' | 'scattered';

export interface GroupData {
  name: string;
  nameKr: string;
  members: GroupMember[];
  memberCount: number;
  defaultFormation: FormationType;
}

export type GroupPracticePhase =
  | 'home'
  | 'song_detail'
  | 'position_select'
  | 'practice'
  | 'result'
  | 'group_select'
  | 'member_select'
  | 'video_upload'
  | 'extracting'
  | 'ready'
  | 'practicing';

export interface GroupSessionResult {
  scores: Record<string, number>;
  duration: number;
  overall: number;
  groupId: string;
  memberId: string;
  groupName?: string;
  memberName?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  coachReview?: string;
}

export const SKELETON_CONNECTIONS: [string, string][] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

export const JOINT_MAP: Record<string, number> = {
  nose: 0,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
};
