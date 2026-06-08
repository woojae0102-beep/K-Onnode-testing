// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import useWebRtcSession from '../hooks/useWebRtcSession';
import { useTVDisplaySync } from '../hooks/useTVDisplaySync';
import YouTubeTVPlayer from '../components/tv/YouTubeTVPlayer';
import StudioSkeletonCanvas from '../components/studio/StudioSkeletonCanvas';
import { db, appId } from '../firebase';
import { AGENCY_COLORS } from '../types/tv';
import '../styles/studio-mode.css';

export default function StudioTVDisplay({ code, isHost = false }) {
  const playerRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const lastSeekRef = useRef(0);

  const { state: syncState } = useTVDisplaySync(code, { role: 'tv' });
  const webrtc = useWebRtcSession({
    db,
    appId,
    sessionId: code,
    role: 'laptop',
    localStream: null,
    enabled: !!code && !!db,
  });

  const agency = syncState?.agency || 'hybe';
  const mode = syncState?.mode || 'dance';
  const agencyColor = AGENCY_COLORS[agency] || '#FF1F8E';
  const isDance = mode === 'dance';
  const isConnected = webrtc.status === 'connected';
  const isPaused = syncState?.isPaused;

  const feedback =
    syncState?.feedback ||
    (isHost && !syncState?.status
      ? `코드 ${code} — 모바일 앱 → TV 연결 → 이 코드 입력`
      : '모바일에서 카메라를 켜면 실시간 분석이 시작됩니다');
  const score = Math.round(syncState?.score || 0);
  const beatAccuracy = Math.round(syncState?.beatAccuracy || syncState?.scores?.rhythm || score);
  const latestTip = syncState?.feedbackItems?.[syncState.feedbackItems.length - 1]?.message;

  useEffect(() => {
    if (!remoteVideoRef.current || !isDance) return;
    if (webrtc.remoteStream) {
      remoteVideoRef.current.srcObject = webrtc.remoteStream;
      remoteVideoRef.current.play?.().catch(() => {});
    } else {
      remoteVideoRef.current.srcObject = null;
    }
  }, [webrtc.remoteStream, isDance]);

  useEffect(() => {
    const t = syncState?.currentTime;
    if (typeof t !== 'number' || !playerRef.current?.isReady?.() || isPaused) return;
    const now = Date.now();
    if (now - lastSeekRef.current < 400) return;
    const local = playerRef.current.getCurrentTime?.() || 0;
    if (Math.abs(local - t) > 0.6) {
      playerRef.current.seekTo?.(t);
      lastSeekRef.current = now;
    }
  }, [syncState?.currentTime, isPaused]);

  useEffect(() => {
    if (isPaused) playerRef.current?.pause?.();
    else if (syncState?.isPlaying) playerRef.current?.play?.();
  }, [isPaused, syncState?.isPlaying]);

  const vocal = syncState?.vocalMetrics || {};

  return (
    <div className="studio-tv-root">
      <div className="studio-tv-ambient" style={{ background: `radial-gradient(ellipse at 30% 0%, ${agencyColor}22, transparent 55%)` }} />

      <header className="studio-tv-top">
        <div className="studio-tv-brand">
          <span>ONNODE STUDIO</span>
          <strong style={{ color: agencyColor }}>{agency.toUpperCase()}</strong>
        </div>
        <div className="studio-tv-song">
          <span className="studio-tv-song-label">NOW PLAYING</span>
          <strong>{syncState?.songTitle || '연습 곡'}</strong>
        </div>
        <div className="studio-tv-step">
          STEP {syncState?.practiceStep || 1} · {syncState?.practiceStepLabel || '워밍업'}
        </div>
        <div className={`studio-tv-live ${isConnected ? 'is-live' : ''}`}>
          {isConnected ? '● LIVE' : '○ 대기'}
        </div>
      </header>

      <main className="studio-tv-main">
        <section className="studio-tv-coach-pane">
          <div className="studio-tv-coach-card">
            <div className="studio-tv-avatar">{syncState?.coachAvatar || '🎤'}</div>
            <div className="studio-tv-coach-meta">
              <strong>{syncState?.coachName || 'AI 코치'}</strong>
              <span>{syncState?.coachTagline || '실시간 코칭'}</span>
            </div>
          </div>

          <div className="studio-tv-ref">
            <div className="studio-tv-ref-label">안무 시범</div>
            <div className="studio-tv-ref-body">
              {syncState?.referenceVideoUrl ? (
                <YouTubeTVPlayer
                  ref={playerRef}
                  embedUrl={syncState.referenceVideoUrl}
                  playbackRate={syncState?.playbackRate || 1}
                  autoplay={false}
                />
              ) : (
                <div className="studio-tv-ref-empty">모바일에서 연습 영상을 불러오는 중...</div>
              )}
            </div>
          </div>

          <div className="studio-tv-scoreboard">
            <div className="studio-tv-score-main">
              <span>SCORE</span>
              <strong style={{ color: agencyColor }}>{score}</strong>
            </div>
            <div className="studio-tv-score-sub">
              <span>박자 정확도</span>
              <strong>{beatAccuracy}%</strong>
            </div>
            {!isDance ? (
              <div className="studio-tv-score-sub">
                <span>음정</span>
                <strong>{vocal.pitchScore || 0}</strong>
              </div>
            ) : null}
          </div>
        </section>

        <section className="studio-tv-user-pane">
          <div className="studio-tv-user-label">{isDance ? '내 동작 · 스켈레톤' : '보컬 분석'}</div>
          <div className="studio-tv-user-body">
            {isDance ? (
              <>
                <video ref={remoteVideoRef} className="studio-tv-remote-video" autoPlay playsInline muted />
                <StudioSkeletonCanvas poseSnapshot={syncState?.poseSnapshot} accent={agencyColor} className="studio-tv-skeleton" />
              </>
            ) : (
              <div className="studio-tv-vocal-stage">
                <div className="studio-tv-vocal-bars">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const lvl = vocal.volumeLevel || 0;
                    const h = Math.max(10, lvl * (0.6 + (i % 4) * 0.1));
                    return <span key={i} style={{ height: `${h}%`, background: agencyColor }} />;
                  })}
                </div>
                <p>{vocal.tuningState === 'in-tune' ? '음정 양호' : vocal.pitchFeedback || '마이크 신호 대기'}</p>
              </div>
            )}

            {!isConnected ? (
              <div className="studio-tv-waiting">
                {isHost ? (
                  <>
                    <div className="studio-tv-host-code">{code}</div>
                    <p>모바일 ONNODE 앱에서 이 코드를 입력하세요</p>
                  </>
                ) : (
                  <p>모바일 카메라 연결 대기 중...</p>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="studio-tv-feedback-bar">
        <div className="studio-tv-feedback-main">
          {latestTip || feedback}
        </div>
        {isPaused ? <div className="studio-tv-paused">⏸ 일시정지</div> : null}
      </footer>
    </div>
  );
}
