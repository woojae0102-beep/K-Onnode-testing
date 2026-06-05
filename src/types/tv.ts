// @ts-nocheck
export type Agency = 'hybe' | 'jyp' | 'sm' | 'yg';
export type TrainingMode = 'dance' | 'vocal';

export interface JointData {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseData {
  joints: Record<string, JointData>;
  jointAccuracies: Record<string, number>;
  timestamp: number;
}

export interface ScoreData {
  rhythm: number;
  posture: number;
  angle: number;
  expression: number;
  energy: number;
  stability: number;
}

export type FeedbackType = 'correction' | 'praise' | 'coaching';

export interface FeedbackItem {
  type: FeedbackType;
  message: string;
  accuracy?: number;
  timestamp: string;
  joint?: string;
  isAI?: boolean;
}

export interface SessionData {
  overallScore: number;
  scores: ScoreData;
  sessionTime: number;
  agency: Agency;
  mode: TrainingMode;
  growthRate: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  passProbability: number;
}

export const AGENCY_COLORS: Record<Agency, string> = {
  hybe: '#6C5CE7',
  jyp: '#FF6348',
  sm: '#E91E63',
  yg: '#FFD700',
};

export const AGENCY_JUDGE_IDS: Record<Agency, string> = {
  hybe: 'hybe-junhyuk',
  jyp: 'jyp-minji',
  sm: 'sm-yujin',
  yg: 'yg-narae',
};
