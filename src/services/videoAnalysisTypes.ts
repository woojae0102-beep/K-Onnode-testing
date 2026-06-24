// @ts-nocheck
import type { DetectionFrame } from './MultiPersonTracker';

export interface AnalysisResult {
  detectedMemberCount: number;
  frames: DetectionFrame[];
  trackIdToInitialPosition: Map<number, { x: number; y: number }>;
}

export default AnalysisResult;
