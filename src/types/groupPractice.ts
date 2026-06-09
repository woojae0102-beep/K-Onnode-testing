// @ts-nocheck
export interface JointPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface SkeletonMemberData {
  personIndex: number;
  joints: Record<string, JointPoint>;
  estimatedMemberId: string | null;
}

export interface SkeletonFrameData {
  timestamp: number;
  members: SkeletonMemberData[];
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
  | 'group_select'
  | 'member_select'
  | 'video_upload'
  | 'extracting'
  | 'ready'
  | 'practicing'
  | 'result';

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
