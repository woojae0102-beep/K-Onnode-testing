// @ts-nocheck
/**
 * Motion Extraction 멤버 수 부족 RCA — 계측 전용 (알고리즘 변경 없음).
 * 콘솔 필터: [MotionRCA]
 */
import { CHOREO_MIN_PERSON_CONFIDENCE } from '../config/choreoExtractConfig';

const LOG_PREFIX = '[MotionRCA]';

export type MotionRcaSummaryInput = {
  expectedMembers: number;
  observedMembers: number;
  peakTrack: number;
  mappedTracks: number;
  totalDroppedFrames: number;
  averageDetectedPersons: number;
  averageTrackedPersons: number;
};

type HungarianReject = {
  prevTrackId: number;
  currIdx: number;
  cost: number;
  threshold: number;
  reason: string;
};

type ConfidenceRemoval = {
  frameIndex: number;
  timestamp: number;
  detectionIdx: number;
  confidence: number;
  threshold: number;
  reason: string;
};

export class MotionExtractionRcaSession {
  expectedMembers = 0;
  frameCount = 0;

  private sumDetectedPersons = 0;
  private sumTrackedPersons = 0;
  private peakDetectedPersons = 0;
  private peakTrackedPersons = 0;

  /** RCA 점수 누적 (기여도 % 추정용) */
  private scoreDetectorMiss = 0;
  private scoreTrackingLoss = 0;
  private scoreHungarian = 0;
  private scoreConfidence = 0;
  private scoreQueueOverflow = 0;

  private totalHungarianRejects = 0;
  private totalConfidenceRemovals = 0;
  private totalTrackingRemoved = 0;
  private totalOccludedTrackFrames = 0;
  private totalQueueOverflows = 0;
  private totalSamplerDrops = 0;

  setExpectedMembers(n: number) {
    this.expectedMembers = Math.max(0, Number(n) || 0);
  }

  /** ① MediaPipe Detector */
  recordDetector(frameIndex: number, timestamp: number, detectedPersons: number, rawLandmarks?: number) {
    this.frameCount += 1;
    this.sumDetectedPersons += detectedPersons;
    this.peakDetectedPersons = Math.max(this.peakDetectedPersons, detectedPersons);
    if (this.expectedMembers > 0 && detectedPersons < this.expectedMembers) {
      this.scoreDetectorMiss += this.expectedMembers - detectedPersons;
    }
    console.info(`${LOG_PREFIX}:①Detector`, {
      frameIndex,
      timestamp: Number(timestamp.toFixed(3)),
      detectedPersons,
      rawLandmarks: rawLandmarks ?? detectedPersons,
    });
  }

  /** ② MemberTrackingEngine */
  recordTracking(frameIndex: number, timestamp: number, payload: {
    activeTracks: number;
    newTracks: number[];
    removedTracks: number[];
    matchedTracks: number[];
    occludedTracks: number[];
    visibleTracks: number;
    outputTrackCount: number;
  }) {
    this.sumTrackedPersons += payload.outputTrackCount;
    this.peakTrackedPersons = Math.max(this.peakTrackedPersons, payload.visibleTracks);

    this.totalTrackingRemoved += payload.removedTracks.length;
    this.totalOccludedTrackFrames += payload.occludedTracks.length;
    this.scoreTrackingLoss += payload.removedTracks.length * 3;
    this.scoreTrackingLoss += payload.occludedTracks.length;

    if (payload.newTracks.length && payload.matchedTracks.length < payload.activeTracks) {
      this.scoreTrackingLoss += 0.5;
    }

    console.info(`${LOG_PREFIX}:②Tracking`, {
      frameIndex,
      timestamp: Number(timestamp.toFixed(3)),
      activeTracks: payload.activeTracks,
      newTracks: payload.newTracks,
      removedTracks: payload.removedTracks,
      matchedTracks: payload.matchedTracks,
      occludedTracks: payload.occludedTracks,
      visibleTracks: payload.visibleTracks,
      outputTrackCount: payload.outputTrackCount,
    });
  }

  /** ③ Hungarian Matching */
  recordHungarian(frameIndex: number, timestamp: number, payload: {
    costMatrixRows: number;
    costMatrixCols: number;
    assignment: number[];
    threshold: number;
    rejects: HungarianReject[];
  }) {
    this.totalHungarianRejects += payload.rejects.length;
    this.scoreHungarian += payload.rejects.length * 2;

    console.info(`${LOG_PREFIX}:③Hungarian`, {
      frameIndex,
      timestamp: Number(timestamp.toFixed(3)),
      costMatrixSize: `${payload.costMatrixRows}x${payload.costMatrixCols}`,
      assignment: payload.assignment,
      threshold: Number(payload.threshold.toFixed(4)),
      rejectCount: payload.rejects.length,
      rejects: payload.rejects.slice(0, 8).map((r) => ({
        prevTrackId: r.prevTrackId,
        currIdx: r.currIdx,
        cost: Number(r.cost.toFixed(4)),
        threshold: Number(r.threshold.toFixed(4)),
        reason: r.reason,
      })),
    });
  }

  /** ④ Confidence Filter — 사람(검출) 단위 제거 */
  recordConfidenceRemoval(removal: ConfidenceRemoval) {
    this.totalConfidenceRemovals += 1;
    this.scoreConfidence += 1.5;
    console.info(`${LOG_PREFIX}:④Confidence`, {
      frameIndex: removal.frameIndex,
      timestamp: Number(removal.timestamp.toFixed(3)),
      memberId: `detection#${removal.detectionIdx}`,
      confidence: Number(removal.confidence.toFixed(4)),
      threshold: removal.threshold,
      reason: removal.reason,
    });
  }

