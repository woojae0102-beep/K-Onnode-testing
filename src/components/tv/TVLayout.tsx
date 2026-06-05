// @ts-nocheck
import React, { useCallback } from 'react';
import type { Agency, TrainingMode } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';
import { useMediaPipeTV } from '../../hooks/useMediaPipeTV';
import { useTVMicrophone } from '../../hooks/useTVMicrophone';
import { useTVMode } from '../../hooks/useTVMode';
import AICoachPanel from './AICoachPanel';
import UserCameraPanel from './UserCameraPanel';
import RealtimeScorePanel from './RealtimeScorePanel';
import RealtimeFeedbackPanel from './RealtimeFeedbackPanel';
import TVModeControls from './TVModeControls';

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

  const { scores, feedback, sessionTime, buildSessionData } = useTVMode({
    poseData,
    vocalMetrics,
    agency,
    mode,
  });

  const handleExit = useCallback(() => {
    stopTracking();
    onExit(buildSessionData());
  }, [stopTracking, onExit, buildSessionData]);

  const formatTime = () => {
    const m = Math.floor(sessionTime / 60)
      .toString()
      .padStart(2, '0');
    const s = (sessionTime % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      className="tv-mode"
      style={{
        width: '100%',
        height: '100vh',
        background: '#030308',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(10px)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: '#FF1F8E',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            O
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: '0.05em' }}>
              ONNODE
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>TV 연습실 모드</div>
          </div>
        </div>

        <div className="tv-header-center" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              padding: '4px 16px',
              background: `${agencyColor}22`,
              border: `1px solid ${agencyColor}66`,
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              color: agencyColor,
              boxShadow: `0 0 12px ${agencyColor}40`,
            }}
          >
            {agency.toUpperCase()} 코치
          </div>
          <div
            style={{
              padding: '4px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20,
              fontSize: 12,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {mode === 'dance' ? '🕺 댄스' : '🎤 보컬'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.1em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatTime()}
          </div>
          <button
            type="button"
            onClick={handleExit}
            style={{
              padding: '6px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            종료
          </button>
        </div>
      </div>

      <div className="tv-layout-grid">
        <AICoachPanel agency={agency} mode={mode} agencyColor={agencyColor} />
        <UserCameraPanel
          mode={mode}
          poseData={poseData}
          isTracking={isTracking}
          onStartTracking={startTracking}
          agencyColor={agencyColor}
          vocalMetrics={vocalMetrics}
        />
        <RealtimeScorePanel scores={scores} agency={agency} agencyColor={agencyColor} />
        <RealtimeFeedbackPanel feedback={feedback} agency={agency} agencyColor={agencyColor} />
      </div>

      <TVModeControls
        agency={agency}
        agencyColor={agencyColor}
        sessionTime={sessionTime}
        isTracking={isTracking}
        onToggleTracking={isTracking ? stopTracking : startTracking}
      />
    </div>
  );
}

export default TVLayout;
