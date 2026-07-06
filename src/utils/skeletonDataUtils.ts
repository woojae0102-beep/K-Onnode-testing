// @ts-nocheck
import type {
  JointPoint,
  SkeletonBoundingBox,
  SkeletonFrameData,
  SkeletonFrameMemberTrack,
  SkeletonMemberData,
  SkeletonWorldPoint,
} from '../types/groupPractice';
import type { FormationKeyframe, MemberTrackMeta } from '../types/danceDatabase';
import {
  buildFieldError,
  logPracticeValidationTable,
  logValidationFieldErrors,
  type ValidationFieldError,
} from './practiceValidationDebug';

/** Map / plain object / JSON 복원 모두 → Map<number, string> */
export function normalizeTrackMemberMap(
  input: Map<number, string> | Record<string | number, string> | null | undefined,
): Map<number, string> {
  const out = new Map<number, string>();
  if (!input) return out;

  if (input instanceof Map) {
    input.forEach((memberId, trackId) => {
      if (memberId) out.set(Number(trackId), String(memberId));
    });
    return out;
  }

  Object.entries(input).forEach(([trackId, memberId]) => {
    if (memberId) out.set(Number(trackId), String(memberId));
  });
  return out;
}

export function normalizePositionMap(
  input: Map<number, { x: number; y: number }> | Record<string, { x: number; y: number }> | null | undefined,
): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  if (!input) return out;

  if (input instanceof Map) {
    input.forEach((pos, trackId) => out.set(Number(trackId), pos));
    return out;
  }

  Object.entries(input).forEach(([trackId, pos]) => {
    if (pos) out.set(Number(trackId), pos);
  });
  return out;
}

/**
 * 관절 데이터 존재 여부 (visibility/confidence로 삭제하지 않음).
 * 좌표가 0이어도 키가 있으면 멤버를 유지한다.
 */
function hasUsableJoints(joints: Record<string, unknown> | null | undefined): boolean {
  if (!joints || typeof joints !== 'object') return false;
  return Object.keys(joints).length > 0;
}

function normalizeJointPoint(joint: any): JointPoint {
  return {
    x: Number(joint?.x) || 0,
    y: Number(joint?.y) || 0,
    z: Number(joint?.z) || 0,
    visibility: joint?.visibility ?? joint?.confidence ?? 1,
    presence: joint?.presence,
    confidence: joint?.confidence ?? joint?.visibility ?? 1,
  };
}

function jointsToWorldCoordinates(
  joints: Record<string, JointPoint>,
): Record<string, SkeletonWorldPoint> {
  const out: Record<string, SkeletonWorldPoint> = {};
  Object.entries(joints).forEach(([name, joint]) => {
    out[name] = {
      x: joint.x,
      y: joint.y,
      z: joint.z ?? 0,
      visibility: joint.visibility,
      confidence: joint.confidence ?? joint.visibility,
    };
  });
  return out;
}

