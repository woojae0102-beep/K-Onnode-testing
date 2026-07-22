// @ts-nocheck
/**
 * Production Dance Asset — types (server Source of Truth).
 */
export type ProductionAssetStatus = 'draft' | 'processing' | 'ready' | 'failed' | 'motion_asset_missing';
export type ProductionMemberStatus = 'ready' | 'failed';
export type ProductionMotionFormat = 'fbx' | 'bvh' | 'glb' | 'json';
export type MotionCaptureProviderId = 'deepmotion';
export type UserRole = 'user' | 'admin';

/** @deprecated Group Runtime에서 읽지 않음 — legacy namespace로 격리 */
export type ProductionLegacyData = {
  skeletonData?: unknown;
  skeletonFrames?: unknown;
  trackId?: unknown;
  joints?: unknown;
  detectionMetadata?: unknown;
};

export type FormationTrack = {
  timestamp: number;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
};

export type StageConfig = {
  backgroundId: string;
  environmentAssetUrl?: string;
  cameraPreset: string;
  stagePreset: string;
};

export type AvatarAssetRecord = {
  id: string;
  url: string;
  format: 'glb';
  skeletonType: string;
  version: number;
  status: 'ready';
  groupId?: string;
  memberId?: string;
  memberName?: string;
};

export type ProductionMemberMotion = {
  memberId: string;
  memberName: string;
  motionAssetUrl: string;
  motionFormat: ProductionMotionFormat;
  /** @deprecated prefer avatarAssetId */
  avatarAssetUrl: string;
  avatarAssetId?: string;
  formationTrack: FormationTrack[];
  motionDurationSec: number;
  status: ProductionMemberStatus;
};

export type ProductionDanceAsset = {
  id: string;
  groupId: string;
  songId: string;
  title: string;
  version: number;
  durationSec: number;
  fps: number;
  /** Group Runtime motion source — glb/fbx animation only */
  members: ProductionMemberMotion[];
  /** Optional explicit motion asset list (same contract as members) */
  motionAssets?: ProductionMemberMotion[];
  avatarAssets?: AvatarAssetRecord[];
  formationAssets?: FormationTrack[][];
  stage: StageConfig;
  status: ProductionAssetStatus;
  provider: MotionCaptureProviderId;
  providerJobId?: string;
  createdAt: string;
  updatedAt: string;
  /** Legacy skeleton JSON — Group Runtime에서 읽으면 안 됨 */
  legacy?: ProductionLegacyData;
};

export type GroupRuntimeActors = {
  userSlot: ProductionMemberMotion;
  aiActors: ProductionMemberMotion[];
  selectedMemberId: string;
};

export const PRODUCTION_ERRORS = {
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  ADMIN_ACCESS_REQUIRED: 'ADMIN_ACCESS_REQUIRED',
  AVATAR_ASSET_MISSING: 'AVATAR_ASSET_MISSING',
  MOTION_ASSET_MISSING: 'MOTION_ASSET_MISSING',
  PRODUCTION_NOT_READY: 'PRODUCTION_NOT_READY',
  PRODUCTION_ASSET_SAVE_FAILED: 'PRODUCTION_ASSET_SAVE_FAILED',
  DEEPMOTION_API_KEY_MISSING: 'DEEPMOTION_API_KEY_MISSING',
  DEEPMOTION_AUTH_FAILED: 'DEEPMOTION_AUTH_FAILED',
  DEEPMOTION_JOB_CREATE_FAILED: 'DEEPMOTION_JOB_CREATE_FAILED',
  DEEPMOTION_JOB_FAILED: 'DEEPMOTION_JOB_FAILED',
  DEEPMOTION_OUTPUT_FAILED: 'DEEPMOTION_OUTPUT_FAILED',
  MOTION_OUTPUT_INVALID: 'MOTION_OUTPUT_INVALID',
  MEMBER_TRACK_MAPPING_REQUIRED: 'MEMBER_TRACK_MAPPING_REQUIRED',
  GROUP_MODE_MOTION_EXTRACTION_FORBIDDEN: 'GROUP_MODE_MOTION_EXTRACTION_FORBIDDEN',
  GROUP_MODE_MEDIAPIPE_FORBIDDEN: 'GROUP_MODE_MEDIAPIPE_FORBIDDEN',
} as const;
