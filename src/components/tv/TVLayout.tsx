// @ts-nocheck
import React, { useCallback, useRef, useState } from 'react';
import type { Agency, TrainingMode } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';
import { useMediaPipeTV } from '../../hooks/useMediaPipeTV';
import { useTVMicrophone } from '../../hooks/useTVMicrophone';
import { useTVMode } from '../../hooks/useTVMode';
import { useTVRecorder } from '../../hooks/useTVRecorder';
import { buildLocalCoachReview } from '../../utils/tvCoachReview';
import TVReferencePanel from './TVReferencePanel';
import UserCameraPanel from './UserCameraPanel';

export function TVLayout({
  agency,
  mode,
  onExit,
}: {
  agency: Agency;
  mode: TrainingMode;
  onExit: (data: any) => void;
}) {
  const agencyColor = AGENCY_COLORS[agency];
  const [completing, setCompleting] = useState(false);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState('');
  const refPlayerRef = useRef(null);

  const dance = useMediaPipeTV(agencyColor);
  const vocal = useTVMicrophone();
  const recorder = useTVRecorder();

  const isDance = mode === 'dance';
  const poseData = isDance ? dance.poseData : null;
  const isTracking = isDance ? dance.isTracking : vocal.isTracking;

  const vocalMetrics = !isDance
    ? {
        volumeLevel: vocal.volumeLevel,
        tuningState: vocal.tuningState,
        pitchScore: vocal.pitchScore,
        pitchFeedback: vocal.pitchFeedback,
      }
    : null;

  const { feedback, sessionTime, buildSessionData } = useTVMode({
    poseData,
    vocalMetrics,
    agency,
    mode,
    playbackSpeed: 1,
  });

  const formatTime = () => {
    const m = Math.floor(sessionTime / 60)
      .toString()
      .padStart(2, '0');
    const s = (sessionTime % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStartTracking = useCallback(async () => {
    if (isDance) {
      await dance.startTracking();
      const stream = dance.getStream();
      if (stream) recorder.startRecording(stream);
    } else {
      await vocal.startTracking();
      const stream = vocal.getStream();
      if (stream) recorder.startRecording(stream);
    }
  }, [dance, vocal, isDance, recorder]);

  const handleStopTracking = useCallback(() => {
    if (isDance) dance.stopTracking();
    else vocal.stopTracking();
  }, [dance, vocal, isDance]);

  const handleComplete = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    handleStopTracking();
    const recordedMediaUrl = await recorder.stopRecording();

    const base = buildSessionData({ feedback });
    let coachReview = buildLocalCoachReview(base);

    try {
      const res = await fetch('/api/tv/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency,
          language: 'ko',
          poseData: poseData || { jointAccuracies: {} },
          sessionSummary: {
            overallScore: base.overallScore,
            weaknesses: base.weaknesses,
            strengths: base.strengths,
            mode,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.feedback) coachReview = data.feedback;
      }
    } catch {
      /* local review */
    }

    onExit({
      ...buildSessionData({ feedback, coachReview }),
      referenceVideoUrl,
      recordedMediaUrl: recordedMediaUrl || recorder.recordedUrl,
    });
  }, [
    completing,
    handleStopTracking,
    recorder,
    buildSessionData,
    feedback,
    agency,
    poseData,
    mode,
    onExit,
    referenceVideoUrl,
  ]);

  return (
    <div className="tv-mode tv-training-screen">
      <header className="tv-training-header">
        <div className="tv-training-header-left">
          <span className="tv-training-agency" style={{ color: agencyColor }}>
            {agency.toUpperCase()}
          </span>
          <span className="tv-training-mode">
            {mode === 'dance' ? '댄스 트레이닝' : '보컬 트레이닝'}
          </span>
        </div>
        <span className="tv-training-timer">{formatTime()}</span>
      </header>

      <div className="tv-split-layout">
        <TVReferencePanel
          mode={mode}
          embedUrl={referenceVideoUrl}
          onEmbedUrlChange={setReferenceVideoUrl}
          playerRef={refPlayerRef}
        />
        <UserCameraPanel
          mode={mode}
          poseData={isDance ? poseData : null}
          isTracking={isTracking}
          onStartTracking={handleStartTracking}
          agencyColor={agencyColor}
          vocalMetrics={vocalMetrics}
          videoRef={isDance ? dance.videoRef : null}
          canvasRef={isDance ? dance.canvasRef : null}
          showJointBadges={false}
        />
      </div>

      <footer className="tv-training-footer">
        <button
          type="button"
          className="tv-footer-btn tv-footer-btn-secondary"
          onClick={isTracking ? handleStopTracking : handleStartTracking}
        >
          {isTracking
            ? isDance
              ? '카메라 끄기'
              : '마이크 끄기'
            : isDance
              ? '카메라 켜기'
              : '마이크 켜기'}
        </button>
        <button
          type="button"
          className="tv-footer-btn tv-footer-btn-primary"
          style={{ background: agencyColor }}
          onClick={handleComplete}
          disabled={completing}
        >
          {completing ? '분석 중...' : '완료'}
        </button>
      </footer>
    </div>
  );
}

export default TVLayout;
