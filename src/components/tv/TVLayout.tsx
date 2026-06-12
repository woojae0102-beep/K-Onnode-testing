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

import { useStudioSession } from '../../hooks/useStudioSession';

import TVReferencePanel from './TVReferencePanel';

import UserCameraPanel from './UserCameraPanel';

import StudioConnectModal from '../studio/StudioConnectModal';

import StudioMobileController from '../studio/StudioMobileController';

import '../../styles/studio-mode.css';



const TV_VOCAL_LINES = [

  '오늘도 무대 위에서 빛나',

  '너와 나의 리듬이 맞닿아',

  '숨을 고르고 다시 시작해',

  '끝까지 정확하게 노래해',

];



const PRACTICE_STEPS = ['워밍업', '기본 동작', '메인 파트', '퍼포먼스', '마무리'];



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

  const [songTitle, setSongTitle] = useState('');

  const [studioModalOpen, setStudioModalOpen] = useState(false);

  const [isPaused, setIsPaused] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const screenRef = useRef(null);

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



  const { feedback, sessionTime, overallScore, scores, buildSessionData } = useTVMode({

    poseData: isPaused ? null : poseData,

    vocalMetrics: isPaused ? null : vocalMetrics,

    agency,

    mode,

    playbackSpeed: 1,

  });



  const castStream = isDance ? dance.getStream() : vocal.getStream();

  const getRefCurrentTime = useCallback(() => refPlayerRef.current?.getCurrentTime?.() || 0, []);



  const practiceStep = Math.min(PRACTICE_STEPS.length, Math.floor(sessionTime / 45) + 1);

  const practiceStepLabel = PRACTICE_STEPS[practiceStep - 1] || '연습';

  useEffect(() => {

    const updateFullscreen = () => {

      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));

    };

    updateFullscreen();

    document.addEventListener('fullscreenchange', updateFullscreen);

    document.addEventListener('webkitfullscreenchange', updateFullscreen);

    return () => {

      document.removeEventListener('fullscreenchange', updateFullscreen);

      document.removeEventListener('webkitfullscreenchange', updateFullscreen);

    };

  }, []);

  const handleToggleFullscreen = useCallback(async () => {

    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;

    try {

      if (fullscreenElement) {

        if (document.exitFullscreen) await document.exitFullscreen();

        else await document.webkitExitFullscreen?.();

      } else {

        const target = screenRef.current || document.documentElement;

        if (target.requestFullscreen) await target.requestFullscreen();

        else await target.webkitRequestFullscreen?.();

      }

    } catch {

      /* fullscreen can be blocked by browser/device settings */

    }

  }, []);



  const studio = useStudioSession({

    localStream: castStream,

    mode,

    agency,

    referenceVideoUrl,

    songTitle: songTitle || (referenceVideoUrl ? '연습 영상' : '연습 곡'),

    playbackRate: 1,

    getCurrentTime: getRefCurrentTime,

    feedbackText: feedback?.[feedback.length - 1]?.message || '',

    feedbackItems: feedback,

    score: overallScore,

    scores,

    vocalMetrics,

    poseData: isPaused ? null : poseData,

    practiceStep,

    practiceStepLabel,

    isPaused,

    isPlaying: isTracking && !isPaused,

  });



  const studioControllerMode = studio.studioEnabled && studio.isConnected;



  const formatTime = () => {

    const m = Math.floor(sessionTime / 60).toString().padStart(2, '0');

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

    setIsPaused(false);

  }, [dance, vocal, isDance, recorder]);



  const handleStopTracking = useCallback(() => {

    if (isDance) dance.stopTracking();

    else vocal.stopTracking();

    setIsPaused(false);

  }, [dance, vocal, isDance]);



  const handlePause = useCallback(() => {

    setIsPaused(true);

    refPlayerRef.current?.pause?.();

  }, []);



  const handleResume = useCallback(() => {

    setIsPaused(false);

    refPlayerRef.current?.play?.();

  }, []);



  const handleComplete = useCallback(async () => {

    if (completing) return;

    setCompleting(true);

    handleStopTracking();

    studio.stopStudio();

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

            type: '트레이닝 보컬',

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

    studio,

    lineScores,

  ]);



  const handleGoHome = () => {

    handleStopTracking();

    studio.stopStudio();

    recorder.stopRecording();

    onHome?.();

  };



  const handleReferenceChange = (url, meta = {}) => {

    setReferenceVideoUrl(url);

    if (url) {

      if (meta.title) {

        setSongTitle(meta.title);

        return;

      }

      try {

        const parsed = new URL(url);

        const title = parsed.searchParams.get('title');

        setSongTitle(title || 'K-POP 연습');

      } catch {

        setSongTitle('K-POP 연습');

      }

    } else {

      setSongTitle('');

    }

  };



  return (

    <div ref={screenRef} className={`tv-mode tv-training-screen ${layoutClass} ${studioControllerMode ? 'tv-studio-controller' : ''}`}>

      <header className="tv-training-header">

        <div className="tv-training-header-left">

          <span className="tv-training-agency" style={{ color: agencyColor }}>

            {agency.toUpperCase()}

          </span>

          <span className="tv-training-mode">

            {mode === 'dance' ? '댄스 트레이닝' : '보컬 트레이닝'}

          </span>

          {studio.studioEnabled ? (

            <span

              className="tv-training-tv-badge"

              style={{ color: studio.isConnected ? '#00FF88' : 'rgba(255,255,255,0.5)' }}

            >

              {studio.isConnected ? 'STUDIO LIVE' : 'STUDIO 대기'}

            </span>

          ) : null}

        </div>

        <div className="tv-training-header-right">

          <button

            type="button"

            className={`studio-tv-btn ${studio.isConnected ? 'is-live' : ''}`}

            onClick={() => setStudioModalOpen(true)}

          >

            📺 TV 연결

          </button>

          <button

            type="button"

            className={`studio-tv-btn studio-fullscreen-btn ${isFullscreen ? 'is-live' : ''}`}

            onClick={handleToggleFullscreen}

          >

            {isFullscreen ? '전체 화면 해제' : '전체 화면'}

          </button>

          <span className="tv-training-timer">{formatTime()}</span>

        </div>

      </header>



      <StudioConnectModal
        open={studioModalOpen}
        onClose={() => setStudioModalOpen(false)}
        mode={mode}
        sessionCode={studio.sessionCode}
        displayUrl={studio.displayUrl}
        studioEnabled={studio.studioEnabled}
        isConnected={studio.isConnected}
        webrtcStatus={studio.webrtcStatus}
        syncError={studio.syncError}
        webrtcError={studio.webrtcError}
        onStartStudio={studio.startStudio}
        onJoinStudio={studio.joinStudio}
        onStopStudio={() => {
          studio.stopStudio();
          setStudioModalOpen(false);
        }}
      />



      {studioControllerMode ? (

        <StudioMobileController

          mode={mode}

          isTracking={isTracking}

          isPaused={isPaused}

          agencyColor={agencyColor}

          isConnected={studio.isConnected}

          videoRef={isDance ? dance.videoRef : null}

          canvasRef={isDance ? dance.canvasRef : null}

          onStart={handleStartTracking}

          onStop={handleStopTracking}

          onPause={handlePause}

          onResume={handleResume}

          onFlipCamera={isDance ? dance.switchCamera : undefined}

          onComplete={handleComplete}

          completing={completing}

        />

      ) : (

        <>

          <div className="tv-split-layout">

            <TVReferencePanel

              mode={mode}

              embedUrl={referenceVideoUrl}

              onEmbedUrlChange={handleReferenceChange}

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

        </>

      )}

    </div>

  );

}



export default TVLayout;