export function computeBoundingBoxFromJoints(
  joints: Record<string, JointPoint> | Record<string, SkeletonWorldPoint>,
): SkeletonBoundingBox | undefined {
  const points = Object.values(joints || {});
  if (!points.length) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach((p) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  if (!Number.isFinite(minX)) return undefined;
  return { minX, minY, maxX, maxY };
}

function averageJointConfidence(joints: Record<string, JointPoint>): number {
  const values = Object.values(joints)
    .map((j) => j.confidence ?? j.visibility)
    .filter((v) => v != null && Number.isFinite(v));
  if (!values.length) return 1;
  return values.reduce((sum, v) => sum + Number(v), 0) / values.length;
}

function buildFrameMemberTracks(members: SkeletonMemberData[]): SkeletonFrameMemberTrack[] {
  return members.map((m) => ({
    trackId: Number(m.trackId ?? m.personIndex ?? 0),
    memberId: m.estimatedMemberId,
    confidence: m.confidence ?? averageJointConfidence(m.joints),
    initialPosition: m.boundingBox
      ? { x: (m.boundingBox.minX + m.boundingBox.maxX) / 2, y: (m.boundingBox.minY + m.boundingBox.maxY) / 2 }
      : undefined,
  }));
}

function mergeFrameBoundingBoxes(members: SkeletonMemberData[]): SkeletonBoundingBox | undefined {
  const boxes = members.map((m) => m.boundingBox).filter(Boolean) as SkeletonBoundingBox[];
  if (!boxes.length) return computeBoundingBoxFromJoints(members[0]?.joints || {});
  return boxes.reduce(
    (acc, box) => ({
      minX: Math.min(acc.minX, box.minX),
      minY: Math.min(acc.minY, box.minY),
      maxX: Math.max(acc.maxX, box.maxX),
      maxY: Math.max(acc.maxY, box.maxY),
    }),
    boxes[0],
  );
}

/** 좌표만 정규화. Metadata(formation, memberTracks, confidence 등)는 삭제하지 않음 */
export function normalizeSkeletonMember(raw: any): SkeletonMemberData | null {
  if (!raw) return null;

  const trackId = Number(raw.trackId ?? raw.personIndex ?? NaN);
  const estimatedMemberId =
    raw.estimatedMemberId
    || raw.memberId
    || raw.id
    || (Number.isFinite(trackId) ? `track_${trackId}` : null);

  if (!estimatedMemberId && !hasUsableJoints(raw.joints) && !raw.boundingBox && !raw.worldCoordinates) {
    return null;
  }

  const joints = raw.joints || {};
  const normalizedJoints: SkeletonMemberData['joints'] = {};
  Object.entries(joints).forEach(([name, joint]: [string, any]) => {
    if (!joint) return;
    normalizedJoints[name] = normalizeJointPoint(joint);
  });

  const worldCoordinates =
    raw.worldCoordinates && typeof raw.worldCoordinates === 'object'
      ? Object.fromEntries(
          Object.entries(raw.worldCoordinates).map(([name, pt]: [string, any]) => [
            name,
            {
              x: Number(pt?.x) || 0,
              y: Number(pt?.y) || 0,
              z: Number(pt?.z) || 0,
              visibility: pt?.visibility ?? pt?.confidence,
              confidence: pt?.confidence ?? pt?.visibility,
            },
          ]),
        )
      : jointsToWorldCoordinates(normalizedJoints);

  const boundingBox =
    raw.boundingBox
      ? {
          minX: Number(raw.boundingBox.minX) || 0,
          minY: Number(raw.boundingBox.minY) || 0,
          maxX: Number(raw.boundingBox.maxX) || 0,
          maxY: Number(raw.boundingBox.maxY) || 0,
        }
      : computeBoundingBoxFromJoints(normalizedJoints);

  const confidence =
    raw.confidence != null && Number.isFinite(Number(raw.confidence))
      ? Number(raw.confidence)
      : averageJointConfidence(normalizedJoints);

  return {
    ...raw,
    personIndex: Number(raw.personIndex ?? raw.trackId ?? 0),
    trackId: Number.isFinite(trackId) ? trackId : Number(raw.personIndex ?? 0),
    estimatedMemberId: estimatedMemberId ? String(estimatedMemberId) : null,
    isEstimated: Boolean(raw.isEstimated),
    joints: normalizedJoints,
    confidence,
    boundingBox,
    worldCoordinates,
  };
}

/**
 * 스켈레톤 프레임 정규화 — 좌표만 보정하고 Frame Metadata는 유지한다.
 *
 * 유지 필드: timestamp, frameIndex, memberTracks, formation, confidence,
 * boundingBox, worldCoordinates, videoWidth, videoHeight, members[].*
 * 변경 필드: joints/worldCoordinates 숫자 좌표만 Number() 정규화
 */
export function normalizeSkeletonFrames(frames: SkeletonFrameData[] | null | undefined): SkeletonFrameData[] {
  if (!normalized.length) {
    logUndefinedFields('normalizeSkeletonFrames.input', { frames }, ['frames']);
    return [];
  }

  return frames
    .map((frame, frameIndex) => {
      const members = (frame.members || [])
        .map((m) => normalizeSkeletonMember(m))
        .filter(
          (m): m is SkeletonMemberData =>
            Boolean(
              m
              && (
                hasUsableJoints(m.joints)
                || m.estimatedMemberId
                || m.trackId != null
                || m.boundingBox
                || m.worldCoordinates
              ),
            ),
        );

      const memberTracks =
        frame.memberTracks?.length
          ? frame.memberTracks.map((t) => ({
              trackId: Number(t.trackId),
              memberId: t.memberId ?? null,
              confidence: Number(t.confidence) || 0,
              initialPosition: t.initialPosition,
            }))
          : buildFrameMemberTracks(members);

      const frameConfidence =
        frame.confidence != null && Number.isFinite(Number(frame.confidence))
          ? Number(frame.confidence)
          : members.length
            ? members.reduce((sum, m) => sum + (m.confidence ?? 1), 0) / members.length
            : 0;

      return {
        ...frame,
        timestamp: Number(frame.timestamp) || 0,
        timestampMs: frame.timestampMs ?? Math.round((Number(frame.timestamp) || 0) * 1000),
        frameIndex: frame.frameIndex ?? frameIndex,
        videoWidth: frame.videoWidth || 1920,
        videoHeight: frame.videoHeight || 1080,
        members,
        memberTracks,
        formation: frame.formation,
        confidence: frameConfidence,
        boundingBox: frame.boundingBox ?? mergeFrameBoundingBoxes(members),
        worldCoordinates: frame.worldCoordinates,
      };
    })
    .filter((frame) => frame.members.length > 0);
}

/** DanceDatabase memberTracks + formation keyframes를 프레임에 병합 */
export function attachSessionMetadataToFrames(
  frames: SkeletonFrameData[],
  {
    memberTracks = [],
    formationKeyframes = [],
  }: {
    memberTracks?: MemberTrackMeta[];
    formationKeyframes?: FormationKeyframe[];
  } = {},
): SkeletonFrameData[] {
  if (!frames.length) return frames;

  const trackMetaById = new Map(memberTracks.map((t) => [t.trackId, t]));
  const formationByTs = new Map(formationKeyframes.map((kf) => [kf.timestamp, kf]));

  return frames.map((frame, frameIndex) => {
    const formation =
      frame.formation
      ?? formationByTs.get(frame.timestamp)
      ?? findNearestFormationKeyframe(formationKeyframes, frame.timestamp);

    const memberTracksForFrame =
      frame.memberTracks?.length
        ? frame.memberTracks.map((t) => {
            const meta = trackMetaById.get(t.trackId);
            return {
              ...t,
              memberId: t.memberId ?? meta?.memberId ?? null,
              confidence: t.confidence ?? meta?.avgConfidence ?? t.confidence,
              initialPosition: t.initialPosition ?? meta?.initialPosition,
            };
          })
        : frame.members.map((m) => {
            const tid = Number(m.trackId ?? m.personIndex ?? 0);
            const meta = trackMetaById.get(tid);
            return {
              trackId: tid,
              memberId: m.estimatedMemberId ?? meta?.memberId ?? null,
              confidence: m.confidence ?? meta?.avgConfidence ?? 1,
              initialPosition: meta?.initialPosition,
            };
          });

    return {
      ...frame,
      frameIndex: frame.frameIndex ?? frameIndex,
      formation,
      formationType: frame.formationType ?? formation?.formationType,
      memberTracks: memberTracksForFrame,
    };
  });
}

function findNearestFormationKeyframe(
  keyframes: FormationKeyframe[],
  timestamp: number,
): FormationKeyframe | undefined {
  if (!keyframes.length) return undefined;
  return keyframes.reduce((nearest, kf) =>
    Math.abs(kf.timestamp - timestamp) < Math.abs(nearest.timestamp - timestamp) ? kf : nearest,
  );
}

/** normalize 전·후 멤버 수 비교 (AI 소실 디버그용) */
export function auditSkeletonPipeline(
  rawFrames: SkeletonFrameData[] | null | undefined,
  normalizedFrames: SkeletonFrameData[] | null | undefined,
  userMemberId: string,
) {
  const countMembers = (list: SkeletonFrameData[] | null | undefined) => {
    if (!list?.length) return { frames: 0, members: 0, ai: 0, estimated: 0 };
    let members = 0;
    let ai = 0;
    let estimated = 0;
    list.forEach((frame) => {
      frame.members?.forEach((m) => {
        members += 1;
        if (m.isEstimated) estimated += 1;
        if (m.estimatedMemberId && m.estimatedMemberId !== userMemberId) ai += 1;
      });
    });
    return { frames: list.length, members, ai, estimated };
  };

  const raw = countMembers(rawFrames);
  const normalized = countMembers(normalizedFrames);

  const audit = {
    rawFrameCount: raw.frames,
    rawMemberCount: raw.members,
    rawAiMemberCount: raw.ai,
    normalizedFrameCount: normalized.frames,
    normalizedMemberCount: normalized.members,
    normalizedAiMemberCount: normalized.ai,
    interpolatedMemberCount: normalized.estimated,
    metadataPreserved: countFramesWithMetadata(normalizedFrames),
  };

  if (import.meta.env?.DEV && raw.ai > 0 && normalized.ai < raw.ai) {
    console.warn('[skeletonPipeline] normalize 단계에서 AI 멤버 감소', audit);
  }

  return audit;
}

function countFramesWithMetadata(frames: SkeletonFrameData[] | null | undefined) {
  if (!frames?.length) {
    return { withFormation: 0, withMemberTracks: 0, withConfidence: 0, withBoundingBox: 0 };
  }
  let withFormation = 0;
  let withMemberTracks = 0;
  let withConfidence = 0;
  let withBoundingBox = 0;
  frames.forEach((frame) => {
    if (frame.formation?.slots?.length) withFormation += 1;
    if (frame.memberTracks?.length) withMemberTracks += 1;
    if (frame.confidence != null) withConfidence += 1;
    if (frame.boundingBox) withBoundingBox += 1;
  });
  return { withFormation, withMemberTracks, withConfidence, withBoundingBox, total: frames.length };
}

export function resolveMemberForTrack(
  trackToMemberMap: Map<number, string>,
  trackId: number | string,
  excludeMemberId?: string,
): string | null {
  const id = Number(trackId);
  const memberId =
    trackToMemberMap.get(id) ||
    trackToMemberMap.get(Number(String(trackId))) ||
    null;
  if (!memberId || (excludeMemberId && memberId === excludeMemberId)) return null;
  return memberId;
}

export interface SkeletonValidationDebugReport {
  totalFrames: number;
  validFrames: number;
  invalidFrames: number;
  memberAverage: number;
  timelineCoverage: number;
  validFrameRatio: number;
}

export interface SkeletonValidationResult {
  valid: boolean;
  frameCount: number;
  aiMemberIds: string[];
  aiMemberCount: number;
  /** 프레임당 평균 AI 멤버 수 (전체 순회 기준) */
  sampleMemberCount: number;
  reason?: string;
  report: SkeletonValidationDebugReport;
  /** Validation 실패 필드 (JSON 로그와 동일 구조) */
  errors: ValidationFieldError[];
}

export const SKELETON_MIN_VALID_FRAME_RATIO = 0.8;
export const SKELETON_MAX_ALLOWED_INVALID_FRAMES = 10;

function countAiInPracticeFrame(frame: SkeletonFrameData, userMemberId: string): number {
  return frame.members.filter(
    (m) =>
      m.estimatedMemberId &&
      m.estimatedMemberId !== userMemberId &&
      hasUsableJoints(m.joints),
  ).length;
}

/** 단일 프레임: AI 스켈레톤 1명 이상이면 유효 */
function isPracticeFrameValid(frame: SkeletonFrameData, userMemberId: string): boolean {
  return countAiInPracticeFrame(frame, userMemberId) >= 1;
}

function buildTimelineCoverage(
  frames: SkeletonFrameData[],
  expectedDurationSec?: number,
): number {
  if (!frames.length) return 0;
  const first = frames[0]?.timestamp ?? 0;
  const last = frames[frames.length - 1]?.timestamp ?? 0;
  const span = Math.max(0, last - first);
  const expected = Number(expectedDurationSec);
  const denom = Number.isFinite(expected) && expected > 0 ? expected : last || span || 1;
  return Math.min(1, span / denom);
}

function failSkeletonValidation(
  label: string,
  errors: ValidationFieldError[],
  partial: Omit<SkeletonValidationResult, 'valid' | 'errors'>,
): SkeletonValidationResult {
  logValidationFieldErrors(label, errors);
  return {
    valid: false,
    errors,
    ...partial,
  };
}

function passSkeletonValidation(
  partial: Omit<SkeletonValidationResult, 'valid' | 'errors'>,
): SkeletonValidationResult {
  return {
    valid: true,
    errors: [],
    ...partial,
  };
}

/**
 * 연습 가능한 스켈레톤인지 검증 (전체 영상·전체 프레임 순회).
 * ※ 읽기 전용 — 프레임을 수정·삭제하지 않는다.
 * ※ 한 프레임 실패로 전체를 막지 않음. validFrameRatio >= 80% 이면 통과.
 */
export function validateSkeletonForPractice(
  frames: SkeletonFrameData[] | null | undefined,
  userMemberId: string,
  options: {
    skipNormalize?: boolean;
    minValidRatio?: number;
    expectedDurationSec?: number;
    logTable?: boolean;
  } = {},
): SkeletonValidationResult {
  const minValidRatio = options.minValidRatio ?? SKELETON_MIN_VALID_FRAME_RATIO;
  const inputErrors: ValidationFieldError[] = [];

  if (!userMemberId || typeof userMemberId !== 'string') {
    inputErrors.push(
      buildFieldError('skeleton.userMemberId', 'non-empty string', userMemberId, '사용자 멤버 ID가 없습니다.'),
    );
  }

  if (!frames?.length) {
    inputErrors.push(
      buildFieldError(
        'skeleton.frames',
        'Array(≥1)',
        frames == null ? undefined : frames.length,
        '스켈레톤 프레임 배열이 비어 있습니다.',
      ),
    );
  }

  if (inputErrors.length) {
    return failSkeletonValidation('validateSkeletonForPractice', inputErrors, {
      frameCount: frames?.length ?? 0,
      aiMemberIds: [],
      aiMemberCount: 0,
      sampleMemberCount: 0,
      reason: inputErrors.map((e) => e.message || e.missingField).join('; '),
      report: {
        totalFrames: 0,
        validFrames: 0,
        invalidFrames: 0,
        memberAverage: 0,
        timelineCoverage: 0,
        validFrameRatio: 0,
      },
    });
  }

  const normalized = options.skipNormalize
    ? (frames ?? [])
    : normalizeSkeletonFrames(frames);

  const emptyReport: SkeletonValidationDebugReport = {
    totalFrames: 0,
    validFrames: 0,
    invalidFrames: 0,
    memberAverage: 0,
    timelineCoverage: 0,
    validFrameRatio: 0,
  };

  if (!normalized.length) {
    const errors = [
      buildFieldError(
        'skeleton.frames',
        'Array(≥1) after normalize',
        normalized.length,
        '정규화 후 유효 프레임이 없습니다.',
      ),
    ];
    return failSkeletonValidation('validateSkeletonForPractice', errors, {
      frameCount: 0,
      aiMemberIds: [],
      aiMemberCount: 0,
      sampleMemberCount: 0,
      reason: '스켈레톤 프레임이 비어 있습니다.',
      report: emptyReport,
    });
  }

  const aiIds = new Set<string>();
  let validFrames = 0;
  let invalidFrames = 0;
  let aiMemberSum = 0;

  normalized.forEach((frame) => {
    const aiInFrame = countAiInPracticeFrame(frame, userMemberId);
    aiMemberSum += aiInFrame;

    frame.members.forEach((m) => {
      if (m.estimatedMemberId && m.estimatedMemberId !== userMemberId && hasUsableJoints(m.joints)) {
        aiIds.add(m.estimatedMemberId);
      }
    });

    if (isPracticeFrameValid(frame, userMemberId)) {
      validFrames += 1;
    } else {
      invalidFrames += 1;
    }
  });

  const totalFrames = normalized.length;
  const validFrameRatio = totalFrames > 0 ? validFrames / totalFrames : 0;
  const memberAverage = totalFrames > 0 ? aiMemberSum / totalFrames : 0;
  const timelineCoverage = buildTimelineCoverage(normalized, options.expectedDurationSec);

  const report: SkeletonValidationDebugReport = {
    totalFrames,
    validFrames,
    invalidFrames,
    memberAverage,
    timelineCoverage,
    validFrameRatio,
  };

  const ratioOk = validFrameRatio >= minValidRatio;

  if (import.meta.env?.DEV || options.logTable) {
    console.debug('[validateSkeletonForPractice] report', report, {
      aiMemberIds: [...aiIds],
      maxAllowedInvalid: SKELETON_MAX_ALLOWED_INVALID_FRAMES,
    });
  }

  if (options.logTable) {
    logPracticeValidationTable(
      {
        frameCount: totalFrames,
        timelineLength: options.expectedDurationSec ?? normalized[normalized.length - 1]?.timestamp ?? 0,
        memberCount: Math.round(memberAverage * 10) / 10,
        snapshot: 'n/a (skeleton pass)',
        video: options.expectedDurationSec ?? 'unknown',
        motion: `aiIds=${aiIds.size}`,
        formation: 'n/a',
        metadata: `valid=${validFrames}/${totalFrames}`,
        confidence: String(Math.round(validFrameRatio * 1000) / 1000),
      },
      {
        stage: 'validateSkeletonForPractice',
        valid: ratioOk && aiIds.size > 0,
      },
    );
  }

  if (aiIds.size === 0) {
    const errors = [
      buildFieldError(
        'skeleton.aiMemberIds',
        'Set(≥1)',
        0,
        '전체 영상에서 AI 멤버 스켈레톤이 한 번도 감지되지 않았습니다.',
      ),
    ];
    return failSkeletonValidation('validateSkeletonForPractice', errors, {
      frameCount: totalFrames,
      aiMemberIds: [],
      aiMemberCount: 0,
      sampleMemberCount: Math.round(memberAverage * 10) / 10,
      reason: errors[0].message,
      report,
    });
  }

  if (!ratioOk) {
    const pct = Math.round(validFrameRatio * 100);
    const needPct = Math.round(minValidRatio * 100);
    const errors = [
      buildFieldError(
        'skeleton.validFrameRatio',
        `≥ ${minValidRatio} (${needPct}%)`,
        validFrameRatio,
        `유효 프레임 비율 부족 (${pct}% < ${needPct}%). ${validFrames}/${totalFrames}프레임.`,
      ),
      buildFieldError(
        'skeleton.validFrames',
        `≥ ${Math.ceil(totalFrames * minValidRatio)}`,
        validFrames,
        `인식 실패 ${invalidFrames}프레임`,
      ),
    ];
    return failSkeletonValidation('validateSkeletonForPractice', errors, {
      frameCount: totalFrames,
      aiMemberIds: [...aiIds],
      aiMemberCount: aiIds.size,
      sampleMemberCount: Math.round(memberAverage * 10) / 10,
      reason: errors[0].message,
      report,
    });
  }

  return passSkeletonValidation({
    frameCount: totalFrames,
    aiMemberIds: [...aiIds],
    aiMemberCount: aiIds.size,
    sampleMemberCount: Math.round(memberAverage * 10) / 10,
    report,
  });
}

export function countAiSkeletonsAtTime(
  frames: SkeletonFrameData[],
  timeSec: number,
  userMemberId: string,
): number {
  const normalized = normalizeSkeletonFrames(frames);
  if (!normalized.length) return 0;

  let lo = 0;
  let hi = normalized.length - 1;
  if (timeSec <= normalized[0].timestamp) {
    return countAiInFrame(normalized[0], userMemberId);
  }
  if (timeSec >= normalized[hi].timestamp) {
    return countAiInFrame(normalized[hi], userMemberId);
  }

  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (normalized[mid].timestamp <= timeSec) lo = mid;
    else hi = mid;
  }

  return countAiInFrame(normalized[lo], userMemberId);
}

function countAiInFrame(frame: SkeletonFrameData, userMemberId: string): number {
  return countAiInPracticeFrame(frame, userMemberId);
}

export default normalizeSkeletonFrames;
