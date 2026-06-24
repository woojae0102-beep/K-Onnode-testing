// @ts-nocheck
import type { SkeletonFrameData } from './groupPractice';

/** danceData/group/{groupId}/{songId}/ 스키마 */

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
  slots: FormationSlot[];
}

export interface FormationTimeline {
  groupId: string;
  songId: string;
  userMemberId: string;
  defaultFormation: string;
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
  groupId: string;
  songId: string;
  videoId?: string;
  detectedMemberCount: number;
  durationSec: number;
  sampleFps: number;
  bpm: DanceBpmMeta;
  skeletonFrames: SkeletonFrameData[];
  memberTracks: MemberTrackMeta[];
  formation: FormationTimeline;
  positionMap: PositionMap;
  formationHole: FormationHole;
  savedAt: string;
}
