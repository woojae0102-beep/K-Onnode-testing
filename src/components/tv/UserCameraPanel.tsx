// @ts-nocheck
import React from 'react';
import type { PoseData } from '../../types/tv';

export function UserCameraPanel({
  mode = 'dance',
  poseData,
  isTracking,
  onStartTracking,
  agencyColor,
  vocalMetrics = null,
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
}) {
  const isVocal = mode === 'vocal';
  return (
    <div
      className="tv-panel"
      style={{
        background: '#0a0a14',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isTracking ? '#00FF88' : '#FF4444',
              boxShadow: isTracking ? '0 0 8px #00FF88' : '0 0 8px #FF4444',
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
            }}
          >
            {isVocal ? '실시간 음정 분석' : '실시간 분석'}
          </span>
        </div>
        {isTracking && (
          <div
            style={{
              fontSize: 10,
              color: '#00FF88',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            {isVocal ? 'MIC ACTIVE' : 'TRACKING ACTIVE'}
          </div>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative', background: '#030308', minHeight: 0 }}>
        {!isVocal && (
          <>
            <video
              id="user-camera-video"
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
              id="skeleton-canvas"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                transform: 'scaleX(-1)',
                pointerEvents: 'none',
              }}
            />
          </>
        )}

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
          </div>
        )}

        {!isTracking && (
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
            <div style={{ fontSize: 40 }}>{isVocal ? '🎤' : '📸'}</div>
            <div
              style={{
                fontSize: 14,
                color: '#fff',
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              {isVocal ? '마이크를 활성화하세요' : '카메라를 활성화하세요'}
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
              {isVocal
                ? '조용한 환경에서 노래하거나 발성 연습을 해주세요'
                : '전신이 화면에 들어오도록 서주세요'}
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
              {isVocal ? '마이크 시작' : '카메라 시작'}
            </button>
          </div>
        )}

        {!isVocal && isTracking && poseData && (
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              right: 12,
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {Object.entries(poseData.jointAccuracies || {})
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
        )}
      </div>
    </div>
  );
}

export default UserCameraPanel;
