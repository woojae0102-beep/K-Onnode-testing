// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';
import { buildMotionSnapshot } from '../services/motion/SnapshotBuilder';
import type { PracticeSessionData } from '../types/practiceSession';
import { snapshotAiAvatars } from './motionSnapshotUtils';
import { practiceDurationsMatch } from './buildPracticeSessionData';
import {
  buildFieldError,
  buildRecoverableError,
  formatReferenceVideoStatus,
  isRecoverableError,
  isReferenceError,
  logPracticeValidationTable,
  logRecoverableErrors,
  logUndefinedFields,
  logValidationFieldErrors,
  type RecoverableValidationError,
  type ValidationFieldError,
} from './practiceValidationDebug';
import { computePracticeTimeline } from './practiceTimelineUtils';
import { validateSkeletonForPractice } from './skeletonDataUtils';

const DURATION_TOLERANCE_SEC = 0.5;

export interface PracticeValidationIssue {
  field: string;
  message: string;
  expected?: string | number;
  actual?: string | number;
  severity: 'error' | 'warning';
}

export interface PracticeValidationMetrics {
  frameCount: number;
  duration: number;
  memberCount: number;
  aiAvatarCount: number;
  formationCount: number;
  timelineLength: number;
  videoDuration: number;
  fps: number;
  snapshotOk: boolean;
  practiceDuration: number | null;
  avgConfidence: number | null;
}

export interface PracticeValidationResult {
  valid: boolean;
  issues: PracticeValidationIssue[];
  warnings: PracticeValidationIssue[];
  /** blocking field errors (JSON 구조) */
  fieldErrors: ValidationFieldError[];
  /** ReferenceError 등 — Validation 실패 아님 */
  recoverableErrors: RecoverableValidationError[];
  metrics: PracticeValidationMetrics;
}

function pushFieldError(list: ValidationFieldError[], error: ValidationFieldError) {
  list.push(error);
}

function pushBlocking(
  issues: PracticeValidationIssue[],
  fieldErrors: ValidationFieldError[],
  {
    field,
    message,
    expected,
    actual,
  }: {
    field: string;
    message: string;
    expected: string | number;
    actual: string | number;
  },
) {
  pushIssue(issues, { field, message, expected, actual });
  pushFieldError(fieldErrors, buildFieldError(field, String(expected), actual, message));
}

function pushIssue(
  list: PracticeValidationIssue[],
  issue: Omit<PracticeValidationIssue, 'severity'> & { severity?: PracticeValidationIssue['severity'] },
) {
  list.push({
    severity: issue.severity || 'error',
    ...issue,
  });
}

function tryBuildPracticeSnapshot(session: PracticeSessionData) {
  const group = GROUP_DATA[session.groupId];
  if (!group) {
    return {
      ok: false,
      aiAvatarCount: 0,
      error: '그룹 데이터를 찾을 수 없습니다.',
      referenceError: false,
    };
  }

  logUndefinedFields('tryBuildPracticeSnapshot.session', session as any, [
    'frames',
    'duration',
    'fps',
    'totalFrames',
    'memberTracks',
    'formationTimeline',
    'motionMetadata',
    'referenceVideo',
    'sourceVideoDurationSec',
  ]);

  try {
    const { snapshot, complete } = buildMotionSnapshot({ session, elapsedSec: 0, userJoints: null });
    const aiAvatarCount = snapshotAiAvatars(snapshot).length;
    const aiWithJoints = snapshotAiAvatars(snapshot).filter((a) => Object.keys(a.joints || {}).length > 0).length;

    logUndefinedFields('tryBuildPracticeSnapshot.result', snapshot as any, [
      'videoDuration',
      'frameCount',
      'fps',
      'timeline',
      'members',
      'formation',
      'motion',
      'referenceVideo',
      'metadata',
      'generatedAt',
    ]);

    return {
      ok: complete,
      aiAvatarCount,
      snapshot,
      referenceError: false,
      error: complete
        ? null
        : `스냅샷 메타데이터 불완전 (AI ${aiAvatarCount}, 관절 ${aiWithJoints}, frame=${Boolean(snapshot?.motion?.frame)}, tracks=${snapshot?.metadata?.memberTracks?.length ?? 0})`,
    };
  } catch (err: any) {
    const recoverable = isRecoverableError(err);
    if (recoverable) {
      const recoverableErr = buildRecoverableError('snapshot.motion', err, 'PracticeMotionSnapshot');
      logRecoverableErrors('tryBuildPracticeSnapshot', [recoverableErr]);
      return {
        ok: false,
        aiAvatarCount: 0,
        referenceError: true,
        recoverable: true,
        recoverableError: recoverableErr,
        error: err?.message || '스냅샷 생성 Recoverable Error',
      };
    }
    console.error('[PracticeValidation] snapshot dry-run failed', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });
    return {
      ok: false,
      aiAvatarCount: 0,
      referenceError: false,
      recoverable: false,
      error: err?.message || '스냅샷 생성에 실패했습니다.',
    };
  }
}

