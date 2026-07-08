// @ts-nocheck
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { getSongById } from '../../data/groupStudioSongs';
import { useMediaPipeTV } from '../../hooks/useMediaPipeTV';
import { usePracticeClock } from '../../hooks/usePracticeClock';
import { PRACTICE_RENDER_FPS } from '../../config/practiceRenderConfig';
import { useGroupStageFrame } from '../../hooks/useGroupStageFrame';
import {
  findFrameIndexByTimestamp,
  isPracticePlaybackFinished,
} from '../../services/practice/PracticePlayer';
import { buildStageRenderInput } from '../../utils/stageRenderInputBuilder';
import CameraPreviewStack from './CameraPreviewStack';
import GroupDanceStage2D from './GroupDanceStage2D';
import { useGroupSync } from '../../hooks/useGroupSync';
import { useGroupDanceEngine } from '../../hooks/useGroupDanceEngine';
import { useStudioSession } from '../../hooks/useStudioSession';
import { useTVRecorder } from '../../hooks/useTVRecorder';
import { useGroupAvatarAssets } from '../../hooks/useGroupAvatarAssets';
import { useTVScreenLayout } from '../../hooks/useTVScreenLayout';
import { isDevEnvironment } from '../../utils/isDevEnvironment';
import { validateSkeletonForPractice } from '../../utils/skeletonDataUtils';
import {
  formatReferenceVideoStatus,
  logPracticeValidationTable,
  logUndefinedFields,
} from '../../utils/practiceValidationDebug';
import {
  snapshotAiAvatars,
  snapshotCurrentTime,
  snapshotFrame,
  snapshotUserAnchor,
} from '../../utils/motionSnapshotUtils';
import { smoothLiveJoints, resetLivePoseKalmanFilter } from '../../services/avatar/MotionRetargetingService';
import StudioConnectModal from '../studio/StudioConnectModal';
import CountdownOverlay from './CountdownOverlay';
import TempoLockIndicator from './TempoLockIndicator';
import MissedBeatAlert from './MissedBeatAlert';
import YouTubeTVPlayer from '../tv/YouTubeTVPlayer';
import type { Agency } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';
import '../../styles/group-studio.css';
import '../../styles/studio-mode.css';
import SnapshotDebugOverlay from './SnapshotDebugOverlay';
import GroupMotionDebugOverlay from './GroupMotionDebugOverlay';
import PracticeDebugHUD from './PracticeDebugHUD';
import { buildGroupMotionDebugFromSession } from '../../utils/groupMotionDebugUtils';
import { logSnapshotStatus } from '../../utils/snapshotDebugLog';

const GroupDanceStage3D = lazy(() => import('./three/GroupDanceStage3D'));

const SLOT_THRESHOLD = 0.15;

