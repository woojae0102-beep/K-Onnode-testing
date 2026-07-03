// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';
import { buildMotionSnapshot } from '../services/motion/SnapshotBuilder';
import type { PracticeSessionData } from '../types/practiceSession';
import { practiceDurationsMatch } from './buildPracticeSessionData';
import { computePracticeTimeline } from './practiceTimelineUtils';
import { validateSkeletonForPractice } from './skeletonDataUtils';

const DURATION_TOLERANCE_SEC = 0.5;

export interface PracticeValidationIssue {
  field: string;
  message: string;
  expected?: string | number;
  actual?: string | number;
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
}

export interface PracticeValidationResult {
  valid: boolean;
  issues: PracticeValidationIssue[];
  metrics: PracticeValidationMetrics;
}

function tryBuildPracticeSnapshot(session: PracticeSessionData) {
  const group = GROUP_DATA[session.groupId];
  if (!group) {
    return { ok: false, aiAvatarCount: 0, error: '그룹 데이터를 찾을 수 없습니다.' };
  }

  try {
    const { snapshot, complete } = buildMotionSnapshot({ session, elapsedSec: 0, userJoints: null });
    const aiAvatarCount = snapshot?.aiAvatars?.length ?? 0;
    const aiWithJoints = snapshot?.aiAvatars?.filter((a) => Object.keys(a.joints || {}).length > 0).length ?? 0;
    return {
      ok: complete,
      aiAvatarCount,
      error: complete
        ? null
        : `스냅샷 메타데이터 불완전 (AI ${aiAvatarCount}, 관절 ${aiWithJoints}, frame=${Boolean(snapshot?.frame)}, tracks=${snapshot?.memberTracks?.length ?? 0})`,
    };
  } catch (err: any) {
    return {
      ok: false,
      aiAvatarCount: 0,
      error: err?.message || '스냅샷 생성에 실패했습니다.',
    };
  }
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
  const group = GROUP_DATA[groupId];
  const expectedMemberCount = group?.memberCount ?? 0;
  const expectedAiCount = Math.max(0, expectedMemberCount - 1);

  if (!practiceSessionData) {
    return {
      valid: false,
      issues: [{ field: 'practiceSessionData', message: '연습 세션 데이터가 없습니다.', expected: 'PracticeSessionData', actual: '없음' }],
      metrics: {
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
      },
    };
  }

  const session = practiceSessionData;
  const frames = session.frames ?? [];
  const extractedFrameCount = session.extractedFrameCount ?? frames.length;
  const skeletonValidation = validateSkeletonForPractice(session.frames, userMemberId, {
    skipNormalize: true,
    expectedDurationSec: session.duration,
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

  if (!frames.length) {
    issues.push({
      field: 'skeletonData.frames',
      message: '스켈레톤 프레임 데이터가 없습니다.',
      expected: '≥ 1',
      actual: 0,
    });
  }

  if (timelineMeta && frameCount !== timelineMeta.totalFrames) {
    issues.push({
      field: 'totalFrames',
      message: '타임라인 프레임 수가 duration × fps와 일치하지 않습니다.',
      expected: timelineMeta.totalFrames,
      actual: frameCount,
    });
  }

  if (extractedFrameCount <= 0) {
    issues.push({
      field: 'extractedFrameCount',
      message: '추출 스켈레톤 프레임이 없습니다.',
      expected: '≥ 1',
      actual: extractedFrameCount,
    });
  }

  if (frameCount <= 0) {
    issues.push({
      field: 'frameCount',
      message: '유효한 스켈레톤 프레임이 없습니다.',
      expected: '≥ 1',
      actual: frameCount,
    });
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    issues.push({
      field: 'duration',
      message: '안무 길이(duration)가 유효하지 않습니다.',
      expected: '> 0초',
      actual: duration,
    });
  }

  if (!skeletonValidation.valid) {
    const report = skeletonValidation.report;
    const pct = Math.round((report?.validFrameRatio ?? 0) * 100);
    issues.push({
      field: 'aiAvatarCount',
      message: skeletonValidation.reason || 'AI 멤버 스켈레톤 검증 실패',
      expected: `유효 프레임 ≥80% (AI ${expectedAiCount}명)`,
      actual: `${pct}% (${report?.validFrames ?? 0}/${report?.totalFrames ?? 0})`,
    });
  } else if (aiAvatarCount <= 0) {
    issues.push({
      field: 'aiAvatarCount',
      message: 'AI 멤버 ID 매핑이 없습니다.',
      expected: `≥ 1 (그룹 AI ${expectedAiCount}명)`,
      actual: aiAvatarCount,
    });
  }

  if (formationCount <= 0) {
    issues.push({
      field: 'formationCount',
      message: '포메이션 타임라인이 비어 있습니다.',
      expected: '≥ 1',
      actual: formationCount,
    });
  }

  if (!Number.isFinite(timelineLength) || timelineLength <= 0) {
    issues.push({
      field: 'timelineLength',
      message: '연습 타임라인 길이가 유효하지 않습니다.',
      expected: '> 0초',
      actual: timelineLength,
    });
  } else if (!practiceDurationsMatch(timelineLength, videoDuration)) {
    issues.push({
      field: 'timelineLength',
      message: '타임라인 길이가 영상 길이와 일치하지 않습니다.',
      expected: `${videoDuration.toFixed(1)}초`,
      actual: `${timelineLength.toFixed(1)}초`,
    });
  }

  if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
    issues.push({
      field: 'videoDuration',
      message: '업로드 영상 길이(videoDuration)가 유효하지 않습니다.',
      expected: '> 0초',
      actual: videoDuration,
    });
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    issues.push({
      field: 'fps',
      message: '샘플 FPS가 유효하지 않습니다.',
      expected: '> 0',
      actual: fps,
    });
  }

  if (practiceDuration == null || !Number.isFinite(practiceDuration) || practiceDuration <= 0) {
    issues.push({
      field: 'practiceDuration',
      message: '연습 길이(practiceDuration)가 설정되지 않았습니다.',
      expected: `${videoDuration.toFixed(1)}초`,
      actual: practiceDuration ?? '없음',
    });
  } else if (!practiceDurationsMatch(practiceDuration, videoDuration)) {
    issues.push({
      field: 'practiceDuration',
      message: '연습 길이가 실제 업로드 영상 길이와 일치하지 않습니다.',
      expected: `${videoDuration.toFixed(1)}초`,
      actual: `${practiceDuration.toFixed(1)}초`,
    });
  }

  if (!session.memberTracks?.length) {
    issues.push({
      field: 'memberTracks',
      message: '멤버 트랙 메타데이터가 없습니다.',
      expected: '≥ 1',
      actual: 0,
    });
  }

  let snapshotOk = false;
  let snapshotAiCount = 0;
  if (frames.length > 0 && timelineLength > 0) {
    const snapshotResult = tryBuildPracticeSnapshot(session);
    snapshotOk = snapshotResult.ok;
    snapshotAiCount = snapshotResult.aiAvatarCount;
    if (!snapshotOk) {
      issues.push({
        field: 'snapshot',
        message: snapshotResult.error || '스냅샷을 생성할 수 없습니다.',
        expected: '생성 가능 (AI 관절 포함)',
        actual: '실패',
      });
    }
  } else {
    issues.push({
      field: 'snapshot',
      message: '스냅샷 생성에 필요한 프레임·타임라인이 없습니다.',
      expected: '생성 가능',
      actual: '건너뜀',
    });
  }

  if (session.songId !== songId || session.userMemberId !== userMemberId) {
    issues.push({
      field: 'sessionMeta',
      message: '세션 메타(songId/userMemberId)가 일치하지 않습니다.',
      expected: `${songId}/${userMemberId}`,
      actual: `${session.songId}/${session.userMemberId}`,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    metrics: {
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
    },
  };
}

export default validatePracticeData;