function computeAvgConfidence(frames: PracticeSessionData['frames']): number | null {
  if (!frames?.length) return null;
  let sum = 0;
  let count = 0;
  frames.forEach((frame) => {
    if (frame.confidence != null && Number.isFinite(Number(frame.confidence))) {
      sum += Number(frame.confidence);
      count += 1;
    }
  });
  return count > 0 ? Math.round((sum / count) * 1000) / 1000 : null;
}

/** GroupStudioSession 진입 전 연습 데이터 검증 */
export function validatePracticeData({
  practiceSessionData,
  groupId,
  songId,
  userMemberId,
}: {
  practiceSessionData: PracticeSessionData | null | undefined;
  groupId: string;
  songId: string;
  userMemberId: string;
}): PracticeValidationResult {
  const issues: PracticeValidationIssue[] = [];
  const warnings: PracticeValidationIssue[] = [];
  const fieldErrors: ValidationFieldError[] = [];
  const recoverableErrors: RecoverableValidationError[] = [];
  const group = GROUP_DATA[groupId];
  const expectedMemberCount = group?.memberCount ?? 0;
  const expectedAiCount = Math.max(0, expectedMemberCount - 1);

  const emptyMetrics: PracticeValidationMetrics = {
    frameCount: 0,
    duration: 0,
    memberCount: 0,
    aiAvatarCount: 0,
    formationCount: 0,
    timelineLength: 0,
    videoDuration: 0,
    fps: 0,
    snapshotOk: false,
    practiceDuration: null,
    avgConfidence: null,
  };

  if (!practiceSessionData) {
    pushBlocking(issues, fieldErrors, {
      field: 'practiceSessionData',
      message: '연습 세션 데이터가 없습니다.',
      expected: 'PracticeSessionData',
      actual: '없음',
    });
    logValidationFieldErrors('validatePracticeData', fieldErrors);
    logPracticeValidationTable({
      frameCount: 0,
      timelineLength: 0,
      memberCount: 0,
      snapshot: 'skipped',
      video: 'missing',
      motion: 'missing',
      formation: 'missing',
      metadata: 'missing',
      confidence: 'n/a',
    }, { valid: false });
    return { valid: false, issues, warnings, fieldErrors, recoverableErrors, metrics: emptyMetrics };
  }

  const session = practiceSessionData;
  const frames = session.frames ?? [];
  const extractedFrameCount = session.extractedFrameCount ?? frames.length;
  const skeletonValidation = validateSkeletonForPractice(session.frames, userMemberId, {
    skipNormalize: true,
    expectedDurationSec: session.duration,
    logTable: true,
  });

  const timelineMeta = computePracticeTimeline(session.duration, session.fps);
  const frameCount = session.totalFrames ?? timelineMeta?.totalFrames ?? extractedFrameCount;
  const skeletonEnd = frames[frames.length - 1]?.timestamp ?? 0;
  const videoDuration = session.sourceVideoDurationSec ?? session.duration ?? 0;
  const duration = session.duration ?? skeletonEnd;
  const memberCount = Math.round((skeletonValidation.report?.memberAverage ?? 0) * 10) / 10;
  const aiAvatarCount =
    session.positionMap?.aiMemberIds?.length
    ?? skeletonValidation.aiMemberCount
    ?? 0;
  const formationCount = session.formationTimeline?.keyframes?.length ?? 0;
  const fps = session.fps ?? 0;
  const timelineLength = session.duration ?? 0;
  const practiceDuration = session.duration ?? null;
  const avgConfidence = computeAvgConfidence(frames);
  const videoStatus = formatReferenceVideoStatus(session.referenceVideo as any);

  logUndefinedFields('validatePracticeData.session', session as any, [
    'frames',
    'duration',
    'fps',
    'totalFrames',
    'memberTracks',
    'formationTimeline',
    'motionMetadata',
    'sourceVideoDurationSec',
    'userMemberId',
    'songId',
    'groupId',
  ]);
  // referenceVideo 없어도 Validation 통과

  if (!skeletonValidation.valid) {
    if (skeletonValidation.errors?.length) {
      fieldErrors.push(...skeletonValidation.errors);
    }
    const report = skeletonValidation.report;
    const pct = Math.round((report?.validFrameRatio ?? 0) * 100);
    pushIssue(issues, {
      field: 'skeleton.validation',
      message: skeletonValidation.reason || 'AI 멤버 스켈레톤 검증 실패',
      expected: `유효 프레임 ≥80% (AI ${expectedAiCount}명)`,
      actual: `${pct}% (${report?.validFrames ?? 0}/${report?.totalFrames ?? 0})`,
    });
  } else if (aiAvatarCount <= 0) {
    pushBlocking(issues, fieldErrors, {
      field: 'aiAvatarCount',
      message: 'AI 멤버 ID 매핑이 없습니다.',
      expected: `≥ 1 (그룹 AI ${expectedAiCount}명)`,
      actual: aiAvatarCount,
    });
  }

  if (!frames.length) {
    pushBlocking(issues, fieldErrors, {
      field: 'skeletonData.frames',
      message: '스켈레톤 프레임 데이터가 없습니다.',
      expected: '≥ 1',
      actual: 0,
    });
  }

  if (timelineMeta && frameCount !== timelineMeta.totalFrames) {
    pushBlocking(issues, fieldErrors, {
      field: 'totalFrames',
      message: '타임라인 프레임 수가 duration × fps와 일치하지 않습니다.',
      expected: timelineMeta.totalFrames,
      actual: frameCount,
    });
  }

  if (extractedFrameCount <= 0) {
    pushBlocking(issues, fieldErrors, {
      field: 'extractedFrameCount',
      message: '추출 스켈레톤 프레임이 없습니다.',
      expected: '≥ 1',
      actual: extractedFrameCount,
    });
  }

  if (frameCount <= 0) {
    pushBlocking(issues, fieldErrors, {
      field: 'frameCount',
      message: '유효한 스켈레톤 프레임이 없습니다.',
      expected: '≥ 1',
      actual: frameCount,
    });
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    pushBlocking(issues, fieldErrors, {
      field: 'duration',
      message: '안무 길이(duration)가 유효하지 않습니다.',
      expected: '> 0초',
      actual: duration,
    });
  }

  if (formationCount <= 0) {
    pushBlocking(issues, fieldErrors, {
      field: 'formationCount',
      message: '포메이션 타임라인이 비어 있습니다.',
      expected: '≥ 1',
      actual: formationCount,
    });
  }

  if (!Number.isFinite(timelineLength) || timelineLength <= 0) {
    pushBlocking(issues, fieldErrors, {
      field: 'timelineLength',
      message: '연습 타임라인 길이가 유효하지 않습니다.',
      expected: '> 0초',
      actual: timelineLength,
    });
  } else if (!practiceDurationsMatch(timelineLength, videoDuration)) {
    pushBlocking(issues, fieldErrors, {
      field: 'timelineLength',
      message: '타임라인 길이가 영상 길이와 일치하지 않습니다.',
      expected: `${videoDuration.toFixed(1)}초`,
      actual: `${timelineLength.toFixed(1)}초`,
    });
  }

  if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
    pushBlocking(issues, fieldErrors, {
      field: 'videoDuration',
      message: '업로드 영상 길이(videoDuration)가 유효하지 않습니다.',
      expected: '> 0초',
      actual: videoDuration,
    });
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    pushBlocking(issues, fieldErrors, {
      field: 'fps',
      message: '샘플 FPS가 유효하지 않습니다.',
      expected: '> 0',
      actual: fps,
    });
  }

  if (practiceDuration == null || !Number.isFinite(practiceDuration) || practiceDuration <= 0) {
    pushBlocking(issues, fieldErrors, {
      field: 'practiceDuration',
      message: '연습 길이(practiceDuration)가 설정되지 않았습니다.',
      expected: `${videoDuration.toFixed(1)}초`,
      actual: practiceDuration ?? '없음',
    });
  } else if (!practiceDurationsMatch(practiceDuration, videoDuration)) {
    pushBlocking(issues, fieldErrors, {
      field: 'practiceDuration',
      message: '연습 길이가 실제 업로드 영상 길이와 일치하지 않습니다.',
      expected: `${videoDuration.toFixed(1)}초`,
      actual: `${practiceDuration.toFixed(1)}초`,
    });
  }

  if (!session.memberTracks?.length) {
    pushBlocking(issues, fieldErrors, {
      field: 'memberTracks',
      message: '멤버 트랙 메타데이터가 없습니다.',
      expected: '≥ 1',
      actual: 0,
    });
  }

  let snapshotOk = false;
  let snapshotAiCount = 0;
  let snapshotStatus = 'skipped';

  if (frames.length > 0 && timelineLength > 0) {
    const snapshotResult = tryBuildPracticeSnapshot(session);
    snapshotOk = snapshotResult.ok;
    snapshotAiCount = snapshotResult.aiAvatarCount;
    snapshotStatus = snapshotOk ? 'ok' : (snapshotResult.error || 'failed');

    if (!snapshotOk) {
      if (snapshotResult.recoverable && snapshotResult.recoverableError) {
        recoverableErrors.push(snapshotResult.recoverableError);
      } else {
        pushIssue(warnings, {
          field: 'snapshot',
          severity: 'warning',
          message: snapshotResult.error || '스냅샷 dry-run 실패 (연습 진입은 허용)',
          expected: '생성 가능 (AI 관절 포함)',
          actual: '불완전',
        });
      }
    }
  } else {
    pushIssue(warnings, {
      field: 'snapshot',
      severity: 'warning',
      message: '스냅샷 dry-run 건너뜀 — 프레임·타임라인 부족',
      expected: '생성 가능',
      actual: '건너뜀',
    });
    snapshotStatus = 'skipped (no frames/timeline)';
  }

  if (session.songId !== songId || session.userMemberId !== userMemberId) {
    pushBlocking(issues, fieldErrors, {
      field: 'sessionMeta',
      message: '세션 메타(songId/userMemberId)가 일치하지 않습니다.',
      expected: `${songId}/${userMemberId}`,
      actual: `${session.songId}/${session.userMemberId}`,
    });
  }

  const metrics: PracticeValidationMetrics = {
    frameCount,
    duration,
    memberCount,
    aiAvatarCount: Math.max(aiAvatarCount, snapshotAiCount),
    formationCount,
    timelineLength,
    videoDuration,
    fps,
    snapshotOk,
    practiceDuration,
    avgConfidence,
  };

  logPracticeValidationTable(
    {
      frameCount,
      timelineLength: Number(timelineLength.toFixed(2)),
      memberCount,
      snapshot: snapshotStatus,
      video: `${videoDuration.toFixed(1)}s (${videoStatus})`,
      motion: session.motionMetadata
        ? `ai=${session.motionMetadata.aiMemberIds?.length ?? 0}, extracted=${session.motionMetadata.extractedFrameCount ?? extractedFrameCount}`
        : 'missing',
      formation: `${formationCount} keyframes`,
      metadata: `tracks=${session.memberTracks?.length ?? 0}, pipeline=${session.motionPipelineAudit ? 'yes' : 'no'}`,
      confidence: avgConfidence != null ? String(avgConfidence) : 'n/a',
    },
    {
      valid: issues.length === 0,
      errorCount: issues.length,
      warningCount: warnings.length,
      skeletonValid: skeletonValidation.valid,
    },
  );

  logValidationFieldErrors('validatePracticeData', fieldErrors);
  logRecoverableErrors('validatePracticeData', recoverableErrors);

  if (warnings.length) {
    console.warn('[PracticeValidation] warnings', warnings);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    fieldErrors,
    recoverableErrors,
    metrics,
  };
}

export default validatePracticeData;
