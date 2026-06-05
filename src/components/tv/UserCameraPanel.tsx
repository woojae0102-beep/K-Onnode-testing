// @ts-nocheck
import React, { memo } from 'react';
import type { PoseData } from '../../types/tv';

const TVCameraViewport = memo(function TVCameraViewport({
  isTracking,
  videoRef,
  canvasRef,
  onStartTracking,
  agencyColor,
}: {
  isTracking: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onStartTracking: () => void;
  agencyColor: string;
}) {
  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1) translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          transform: 'scaleX(-1) translateZ(0)',
          pointerEvents: 'none',
        }}
      />
      {!isTracking ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(3,3,8,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <div style={{ fontSize: 40 }}>📸</div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 500, marginBottom: 4 }}>
            카메라를 활성화하세요
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              marginBottom: 16,
              textAlign: 'center',
              padding: '0 20px',
            }}
          >
            전신이 화면에 들어오도록 서주세요
          </div>
          <button
            type="button"
            onClick={onStartTracking}
            style={{
              padding: '10px 24px',
              background: agencyColor,
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: `0 0 20px ${agencyColor}60`,
            }}
          >
            카메라 시작
          </button>
        </div>
      ) : null}
    </>
  );
});

const JointAccuracyBadges = memo(function JointAccuracyBadges({
  poseData,
}: {
  poseData: PoseData | null;
}) {
  if (!poseData?.jointAccuracies) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        pointerEvents: 'none',
      }}
    >
      {Object.entries(poseData.jointAccuracies)
        .slice(0, 6)
        .map(([joint, accuracy]) => (
          <div
            key={joint}
            style={{
              padding: '3px 8px',
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 4,
              fontSize: 10,
              color: accuracy > 80 ? '#00FF88' : accuracy > 60 ? '#FFD700' : '#FF4444',
              fontWeight: 500,
            }}
          >
            {joint}: {Math.round(accuracy)}%
          </div>
        ))}
    </div>
  );
});

export function UserCameraPanel({
  mode = 'dance',
  poseData,
  isTracking,
  onStartTracking,
  agencyColor,
  vocalMetrics = null,
  videoRef = null,
  canvasRef = null,
  showJointBadges = true,
}: {
  mode?: 'dance' | 'vocal';
  poseData: PoseData | null;
  isTracking: boolean;
  onStartTracking: () => void;
  agencyColor: string;
  vocalMetrics?: {
    volumeLevel: number;
    pitchFeedback: string;
    tuningState: string;
    pitchScore: number;
  } | null;
  videoRef?: React.RefObject<HTMLVideoElement> | null;
  canvasRef?: React.RefObject<HTMLCanvasElement> | null;
  showJointBadges?: boolean;
}) {
  const isVocal = mode === 'vocal';

  return (
    <div className="tv-simple-panel tv-camera-panel">
      <div className="tv-panel-label">
        {isVocal ? '내 마이크' : '내 카메라'}
        {isTracking ? (
          <span style={{ marginLeft: 8, color: '#00FF88', fontSize: 10 }}>● ON</span>
        ) : null}
      </div>

      <div style={{ flex: 1, position: 'relative', background: '#030308', minHeight: 0 }}>
        {!isVocal && videoRef && canvasRef ? (
          <>
            <TVCameraViewport
              isTracking={isTracking}
              videoRef={videoRef}
              canvasRef={canvasRef}
              onStartTracking={onStartTracking}
              agencyColor={agencyColor}
            />
            {isTracking && showJointBadges ? <JointAccuracyBadges poseData={poseData} /> : null}
          </>
        ) : null}

        {isVocal && (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 64 }}>
              {vocalMetrics?.tuningState === 'in-tune'
                ? '🎵'
                : vocalMetrics?.tuningState === 'sharp'
                  ? '⬆️'
                  : vocalMetrics?.tuningState === 'flat'
                    ? '⬇️'
                    : '🎤'}
            </div>
            {isTracking && vocalMetrics && (
              <>
                <div
                  style={{
                    width: '80%',
                    height: 8,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${vocalMetrics.volumeLevel}%`,
                      background: `linear-gradient(90deg, ${agencyColor}, #FF1F8E)`,
                      borderRadius: 4,
                      transition: 'width 0.1s ease',
                      boxShadow: `0 0 12px ${agencyColor}60`,
                    }}
                  />
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                  {Math.round(vocalMetrics.pitchScore)}점
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color:
                      vocalMetrics.tuningState === 'in-tune'
                        ? '#00FF88'
                        : 'rgba(255,255,255,0.6)',
                    textAlign: 'center',
                  }}
                >
                  {vocalMetrics.pitchFeedback}
                </div>
              </>
            )}
            {!isTracking && (
              <button
                type="button"
                onClick={onStartTracking}
                style={{
                  padding: '10px 24px',
                  background: agencyColor,
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: `0 0 20px ${agencyColor}60`,
                }}
              >
                마이크 시작
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserCameraPanel;
