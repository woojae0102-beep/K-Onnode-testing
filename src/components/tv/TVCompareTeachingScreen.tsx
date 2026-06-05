// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Agency, SessionData, TrainingMode } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';
import { useAgencyPersona } from '../../hooks/useAgencyPersona';
import { useMediaPipeTV } from '../../hooks/useMediaPipeTV';
import { useTVMicrophone } from '../../hooks/useTVMicrophone';
import PlaybackSpeedControl from '../common/PlaybackSpeedControl';
import YouTubeTVPlayer from './YouTubeTVPlayer';
import UserCameraPanel from './UserCameraPanel';
import CoachReviewBlock from './CoachReviewBlock';
import { buildLocalCoachReview } from '../../utils/tvCoachReview';
import VocalLineCoachingLoop from '../coaching/VocalLineCoachingLoop';
import { TVCompareBottomDock, TVCompareBottomSheet } from './TVCompareBottomDock';

export default function TVCompareTeachingScreen({
  sessionData,
  agency,
  mode,
  onShowResult,
  onRetrySession,
}: {
  sessionData: SessionData | null;
  agency: Agency;
  mode: TrainingMode;
  onShowResult: () => void;
  onRetrySession: () => void;
}) {
  const agencyColor = AGENCY_COLORS[agency];
  const persona = useAgencyPersona(agency);
  const data = sessionData || {};
  const coachReview = data.coachReview || buildLocalCoachReview(data);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [rightMode, setRightMode] = useState('recording');
  const [isPlaying, setIsPlaying] = useState(false);
  const [syncTime, setSyncTime] = useState(0);
  const [sheetTab, setSheetTab] = useState(null);

  const refPlayerRef = useRef(null);
  const myVideoRef = useRef(null);
  const myAudioRef = useRef(null);
  const syncTimerRef = useRef(0);

  const isDance = mode === 'dance';
  const dance = useMediaPipeTV(agencyColor);
  const vocal = useTVMicrophone();
  const [vocalCoachKick, setVocalCoachKick] = useState(0);

  const tvSongAnalysis = useMemo(
    () => ({
      trackName: `${agency.toUpperCase()} TV 보컬 연습`,
      personaName: persona.coachName,
      mood: '연습',
      vocalAttitude: '감정을 먼저 떠올리고 노래하세요',
    }),
    [agency, persona.coachName],
  );

  const vocalCoachProps = useMemo(
    () => ({
      songAnalysis: tvSongAnalysis,
      vocalCharacteristics: data.vocalCharacteristics,
      lyrics: data.lyrics || [],
      lineScores: data.lineScores || [],
      pitchHistory: data.pitchHistory || [],
      pitchAccuracy: vocal.pitchAccuracy,
      tuningState: vocal.tuningState,
      pitchFeedback: vocal.pitchFeedback,
      micActive: rightMode === 'live' && vocal.isTracking,
      autoStart: rightMode === 'live',
    }),
    [
      tvSongAnalysis,
      data.vocalCharacteristics,
      data.lyrics,
      data.lineScores,
      data.pitchHistory,
      vocal.pitchAccuracy,
      vocal.tuningState,
      vocal.pitchFeedback,
      rightMode,
      vocal.isTracking,
    ],
  );

  const stopSync = useCallback(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = 0;
    }
    refPlayerRef.current?.pause?.();
    if (myVideoRef.current) myVideoRef.current.pause();
    if (myAudioRef.current) myAudioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const syncRightMedia = useCallback(
    (t) => {
      if (rightMode !== 'recording') return;
      if (isDance && myVideoRef.current) {
        const dur = myVideoRef.current.duration;
        if (Number.isFinite(dur) && t <= dur && Math.abs(myVideoRef.current.currentTime - t) > 0.25) {
          myVideoRef.current.currentTime = t;
        }
      }
      if (!isDance && myAudioRef.current) {
        const dur = myAudioRef.current.duration;
        if (Number.isFinite(dur) && t <= dur && Math.abs(myAudioRef.current.currentTime - t) > 0.25) {
          myAudioRef.current.currentTime = t;
        }
      }
    },
    [rightMode, isDance],
  );

  const startSync = useCallback(() => {
    stopSync();
    refPlayerRef.current?.play?.();
    if (rightMode === 'recording') {
      if (isDance && myVideoRef.current) {
        myVideoRef.current.playbackRate = 1;
        myVideoRef.current.currentTime = 0;
        myVideoRef.current.play().catch(() => {});
      }
      if (!isDance && myAudioRef.current) {
        myAudioRef.current.playbackRate = 1;
        myAudioRef.current.currentTime = 0;
        myAudioRef.current.play().catch(() => {});
      }
    }
    setIsPlaying(true);
    syncTimerRef.current = window.setInterval(() => {
      const t = refPlayerRef.current?.getCurrentTime?.() || 0;
      setSyncTime(t);
      syncRightMedia(t);
    }, 120);
  }, [rightMode, stopSync, isDance, syncRightMedia]);

  useEffect(() => () => stopSync(), [stopSync]);

  useEffect(() => {
    refPlayerRef.current?.setPlaybackRate?.(playbackRate);
  }, [playbackRate]);

  const handleSeekStart = () => {
    refPlayerRef.current?.seekTo?.(0);
    if (myVideoRef.current) myVideoRef.current.currentTime = 0;
    if (myAudioRef.current) myAudioRef.current.currentTime = 0;
    setSyncTime(0);
  };

  const handlePracticeWeak = async () => {
    stopSync();
    setSheetTab(null);
    setRightMode('live');
    if (isDance && !dance.isTracking) {
      await dance.startTracking();
    } else if (!isDance && !vocal.isTracking) {
      await vocal.startTracking();
      setVocalCoachKick((v) => v + 1);
    } else if (!isDance) {
      setVocalCoachKick((v) => v + 1);
    }
  };

  const handleBackToRecording = () => {
    if (isDance && dance.isTracking) dance.stopTracking();
    if (!isDance && vocal.isTracking) vocal.stopTracking();
    setRightMode('recording');
    setSyncTime(0);
    setSheetTab(null);
  };

  const formatTime = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  const vocalMetrics = !isDance
    ? {
        volumeLevel: vocal.volumeLevel,
        tuningState: vocal.tuningState,
        pitchScore: vocal.pitchScore,
        pitchFeedback: vocal.pitchFeedback,
      }
    : null;

  const rightLabel =
    rightMode === 'live'
      ? isDance
        ? '실시간 카메라'
        : '실시간 마이크'
      : isDance
        ? '내 연습 영상'
        : '내 녹음';

  return (
    <div className="tv-mode tv-compare-screen">
      <div className="tv-compare-main">
        <header className="tv-training-header tv-compare-header">
          <div className="tv-training-header-left">
            <span className="tv-training-agency" style={{ color: agencyColor }}>
              {agency.toUpperCase()}
            </span>
            <span className="tv-training-mode">페르소나 비교</span>
          </div>
          <div className="tv-compare-header-right">
            <span className="tv-compare-score-chip">{data.overallScore ?? 0}점</span>
            <span className="tv-training-timer">{formatTime(syncTime)}</span>
          </div>
        </header>

        <div className="tv-split-layout tv-compare-split">
          <div className="tv-simple-panel tv-compare-panel">
            <div className="tv-panel-label tv-compare-panel-label">페르소나 · 레퍼런스</div>
            <div className="tv-compare-persona-wrap">
              <YouTubeTVPlayer
                ref={refPlayerRef}
                embedUrl={data.referenceVideoUrl}
                playbackRate={playbackRate}
                className="tv-compare-ref-video"
              />
              <div className="tv-compare-persona-overlay">
                <div
                  className="tv-coach-avatar tv-compare-avatar"
                  style={{ borderColor: `${agencyColor}88`, boxShadow: `0 0 24px ${agencyColor}40` }}
                >
                  <span style={{ fontSize: 40 }}>{persona.coachAvatar}</span>
                </div>
                <p className="tv-compare-persona-name">{persona.coachName}</p>
              </div>
            </div>
          </div>

          <div className="tv-simple-panel tv-compare-panel">
            <div className="tv-panel-label tv-compare-panel-label">{rightLabel}</div>
            <div className="tv-compare-right-body">
              {rightMode === 'recording' && data.recordedMediaUrl && isDance ? (
                <video
                  ref={myVideoRef}
                  src={data.recordedMediaUrl}
                  playsInline
                  className="tv-compare-my-video"
                />
              ) : rightMode === 'recording' && data.recordedMediaUrl && !isDance ? (
                <div className="tv-compare-vocal-recording">
                  <audio ref={myAudioRef} src={data.recordedMediaUrl} />
                  <div className="tv-compare-vocal-visual">
                    <span style={{ fontSize: 72 }}>🎤</span>
                    <p>녹음된 보컬 연습</p>
                  </div>
                </div>
              ) : rightMode === 'live' && isDance ? (
                <UserCameraPanel
                  mode="dance"
                  poseData={dance.poseData}
                  isTracking={dance.isTracking}
                  onStartTracking={dance.startTracking}
                  agencyColor={agencyColor}
                  videoRef={dance.videoRef}
                  canvasRef={dance.canvasRef}
                  showJointBadges={false}
                  embedded
                />
              ) : rightMode === 'live' && !isDance ? (
                <UserCameraPanel
                  mode="vocal"
                  poseData={null}
                  isTracking={vocal.isTracking}
                  onStartTracking={vocal.startTracking}
                  agencyColor={agencyColor}
                  vocalMetrics={vocalMetrics}
                  showJointBadges={false}
                  embedded
                />
              ) : (
                <div className="tv-compare-empty">연습 기록이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 데스크톱: 인라인 컨트롤 */}
      <div className="tv-compare-desktop-panel">
        <div className="tv-compare-feedback-banner">
          <p className="tv-compare-feedback-title">AI 분석 피드백</p>
          <p className="tv-compare-feedback-score">종합 {data.overallScore ?? 0}점</p>
        </div>

        <div className="tv-compare-speed">
          <PlaybackSpeedControl
            value={playbackRate}
            onChange={setPlaybackRate}
            variant="dark"
            label="페르소나 영상 속도"
            compact
          />
        </div>

        {!isDance ? (
          <div className="tv-compare-vocal-coach" key={vocalCoachKick}>
            <VocalLineCoachingLoop variant="dark" {...vocalCoachProps} />
          </div>
        ) : null}

        <div className="tv-compare-controls">
          <button
            type="button"
            className="tv-footer-btn tv-footer-btn-secondary"
            onClick={isPlaying ? stopSync : startSync}
          >
            {isPlaying ? '⏸ 일시정지' : '▶ 싱크 재생'}
          </button>
          <button type="button" className="tv-footer-btn tv-footer-btn-secondary" onClick={handleSeekStart}>
            처음부터
          </button>
        </div>

        <div className="tv-compare-review">
          <CoachReviewBlock agency={agency} reviewText={coachReview} />
        </div>

        <footer className="tv-training-footer tv-compare-footer">
          {rightMode === 'live' ? (
            <button type="button" className="tv-footer-btn tv-footer-btn-secondary" onClick={handleBackToRecording}>
              {isDance ? '내 영상 보기' : '내 녹음 보기'}
            </button>
          ) : (
            <button type="button" className="tv-footer-btn tv-footer-btn-secondary" onClick={handlePracticeWeak}>
              다시 부족한 부분 연습
            </button>
          )}
          <button
            type="button"
            className="tv-footer-btn tv-footer-btn-primary"
            style={{ background: agencyColor }}
            onClick={onShowResult}
          >
            결과 상세 보기
          </button>
          <button type="button" className="tv-footer-btn tv-footer-btn-secondary" onClick={onRetrySession}>
            처음부터
          </button>
        </footer>
      </div>

      {/* 모바일: 하단 독 + 시트 */}
      <TVCompareBottomDock activeTab={sheetTab} onTabChange={setSheetTab} agencyColor={agencyColor} />
      <TVCompareBottomSheet
        open={Boolean(sheetTab)}
        tab={sheetTab}
        onClose={() => setSheetTab(null)}
        agency={agency}
        agencyColor={agencyColor}
        playbackRate={playbackRate}
        onPlaybackRateChange={setPlaybackRate}
        isPlaying={isPlaying}
        onToggleSync={isPlaying ? stopSync : startSync}
        onSeekStart={handleSeekStart}
        coachReview={coachReview}
        isDance={isDance}
        vocalCoachProps={!isDance ? vocalCoachProps : null}
        vocalCoachKey={vocalCoachKick}
        rightMode={rightMode}
        onPracticeWeak={handlePracticeWeak}
        onBackToRecording={handleBackToRecording}
        onShowResult={onShowResult}
        onRetrySession={onRetrySession}
      />
    </div>
  );
}
