// @ts-nocheck
import type { DetectionFrame } from './MultiPersonTracker';

export interface AnalysisResult {
  detectedMemberCount: number;
  /** 분석 중 관측된 최대 동시 트랙 수 */
  peakTrackCount?: number;
  frames: DetectionFrame[];
  trackIdToInitialPosition: Map<number, { x: number; y: number }>;
  /** 원본 영상 픽셀 크기 */
  videoWidth?: number;
  videoHeight?: number;
}
