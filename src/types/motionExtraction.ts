// @ts-nocheck
import type { DanceDatabase } from './danceDatabase';
import type { SkeletonData, SkeletonFrameData } from './groupPractice';
import type { AnalysisResult } from '../services/videoAnalysisTypes';

/** 실시간 추출 디버그 — Debug Overlay / 콘솔 출력용 */
export interface MotionExtractionDebugState {
  frameIndex: number;
  timestamp: number;
  sourceVideoTime: number;
  /** RVFC 실측 FPS */
  measuredFps: number;
  /** 추출 샘플 FPS (30~60) */
  sampleFps: number;
  nativeFps: number | null;
  progress: number;
  pipelineStage: string;
  rawPoseCount: number;
  handCount: number;
  faceCount: number;
  trackedCount: number;
  visibleCount: number;
  estimatedCount: number;
  expectedMemberCount: number;
  missingMemberCount: number;
  trackingIds: number[];
  avgConfidence: number;
  poseQuality: number | null;
  beat: number | null;
  beatIndex: number | null;
  formation: string | null;
  interpolationHold: boolean;
  timelineDuration: number;
  timelineFrameIndex: number;
  timelineTotalFrames: number;
  /** 현재 프레임에서 유지 중인 trackId 목록 (실감지 + 보강 포함) */
  currentTrackedMembers: number[];
  /** 이번 프레임에서 lastDetectedPeople로부터 보간한 trackId 목록 */
  missingMembers: number[];
  /** Worker에 전송했으나 아직 FRAME_BUFFERED로 확인되지 않은 대기열 길이 */
  workerQueue: number;
  /** Frame Processing Lock — 이전 프레임 처리 중 새 샘플이 드롭되었는지 */
  processingFrame: boolean;
  /** 직전 프레임 처리(detect+track+worker dispatch)에 걸린 시간(ms) */
  processingDelay: number;
  /** 가려짐 초과로 소멸된 트랙 누적 수 */
  trackerResetCount: number;
  /** Track Stability 보정으로 되돌린 trackId 변경 누적 수 */
  trackIdChanges: number;
  /** 현재까지 진행된 Coverage 추정치 (0~1) */
  coverage: number;
  /** 마지막으로 처리된 원본 영상 시각(초) */
  lastTimestamp: number;
  /** RVFC 콜백이 실제 도착하는 속도(fps) — Processing 지연과 무관한 Producer 단독 측정값 */
  rvfcFps: number;
  /** Processing Queue backlog — 이 프레임을 꺼낸 시점에 남아있던 나머지 프레임 수 */
  queueLength: number;
  /** 이 프레임이 캡처된 뒤 Processing Queue에서 대기한 시간(ms) */
  queueDelay: number;
  /** Worker postMessage → FRAME_BUFFERED ack까지의 왕복 시간(ms, EMA) */
  workerDelay: number;
  /** MediaPipe detect() 단일 호출에 걸린 시간(ms) */
  mediaPipeDelay: number;
  /** Processing Queue Overflow로 드롭된 누적 프레임 수 */
  droppedFrames: number;
  /** Track Stability — 지금까지 프레임 대비 되돌린 trackId 변경 비율의 역수(0~1) */
  trackStability: number;
  /** 이번 추출/조회가 캐시에서 왔는지 여부 */
  cacheUsed: boolean;
  /** 캐시 사용 시 해당 캐시의 Timeline Coverage (0~1) — 캐시 미사용 시 null */
  cacheCoverage: number | null;
  /** Frame Buffer(추출 중 frames[]) 추정 메모리(MB) — Chrome 계열 외에는 null */
  frameBufferMemoryMb: number | null;
  /** DanceDatabase 저장 시점 추정 메모리(MB) — 추출 완료 후에만 값이 채워짐 */
  danceDatabaseMemoryMb: number | null;
  /** Worker(들)가 자체 보고한 heap 합계(MB) — Chrome 계열 외에는 null */
  workerMemoryMb: number | null;
  /** Canvas Pool(RGBA) 추정 메모리(MB) — 정확 계산(근사 아님) */
  canvasMemoryMb: number | null;
  /** 실행 중 관측된 메인 스레드 Peak Heap(MB) — Chrome 계열 외에는 null */
  peakHeapMb: number | null;
  /** GC 발생 추정 횟수(휴리스틱 — 표준 GC 이벤트 API가 없어 heap 급락 감지로 근사) */
  gcFrequency: number;
}

export interface ReferenceVideoMeta {
  blobCacheKey: string | null;
  localPlaybackUrl: string | null;
  durationSec: number;
  mimeType?: string;
  sizeBytes?: number;
}

export interface MotionExtractionResult {
  danceDatabase: DanceDatabase;
  frames: SkeletonFrameData[];
  /** 추출 스켈레톤 메타 — fps · duration · frameCount */
  skeletonData: SkeletonData;
  analysisResult: AnalysisResult;
  fromCache: boolean;
  referenceVideo: ReferenceVideoMeta;
  songId: string;
  groupId: string;
  userMemberId: string;
}

export const EMPTY_MOTION_DEBUG: MotionExtractionDebugState = {
  frameIndex: 0,
  timestamp: 0,
  sourceVideoTime: 0,
  measuredFps: 0,
  sampleFps: 30,
  nativeFps: null,
  progress: 0,
  pipelineStage: 'idle',
  rawPoseCount: 0,
  handCount: 0,
  faceCount: 0,
  trackedCount: 0,
  visibleCount: 0,
  estimatedCount: 0,
  expectedMemberCount: 0,
  missingMemberCount: 0,
  trackingIds: [],
  avgConfidence: 0,
  poseQuality: null,
  beat: null,
  beatIndex: null,
  formation: null,
  interpolationHold: false,
  timelineDuration: 0,
  timelineFrameIndex: 0,
  timelineTotalFrames: 0,
  currentTrackedMembers: [],
  missingMembers: [],
  workerQueue: 0,
  processingFrame: false,
  processingDelay: 0,
  trackerResetCount: 0,
  trackIdChanges: 0,
  coverage: 0,
  lastTimestamp: 0,
  rvfcFps: 0,
  queueLength: 0,
  queueDelay: 0,
  workerDelay: 0,
  mediaPipeDelay: 0,
  droppedFrames: 0,
  trackStability: 1,
  cacheUsed: false,
  cacheCoverage: null,
  frameBufferMemoryMb: null,
  danceDatabaseMemoryMb: null,
  workerMemoryMb: null,
  canvasMemoryMb: null,
  peakHeapMb: null,
  gcFrequency: 0,
};
