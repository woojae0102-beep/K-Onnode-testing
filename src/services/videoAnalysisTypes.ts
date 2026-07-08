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
  /** 원본 영상 실제 길이(초) — 연습 타임라인 기준 */
  sourceVideoDurationSec?: number;
  /** 영상 native FPS (감지 실패 시 null) */
  sourceVideoNativeFps?: number | null;
  /** Motion Extraction 샘플 FPS — 추출 고정 30 */
  sampleFps?: number;
}
