// @ts-nocheck
import React from 'react';
import CameraPreviewStack from '../group/CameraPreviewStack';
import '../../styles/group-studio.css';

export default function StudioMobileController({
  mode = 'dance',
  isTracking = false,
  isPaused = false,
  agencyColor = '#FF1F8E',
  isConnected = false,
  videoRef = null,
  stream = null,
  canvasRef = null,
  onStart,
  onStop,
  onPause,
  onResume,
  onFlipCamera,
  onComplete,
  completing = false,
}) {
  const isDance = mode === 'dance';

  return (
    <div className="studio-mobile-controller">
      <div className="studio-mobile-camera-wrap">
        {isDance ? (
          <CameraPreviewStack
            videoRef={videoRef}
            stream={stream}
            skeletonCanvasRef={canvasRef}
            isTracking={isTracking}
            fitMode="contain"
            className="studio-mobile-camera-stack"
          />
        ) : (
          <div className="studio-mobile-vocal">
            <div className="studio-mobile-vocal-ring" style={{ borderColor: agencyColor }} />
            <span className="studio-mobile-vocal-label">🎤 보컬 연습</span>
          </div>
        )}

        {!isTracking ? (
          <div className="studio-mobile-overlay">
            <p>{isDance ? '카메라를 켜고 TV 연습실에서 피드백을 확인하세요' : '마이크를 켜고 TV에서 음정 피드백을 확인하세요'}</p>
            <button type="button" className="studio-mobile-btn studio-mobile-btn-primary" style={{ background: agencyColor }} onClick={onStart}>
              시작
            </button>
          </div>
        ) : null}

        {isConnected ? (
          <div className="studio-mobile-live-badge">● TV 연습실 LIVE</div>
        ) : (
          <div className="studio-mobile-live-badge studio-mobile-live-wait">TV 연결 대기</div>
        )}
      </div>

      <div className="studio-mobile-controls">
        {isTracking ? (
          <>
            {isPaused ? (
              <button type="button" className="studio-mobile-btn" onClick={onResume}>
                ▶ 재개
              </button>
            ) : (
              <button type="button" className="studio-mobile-btn" onClick={onPause}>
                ⏸ 일시정지
              </button>
            )}
            <button type="button" className="studio-mobile-btn" onClick={onStop}>
              ■ 종료
            </button>
            {isDance && onFlipCamera ? (
              <button type="button" className="studio-mobile-btn" onClick={onFlipCamera}>
                🔄 전환
              </button>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          className="studio-mobile-btn studio-mobile-btn-primary"
          style={{ background: agencyColor }}
          onClick={onComplete}
          disabled={completing}
        >
          {completing ? '분석 중...' : '연습 완료'}
        </button>
      </div>
    </div>
  );
}
