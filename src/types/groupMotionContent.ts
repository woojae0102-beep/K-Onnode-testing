// @ts-nocheck
/**
 * Group Mode Pre-Built Motion Content — memberId 기반 (trackId 런타임 금지).
 * Admin/콘텐츠 제작 시 1회 생성·저장, 사용자 런타임은 로드만.
 */
import type { FormationTimeline, FormationHole } from './danceDatabase';
import type { SkeletonFrameData } from './groupPractice';

export type GroupMotionAssetFormat = 'glb' | 'gltf' | 'fbx' | 'json' | 'skeleton_frames';

export type GroupFormationKeyframe = {
  time: number;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
};

export type GroupMemberMotion = {
  memberId: string;
  memberName: string;
  avatarId?: string;
  motionAsset?: string;
  motionFormat?: GroupMotionAssetFormat;
  /** 멤버별 독립 시계열 (memberId 키) */
  motionData?: SkeletonFrameData[];
  formationTimeline?: GroupFormationKeyframe[];
  displayNameKr?: string;
  persona?: Record<string, unknown>;
  formationAnchor?: { x: number; y: number; z: number };
};

export type GroupStageConfig = {
  width?: number;
  height?: number;
  depth?: number;
  floorColor?: string;
  accentColor?: string;
};

export type GroupMotionContentSource = 'indexeddb' | 'static_json' | 'bundled' | 'production';

export type GroupMotionContent = {
  id: string;
  groupId: string;
  songId: string;
  version: number;
  durationSec: number;
  bpm?: number;
  sampleFps?: number;
  members: GroupMemberMotion[];
  /** 전체 프레임 (memberId별 members[] 포함) — 비교·reference용 */
  frames?: SkeletonFrameData[];
  formation?: FormationTimeline;
  formationHole?: FormationHole;
  stage?: GroupStageConfig;
  source: GroupMotionContentSource;
  videoId?: string;
  savedAt?: string;
};

/** 사용자 멤버 선택 후 런타임 상태 */
export type GroupUserSlot = {
  memberId: string;
  memberName: string;
  referenceMotion: GroupMemberMotion;
  formationAnchor?: { x: number; y: number; z: number };
};

export type GroupPracticeRuntimeState = {
  selectedMemberId: string;
  userSlot: GroupUserSlot;
  aiAvatarMembers: GroupMemberMotion[];
};