export function GroupStudioSession({
  practiceSessionData,
  referenceYoutubeUrl: referenceYoutubeUrlOverride = '',
  agency = 'hybe',
  onEnd,
  onHome,
}) {
  const { t } = useTranslation();
  const songId = practiceSessionData.songId;
  const groupId = practiceSessionData.groupId;
  const myMemberId = practiceSessionData.userMemberId;
  const sessionFrames = practiceSessionData.frames;
  const maxDuration = practiceSessionData.duration;
  const referenceYoutubeUrl = practiceSessionData.referenceVideo?.youtubeUrl || referenceYoutubeUrlOverride;
  const song = getSongById(songId);
  const group = GROUP_DATA[groupId];
  const myMember = group?.members.find((m) => m.id === myMemberId);
  const otherMembers = group?.members.filter((m) => m.id !== myMemberId) || [];
  const agencyColor = AGENCY_COLORS[agency as Agency] || '#FF1F8E';

  const stage2DRef = useRef(null);
  const ytPlayerRef = useRef(null);

  const skeletonValidation = useMemo(
    () => validateSkeletonForPractice(sessionFrames, myMemberId, {
      skipNormalize: true,
      expectedDurationSec: maxDuration,
      logTable: true,
    }),
    [sessionFrames, myMemberId, maxDuration],
  );

  useEffect(() => {
    logUndefinedFields('GroupStudioSession.practiceSessionData', practiceSessionData as any, [
      'frames',
      'duration',
      'fps',
      'referenceVideo',
      'motionMetadata',
      'formationTimeline',
      'memberTracks',
    ]);
    logPracticeValidationTable(
      {
        frameCount: sessionFrames?.length ?? 0,
        timelineLength: maxDuration,
        memberCount: skeletonValidation.sampleMemberCount ?? 0,
        snapshot: 'runtime',
        video: formatReferenceVideoStatus(practiceSessionData.referenceVideo as any),
        motion: practiceSessionData.motionMetadata ? 'present' : 'missing',
        formation: `${practiceSessionData.formationTimeline?.keyframes?.length ?? 0} keyframes`,
        metadata: `tracks=${practiceSessionData.memberTracks?.length ?? 0}`,
        confidence: skeletonValidation.report?.validFrameRatio != null
          ? String(Math.round(skeletonValidation.report.validFrameRatio * 1000) / 1000)
          : 'n/a',
      },
      { stage: 'GroupStudioSession.mount', skeletonValid: skeletonValidation.valid },
    );
  }, [practiceSessionData, sessionFrames, maxDuration, skeletonValidation]);

  const renderTimeline = practiceSessionData.renderTimeline ?? null;
  const [sessionPhase, setSessionPhase] = useState('lobby');
  const [countdown, setCountdown] = useState(null);
  const [showGhost, setShowGhost] = useState(true);
  const [showMissedAlert, setShowMissedAlert] = useState(false);
  const [studioModalOpen, setStudioModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stageViewMode, setStageViewMode] = useState('2d');
  const screenRef = useRef(null);
  const animFrameRef = useRef(0);
  const practiceAnimRef = useRef(0);
  const practiceTimeRef = useRef(0);
  const groupStageRef = useRef(null);
  const slotEnteredRef = useRef(false);
  const endedRef = useRef(false);
  const prevSmoothScoreRef = useRef(100);
  const [videoPlaybackTime, setVideoPlaybackTime] = useState(0);
  const [referenceVideoDuration, setReferenceVideoDuration] = useState(0);
  const [stageSkeletonCount, setStageSkeletonCount] = useState(0);
  const [danceSnapshot, setDanceSnapshot] = useState(null);
  const lastSkeletonCountRef = useRef(-1);
  const renderGroupStageRef = useRef(null);
  const syncDanceStageRef = useRef(null);
  const stopDanceTrackingRef = useRef(() => {});

  const { layoutClass, isMobile } = useTVScreenLayout();

  const dance = useMediaPipeTV(myMember?.color || agencyColor);
  stopDanceTrackingRef.current = dance.stopTracking;
  const recorder = useTVRecorder();
  const isPracticing = sessionPhase === 'practicing';
  const useYoutubeClock = Boolean(referenceYoutubeUrl && isPracticing);

  const practiceClock = usePracticeClock({
    durationSec: maxDuration,
    fps: practiceSessionData.fps || PRACTICE_RENDER_FPS,
    externalTimeSec: useYoutubeClock ? videoPlaybackTime : null,
    externalRunning: useYoutubeClock,
  });

  const currentTime = practiceClock.currentTime;
  const isRunning = practiceClock.isRunning;
  const isFinished = practiceClock.isFinished;
  const startTimeline = practiceClock.start;
  const forceStop = practiceClock.forceStop;

  const stageFrame = useGroupStageFrame({
    sourceFrames: sessionFrames,
    timeSec: currentTime,
    sourceVideoDurationSec: practiceSessionData.sourceVideoDurationSec ?? maxDuration,
    renderTimeline,
    sessionKey: `${groupId}:${songId}:${myMemberId}`,
  });

  const getTimelineFrame = useCallback(
    (timeSec = practiceClock.currentTime) => stageFrame.resolveAt(timeSec),
    [stageFrame.resolveAt, practiceClock.currentTime],
  );
  const { syncScore, missedBeats, updateSyncScore, getFinalStats } = useGroupSync(
    myMemberId,
    group?.members || [],
  );
  const roundedScore = Math.round(syncScore);
  const danceEngine = useGroupDanceEngine({
    groupId,
    songId,
    userMemberId: myMemberId,
    skeletonFrames: sessionFrames,
    practiceDuration: maxDuration,
    sampleFps: practiceSessionData.fps,
    totalFrames: practiceSessionData.totalFrames,
    referenceVideo: practiceSessionData.referenceVideo ?? null,
    sourceVideoDurationSec: practiceSessionData.sourceVideoDurationSec ?? maxDuration,
  });
  const myDefault = { x: myMember?.defaultX ?? 0.5, y: myMember?.defaultY ?? 0.5 };

  const formationHole = practiceSessionData.formationHole || {
    memberId: myMemberId,
    anchor: { x: myMember?.defaultX ?? 0.5, y: myMember?.defaultY ?? 0.5, z: 0 },
    label: myMember?.nameKr || 'YOU',
    color: myMember?.color || '#FF1F8E',
  };
  const aiMemberIds = practiceSessionData.positionMap?.aiMemberIds || otherMembers.map((m) => m.id);
  const { assets: avatarAssets } = useGroupAvatarAssets(groupId, aiMemberIds);
  const use3DStage = stageViewMode === '3d' && !danceEngine.error;
  const show3DRenderer = use3DStage && !danceEngine.loading;

  useEffect(() => {
    if (danceEngine.error && stageViewMode === '3d') {
      setStageViewMode('2d');
    }
  }, [danceEngine.error, stageViewMode]);

  useEffect(() => {
    if (!show3DRenderer || !sessionFrames?.length) return;
    if (sessionPhase === 'lobby' || sessionPhase === 'countdown' || sessionPhase === 'waiting_slot') {
      danceEngine.tick(0, null);
    }
  }, [show3DRenderer, sessionFrames, sessionPhase, danceEngine]);

  useEffect(() => {
    const updateFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };
    updateFullscreen();
    document.addEventListener('fullscreenchange', updateFullscreen);
    document.addEventListener('webkitfullscreenchange', updateFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreen);
      document.removeEventListener('webkitfullscreenchange', updateFullscreen);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (fullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await document.webkitExitFullscreen?.();
      } else {
        const target = screenRef.current || document.documentElement;
        if (target.requestFullscreen) await target.requestFullscreen();
        else await target.webkitRequestFullscreen?.();
      }
    } catch {
      /* fullscreen can be blocked by browser/device settings */
    }
  }, []);

  /** PracticeClock 단일 시간축 */
  const effectiveTime = currentTime;

  useEffect(() => {
    practiceTimeRef.current = currentTime;
  }, [currentTime]);

  const hasSkeletonData = skeletonValidation.valid;
  const skeletonIssue = skeletonValidation.reason || '';

  const effectiveMaxDuration = maxDuration;

  const practiceEnded = isPracticing && (
    practiceClock.isFinished
    || isPracticePlaybackFinished(currentTime, maxDuration)
    || (referenceYoutubeUrl && isRunning && isPracticePlaybackFinished(videoPlaybackTime, maxDuration))
  );

  const debugHudStats = useMemo(() => {
    const frameIndex = findFrameIndexByTimestamp(sessionFrames, practiceClock.currentTime);
    const frame = snapshotFrame(danceSnapshot) ?? getTimelineFrame(practiceClock.currentTime);
    const skeletonCount = frame?.members?.length ?? 0;
    const aiInFrame = frame?.members?.filter(
      (m) => m.estimatedMemberId && m.estimatedMemberId !== myMemberId,
    ).length ?? 0;
    const userSkeletonJoints = dance.poseData?.joints
      ? Object.keys(dance.poseData.joints).length
      : 0;
    const snapshotAiCount = snapshotAiAvatars(danceSnapshot).filter(
      (a) => Object.keys(a.joints || {}).length > 0,
    ).length ?? 0;

    return {
      frameIndex,
      totalTimelineFrames: sessionFrames?.length ?? 0,
      skeletonCount,
      aiAvatarCount: Math.max(aiInFrame, snapshotAiCount, stageSkeletonCount),
      userSkeletonJoints,
      snapshotAiCount,
    };
  }, [
    practiceClock.currentTime,
    sessionFrames,
    getTimelineFrame,
    myMemberId,
    dance.poseData,
    danceSnapshot,
    stageSkeletonCount,
  ]);

  const groupMotionDebug = useMemo(() => {
    const frame = snapshotFrame(danceSnapshot) ?? getTimelineFrame(practiceClock.currentTime);
    return buildGroupMotionDebugFromSession(practiceSessionData, frame, effectiveTime);
  }, [practiceSessionData, danceSnapshot, getTimelineFrame, practiceClock.currentTime, effectiveTime]);

  const studio = useStudioSession({
    localStream: dance.getStream(),
    mode: 'group',
    agency,
    referenceVideoUrl: referenceYoutubeUrl,
    songTitle: song ? `${song.title} · ${myMember?.nameKr}` : `${group?.nameKr} · ${myMember?.nameKr}`,
    playbackRate: 1,
    getCurrentTime: () => currentTime,
    feedbackText: isPracticing && roundedScore
      ? t('groupStudio.session.syncFeedback', {
          score: roundedScore,
          msg: roundedScore > 80
            ? t('groupStudio.session.syncGreat')
            : t('groupStudio.session.syncKeepGoing'),
        })
      : t('groupStudio.session.ghostSlot', { member: myMember?.nameKr || '' }),
    score: isPracticing ? roundedScore : 0,
    scores: {
      rhythm: isPracticing ? roundedScore : 0,
      posture: isPracticing ? roundedScore : 0,
      angle: isPracticing ? roundedScore : 0,
      expression: 0,
      energy: 0,
      stability: isPracticing ? roundedScore : 0,
    },
    poseData: dance.poseData,
    practiceStep: 3,
    practiceStepLabel: t('groupStudio.session.practiceStep'),
    isPaused: false,
    isPlaying: isPracticing && isRunning,
  });

  const syncDanceStage = useCallback(
    (elapsedSec) => {
      const timelineFrame = stageFrame.resolveAt(elapsedSec);
      const showUserPose = isPracticing || sessionPhase === 'waiting_slot';
      return danceEngine.tick(
        elapsedSec,
        showUserPose ? dance.poseData?.joints || null : null,
        timelineFrame,
      );
    },
    [danceEngine.tick, isPracticing, sessionPhase, dance.poseData, stageFrame.resolveAt],
  );

  const renderGroupStage = useCallback(
    (snapshot, timeSec = practiceTimeRef.current) => {
      if (show3DRenderer) return;
      if (!myMember) return;

      const showUserPose = isPracticing || sessionPhase === 'waiting_slot';
      const timelineFrame = stageFrame.resolveAt(timeSec);
      const frame = snapshotFrame(snapshot) ?? timelineFrame;

      const aiRendered = frame?.members?.filter(
        (m) => m.estimatedMemberId && m.estimatedMemberId !== myMemberId,
      ).length ?? snapshotAiAvatars(snapshot).length;

      if (aiRendered !== lastSkeletonCountRef.current) {
        lastSkeletonCountRef.current = aiRendered;
        setStageSkeletonCount(aiRendered);
      }

      const userAnchor = snapshotUserAnchor(snapshot);
      const renderInput = buildStageRenderInput({
        frame,
        groupId,
        myMemberId,
        timeSec,
        formationTimeline: practiceSessionData.formationTimeline ?? null,
        formationHole,
        userJoints: showUserPose && dance.poseData?.joints
          ? smoothLiveJoints(dance.poseData.joints)
          : null,
        userColor: myMember.color,
        userAnchor: userAnchor
          ? { x: userAnchor.x, y: userAnchor.y }
          : null,
        showUserPose,
        showGhost: (showGhost && sessionPhase !== 'practicing') || isPracticing,
        ghostLabel: sessionPhase === 'practicing'
          ? (formationHole?.label || 'YOU')
          : (formationHole?.label || 'YOUR SLOT'),
        snapshotAiMembers: snapshotAiAvatars(snapshot),
      });

      stage2DRef.current?.draw(renderInput);
    },
    [
      groupId,
      myMember,
      myMemberId,
      dance.poseData,
      showGhost,
      sessionPhase,
      isPracticing,
      show3DRenderer,
      formationHole,
      stageFrame.resolveAt,
      practiceSessionData.formationTimeline,
    ],
  );

  renderGroupStageRef.current = renderGroupStage;
  syncDanceStageRef.current = syncDanceStage;

  useEffect(() => {
    if (show3DRenderer) return;
    if (sessionPhase !== 'lobby' && sessionPhase !== 'waiting_slot') return;
    const snapshot = syncDanceStage(0) || null;
    logSnapshotStatus(snapshot, `2d-idle-${sessionPhase}`, { loading: danceEngine.loading });
    setDanceSnapshot(snapshot);
    renderGroupStage(snapshot);
  }, [show3DRenderer, sessionPhase, syncDanceStage, renderGroupStage, danceEngine.loading]);

  useEffect(() => {
    if (!show3DRenderer) return;
    if (sessionPhase !== 'lobby' && sessionPhase !== 'waiting_slot' && sessionPhase !== 'countdown') return;
    const snapshot = syncDanceStage(0) || null;
    logSnapshotStatus(snapshot, `3d-idle-${sessionPhase}`, { loading: danceEngine.loading });
    setDanceSnapshot(snapshot);
  }, [show3DRenderer, sessionPhase, syncDanceStage, danceEngine.loading]);

  const checkSlotEntry = useCallback(() => {
    if (!dance.poseData?.joints?.nose || slotEnteredRef.current) return false;
    const nose = dance.poseData.joints.nose;
    const dx = Math.abs(nose.x - myDefault.x);
    const dy = Math.abs(nose.y - myDefault.y);
    return dx < SLOT_THRESHOLD && dy < SLOT_THRESHOLD;
  }, [dance.poseData, myDefault]);

  const getPracticeFrame = useCallback(
    () => snapshotFrame(danceSnapshot) ?? getTimelineFrame(practiceClock.currentTime),
    [danceSnapshot, getTimelineFrame, practiceClock.currentTime],
  );

  const finishSession = useCallback(
    async (stats) => {
      if (endedRef.current) return;
      endedRef.current = true;
      cancelAnimationFrame(animFrameRef.current);
      cancelAnimationFrame(practiceAnimRef.current);
      ytPlayerRef.current?.pause?.();
      dance.stopTracking();
      studio.stopStudio();
      const recording = await recorder.stopRecording();

      const syncScores = {
        overall: stats.avgScore,
        pose: stats.avgScore,
        timing: stats.avgScore,
        formation: stats.avgScore,
        position: stats.avgScore,
        energy: stats.avgScore,
      };

      onEnd({
        syncScores,
        scores: syncScores,
        duration: currentTime,
        overall: stats.avgScore,
        avgScore: stats.avgScore,
        missedBeats: stats.missedBeats,
        worstMoments: stats.worstMoments,
        bestMoments: stats.bestMoments,
        scoreHistory: stats.scoreHistory,
        recordedMediaUrl: recording?.url || recorder.recordedUrl,
        recordedBlob: recording?.blob || recorder.recordedBlob,
        scoreTimeline: stats.scoreHistory.map((entry) => ({
          time: entry.time,
          score: Math.round(entry.score),
        })),
        groupId,
        memberId: myMemberId,
        songId,
        groupName: group?.nameKr,
        memberName: myMember?.nameKr,
        songTitle: song?.title,
        completed: true,
      });
    },
    [dance, studio, recorder, onEnd, currentTime, groupId, myMemberId, songId, group, myMember, song],
  );

  const practiceClockRef = useRef(practiceClock);
  practiceClockRef.current = practiceClock;

  useEffect(() => {
    if (!isPracticing || (!isRunning && !isFinished)) return undefined;

    let lastScoreAt = 0;
    let lastUiAt = 0;
    let last3dAt = 0;

    const loop = () => {
      if (referenceYoutubeUrl && isRunning) {
        const vt = ytPlayerRef.current?.getCurrentTime?.();
        const dur = ytPlayerRef.current?.getDuration?.();
        if (typeof vt === 'number' && Number.isFinite(vt)) {
          practiceTimeRef.current = Math.max(0, vt);
          const now = performance.now();
          if (now - lastUiAt > 200) {
            lastUiAt = now;
            setVideoPlaybackTime(practiceTimeRef.current);
          }
        }
        if (typeof dur === 'number' && Number.isFinite(dur) && dur > 0) {
          setReferenceVideoDuration((prev) => (Math.abs(prev - dur) > 0.5 ? dur : prev));
        }
      }

      const clock = practiceClockRef.current;
      const t = clock.currentTime;
      practiceTimeRef.current = t;

      const snapshot = syncDanceStageRef.current?.(t) || null;
      renderGroupStageRef.current?.(snapshot, t);

      const now = performance.now();
      if (now - last3dAt > 100) {
        last3dAt = now;
        setDanceSnapshot(snapshot);
        logSnapshotStatus(snapshot, 'practice-loop', { loading: danceEngine.loading });
      }

      if (now - lastScoreAt > 120) {
        lastScoreAt = now;
        const frame = stageFrame.resolveAt(t);
        if (dance.poseData && frame) {
          const accuracy = updateSyncScore(dance.poseData, frame, t);
          if (accuracy != null && prevSmoothScoreRef.current > 50 && accuracy < 20) {
            setShowMissedAlert(true);
          }
          if (accuracy != null) {
            prevSmoothScoreRef.current = prevSmoothScoreRef.current * 0.7 + accuracy * 0.3;
          }
        }

        groupStageRef.current = {
          groupId,
          groupName: group?.nameKr,
          songTitle: song?.title,
          myMemberId,
          myMemberName: myMember?.nameKr,
          myMemberColor: myMember?.color,
          currentFrame: frame,
          danceSnapshot: snapshot,
          score: roundedScore,
          formationHole,
          formationTimeline: practiceSessionData.formationTimeline ?? null,
          referenceVideoUrl: referenceYoutubeUrl,
          beatProgress: maxDuration > 0 ? t / maxDuration : 0,
          currentTime: t,
          maxDuration,
          bpm: song?.bpm,
          isPlaying: isRunning,
          members: group?.members.map((m) => ({
            id: m.id,
            nameKr: m.nameKr,
            color: m.color,
            avatar: m.avatar,
            defaultX: m.defaultX,
            defaultY: m.defaultY,
            isUser: m.id === myMemberId,
          })),
        };
      }

      if (isRunning && !clock.isFinished) {
        practiceAnimRef.current = requestAnimationFrame(loop);
      }
    };

    practiceAnimRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(practiceAnimRef.current);
  }, [
    isPracticing,
    isRunning,
    isFinished,
    referenceYoutubeUrl,
    stageFrame.resolveAt,
    dance.poseData,
    updateSyncScore,
    groupId,
    group,
    song,
    myMemberId,
    myMember,
    roundedScore,
    formationHole,
    maxDuration,
    danceEngine.loading,
  ]);

  useEffect(() => {
    if (practiceEnded) {
      finishSession(getFinalStats());
    }
  }, [practiceEnded, finishSession, getFinalStats]);

  const startPracticeAfterCountdown = useCallback(() => {
    setSessionPhase('practicing');
    prevSmoothScoreRef.current = 100;
    startTimeline();
    if (referenceYoutubeUrl) {
      ytPlayerRef.current?.seekTo?.(0);
      ytPlayerRef.current?.play?.();
    }
  }, [startTimeline, referenceYoutubeUrl]);

  const runCountdown = useCallback(() => {
    slotEnteredRef.current = true;
    setShowGhost(false);
    setSessionPhase('countdown');
    let c = 3;
    setCountdown(c);
    const timer = window.setInterval(() => {
      c -= 1;
      if (c > 0) {
        setCountdown(c);
      } else if (c === 0) {
        setCountdown(0);
      } else {
        clearInterval(timer);
        setCountdown(null);
        startPracticeAfterCountdown();
      }
    }, 900);
  }, [startPracticeAfterCountdown]);

  const waitingLoop = useCallback(() => {
    const snapshot = syncDanceStage(0);
    if (snapshot) renderGroupStage(snapshot);

    if (sessionPhase === 'waiting_slot' && checkSlotEntry()) {
      runCountdown();
      return;
    }

    if (sessionPhase === 'waiting_slot' || sessionPhase === 'lobby') {
      animFrameRef.current = requestAnimationFrame(waitingLoop);
    }
  }, [renderGroupStage, sessionPhase, checkSlotEntry, runCountdown, syncDanceStage]);

  const enterStudio = useCallback(async () => {
    resetLivePoseKalmanFilter();
    await dance.startTracking();
    const stream = dance.getStream();
    if (stream) recorder.startRecording(stream);
    setSessionPhase('waiting_slot');
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(waitingLoop);
  }, [dance, recorder, waitingLoop]);

  useEffect(() => {
    if (!studio.studioEnabled) return undefined;
    const timer = window.setInterval(() => {
      if (groupStageRef.current) {
        studio.publishStudioState({ groupStage: groupStageRef.current });
      }
    }, 400);
    return () => clearInterval(timer);
  }, [studio.studioEnabled, studio.publishStudioState]);

  const handleForceQuit = useCallback(async () => {
    forceStop();
    await finishSession(getFinalStats());
  }, [forceStop, finishSession, getFinalStats]);

  useEffect(() => () => {
    cancelAnimationFrame(animFrameRef.current);
    cancelAnimationFrame(practiceAnimRef.current);
    stopDanceTrackingRef.current?.();
    resetLivePoseKalmanFilter();
  }, []);

  if (!group || !myMember || !song) return null;

  const gridStyle = {
    width: '100vw',
    height: isMobile ? '100dvh' : '100vh',
    background: '#030308',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    gap: 8,
    padding: 8,
    paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
    paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
  };

  return (
    <div ref={screenRef} className={`tv-mode group-studio-session ${layoutClass}`} style={gridStyle}>
      <header
        style={{
          gridColumn: isMobile ? undefined : '1 / -1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: 10,
        }}
      >
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{song.title}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
            {group.nameKr} · {myMember.nameKr}
          </span>
        </div>
        <div
          style={{
            position: 'fixed',
            top: 'calc(12px + env(safe-area-inset-top, 0px))',
            right: 12,
            zIndex: 60,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            className={`studio-tv-btn ${studio.isConnected ? 'is-live' : ''}`}
            onClick={() => setStudioModalOpen(true)}
            style={{ fontSize: 11, padding: '6px 12px' }}
          >
            {t('groupStudio.session.tvConnect')}
          </button>
          <button
            type="button"
            className={`studio-tv-btn studio-fullscreen-btn ${isFullscreen ? 'is-live' : ''}`}
            onClick={handleToggleFullscreen}
            style={{ fontSize: 11, padding: '6px 12px' }}
          >
            {isFullscreen ? '전체 화면 해제' : '전체 화면'}
          </button>
        </div>
      </header>

      <StudioConnectModal
        open={studioModalOpen}
        onClose={() => setStudioModalOpen(false)}
        mode="group"
        sessionCode={studio.sessionCode}
        displayUrl={studio.displayUrl}
        studioEnabled={studio.studioEnabled}
        isConnected={studio.isConnected}
        webrtcStatus={studio.webrtcStatus}
        syncError={studio.syncError}
        webrtcError={studio.webrtcError}
        onStartStudio={studio.startStudio}
        onJoinStudio={studio.joinStudio}
        onStopStudio={() => { studio.stopStudio(); setStudioModalOpen(false); }}
      />

      <div className={`group-studio-practice-shell ${referenceYoutubeUrl ? '' : 'group-studio-practice-shell--no-ref'}`}>
        {referenceYoutubeUrl ? (
          <div className="group-studio-ref-pane">
            <div className="group-studio-pane-label">{t('groupStudio.session.referenceVideo')}</div>
            <div className="group-studio-ref-body">
              <YouTubeTVPlayer ref={ytPlayerRef} embedUrl={referenceYoutubeUrl} autoplay={false} />
            </div>
          </div>
        ) : null}

        <div className="group-studio-stage-pane group-studio-stage-panel" style={{ position: 'relative', borderColor: `${myMember.color}33` }}>
        {isDevEnvironment() ? (
          <>
            <PracticeDebugHUD
              frameIndex={debugHudStats.frameIndex}
              totalFrames={debugHudStats.totalTimelineFrames}
              duration={maxDuration}
              skeletonCount={debugHudStats.skeletonCount}
              aiAvatarCount={debugHudStats.aiAvatarCount}
              userSkeletonJoints={debugHudStats.userSkeletonJoints}
              currentTimeline={effectiveTime}
              snapshotAiCount={debugHudStats.snapshotAiCount}
              validationReport={practiceSessionData.motionMetadata?.validationReport}
              interpolatedMemberCount={practiceSessionData.motionMetadata?.pipelineAudit?.interpolatedMemberCount}
            />
            <GroupMotionDebugOverlay debug={groupMotionDebug} visible />
          </>
        ) : null}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 14px', background: 'rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{t('groupStudio.session.stageLabel')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={`group-studio-stage-view-toggle ${stageViewMode === '3d' ? 'is-active' : ''}`}
              onClick={() => setStageViewMode('3d')}
            >
              3D
            </button>
            <button
              type="button"
              className={`group-studio-stage-view-toggle ${stageViewMode === '2d' ? 'is-active' : ''}`}
              onClick={() => setStageViewMode('2d')}
            >
              2D
            </button>
            {group.members.map((m) => (
              <div key={m.id} style={{ width: 18, height: 18, borderRadius: '50%', background: m.id === myMemberId ? m.color : `${m.color}44`, border: `1px solid ${m.color}66`, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.id === myMemberId ? '👤' : m.avatar}
              </div>
            ))}
          </div>
        </div>

        {show3DRenderer ? (
          <Suspense
            fallback={
              <div style={{ minHeight: 280, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                3D 스테이지 로딩 중...
              </div>
            }
          >
            <GroupDanceStage3D
              snapshot={danceSnapshot}
              snapshotLoading={danceEngine.loading}
              skeletonFrames={sessionFrames}
              currentTimeSec={snapshotCurrentTime(danceSnapshot) || effectiveTime}
              className="group-studio-stage-3d"
              avatarAssets={avatarAssets}
              formationHole={formationHole}
              useCharacterAvatars={stageViewMode === '3d'}
            />
          </Suspense>
        ) : (
          <div className="group-studio-stage-canvas-wrap" style={{ position: 'relative' }}>
            <GroupDanceStage2D ref={stage2DRef} />
            {isDevEnvironment() ? (
              <SnapshotDebugOverlay snapshot={danceSnapshot} loading={danceEngine.loading} />
            ) : null}
          </div>
        )}

        {danceEngine.error && stageViewMode === '3d' ? (
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, padding: '8px 10px', borderRadius: 10, background: 'rgba(40,20,24,0.85)', color: '#ffc4cc', fontSize: 11, zIndex: 12 }}>
            3D 데이터 로드 실패 — 2D 보기로 전환해 주세요.
          </div>
        ) : null}

        {isPracticing && stageSkeletonCount === 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,68,68,0.15)',
              border: '1px solid rgba(255,68,68,0.35)',
              color: '#ffb4b4',
              fontSize: 11,
              zIndex: 14,
              lineHeight: 1.5,
            }}
          >
            {skeletonIssue || 'AI 스켈레톤이 표시되지 않습니다. 안무 추출을 다시 진행해 주세요.'}
            {!skeletonValidation.valid ? (
              <span style={{ display: 'block', marginTop: 4, opacity: 0.85 }}>
                (유효 {skeletonValidation.report.validFrames}/{skeletonValidation.report.totalFrames}프레임
                {' · '}
                AI {skeletonValidation.aiMemberCount}명 · 평균 {skeletonValidation.report.memberAverage.toFixed(1)}명/프레임)
              </span>
            ) : skeletonValidation.report ? (
              <span style={{ display: 'block', marginTop: 4, opacity: 0.85 }}>
                (유효 {Math.round(skeletonValidation.report.validFrameRatio * 100)}% · {skeletonValidation.report.validFrames}/{skeletonValidation.report.totalFrames}프레임)
              </span>
            ) : null}
          </div>
        ) : null}

        {isPracticing && stageSkeletonCount > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              padding: '4px 8px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.55)',
              color: 'rgba(255,255,255,0.65)',
              fontSize: 10,
              zIndex: 12,
            }}
          >
            AI {stageSkeletonCount}명
          </div>
        ) : null}

        {!hasSkeletonData && sessionPhase === 'lobby' ? (
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,136,0,0.12)',
              border: '1px solid rgba(255,136,0,0.35)',
              color: '#ffd699',
              fontSize: 11,
              zIndex: 14,
            }}
          >
            저장된 스켈레톤 데이터가 비어 있습니다. 「캐시 사용」 말고 안무를 다시 추출해 주세요.
            {skeletonIssue ? ` (${skeletonIssue})` : ''}
          </div>
        ) : null}

        {countdown !== null ? <CountdownOverlay count={countdown} /> : null}

        {isPracticing && (isRunning || isFinished) ? (
          <TempoLockIndicator
            isRunning={isRunning}
            currentTime={referenceYoutubeUrl ? videoPlaybackTime : currentTime}
            totalDuration={effectiveMaxDuration}
          />
        ) : null}

        <MissedBeatAlert show={showMissedAlert} onDismiss={() => setShowMissedAlert(false)} />

        {isPracticing && isRunning ? (
          <button
            type="button"
            onClick={handleForceQuit}
            style={{
              position: 'absolute',
              top: 52,
              right: 12,
              padding: '6px 16px',
              background: 'rgba(255,68,68,0.15)',
              border: '1px solid rgba(255,68,68,0.3)',
              borderRadius: 8,
              color: '#FF4444',
              fontSize: 12,
              cursor: 'pointer',
              zIndex: 25,
            }}
          >
            그만하기
          </button>
        ) : null}

        {sessionPhase === 'lobby' ? (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,3,8,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 20 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>{t('groupStudio.session.title')}</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 8 }}>
              {otherMembers.map((m) => `${m.nameKr} AI`).join(' · ')}
            </p>
            <p style={{ fontSize: 12, color: myMember.color, marginBottom: 12 }}>
              {t('groupStudio.session.emptySlot', { member: myMember.nameKr })}
            </p>
            <p
              style={{
                fontSize: 12,
                color: '#FF4444',
                marginBottom: 28,
                textAlign: 'center',
                lineHeight: 1.6,
              }}
            >
              ⚠️ 시작하면 멈추거나 되돌릴 수 없습니다.
              <br />
              실제 그룹 무대처럼 끝까지 함께 진행하세요.
            </p>
            <button
              type="button"
              onClick={enterStudio}
              style={{ padding: '14px 48px', background: myMember.color, border: 'none', borderRadius: 50, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: `0 0 30px ${myMember.color}60` }}
            >
              {t('groupStudio.session.enterStage')}
            </button>
          </div>
        ) : null}

        {sessionPhase === 'waiting_slot' ? (
          <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, padding: '12px 16px', background: 'rgba(0,0,0,0.7)', borderRadius: 12, textAlign: 'center', zIndex: 15 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              {t('groupStudio.session.ghostSlot', { member: myMember.nameKr })}
            </p>
            <button
              type="button"
              onClick={runCountdown}
              style={{ marginTop: 8, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '4px 12px', cursor: 'pointer' }}
            >
              {t('groupStudio.session.manualStart')}
            </button>
          </div>
        ) : null}
        </div>

        <div className="group-studio-user-pane group-studio-stage-panel group-studio-stage-panel--user-slot">
          <div className="group-studio-pane-label group-studio-user-pane-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: dance.isTracking ? '#00FF88' : '#FF4444',
                  boxShadow: dance.isTracking ? '0 0 6px #00FF88' : 'none',
                }}
              />
              <span>{t('groupStudio.session.myCamera')}</span>
            </div>
            <span style={{ fontWeight: 600, color: myMember.color }}>{myMember.nameKr}</span>
          </div>
          <div className="group-studio-user-body">
            <CameraPreviewStack
              videoRef={dance.videoRef}
              skeletonCanvasRef={dance.canvasRef}
              isTracking={dance.isTracking}
              cameraError={dance.cameraHealth?.error}
              showPlaceholder={sessionPhase !== 'lobby'}
              fitMode={dance.fitMode}
            />
          </div>
          <div className="group-studio-user-score">
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: roundedScore > 80 ? '#00FF88' : roundedScore > 60 ? '#FFD700' : isPracticing ? '#FF4444' : 'rgba(255,255,255,0.2)',
              }}
            >
              {isPracticing ? roundedScore || 0 : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
              {t('groupStudio.session.syncScore')}
            </div>
          </div>
        </div>
      </div>

      <div style={{ gridColumn: isMobile ? undefined : '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'rgba(0,0,0,0.6)', borderRadius: 12, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {isPracticing && isRunning
            ? `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}`
            : sessionPhase === 'waiting_slot'
              ? t('groupStudio.session.waitingPosition')
              : t('groupStudio.session.ready')}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {onHome ? (
            <button
              type="button"
              onClick={onHome}
              disabled={isPracticing && isRunning}
              style={{
                padding: '6px 16px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                color: isPracticing && isRunning ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                fontSize: 12,
                cursor: isPracticing && isRunning ? 'not-allowed' : 'pointer',
              }}
            >
              {t('groupStudio.session.home')}
            </button>
          ) : null}
        </div>
        <span style={{ fontSize: 11, color: myMember.color, fontWeight: 500 }}>
          {isPracticing && isRunning
            ? `${myMember.nameKr} · 실시간 진행 중`
            : `${myMember.nameKr} ${t('groupStudio.session.practiceStep')}`}
        </span>
      </div>
    </div>
  );
}

export default GroupStudioSession;
