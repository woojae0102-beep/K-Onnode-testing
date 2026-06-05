// @ts-nocheck
import React, { useCallback, useState } from 'react';
import type { Agency, TrainingMode } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';
import { useMediaPipeTV } from '../../hooks/useMediaPipeTV';
import { useTVMicrophone } from '../../hooks/useTVMicrophone';
import { useTVMode } from '../../hooks/useTVMode';
import { buildLocalCoachReview } from '../../utils/tvCoachReview';
import AICoachPanel from './AICoachPanel';
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

  const dance = useMediaPipeTV(agencyColor);
  const vocal = useTVMicrophone();

  const isDance = mode === 'dance';
  const poseData = isDance ? dance.poseData : null;
  const isTracking = isDance ? dance.isTracking : vocal.isTracking;
  const startTracking = isDance ? dance.startTracking : vocal.startTracking;
  const stopTracking = isDance ? dance.stopTracking : vocal.stopTracking;

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

  const handleComplete = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    stopTracking();

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

    onExit(buildSessionData({ feedback, coachReview }));
  }, [completing, stopTracking, buildSessionData, feedback, agency, poseData, mode, onExit]);

  return (
    <div className="tv-mode tv-training-screen">
      <header className="tv-training-header">
        <div className="tv-training-header-left">
          <span className="tv-training-agency" style={{ color: agencyColor }}>
            {agency.toUpperCase()}
          </span>
          <span className="tv-training-mode">{mode === 'dance' ? '댄스' : '보컬'}</span>
        </div>
        <span className="tv-training-timer">{formatTime()}</span>
      </header>

      <div className="tv-split-layout">
        <AICoachPanel agency={agency} mode={mode} agencyColor={agencyColor} />
        <UserCameraPanel
          mode={mode}
          poseData={null}
          isTracking={isTracking}
          onStartTracking={startTracking}
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
          onClick={isTracking ? stopTracking : startTracking}
        >
          {isTracking ? (isDance ? '카메라 끄기' : '마이크 끄기') : isDance ? '카메라 켜기' : '마이크 켜기'}
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
