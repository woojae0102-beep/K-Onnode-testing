// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import useWebRtcSession from '../hooks/useWebRtcSession';
import { useTVDisplaySync } from '../hooks/useTVDisplaySync';
import YouTubeTVPlayer from '../components/tv/YouTubeTVPlayer';
import { db, appId } from '../firebase';
import { AGENCY_COLORS } from '../types/tv';
import '../styles/tv-display.css';

export default function TVDisplayView({ code }) {
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

  useEffect(() => {
    if (!remoteVideoRef.current) return;
    if (webrtc.remoteStream) {
      remoteVideoRef.current.srcObject = webrtc.remoteStream;
      remoteVideoRef.current.play?.().catch(() => {});
    } else {
      remoteVideoRef.current.srcObject = null;
    }
  }, [webrtc.remoteStream]);

  useEffect(() => {
    const t = syncState?.currentTime;
    if (typeof t !== 'number' || !playerRef.current?.isReady?.()) return;
    const now = Date.now();
    if (now - lastSeekRef.current < 400) return;
    const local = playerRef.current.getCurrentTime?.() || 0;
    if (Math.abs(local - t) > 0.6) {
      playerRef.current.seekTo?.(t);
      lastSeekRef.current = now;
    }
  }, [syncState?.currentTime]);

  useEffect(() => {
    const rate = syncState?.playbackRate;
    if (!rate || !playerRef.current?.setPlaybackRate) return;
    playerRef.current.setPlaybackRate(rate);
  }, [syncState?.playbackRate]);

  const vocal = syncState?.vocalMetrics || {};
  const feedback = syncState?.feedback || (isConnected ? '연습 중...' : '폰에서 카메라/마이크를 켜면 이 화면에 표시됩니다');
  const score = syncState?.score || 0;

  return (
    <div className="tv-display-root">
      <header className="tv-display-header">
        <div className="tv-display-header-left">
          <span className="tv-display-badge">ONNODE TV</span>
          <span className="tv-display-code">코드 {code}</span>
          <span className="tv-display-mode" style={{ color: agencyColor }}>
            {agency.toUpperCase()} · {isDance ? '댄스' : '보컬'}
          </span>
        </div>
        <div className={`tv-display-conn tv-display-conn-${webrtc.status}`}>
          {isConnected ? '● 실시간 연결됨' : `○ ${webrtc.status === 'connecting' ? '연결 중' : '폰 연결 대기'}`}
        </div>
      </header>

      <div className="tv-display-split">
        <section className="tv-display-pane tv-display-ref">
          <div className="tv-display-pane-label">레퍼런스 영상</div>
          <div className="tv-display-pane-body">
            {syncState?.referenceVideoUrl ? (
              <YouTubeTVPlayer
                ref={playerRef}
                embedUrl={syncState.referenceVideoUrl}
                playbackRate={syncState?.playbackRate || 1}
                autoplay={false}
              />
            ) : (
              <div className="tv-display-placeholder">
                <p>폰에서 유튜브 연습 영상을 불러오면 여기에 표시됩니다</p>
              </div>
            )}
          </div>
        </section>

        <section className="tv-display-pane tv-display-user">
          <div className="tv-display-pane-label">{isDance ? '내 모습 (실시간)' : '내 보컬 (실시간)'}</div>
          <div className="tv-display-pane-body">
            {isConnected ? (
              <>
                <video
                  ref={remoteVideoRef}
                  className={`tv-display-remote-video ${isDance ? '' : 'tv-display-audio-only'}`}
                  autoPlay
                  playsInline
                  muted={false}
                />
                {!isDance ? (
                  <div className="tv-display-vocal-overlay">
                    <div className="tv-display-vocal-bars">
                      {Array.from({ length: 12 }).map((_, i) => {
                        const lvl = vocal.volumeLevel || 0;
                        const h = Math.max(8, (lvl / 100) * 100 * (0.5 + Math.sin(i) * 0.3));
                        return (
                          <span
                            key={i}
                            className="tv-display-vocal-bar"
                            style={{ height: `${h}%`, background: agencyColor }}
                          />
                        );
                      })}
                    </div>
                    <div className="tv-display-vocal-meta">
                      <span>{vocal.tuningState === 'in-tune' ? '✓ 음정 양호' : vocal.pitchFeedback || '마이크 수신 중'}</span>
                      <span>점수 {vocal.pitchScore || score || 0}</span>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="tv-display-placeholder tv-display-waiting">
                <div className="tv-display-waiting-icon">📱 → 📺</div>
                <p>스마트폰에서 트레이닝을 시작하고</p>
                <p>
                  <strong>{isDance ? '카메라' : '마이크'}</strong>를 켜 주세요
                </p>
                {webrtc.error ? <p className="tv-display-error">{webrtc.error}</p> : null}
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="tv-display-footer">
        <div className="tv-display-feedback">{feedback}</div>
        {score > 0 ? <div className="tv-display-score">점수 {Math.round(score)}</div> : null}
      </footer>
    </div>
  );
}
