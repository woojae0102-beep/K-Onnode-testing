// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';
import { useLiveAudioMeter } from '../../hooks/useLiveAudioMeter';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { requiresMediaUserGesture } from '../../utils/mobileMedia';
import LiveFeedbackStrip from './LiveFeedbackStrip';

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function TeachingPracticePanel({
  mode = 'dance',
  onComplete,
  onCancel,
  referencePreview = null,
}) {
  const { t } = useTranslation();
  const overlayRef = useRef(null);
  const isVideo = mode === 'dance';
  const needsGesture = requiresMediaUserGesture();

  const [previewStream, setPreviewStream] = useState(null);
  const [mediaReady, setMediaReady] = useState(!needsGesture);

  const {
    videoRef,
    isPreviewing,
    isRecording,
    elapsedSec,
    error,
    startPreview,
    stopPreview,
    startRecording,
    stopRecording,
  } = useMediaRecorder({ mode: isVideo ? 'video' : 'audio' });

  const poseActive = isVideo && isPreviewing && mediaReady;
  const { score, issue, isAnalyzing } = usePoseDetection({
    active: poseActive,
    videoRef,
    overlayCanvasRef: overlayRef,
  });

  const { volumeLevel, pitchFeedback, tuningState } = useLiveAudioMeter({
    stream: previewStream,
    active: !isVideo && isPreviewing && mediaReady,
  });

  useEffect(() => {
    if (!needsGesture) {
      startPreview()
        .then((s) => {
          setPreviewStream(s);
          setMediaReady(true);
        })
        .catch(() => {});
    }
    return () => {
      setPreviewStream(null);
      setMediaReady(false);
      stopPreview();
    };
  }, [mode, needsGesture]);

  const handleEnableMedia = async () => {
    try {
      const s = await startPreview();
      setPreviewStream(s);
      setMediaReady(true);
    } catch {
      /* error state in hook */
    }
  };

  const handleToggleRecord = async () => {
    if (!mediaReady) {
      await handleEnableMedia();
      return;
    }
    if (isRecording) {
      try {
        const file = await stopRecording();
        stopPreview();
        setMediaReady(false);
        onComplete?.(file);
      } catch {
        /* ignore */
      }
    } else {
      startRecording();
    }
  };

  const liveHint = !mediaReady
    ? t('teaching.session.tapToEnableMedia')
    : isVideo
    ? issue || (isAnalyzing ? '전신이 보이도록 서 주세요.' : t('teaching.session.poseLoading'))
    : pitchFeedback;

  const primaryLabel = !mediaReady
    ? isVideo
      ? t('teaching.session.enableCamera')
      : t('teaching.session.enableMic')
    : isRecording
    ? t('teaching.session.finishPractice')
    : t('teaching.session.startPractice');

  return (
    <div className="flex flex-col gap-4 pb-[env(safe-area-inset-bottom,0px)]">
      {referencePreview ? (
        <div className="rounded-xl overflow-hidden border border-white/10 aspect-video max-h-28 opacity-80">{referencePreview}</div>
      ) : null}

      <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[min(62dvh,520px)] mx-auto w-full max-w-md border border-[#FF1F8E]/30">
        {isVideo ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
              autoPlay={false}
            />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ transform: 'scaleX(-1)' }}
            />
            {!mediaReady ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
                <span className="text-4xl">📷</span>
                <p className="text-sm text-white/70">{t('teaching.session.tapToEnableMedia')}</p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
            <span className="text-6xl animate-pulse">{isRecording ? '🔴' : '🎙️'}</span>
            <p className="text-white/70 text-sm text-center">
              {!mediaReady ? t('teaching.session.tapToEnableMedia') : isRecording ? t('teaching.session.recording') : t('teaching.session.readyMic')}
            </p>
            {mediaReady ? (
              <div className="w-full h-24 flex items-end justify-center gap-1 px-4">
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-[#FF1F8E]/80 transition-all duration-75"
                    style={{ height: `${8 + (volumeLevel / 100) * (40 + Math.sin(i + elapsedSec) * 12)}%` }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
        {isRecording ? (
          <div
            className="absolute top-3 left-3 flex items-center gap-2 bg-rose-600/90 px-3 py-1 rounded-full text-xs font-bold"
            style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }}
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            REC {formatTime(elapsedSec)}
          </div>
        ) : null}
      </div>

      <LiveFeedbackStrip
        hint={liveHint}
        score={isVideo && mediaReady ? score : null}
        scoreLabel={t('teaching.session.poseScore')}
        tuningState={tuningState}
        volumeLevel={volumeLevel}
        mode={isVideo ? 'dance' : 'vocal'}
      />

      {error ? <p className="text-rose-400 text-sm text-center px-2">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-[48px] py-3 rounded-xl bg-white/10 text-sm font-semibold touch-manipulation"
        >
          {t('teaching.session.back')}
        </button>
        <button
          type="button"
          onClick={handleToggleRecord}
          className={`flex-[2] min-h-[48px] py-4 rounded-xl font-bold text-white touch-manipulation ${isRecording ? 'bg-rose-600' : ''}`}
          style={isRecording ? undefined : { background: '#FF1F8E' }}
        >
          {primaryLabel}
        </button>
      </div>
      <p className="text-xs text-white/40 text-center px-2">{t('teaching.session.practiceHint')}</p>
    </div>
  );
}

export default TeachingPracticePanel;
