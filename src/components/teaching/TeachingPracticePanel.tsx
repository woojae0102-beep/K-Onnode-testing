// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';
import { useLiveAudioMeter } from '../../hooks/useLiveAudioMeter';
import { usePoseDetection } from '../../hooks/usePoseDetection';
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

  const [previewStream, setPreviewStream] = useState(null);

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

  const poseActive = isVideo && isPreviewing;
  const { score, issue, isAnalyzing } = usePoseDetection({
    active: poseActive,
    videoRef,
    overlayCanvasRef: overlayRef,
  });

  const { volumeLevel, pitchFeedback, tuningState } = useLiveAudioMeter({
    stream: previewStream,
    active: !isVideo && isPreviewing,
  });

  useEffect(() => {
    startPreview()
      .then((s) => setPreviewStream(s))
      .catch(() => {});
    return () => {
      setPreviewStream(null);
      stopPreview();
    };
  }, [mode]);

  const handleToggleRecord = async () => {
    if (isRecording) {
      try {
        const file = await stopRecording();
        stopPreview();
        onComplete?.(file);
      } catch {
        /* ignore */
      }
    } else {
      startRecording();
    }
  };

  const liveHint = isVideo
    ? issue || (isAnalyzing ? '전신이 보이도록 서 주세요.' : t('teaching.session.poseLoading'))
    : pitchFeedback;

  return (
    <div className="flex flex-col gap-4">
      {referencePreview ? (
        <div className="rounded-xl overflow-hidden border border-white/10 aspect-video max-h-32 opacity-80">{referencePreview}</div>
      ) : null}

      <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[min(70vh,520px)] mx-auto w-full max-w-md border border-[#FF1F8E]/30">
        {isVideo ? (
          <>
            <video ref={videoRef} className="w-full h-full object-cover mirror" style={{ transform: 'scaleX(-1)' }} playsInline muted />
            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'scaleX(-1)' }} />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
            <span className="text-6xl animate-pulse">{isRecording ? '🔴' : '🎙️'}</span>
            <p className="text-white/70 text-sm text-center">{isRecording ? t('teaching.session.recording') : t('teaching.session.readyMic')}</p>
            <div className="w-full h-24 flex items-end justify-center gap-1 px-4">
              {Array.from({ length: 24 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-[#FF1F8E]/80 transition-all duration-75"
                  style={{ height: `${8 + (volumeLevel / 100) * (40 + Math.sin(i + elapsedSec) * 12)}%` }}
                />
              ))}
            </div>
          </div>
        )}
        {isRecording ? (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-rose-600/90 px-3 py-1 rounded-full text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            REC {formatTime(elapsedSec)}
          </div>
        ) : null}
      </div>

      <LiveFeedbackStrip
        hint={liveHint}
        score={isVideo ? score : null}
        scoreLabel={t('teaching.session.poseScore')}
        tuningState={tuningState}
        volumeLevel={volumeLevel}
        mode={isVideo ? 'dance' : 'vocal'}
      />

      {error ? <p className="text-rose-400 text-sm text-center">{error}</p> : null}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl bg-white/10 text-sm font-semibold">
          {t('teaching.session.back')}
        </button>
        <button
          type="button"
          onClick={handleToggleRecord}
          className={`flex-[2] py-4 rounded-xl font-bold text-white ${isRecording ? 'bg-rose-600' : ''}`}
          style={isRecording ? undefined : { background: '#FF1F8E' }}
        >
          {isRecording ? t('teaching.session.finishPractice') : t('teaching.session.startPractice')}
        </button>
      </div>
      <p className="text-xs text-white/40 text-center">{t('teaching.session.practiceHint')}</p>
    </div>
  );
}

export default TeachingPracticePanel;
