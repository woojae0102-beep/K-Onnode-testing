export interface JointPosition {
  x: number;
  y: number;
  confidence: number;
}

export interface FrameData {
  timestamp: number;
  joints: Record<string, JointPosition>;
}

export interface DanceAnalysisResult {
  overallAccuracy: number;
  frameComparisons: Array<{
    timestamp: number;
    accuracy: number;
    jointAccuracies: Record<string, number>;
    worstJoint?: string;
  }>;
  topProblems: string[];
  feedback: { overall: string; problems: string[]; praise: string };
  bestMoments: number[];
  worstMoments: number[];
}

export interface TeachingComment {
  problemJoint: string;
  instruction: string;
  personaStyle: string;
}

export interface VocalAnalysisResult {
  pitchSeries: Array<{ time: number; midi: number; cents: number }>;
  targetPitchSeries: Array<{ time: number; midi: number }>;
  lyrics: Array<{ text: string; start: number; end: number; match: boolean }>;
  overallPitchScore: number;
  transcript?: string;
}

export interface KoreanAnalysisResult {
  transcript: string;
  referenceText: string;
  accuracy: number;
  problemSyllables: string[];
  waveform: number[];
  correctedText: string;
}
