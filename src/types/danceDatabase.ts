// @ts-nocheck
import type { SkeletonFrameData, SkeletonData } from './groupPractice';

/** danceData/group/{groupId}/{songId}/ 스키마 */

export type FormationType =
  | 'diamond'
  | 'line'
  | 'circle'
  | 'triangle'
  | 'v_shape'
  | 'scatter'
  | 'unknown';

export type FormationTransition = 'cut' | 'morph' | 'step';

import type { MemberMotionTimeline } from '../services/motion/MotionTimelineEngine';

export interface DanceBpmMeta {
  bpm: number;
  estimated: boolean;
  source: 'song' | 'analysis' | 'default';
}

export interface MemberTrackMeta {
  trackId: number;
  memberId: string | null;
  initialPosition: { x: number; y: number };
  avgConfidence: number;
}

export interface FormationSlot {
  memberId: string | null;
  trackId: number | null;
  x: number;
  y: number;
  z: number;
  isUserSlot: boolean;
  isEmpty: boolean;
}

export interface FormationKeyframe {
  timestamp: number;
  /** 감지된 대형 타입 — defaultX/defaultY 아님 */
  formationType?: FormationType;
  rotation?: number;
  spacing?: number;
  transition?: FormationTransition;
  slots: FormationSlot[];
}

/** 곡 구간별 대형 — 0:00 Diamond → 0:14 Line 등 */
export interface FormationSegment {
  startTime: number;
  endTime: number;
  formationType: FormationType;
  rotation: number;
  spacing: number;
  transition: FormationTransition;
  slots: FormationSlot[];
}

export interface FormationTimeline {
  groupId: string;
  songId: string;
  userMemberId: string;
  defaultFormation: string;
  /** 구간별 대형 타임라인 */
  segments: FormationSegment[];
  keyframes: FormationKeyframe[];
}

export interface PositionMap {
  userMemberId: string;
  aiMemberIds: string[];
  trackToMember: Record<number, string>;
  memberToTrack: Record<string, number>;
}

export interface FormationHole {
  memberId: string;
  anchor: { x: number; y: number; z: number };
  label: string;
  color: string;
}

export interface DanceDatabase {
  version: '2.0';
  /** GroupMotionPipeline 적용 버전 — 3.0 이상이면 재후처리 스킵 */
  pipelineVersion?: string;
  motionPipelineAudit?: import('../services/motion/GroupMotionPipeline').MotionPipelineAudit;
  groupId: string;
  songId: string;
  videoId?: string;
  detectedMemberCount: number;
  durationSec: number;
  /** 원본 업로드/참조 영상 전체 길이(초) */
  sourceVideoDurationSec?: number;
  /** 스켈레톤이 실제 커버하는 길이(초) */
  skeletonCoverageSec?: number;
  sampleFps: number;
  /** 추출 스켈레톤 메타 — fps · duration · frameCount */
  skeletonData?: SkeletonData;
  bpm: DanceBpmMeta;
  skeletonFrames: SkeletonFrameData[];
  memberTracks: MemberTrackMeta[];
  formation: FormationTimeline;
  /** 멤버별 Motion Timeline — 실제 그룹 연습 데이터 */
  motionTimelines?: MemberMotionTimeline[];
  positionMap: PositionMap;
  formationHole: FormationHole;
  savedAt: string;
}
