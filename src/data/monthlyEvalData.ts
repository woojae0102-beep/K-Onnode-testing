// 월말 평가 시스템 데이터 타입 정의
// 모든 타입은 "연습생 인생 시뮬레이터" 몰입 경험을 기반으로 설계.

export type AgencyId = 'hybe' | 'yg' | 'jyp' | 'sm' | 'starship';

export const AGENCY_IDS: AgencyId[] = ['hybe', 'yg', 'jyp', 'sm', 'starship'];

export const AGENCY_LABELS: Record<AgencyId, string> = {
  hybe: 'HYBE',
  yg: 'YG',
  jyp: 'JYP',
  sm: 'SM',
  starship: 'Starship',
};

export const AGENCY_COLORS: Record<AgencyId, string> = {
  hybe: '#7C3AED',
  yg: '#111111',
  jyp: '#22C55E',
  sm: '#0EA5E9',
  starship: '#FF1F8E',
};

export type SessionType = 'dance' | 'vocal' | 'korean' | 'audition';

export interface SessionRecord {
  type: SessionType;
  score: number;
  duration: number;
  weakness?: string[];
  strength?: string[];
  date: number; // epoch ms
}

export interface DanceMonthlyStats {
  sessions: number;
  avgScore: number;
  improvement: number;
  topWeakness: string;
  topStrength: string;
  consistencyScore: number;
  bestSessionScore: number;
}

export interface VocalMonthlyStats {
  sessions: number;
  avgPitchAccuracy: number;
  breathingStability: number;
  improvement: number;
  topWeakness: string;
  topStrength: string;
  liveAbility: number;
}

export interface KoreanMonthlyStats {
  sessions: number;
  pronunciation: number;
  intonation: number;
  improvement: number;
  topWeakness: string;
}

export interface AuditionMonthlyStats {
  attempts: number;
  bestResult: 'pass' | 'conditional' | 'pending' | 'fail';
  agencyResults: Record<string, string>;
  interviewScore: number;
}

export interface ConsistencyStats {
  weeklyAttendance: number;
  totalDays: number;
  streakDays: number;
  lateDays: number;
}

export interface MonthlyAccumulatedData {
  month: string; // "2026-04"
  userId: string;
  dance: DanceMonthlyStats;
  vocal: VocalMonthlyStats;
  korean: KoreanMonthlyStats;
  audition: AuditionMonthlyStats;
  consistency: ConsistencyStats;
  previousMonths: MonthlyResult[];
}

export type GrowthRate = 'very_fast' | 'fast' | 'normal' | 'slow';
export type StagePresence = 'S' | 'A' | 'B' | 'C';
export type Marketability = 'very_high' | 'high' | 'medium' | 'low';

export interface TraineeAIProfile {
  traineeType: string;
  mainStrength: string;
  mainWeakness: string;
  growthRate: GrowthRate;
  stagePresence: StagePresence;
  marketability: Marketability;
  primaryPosition: string;
  potentialPositions: string[];
  personalityTag: string;
  growthNarrative: string;
  specialNote?: string;
}

export type Tone = 'positive' | 'critical' | 'neutral' | 'impressed' | 'conflicted';
export type AgencyGrade = 'S' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D';

export interface JudgeComment {
  judgeId: string;
  judgeName: string;
  agency?: AgencyId;
  avatar: string;
  comment: string;
  tone: Tone;
}

export interface AgencyEvaluation {
  agencyId: AgencyId;
  agencyName?: string;
  overallGrade: AgencyGrade;
  passRate: number;
  judgeComments: JudgeComment[];
  focusCriteria: string[];
  verdict: string;
  recommendation: string;
  gradeReason?: string;
}

export interface DebateLine {
  speaker: string;
  agency: string;
  avatar: string;
  line: string;
  tone: Tone;
  pauseBefore?: number;
}

export interface JudgeDebate {
  debateLines: DebateLine[];
  keyConflict: string;
  consensus: string;
  finalSummary: string;
}

export type SurvivalStatus = 'debut_candidate' | 'top30' | 'hold' | 'danger' | 'eliminated';

export interface PositionChange {
  position: string;
  change: 'up' | 'down' | 'stable' | 'new';
  detail: string;
}

export interface GroupMatch {
  primaryGroup: string;
  reason: string;
  alternativeGroup: string;
}

export interface HistoryEntry {
  month: string;
  event: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export interface MonthlyResult {
  month: string;
  overallGrade: AgencyGrade;
  overallScore: number;
  survivalStatus: SurvivalStatus;
  survivalMessage?: string;
  debutProbability: number;
  debutProbabilityChange: number;
  debutProbabilityMessage?: string;
  positionChanges: PositionChange[];
  agencyPassRates: Record<string, number>;
  biggestGrowth: string;
  biggestIssue: string;
  aiJudgeSummary: string;
  nextMonthGoals: string[];
  groupMatch: GroupMatch;
  traineeHistory: HistoryEntry[];
  specialAward?: string | null;
  emotionalMessage?: string;
}

export type EvalPhase =
  | 'countdown'
  | 'profile'
  | 'agency_evals'
  | 'debate'
  | 'final'
  | 'complete';
