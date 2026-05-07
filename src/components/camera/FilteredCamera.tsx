// @ts-nocheck
// 명암 필터가 적용되는 자체 완결형 카메라 컴포넌트
// AuditionStage 같이 MediaPipe를 쓰지 않는 화면에서 손쉽게 쓸 수 있도록 설계.
//
// 댄스 화면처럼 외부에서 video element를 직접 다뤄야 하는 경우에는
// useCameraWithFilter 훅을 직접 import해서 사용하는 것을 권장.
import React, { useImperativeHandle, useState, forwardRef } from 'react';
import { useCameraWithFilter, buildCameraFilterCss } from '../../hooks/useCameraWithFilter';
import BrightnessControl from './BrightnessControl';

const FilteredCamera = forwardRef(function FilteredCamera(
  {
    audio = false,
    defaultFacingMode = 'user',
    mirror = true,
    children,
    onReady,
    showControls = true,
    onRecordingComplete,
    className,
    style,
  },
  ref,
) {
  const {
    videoRef,
    displayCanvasRef,
    streamRef,
    filter,
    setFilter,
    resetFilter,
    isReady,
    displaySurface,
    isRecording,
    error,
    startCamera,
    switchCamera,
    startRecording,
    stopRecording,
    takePhoto,
  } = useCameraWithFilter({ audio, defaultFacingMode, surface: 'auto' });

  const [showPanel, setShowPanel] = useState(false);

  // 외부에서 녹화/사진 등을 호출할 수 있도록 노출
  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
    takePhoto,
    getStream: () => streamRef.current,
  }));

  React.useEffect(() => {
    if (isReady) onReady?.(streamRef.current);
  }, [isReady, onReady, streamRef]);

  const handleStopRecording = async () => {
    const blob = await stopRecording();
    if (blob && onRecordingComplete) onRecordingComplete(blob);
  };

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
    >
      {displaySurface === 'video' ? (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              filter: buildCameraFilterCss(filter),
              WebkitFilter: buildCameraFilterCss(filter),
              transform: 'translateZ(0)',
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: mirror ? 'scaleX(-1)' : 'none',
                opacity: isReady ? 1 : 0,
              }}
            />
          </div>
          <canvas
            ref={displayCanvasRef}
            aria-hidden
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              opacity: 0,
              visibility: 'hidden',
              pointerEvents: 'none',
            }}
          />
        </>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0,
              pointerEvents: 'none',
            }}
          />

          <canvas
            ref={displayCanvasRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: mirror ? 'scaleX(-1)' : 'none',
              filter: buildCameraFilterCss(filter),
            }}
          />
        </>
      )}

      {children}

      {error ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            fontSize: 13,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => startCamera()}
            style={{
              background: '#FF1F8E',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {showControls && isReady ? (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            gap: 8,
            zIndex: 25,
          }}
        >
          <button
            type="button"
            onClick={() => setShowPanel((v) => !v)}
            aria-label="카메라 명암 조절"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: showPanel ? '#FF1F8E' : 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ☀
          </button>
          <button
            type="button"
            onClick={switchCamera}
            aria-label="카메라 전환"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ⇄
          </button>
        </div>
      ) : null}

      <BrightnessControl filter={filter} onChange={setFilter} onReset={resetFilter} visible={showPanel} />

      {/* 녹화 컨트롤 (선택) - onRecordingComplete가 들어왔을 때만 표시 */}
      {showControls && isReady && onRecordingComplete ? (
        <div
          style={{
            position: 'absolute',
            bottom: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 25,
          }}
        >
          <button
            type="button"
            onClick={isRecording ? handleStopRecording : startRecording}
            aria-label={isRecording ? '녹화 중지' : '녹화 시작'}
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: isRecording ? '#FF1F8E' : '#fff',
              border: `3px solid ${isRecording ? '#fff' : '#FF1F8E'}`,
              cursor: 'pointer',
              fontSize: isRecording ? 18 : 14,
            }}
          >
            {isRecording ? '■' : '●'}
          </button>
        </div>
      ) : null}

      {isRecording ? (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(0,0,0,0.55)',
            padding: '4px 10px',
            borderRadius: 999,
            zIndex: 24,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#FF1F8E',
              animation: 'cam-blink 0.9s infinite',
            }}
          />
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>REC</span>
        </div>
      ) : null}

      <style>{`@keyframes cam-blink { 0%,100% { opacity: 1 } 50% { opacity: 0.2 } }`}</style>
    </div>
  );
});

export default FilteredCamera;
