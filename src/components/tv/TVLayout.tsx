// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Agency, TrainingMode } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';
import { useMediaPipeTV } from '../../hooks/useMediaPipeTV';
import { useTVMicrophone } from '../../hooks/useTVMicrophone';
import { useTVMode } from '../../hooks/useTVMode';
import { useTVRecorder } from '../../hooks/useTVRecorder';
import { buildLocalCoachReview } from '../../utils/tvCoachReview';
import { useTVScreenLayout } from '../../hooks/useTVScreenLayout';
import TVReferencePanel from './TVReferencePanel';
import UserCameraPanel from './UserCameraPanel';

const TV_VOCAL_LINES = [
  '오늘도 무대 위에서 빛나',
  '너와 나의 리듬이 맞닿아',
  '숨을 고르고 다시 시작해',
  '끝까지 정확하게 노래해',
];

export function TVLayout({
  agency,
  mode,
  onExit,
  onHome,
}: {
  agency: Agency;
  mode: TrainingMode;
  onExit: (data: any) => void;
  onHome?: () => void;
}) {
  const agencyColor = AGENCY_COLORS[agency];
  const [completing, setCompleting] = useState(false);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState('');
  const refPlayerRef = useRef(null);
  const [lineScores, setLineScores] = useState(() => TV_VOCAL_LINES.map(() => null));
  const [lineIdx, setLineIdx] = useState(0);
  const lineIdxRef = useRef(0);
  const lineAccRef = useRef({ sum: 0, count: 0 });
  const pitchHistRef = useRef([]);

  const { layoutClass } = useTVScreenLayout();
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

  const finalizeVocalLine = useCallback(() => {
    const { sum, count } = lineAccRef.current;
    if (!count) return;
    const avg = Math.round(sum / count);
    const idx = lineIdxRef.current;
    setLineScores((prev) => {
      const next = [...prev];
      next[idx] = avg;
      return next;
    });
    lineAccRef.current = { sum: 0, count: 0 };
  }, []);

  useEffect(() => {
    if (isDance || !vocal.isTracking) return undefined;
    setLineIdx(0);
    lineIdxRef.current = 0;
    setLineScores(TV_VOCAL_LINES.map(() => null));
    lineAccRef.current = { sum: 0, count: 0 };
    pitchHistRef.current = [];

    const sampleTimer = window.setInterval(() => {
      const score = vocal.pitchScore || 0;
      lineAccRef.current.sum += score;
      lineAccRef.current.count += 1;
      if (vocal.pitchAccuracy > 0) {
        pitchHistRef.current.push(180 + vocal.pitchAccuracy * 0.8);
      }
    }, 500);

    const segmentTimer = window.setInterval(() => {
      finalizeVocalLine();
      setLineIdx((prev) => {
        const next = Math.min(prev + 1, TV_VOCAL_LINES.length - 1);
        lineIdxRef.current = next;
        return next;
      });
    }, 5000);

    return () => {
      clearInterval(sampleTimer);
      clearInterval(segmentTimer);
      finalizeVocalLine();
    };
  }, [finalizeVocalLine, isDance, vocal.isTracking, vocal.pitchScore, vocal.pitchAccuracy]);

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

    const pitchSamples = pitchHistRef.current;
    const avgPitch =
      pitchSamples.length > 0
        ? Math.round(pitchSamples.reduce((a, b) => a + b, 0) / pitchSamples.length)
        : 220;

    onExit({
      ...buildSessionData({ feedback, coachReview }),
      referenceVideoUrl,
      recordedMediaUrl: recordedMediaUrl || recorder.recordedUrl,
      lineScores: isDance ? undefined : lineScores,
      lyrics: isDance ? undefined : TV_VOCAL_LINES,
      pitchHistory: isDance ? undefined : pitchSamples.slice(-60),
      vocalCharacteristics: isDance
        ? undefined
        : {
            avgPitch,
            range: avgPitch > 250 ? '고음역' : avgPitch > 190 ? '중음역' : '저음역',
            type: 'TV 연습 보컬',
            stability: Math.round(
              (lineScores.filter((s) => Number.isFinite(s)).reduce((a, b) => a + b, 0) || 0) /
                Math.max(1, lineScores.filter((s) => Number.isFinite(s)).length),
            ),
          },
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

  const handleGoHome = () => {
    handleStopTracking();
    recorder.stopRecording();
    onHome?.();
  };

  return (
    <div className={`tv-mode tv-training-screen ${layoutClass}`}>
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
        {onHome ? (
          <button type="button" className="tv-footer-btn tv-footer-btn-secondary" onClick={handleGoHome}>
            홈으로
          </button>
        ) : null}
      </footer>
    </div>
  );
}

export default TVLayout;