  /** ⑤ Queue Overflow */
  recordQueue(frameIndex: number, timestamp: number, payload: {
    queueLength: number;
    droppedFrames: number;
    overflowCount: number;
    workerProcessingTimeMs?: number;
    stage?: string;
  }) {
    if (payload.overflowCount > 0 || payload.droppedFrames > 0) {
      this.totalQueueOverflows += payload.overflowCount;
      this.scoreQueueOverflow += payload.overflowCount * 4 + payload.droppedFrames;
    }
    console.info(`${LOG_PREFIX}:⑤Queue`, {
      frameIndex,
      timestamp: Number(timestamp.toFixed(3)),
      stage: payload.stage ?? 'pipeline',
      queueLength: payload.queueLength,
      droppedFrames: payload.droppedFrames,
      overflowCount: payload.overflowCount,
      workerProcessingTimeMs: payload.workerProcessingTimeMs != null
        ? Math.round(payload.workerProcessingTimeMs)
        : undefined,
    });
  }

  recordSamplerDrop(droppedTotal: number) {
    this.totalSamplerDrops = Math.max(this.totalSamplerDrops, droppedTotal);
  }

  /** ⑥ 종료 Summary + ROOT CAUSE */
  dumpSummaryAndRca(input: MotionRcaSummaryInput) {
    const avgDetected = this.frameCount > 0
      ? this.sumDetectedPersons / this.frameCount
      : input.averageDetectedPersons;
    const avgTracked = this.frameCount > 0
      ? this.sumTrackedPersons / this.frameCount
      : input.averageTrackedPersons;

    console.info(`${LOG_PREFIX}:⑥Summary`, {
      expectedMembers: input.expectedMembers,
      observedMembers: input.observedMembers,
      peakTrack: input.peakTrack,
      mappedTracks: input.mappedTracks,
      totalDroppedFrames: input.totalDroppedFrames,
      averageDetectedPersons: Number(avgDetected.toFixed(2)),
      averageTrackedPersons: Number(avgTracked.toFixed(2)),
      peakDetectedPersons: this.peakDetectedPersons,
      peakTrackedPersons: this.peakTrackedPersons,
      totalHungarianRejects: this.totalHungarianRejects,
      totalConfidenceRemovals: this.totalConfidenceRemovals,
      totalTrackingRemoved: this.totalTrackingRemoved,
      totalOccludedTrackFrames: this.totalOccludedTrackFrames,
      totalQueueOverflows: this.totalQueueOverflows,
      totalSamplerDrops: this.totalSamplerDrops,
      framesLogged: this.frameCount,
    });

    const contributions = this.estimateContributions(input);
    const lines = [
      '========================',
      'ROOT CAUSE',
      '',
      `MediaPipe Detection 문제: ${contributions.detectorPct}%`,
      `Tracking Loss 문제: ${contributions.trackingPct}%`,
      `Hungarian Matching 문제: ${contributions.hungarianPct}%`,
      `Confidence Filter 문제: ${contributions.confidencePct}%`,
      `Queue Overflow 문제: ${contributions.queuePct}%`,
      '',
      `예) Queue Overflow: ${contributions.queuePct}%`,
      `    Tracking Loss: ${contributions.trackingPct}%`,
      `    Detector Miss: ${contributions.detectorPct}%`,
      '========================',
    ];
    console.info(`${LOG_PREFIX} RCA\n${lines.join('\n')}`);
    console.table({
      'Motion RCA Contributions (%)': {
        'Detector Miss': contributions.detectorPct,
        'Tracking Loss': contributions.trackingPct,
        'Hungarian Matching': contributions.hungarianPct,
        'Confidence Filter': contributions.confidencePct,
        'Queue Overflow': contributions.queuePct,
      },
    });

    return contributions;
  }

  private estimateContributions(input: MotionRcaSummaryInput) {
    let detector = this.scoreDetectorMiss;
    let tracking = this.scoreTrackingLoss;
    let hungarian = this.scoreHungarian;
    let confidence = this.scoreConfidence;
    let queue = this.scoreQueueOverflow;

    if (detector <= 0 && this.peakDetectedPersons < input.expectedMembers) {
      detector = (input.expectedMembers - this.peakDetectedPersons) * Math.max(1, this.frameCount * 0.05);
    }
    if (tracking <= 0 && input.peakTrack < input.expectedMembers) {
      tracking = (input.expectedMembers - input.peakTrack) * 10;
    }
    if (queue <= 0 && (input.totalDroppedFrames > 0 || this.totalQueueOverflows > 0)) {
      queue = input.totalDroppedFrames + this.totalQueueOverflows * 5;
    }

    const total = detector + tracking + hungarian + confidence + queue;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

    return {
      detectorPct: pct(detector),
      trackingPct: pct(tracking),
      hungarianPct: pct(hungarian),
      confidencePct: pct(confidence),
      queuePct: pct(queue),
    };
  }
}

let activeSession: MotionExtractionRcaSession | null = null;

export function createMotionExtractionRcaSession(expectedMembers: number): MotionExtractionRcaSession {
  activeSession = new MotionExtractionRcaSession();
  activeSession.setExpectedMembers(expectedMembers);
  return activeSession;
}

export function getMotionExtractionRcaSession(): MotionExtractionRcaSession | null {
  return activeSession;
}

export function clearMotionExtractionRcaSession() {
  activeSession = null;
}

export function motionRcaConfidenceThreshold() {
  return CHOREO_MIN_PERSON_CONFIDENCE;
}
