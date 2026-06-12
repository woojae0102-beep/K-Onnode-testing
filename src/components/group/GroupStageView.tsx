// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { useMediaPipeTV } from '../../hooks/useMediaPipeTV';
import { useAvatarSync } from '../../hooks/useAvatarSync';
import { useFormationTracker } from '../../hooks/useFormationTracker';
import { useStudioSession } from '../../hooks/useStudioSession';
import { useTVScreenLayout } from '../../hooks/useTVScreenLayout';
import {
  drawStageBackground,
  drawMySpot,
  drawAIAvatar,
  drawUserSkeleton,
} from '../../utils/groupSkeletonDraw';
import StudioConnectModal from '../studio/StudioConnectModal';
import FormationGuide from './FormationGuide';
import type { Agency } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';
import '../../styles/studio-mode.css';

export function GroupStageView({
  groupId,
  myMemberId,
  skeletonData,
  agency = 'hybe',
  onEnd,
  onHome,
}) {
  const group = GROUP_DATA[groupId];
  const myMember = group?.members.find((m) => m.id === myMemberId);
  const otherMembers = group?.members.filter((m) => m.id !== myMemberId) || [];
  const agencyColor = AGENCY_COLORS[agency as Agency] || '#FF1F8E';

  const stageCanvasRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [scores, setScores] = useState({});
  const [studioModalOpen, setStudioModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const screenRef = useRef(null);
  const animFrameRef = useRef(0);
  const groupStageRef = useRef(null);

  const { layoutClass, isMobile } = useTVScreenLayout();
  const dance = useMediaPipeTV(myMember?.color || agencyColor);
  const avatarSync = useAvatarSync(skeletonData);
  const formation = useFormationTracker(groupId, myMemberId);

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

  const studio = useStudioSession({
    localStream: dance.getStream(),
    mode: 'group',
    agency,
    songTitle: `${group?.nameKr || '그룹'} · ${myMember?.nameKr || ''} 파트`,
    playbackRate: 1,
    getCurrentTime: () => avatarSync.getElapsed(),
    feedbackText: scores.overall
      ? `싱크 점수 ${scores.overall}점 — ${scores.overall > 80 ? '훌륭해요!' : '조금 더 맞춰봐요!'}`
      : '그룹 연습 준비 중...',
    score: scores.overall || 0,
    scores: {
      rhythm: scores.overall || 0,
      posture: scores.position || 0,
      angle: scores.formation || 0,
      expression: 0,
      energy: 0,
      stability: 0,
    },
    poseData: dance.poseData,
    practiceStep: 2,
    practiceStepLabel: '그룹 연습',
    isPaused,
    isPlaying: isPlaying && !isPaused,
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
      drawMySpot(ctx, myPos, myMember.color);

      frame?.members?.forEach((memberData) => {
        if (memberData.estimatedMemberId === myMemberId) return;
        const member = group.members.find((m) => m.id === memberData.estimatedMemberId);
        if (!member) return;
        drawAIAvatar(ctx, memberData.joints, member.color, member.nameKr, canvas);
      });

      if (dance.poseData?.joints) {
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
    [group, myMember, myMemberId, dance.poseData],
  );

  const calculateScores = useCallback(
    (userPose, frame) => {
      if (!userPose?.joints || !frame) return;
      const formationScore = formation.scoreFormation(userPose.joints, frame);
      const positionScore = formation.scorePosition(userPose.joints);
      const overall = Math.round(formationScore * 0.7 + positionScore * 0.3);
      setScores({
        overall,
        formation: formationScore,
        position: positionScore,
        timestamp: avatarSync.getElapsed(),
      });
    },
    [formation, avatarSync],
  );

  const renderLoop = useCallback(() => {
    if (isPaused) return;
    const elapsed = avatarSync.getElapsed();
    setCurrentTime(elapsed);
    const frame = avatarSync.getCurrentFrame();
    if (frame) renderGroupStage(frame);
    if (dance.poseData && frame) calculateScores(dance.poseData, frame);

    groupStageRef.current = {
      groupId,
      groupName: group?.nameKr,
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

    animFrameRef.current = requestAnimationFrame(renderLoop);
  }, [
    isPaused,
    avatarSync,
    renderGroupStage,
    dance.poseData,
    calculateScores,
    groupId,
    group,
    myMemberId,
    myMember,
    scores.overall,
  ]);

  useEffect(() => {
    if (!studio.studioEnabled) return undefined;
    const timer = window.setInterval(() => {
      if (groupStageRef.current) {
        studio.publishStudioState({ groupStage: groupStageRef.current });
      }
    }, 400);
    return () => clearInterval(timer);
  }, [studio.studioEnabled, studio.publishStudioState]);

  const startPractice = useCallback(async () => {
    await dance.startTracking();
    avatarSync.start();
    setIsPlaying(true);
    setIsPaused(false);
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(renderLoop);
  }, [dance, avatarSync, renderLoop]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    avatarSync.pause();
    cancelAnimationFrame(animFrameRef.current);
  }, [avatarSync]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    avatarSync.resume();
    animFrameRef.current = requestAnimationFrame(renderLoop);
  }, [avatarSync, renderLoop]);

  const handleEnd = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    dance.stopTracking();
    studio.stopStudio();
    onEnd({
      scores,
      duration: currentTime,
      overall: scores.overall || 0,
      groupId,
      memberId: myMemberId,
      groupName: group?.nameKr,
      memberName: myMember?.nameKr,
    });
  }, [dance, studio, onEnd, scores, currentTime, groupId, myMemberId, group, myMember]);

  useEffect(() => () => {
    cancelAnimationFrame(animFrameRef.current);
    dance.stopTracking();
  }, [dance]);

  if (!group || !myMember) return null;

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
    <div ref={screenRef} className={`tv-mode group-stage-screen ${layoutClass}`} style={gridStyle}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: myMember.color }}>
            {group.nameKr} · 그룹 연습
          </span>
          {studio.studioEnabled ? (
            <span style={{ fontSize: 10, color: studio.isConnected ? '#00FF88' : 'rgba(255,255,255,0.4)' }}>
              {studio.isConnected ? '● TV LIVE' : '○ TV 대기'}
            </span>
          ) : null}
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
            📺 TV 연결
          </button>
          <button
            type="button"
            className={`studio-tv-btn studio-fullscreen-btn ${isFullscreen ? 'is-live' : ''}`}
            onClick={handleToggleFullscreen}
            style={{ fontSize: 11, padding: '6px 12px' }}
          >
            {isFullscreen ? '전체 화면 해제' : '전체 화면'}
          </button>
          <FormationGuide groupId={groupId} myMemberId={myMemberId} />
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
        onStopStudio={() => {
          studio.stopStudio();
          setStudioModalOpen(false);
        }}
      />

      {/* 좌: 내 카메라 */}
      <div
        style={{
          background: '#0a0a14',
          border: `1px solid ${myMember.color}33`,
          borderRadius: 16,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: isMobile ? 200 : undefined,
          flex: isMobile ? '0 0 auto' : undefined,
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
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
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>
              내 카메라
            </span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: myMember.color }}>
            {myMember.nameKr} 파트
          </span>
        </div>

        <div style={{ flex: 1, position: 'relative', minHeight: 160 }}>
          <video
            ref={dance.videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            }}
          />
          <canvas
            ref={dance.canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              transform: 'scaleX(-1)',
            }}
          />
        </div>

        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(0,0,0,0.4)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color:
                (scores.overall || 0) > 80
                  ? '#00FF88'
                  : (scores.overall || 0) > 60
                    ? '#FFD700'
                    : '#FF4444',
              textShadow: '0 0 20px currentColor',
            }}
          >
            {scores.overall || 0}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            SYNC SCORE
          </div>
        </div>
      </div>

      {/* 우: 그룹 스테이지 */}
      <div
        style={{
          background: '#0a0a14',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          position: 'relative',
          overflow: 'hidden',
          flex: isMobile ? 1 : undefined,
          minHeight: isMobile ? 240 : undefined,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '10px 14px',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>
            {group.nameKr} · 그룹 스테이지
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {group.members.map((member) => (
              <div
                key={member.id}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background:
                    member.id === myMemberId ? member.color : `${member.color}44`,
                  border: `1px solid ${member.color}66`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                }}
              >
                {member.id === myMemberId ? '👤' : member.avatar}
              </div>
            ))}
          </div>
        </div>

        <canvas
          ref={stageCanvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {!isPlaying ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(3,3,8,0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
              준비되셨나요?
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 24,
                textAlign: 'center',
              }}
            >
              {group.nameKr}의 {otherMembers.map((m) => m.nameKr).join(', ')}이
              <br />
              AI 아바타로 함께 연습합니다
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
              {group.members.map((member) => (
                <div key={member.id} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background:
                        member.id === myMemberId ? `${member.color}44` : `${member.color}22`,
                      border: `2px solid ${member.id === myMemberId ? member.color : `${member.color}44`}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      boxShadow:
                        member.id === myMemberId ? `0 0 16px ${member.color}60` : 'none',
                      marginBottom: 4,
                    }}
                  >
                    {member.id === myMemberId ? '👤' : member.avatar}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color:
                        member.id === myMemberId ? member.color : 'rgba(255,255,255,0.4)',
                      fontWeight: member.id === myMemberId ? 600 : 400,
                    }}
                  >
                    {member.id === myMemberId ? 'YOU' : member.nameKr}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={startPractice}
              style={{
                padding: '14px 48px',
                background: myMember.color,
                border: 'none',
                borderRadius: 50,
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: `0 0 30px ${myMember.color}60`,
              }}
            >
              연습 시작
            </button>
          </div>
        ) : null}
      </div>

      {/* 하단 컨트롤 */}
      <div
        style={{
          gridColumn: isMobile ? undefined : '1 / -1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {Math.floor(currentTime / 60)
            .toString()
            .padStart(2, '0')}
          :
          {Math.floor(currentTime % 60)
            .toString()
            .padStart(2, '0')}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isPlaying ? (
            <button
              type="button"
              onClick={isPaused ? handleResume : handlePause}
              style={{
                padding: '6px 20px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {isPaused ? '재개' : '일시정지'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleEnd}
            style={{
              padding: '6px 20px',
              background: 'rgba(255,68,68,0.15)',
              border: '1px solid rgba(255,68,68,0.3)',
              borderRadius: 8,
              color: '#FF4444',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            종료
          </button>
          {onHome ? (
            <button
              type="button"
              onClick={onHome}
              style={{
                padding: '6px 20px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              홈
            </button>
          ) : null}
        </div>
        <div style={{ fontSize: 11, color: myMember.color, fontWeight: 500 }}>
          {myMember.nameKr} 파트 연습 중
        </div>
      </div>
    </div>
  );
}

export default GroupStageView;
