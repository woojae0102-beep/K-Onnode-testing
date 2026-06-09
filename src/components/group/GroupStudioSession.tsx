// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { getSongById } from '../../data/groupStudioSongs';
import { useMediaPipeTV } from '../../hooks/useMediaPipeTV';
import { useAvatarSync } from '../../hooks/useAvatarSync';
import { useSyncScore } from '../../hooks/useSyncScore';
import { useStudioSession } from '../../hooks/useStudioSession';
import { useTVScreenLayout } from '../../hooks/useTVScreenLayout';
import {
  drawStageBackground,
  drawGhostSlot,
  drawMySpot,
  drawAIAvatar,
  drawUserSkeleton,
} from '../../utils/groupSkeletonDraw';
import StudioConnectModal from '../studio/StudioConnectModal';
import CountdownOverlay from './CountdownOverlay';
import type { Agency } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';
import '../../styles/group-studio.css';
import '../../styles/studio-mode.css';

const SLOT_THRESHOLD = 0.15;

export function GroupStudioSession({
  songId,
  groupId,
  myMemberId,
  skeletonData,
  agency = 'hybe',
  onEnd,
  onHome,
}) {
  const { t } = useTranslation();
  const song = getSongById(songId);
  const group = GROUP_DATA[groupId];
  const myMember = group?.members.find((m) => m.id === myMemberId);
  const otherMembers = group?.members.filter((m) => m.id !== myMemberId) || [];
  const agencyColor = AGENCY_COLORS[agency as Agency] || '#FF1F8E';

  const stageCanvasRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [sessionPhase, setSessionPhase] = useState('lobby');
  const [countdown, setCountdown] = useState(null);
  const [showGhost, setShowGhost] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [studioModalOpen, setStudioModalOpen] = useState(false);
  const animFrameRef = useRef(0);
  const groupStageRef = useRef(null);
  const slotEnteredRef = useRef(false);

  const { layoutClass, isMobile } = useTVScreenLayout();
  const dance = useMediaPipeTV(myMember?.color || agencyColor);
  const avatarSync = useAvatarSync(skeletonData);
  const myDefault = { x: myMember?.defaultX ?? 0.5, y: myMember?.defaultY ?? 0.5 };
  const { scores, calculate: calculateSync, reset: resetSync } = useSyncScore(myMemberId, myDefault);

  const isPracticing = sessionPhase === 'practicing';

  const studio = useStudioSession({
    localStream: dance.getStream(),
    mode: 'group',
    agency,
    songTitle: song ? `${song.title} · ${myMember?.nameKr}` : `${group?.nameKr} · ${myMember?.nameKr}`,
    playbackRate: 1,
    getCurrentTime: () => avatarSync.getElapsed(),
    feedbackText: scores.overall
      ? t('groupStudio.session.syncFeedback', {
          score: scores.overall,
          msg: scores.overall > 80
            ? t('groupStudio.session.syncGreat')
            : t('groupStudio.session.syncKeepGoing'),
        })
      : t('groupStudio.session.ghostSlot', { member: myMember?.nameKr || '' }),
    score: scores.overall || 0,
    scores: {
      rhythm: scores.timing || 0,
      posture: scores.position || 0,
      angle: scores.pose || 0,
      expression: scores.formation || 0,
      energy: scores.energy || 0,
      stability: scores.overall || 0,
    },
    poseData: dance.poseData,
    practiceStep: 3,
    practiceStepLabel: t('groupStudio.session.practiceStep'),
    isPaused,
    isPlaying: isPracticing && !isPaused,
  });

  const resizeStageCanvas = useCallback(() => {
    const canvas = stageCanvasRef.current;
    if (!canvas?.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, []);

  useEffect(() => {
    resizeStageCanvas();
    window.addEventListener('resize', resizeStageCanvas);
    return () => window.removeEventListener('resize', resizeStageCanvas);
  }, [resizeStageCanvas, isMobile]);

  const renderGroupStage = useCallback(
    (frame) => {
      const canvas = stageCanvasRef.current;
      if (!canvas || !myMember) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      drawStageBackground(ctx, canvas.width, canvas.height);

      const myPos = {
        x: myMember.defaultX * canvas.width,
        y: myMember.defaultY * canvas.height,
      };

      if (showGhost && sessionPhase !== 'practicing') {
        drawGhostSlot(ctx, myPos, myMember.color);
      } else if (isPracticing) {
        drawMySpot(ctx, myPos, myMember.color);
      }

      frame?.members?.forEach((memberData) => {
        if (memberData.estimatedMemberId === myMemberId) return;
        const member = group.members.find((m) => m.id === memberData.estimatedMemberId);
        if (!member) return;
        drawAIAvatar(ctx, memberData.joints, member.color, member.nameKr, canvas);
      });

      if (dance.poseData?.joints && (isPracticing || sessionPhase === 'waiting_slot')) {
        drawUserSkeleton(
          ctx,
          dance.poseData.joints,
          myMember.color,
          canvas,
          myMember.defaultX,
          myMember.defaultY,
        );
      }
    },
    [group, myMember, myMemberId, dance.poseData, showGhost, sessionPhase, isPracticing],
  );

  const checkSlotEntry = useCallback(() => {
    if (!dance.poseData?.joints?.nose || slotEnteredRef.current) return false;
    const nose = dance.poseData.joints.nose;
    const dx = Math.abs(nose.x - myDefault.x);
    const dy = Math.abs(nose.y - myDefault.y);
    return dx < SLOT_THRESHOLD && dy < SLOT_THRESHOLD;
  }, [dance.poseData, myDefault]);

  const practiceLoop = useCallback(() => {
    if (isPaused || sessionPhase !== 'practicing') return;
    const elapsed = avatarSync.getElapsed();
    setCurrentTime(elapsed);
    const frame = avatarSync.getCurrentFrame();
    if (frame) renderGroupStage(frame);
    if (dance.poseData && frame) calculateSync(dance.poseData, frame, elapsed);

    groupStageRef.current = {
      groupId,
      groupName: group?.nameKr,
      songTitle: song?.title,
      myMemberId,
      myMemberName: myMember?.nameKr,
      myMemberColor: myMember?.color,
      currentFrame: frame,
      score: scores.overall || 0,
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

    animFrameRef.current = requestAnimationFrame(practiceLoop);
  }, [
    isPaused,
    sessionPhase,
    avatarSync,
    renderGroupStage,
    dance.poseData,
    calculateSync,
    groupId,
    group,
    song,
    myMemberId,
    myMember,
    scores.overall,
  ]);

  const startPracticeAfterCountdown = useCallback(() => {
    setSessionPhase('practicing');
    resetSync();
    avatarSync.start();
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(practiceLoop);
  }, [avatarSync, resetSync, practiceLoop]);

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
    const frame = skeletonData?.[0] || avatarSync.getCurrentFrame();
    if (frame) renderGroupStage(frame);

    if (sessionPhase === 'waiting_slot' && checkSlotEntry()) {
      runCountdown();
      return;
    }

    if (sessionPhase === 'waiting_slot' || sessionPhase === 'lobby') {
      animFrameRef.current = requestAnimationFrame(waitingLoop);
    }
  }, [skeletonData, avatarSync, renderGroupStage, sessionPhase, checkSlotEntry, runCountdown]);

  const enterStudio = useCallback(async () => {
    await dance.startTracking();
    setSessionPhase('waiting_slot');
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(waitingLoop);
  }, [dance, waitingLoop]);

  useEffect(() => {
    if (!studio.studioEnabled) return undefined;
    const timer = window.setInterval(() => {
      if (groupStageRef.current) {
        studio.publishStudioState({ groupStage: groupStageRef.current });
      }
    }, 400);
    return () => clearInterval(timer);
  }, [studio.studioEnabled, studio.publishStudioState]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    avatarSync.pause();
    cancelAnimationFrame(animFrameRef.current);
  }, [avatarSync]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    avatarSync.resume();
    animFrameRef.current = requestAnimationFrame(practiceLoop);
  }, [avatarSync, practiceLoop]);

  const handleEnd = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    dance.stopTracking();
    studio.stopStudio();
    onEnd({
      syncScores: scores,
      scores,
      duration: currentTime,
      overall: scores.overall || 0,
      groupId,
      memberId: myMemberId,
      songId,
      groupName: group?.nameKr,
      memberName: myMember?.nameKr,
      songTitle: song?.title,
      completed: true,
    });
  }, [dance, studio, onEnd, scores, currentTime, groupId, myMemberId, songId, group, myMember, song]);

  useEffect(() => () => {
    cancelAnimationFrame(animFrameRef.current);
    dance.stopTracking();
  }, [dance]);

  if (!group || !myMember || !song) return null;

  const gridStyle = isMobile
    ? {
        width: '100vw',
        height: '100dvh',
        background: '#030308',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 8,
        paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
      }
    : {
        width: '100vw',
        height: '100vh',
        background: '#030308',
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gridTemplateRows: 'auto 1fr auto',
        gap: 8,
        padding: 8,
      };

  return (
    <div className={`tv-mode group-studio-session ${layoutClass}`} style={gridStyle}>
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
        <button
          type="button"
          className={`studio-tv-btn ${studio.isConnected ? 'is-live' : ''}`}
          onClick={() => setStudioModalOpen(true)}
          style={{ fontSize: 11, padding: '6px 12px' }}
        >
          {t('groupStudio.session.tvConnect')}
        </button>
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

      <div
        style={{
          background: '#0a0a14',
          border: `1px solid ${myMember.color}33`,
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: isMobile ? 200 : undefined,
        }}
      >
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{t('groupStudio.session.myCamera')}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: myMember.color }}>{myMember.nameKr}</span>
        </div>
        <div style={{ flex: 1, position: 'relative', minHeight: 160 }}>
          <video ref={dance.videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <canvas ref={dance.canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
        </div>
        <div style={{ padding: '10px 14px', textAlign: 'center', background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: scores.overall > 80 ? '#00FF88' : scores.overall > 60 ? '#FFD700' : isPracticing ? '#FF4444' : 'rgba(255,255,255,0.2)' }}>
            {isPracticing ? scores.overall || 0 : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>{t('groupStudio.session.syncScore')}</div>
        </div>
      </div>

      <div style={{ background: '#0a0a14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, position: 'relative', overflow: 'hidden', flex: isMobile ? 1 : undefined }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 14px', background: 'rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{t('groupStudio.session.stageLabel')}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {group.members.map((m) => (
              <div key={m.id} style={{ width: 18, height: 18, borderRadius: '50%', background: m.id === myMemberId ? m.color : `${m.color}44`, border: `1px solid ${m.color}66`, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.id === myMemberId ? '👤' : m.avatar}
              </div>
            ))}
          </div>
        </div>
        <canvas ref={stageCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {countdown !== null ? <CountdownOverlay count={countdown} /> : null}

        {sessionPhase === 'lobby' ? (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,3,8,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 20 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>{t('groupStudio.session.title')}</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 8 }}>
              {otherMembers.map((m) => `${m.nameKr} AI`).join(' · ')}
            </p>
            <p style={{ fontSize: 12, color: myMember.color, marginBottom: 28 }}>
              {t('groupStudio.session.emptySlot', { member: myMember.nameKr })}
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

      <div style={{ gridColumn: isMobile ? undefined : '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'rgba(0,0,0,0.6)', borderRadius: 12, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {isPracticing
            ? `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}`
            : sessionPhase === 'waiting_slot' ? t('groupStudio.session.waitingPosition') : t('groupStudio.session.ready')}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {isPracticing ? (
            <button type="button" onClick={isPaused ? handleResume : handlePause} style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
              {isPaused ? t('groupStudio.session.resume') : t('groupStudio.session.pause')}
            </button>
          ) : null}
          <button type="button" onClick={handleEnd} style={{ padding: '6px 16px', background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 8, color: '#FF4444', fontSize: 12, cursor: 'pointer' }}>
            {t('groupStudio.session.end')}
          </button>
          {onHome ? (
            <button type="button" onClick={onHome} style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
              {t('groupStudio.session.home')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default GroupStudioSession;
