// @ts-nocheck
/**
 * 그룹 안무 데이터셋 JSON 스키마
 * - 멤버별 ID, 3D 관절 좌표(x,y,z), 페르소나 스타일 속성
 * - public/data/choreography/*.json 으로 배포 후 lazy load
 */

export interface ChoreographyJoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PersonaStyle {
  /** dance | vocal | leader | center 등 역할 태그 */
  styleId: string;
  /** 0~1 에너지 강도 — 렌더링 glow/line width에 반영 */
  energy: number;
  /** 0~1 동작 날카로움 — 보간 smoothing 계수 */
  sharpness: number;
  /** 0~1 그루브/리듬감 — 타이밍 오프셋 ms */
  groove: number;
  accentColor: string;
  /** Three.js 스켈레톤 두께 배율 */
  lineScale?: number;
}

export interface ChoreographyMemberMeta {
  memberId: string;
  displayName: string;
  displayNameKr?: string;
  persona: PersonaStyle;
  /** 대형 기준 슬롯 (0~1 정규화, z=깊이) */
  formationAnchor: { x: number; y: number; z: number };
}

export interface ChoreographyMemberFrame {
  memberId: string;
  joints: Record<string, ChoreographyJoint>;
}

export interface ChoreographyFrame {
  timestamp: number;
  members: ChoreographyMemberFrame[];
}

export interface ChoreographyDatasetMeta {
  groupId: string;
  songId: string;
  title?: string;
  bpm?: number;
  durationSec: number;
  formation: 'line' | 'v_shape' | 'diamond' | 'scattered';
  fps?: number;
  version?: string;
  /** 추출 영상 좌표 그대로 AI 배치 (formation 재배치 생략) */
  preserveVideoFormation?: boolean;
}

export interface ChoreographyDataset {
  meta: ChoreographyDatasetMeta;
  members: ChoreographyMemberMeta[];
  frames: ChoreographyFrame[];
}

/** 런타임 AI 아바타 인스턴스 (AvatarGroupManager 출력) */
export interface AIAvatarInstance {
  memberId: string;
  displayName: string;
  persona: PersonaStyle;
  /** @deprecated Group Mode — motionUrl + AnimationClip 사용 */
  joints?: Record<string, ChoreographyJoint>;
  /** Group Mode motion playback */
  motionUrl?: string;
  motionFormat?: 'gltf_animation';
  motionAssetId?: string;
  /** 본별 Quaternion — Teaching/legacy GLB retarget */
  boneRotations?: Record<string, { x: number; y: number; z: number; w: number }>;
  /** Body facing */
  orientation?: { yaw: number; pitch: number; label: string; confidence: number };
  animationClipName?: string;
  sourceSkeletonProfile?: import('../../modes/group/types/ProductionSkeletonContract').SkeletonProfile;
  avatarSkeletonProfile?: import('../../modes/group/types/ProductionSkeletonContract').SkeletonProfile;
  /** 3D 월드 오프셋 (dynamic positioning) */
  worldOffset: { x: number; y: number; z: number };
  isEstimated?: boolean;
}

/** 사용자 + AI 아바타 동기화 스냅샷 (렌더러 입력) — 스테이지 100% 복원용 */
export interface GroupDanceTimelineSnapshot {
  /** 연습 타임라인 길이(초) — video.duration */
  duration: number;
  fps: number;
  /** duration × fps */
  totalFrames: number;
  /** 현재 프레임 인덱스 */
  frameIndex: number;
  /** 0~1 진행률 */
  progress: number;
}

/** @deprecated PracticeMotionSnapshot (src/types/motionSnapshot.ts) 사용 */
export type { PracticeMotionSnapshot as GroupDanceRenderSnapshot } from './motionSnapshot';
export type { SyncEngineTickResult } from './motionSnapshot';
