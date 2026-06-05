// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DifficultySlider from '../components/dance/DifficultySlider';
import MirrorModeToggle from '../components/dance/MirrorModeToggle';
import PoseFeedbackOverlay from '../components/dance/PoseFeedbackOverlay';
import YouTubeImport from '../components/dance/YouTubeImport';
import { usePoseDetection } from '../hooks/usePoseDetection';
import BrightnessControl from '../components/camera/BrightnessControl';
import { DEFAULT_FILTER } from '../hooks/useCameraWithFilter';
import { useSpotifyAnalysis } from '../hooks/useSpotifyAnalysis';
import { useDancePersonaCoach } from '../hooks/useDancePersonaCoach';
import { useSettingsStore } from '../store/settingsSlice';
import { buildMobileVideoConstraints } from '../utils/mobileMedia';
import { applyInlineVideoAttributes } from '../utils/mobileMedia';
import {
  cancelVideoFrame,
  getOptimizedCanvasContext,
  isDefaultCameraFilter,
  scheduleVideoFrame,
  shouldPreferDirectVideoDisplay,
  syncCanvasToVideo,
} from '../utils/cameraFrameLoop';
import DancePersonaCoachPanel from '../components/coaching/DancePersonaCoachPanel';
import PlaybackSpeedControl from '../components/common/PlaybackSpeedControl';
import YouTubePlayer from '../components/dance/YouTubePlayer';

const DEFAULT_YOUTUBE_URL =
  'https://www.youtube.com/watch?v=MPyvBYaCoLc&list=RDMPyvBYaCoLc&start_radio=1';
const DEFAULT_EMBED_URL =
  'https://www.youtube.com/embed/MPyvBYaCoLc?list=RDMPyvBYaCoLc';

export default function DanceTrainingView({ onNavigate, onReportUpdate }) {
  const { t } = useTranslation();
  const [videoUrl, setVideoUrl] = useState(DEFAULT_EMBED_URL);
  const [rate, setRate] = useState(1.0);
  const [mirror, setMirror] = useState(false);
  const [difficulty, setDifficulty] = useState(3);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const displayCanvasRef = useRef(null);
  const cameraBoxRef = useRef(null);
  const streamRef = useRef(null);
  const filterFrameRef = useRef(null);
  const useDirectVideoRef = useRef(true);
  const [cameraFilter, setCameraFilter] = useState(DEFAULT_FILTER);
  const cameraFilterRef = useRef(DEFAULT_FILTER);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isSecureOrigin = typeof window !== 'undefined' && (window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname));
  const { score, issue, summary, feedbackList, metrics, isAnalyzing } = usePoseDetection({
    active: cameraOn,
    videoRef,
    overlayCanvasRef,
  });

  const settings = useSettingsStore((state) => state.settings);
  const coachPersona = (settings?.dancePersona || 'jyp_jung');
  const language = settings?.coachLanguage || 'ko';
  const aiCoachOptions = useMemo(
    () => ({
      coachTone: settings?.coachTone || 'friendly',
      feedbackSensitivity: settings?.feedbackSensitivity || 3,
      coachMode: settings?.coachMode || 'single',
    }),
    [settings?.coachMode, settings?.coachTone, settings?.feedbackSensitivity]
  );

  const [songQuery, setSongQuery] = useState('');
  const {
    songAnalysis,
    isAnalyzing: isSongAnalyzing,
    analyzeSong,
    resetSongAnalysis,
  } = useSpotifyAnalysis();
  const {
    latest: danceCoachFeedback,
    isLoading: isCoachLoading,
    requestCoaching: requestDanceCoaching,
    resetCoach: resetDanceCoach,
  } = useDancePersonaCoach();
  const [currentPhase, setCurrentPhase] = useState('idle');

  const buildPoseData = () => {
    const mainIssues = [];
    if (issue) mainIssues.push(issue);
    if ((feedbackList || []).length > 0) {
      mainIssues.push(...feedbackList.slice(0, 2).map((f) => f?.text || f?.label || ''));
    }
    return {
      overallScore: Math.round(Number(score) || 0),
      rhythmScore: Math.round(Number(metrics?.symmetry || 0) * 100) / 1,
      expressionScore: Math.round(Number(metrics?.armAccuracy || 0)),
      mainIssues: mainIssues.filter(Boolean),
      strengths: summary?.bestMoment ? [summary.bestMoment] : [],
    };
  };

  const handleAnalyzeSong = async () => {
    const q = songQuery.trim();
    if (!q) return;
    resetDanceCoach();
    const analysis = await analyzeSong(q, { language });
    if (!analysis) return;
    setCurrentPhase('start');
    await requestDanceCoaching({
      songAnalysis: analysis,
      poseData: null,
      sessionPhase: 'start',
      coachPersona,
      language,
      ...aiCoachOptions,
    });
  };

  useEffect(() => {
    if (!cameraOn || !songAnalysis) return undefined;
    let cancelled = false;
    setCurrentPhase('realtime');
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      await requestDanceCoaching({
        songAnalysis,
        poseData: buildPoseData(),
        sessionPhase: 'realtime',
        coachPersona,
        language,
        ...aiCoachOptions,
      });
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, songAnalysis?.trackId, coachPersona, language, aiCoachOptions]);

  useEffect(() => {
    if (!songAnalysis) return undefined;
    // 카메라가 켜졌다가 꺼지면 종합 코칭 트리거
    if (!cameraOn && currentPhase === 'realtime') {
      setCurrentPhase('end');
      requestDanceCoaching({
        songAnalysis,
        poseData: buildPoseData(),
        sessionPhase: 'end',
        coachPersona,
        language,
        ...aiCoachOptions,
      });
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, songAnalysis?.trackId]);

  const phaseLabel = useMemo(() => {
    if (!currentPhase || currentPhase === 'idle') return undefined;
    return t(`coaching.phaseLabels.${currentPhase}`, { defaultValue: '' });
  }, [currentPhase, t]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('onnode_dance_difficulty', String(difficulty));
    } catch {
      /* ignore */
    }
  }, [difficulty]);

  useEffect(() => {
    onReportUpdate?.({
      mode: 'dance',
      cameraOn,
      isAnalyzing,
      score,
      summary,
      metrics,
      feedbackList,
      updatedAt: Date.now(),
    });
  }, [cameraOn, feedbackList, isAnalyzing, metrics, onReportUpdate, score, summary]);

  const stopCamera = () => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    cancelVideoFrame(filterFrameRef.current);
    filterFrameRef.current = null;
    setVideoReady(false);
    setCameraOn(false);
  };

  const updateCameraFilter = (next) => {
    cameraFilterRef.current = next;
    setCameraFilter(next);
  };

  const resetCameraFilter = () => updateCameraFilter(DEFAULT_FILTER);

  // 시각적 필터는 CSS filter로 적용 (ctx.filter는 iOS Safari 18 미만에서 무시되므로 비신뢰)
  // CSS filter는 모든 브라우저에서 GPU 가속으로 정확히 동작.
  const buildFilterString = (f) => {
    if (isDefaultCameraFilter(f)) return 'none';
    return `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation})`;
  };

  const useDirectVideo = cameraOn && shouldPreferDirectVideoDisplay(cameraFilter);

  const stopFilterRenderLoop = () => {
    cancelVideoFrame(filterFrameRef.current);
    filterFrameRef.current = null;
  };

  const startFilterRenderLoop = () => {
    stopFilterRenderLoop();

    const useDirect = shouldPreferDirectVideoDisplay(cameraFilterRef.current);
    useDirectVideoRef.current = useDirect;
    if (useDirect) return;

    const loop = () => {
      const v = videoRef.current;
      const c = displayCanvasRef.current;
      if (!v || !c) {
        filterFrameRef.current = scheduleVideoFrame(v, loop);
        return;
      }
      if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
        filterFrameRef.current = scheduleVideoFrame(v, loop);
        return;
      }
      syncCanvasToVideo(c, v);
      const ctx = getOptimizedCanvasContext(c);
      if (ctx) {
        ctx.drawImage(v, 0, 0, c.width, c.height);
      }
      filterFrameRef.current = scheduleVideoFrame(v, loop);
    };
    filterFrameRef.current = scheduleVideoFrame(videoRef.current, loop);
  };

  const attachStreamToVideo = async () => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video) return false;
    try {
      applyInlineVideoAttributes(video);
      video.srcObject = stream;
      await video.play();
      return true;
    } catch {
      return false;
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('이 브라우저는 카메라 API를 지원하지 않습니다.');
      return;
    }
    if (!isSecureOrigin) {
      setCameraError('카메라는 HTTPS 또는 localhost에서만 동작합니다. HTTPS 주소로 접속해주세요.');
      return;
    }
    try {
      stopCamera();
      setCameraLoading(true);
      setCameraError('');
      setVideoReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: buildMobileVideoConstraints(settings),
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      const attached = await attachStreamToVideo();
      if (!attached) {
        stream.getTracks().forEach((track) => track.stop());
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        const fallbackAttached = await attachStreamToVideo();
        if (!fallbackAttached) {
          throw new Error('VIDEO_ATTACH_FAILED');
        }
      }
      setVideoReady(true);
      // 캔버스 렌더 루프는 무조건 시작 (idempotent: 이미 돌고 있으면 재시작)
      startFilterRenderLoop();
    } catch (error) {
      const name = error?.name || '';
      if (name === 'NotAllowedError') {
        setCameraError('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라를 허용해주세요.');
      } else if (name === 'NotFoundError') {
        setCameraError('사용 가능한 카메라를 찾지 못했습니다.');
      } else if (error?.message === 'VIDEO_ATTACH_FAILED') {
        setCameraError('카메라 접근은 성공했지만 영상 표시에 실패했습니다. 페이지를 새로고침 후 다시 시도해주세요.');
      } else {
        setCameraError('카메라를 시작하지 못했습니다. 브라우저/권한 상태를 확인해주세요.');
      }
      setCameraOn(false);
      setVideoReady(false);
    } finally {
      setCameraLoading(false);
    }
  };

  useEffect(() => {
    if (!cameraOn) return;
    startFilterRenderLoop();
  }, [cameraFilter]);

  useEffect(() => {
    if (!cameraOn || !streamRef.current || !videoRef.current) return;
    // video element가 이미 srcObject를 가지고 있고 재생 중이면 굳이 다시 attach할 필요 없음
    const v = videoRef.current;
    if (v.srcObject === streamRef.current && !v.paused && v.videoWidth > 0) {
      setVideoReady(true);
      startFilterRenderLoop();
      return;
    }
    attachStreamToVideo().then((ok) => {
      if (ok) {
        setVideoReady(true);
        startFilterRenderLoop();
      }
      // 실패해도 startCamera에서 이미 처리했으므로 여기서는 추가 에러 표시하지 않음
    });
  }, [cameraOn]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Fullscreen 상태 추적 (사용자가 ESC 키 등으로 빠져나갈 수도 있음)
  useEffect(() => {
    const handler = () => {
      const fsEl =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement;
      setIsFullscreen(Boolean(fsEl));
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  const toggleFullscreen = async () => {
    const el = cameraBoxRef.current;
    if (!el) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const fsEl =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement;

    // iOS Safari는 element.requestFullscreen 미지원 → CSS 기반 의사-풀스크린만 사용
    if (isIOS || (!el.requestFullscreen && !(el as any).webkitRequestFullscreen)) {
      setIsFullscreen((v) => !v);
      return;
    }

    try {
      if (fsEl) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  };

  return (
    <div className="min-h-full p-4 md:p-6 bg-[#F5F5F7] space-y-4">
      <DancePersonaCoachPanel
        songQuery={songQuery}
        onSongQueryChange={setSongQuery}
        onAnalyze={handleAnalyzeSong}
        onReset={() => {
          resetSongAnalysis();
          resetDanceCoach();
          setSongQuery('');
          setCurrentPhase('idle');
        }}
        isSongAnalyzing={isSongAnalyzing}
        songAnalysis={songAnalysis}
        feedback={danceCoachFeedback}
        coachPersona={coachPersona}
        language={language}
        loading={isCoachLoading}
        phaseLabel={phaseLabel}
        currentPhase={currentPhase}
        playbackSpeed={rate}
        autoPlay={currentPhase !== 'realtime' || cameraOn}
        cameraOn={cameraOn}
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
          <YouTubeImport onLoad={setVideoUrl} initialUrl={DEFAULT_YOUTUBE_URL} />
          <div className="rounded-xl overflow-hidden border border-[#E5E5E5] bg-black h-[260px] md:h-[360px]">
            {videoUrl ? (
              <YouTubePlayer
                embedUrl={videoUrl}
                mirror={mirror}
                playbackRate={rate}
                className="w-full h-full"
              />
            ) : (
              <div className="h-full grid place-items-center text-white text-sm">{t('dance.emptyVideo')}</div>
            )}
          </div>
          <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <PlaybackSpeedControl
              value={rate}
              onChange={setRate}
              variant="light"
              label={t('dance.speed')}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <MirrorModeToggle value={mirror} onChange={setMirror} />
            <div className="flex-1">
              <DifficultySlider value={difficulty} onChange={setDifficulty} />
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-3">
          <div
            ref={cameraBoxRef}
            className={`rounded-xl border border-[#E5E5E5] bg-black relative overflow-hidden ${
              isFullscreen ? 'dance-camera-fs' : 'h-56 md:h-64'
            }`}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`absolute inset-0 h-full w-full object-cover scale-x-[-1] transition-opacity duration-150 ${
                useDirectVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              style={useDirectVideo ? { filter: buildFilterString(cameraFilter) } : undefined}
            />
            <canvas
              ref={displayCanvasRef}
              className={`absolute inset-0 h-full w-full object-cover scale-x-[-1] transition-opacity duration-150 ${
                cameraOn && !useDirectVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              style={!useDirectVideo ? { filter: buildFilterString(cameraFilter) } : undefined}
            />
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 h-full w-full pointer-events-none scale-x-[-1] transition-opacity duration-150 ${
                cameraOn ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {!cameraOn && (
              <>
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_center,#FF1F8E55,transparent_60%)]" />
                <div className="absolute inset-0 grid place-items-center text-white text-sm px-4 text-center">
                  {!isSecureOrigin
                    ? '모바일 카메라는 HTTPS 환경에서만 시작됩니다.'
                    : t('dance.cameraLive')}
                </div>
              </>
            )}
            {cameraOn && !videoReady && (
              <div className="absolute inset-0 grid place-items-center text-white text-xs bg-black/60">
                카메라 화면을 연결하는 중...
              </div>
            )}
            <div className="absolute left-3 bottom-3 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={cameraOn ? stopCamera : startCamera}
                disabled={cameraLoading}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  cameraOn ? 'bg-rose-500 text-white' : 'bg-[#FF1F8E] text-white'
                } disabled:opacity-60`}
              >
                {cameraLoading ? '카메라 준비중...' : cameraOn ? '카메라 끄기' : '카메라 켜기'}
              </button>
              {cameraOn && (
                <span className="rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white">
                  {isAnalyzing ? 'AI 분석 중' : 'AI 준비 중'}
                </span>
              )}
            </div>
            {cameraOn && (
              <div className="absolute left-3 top-3 z-10 rounded-lg bg-black/55 px-2 py-1 text-[10px] text-white">
                포즈 {metrics.trackedPoints}/33 · 손 {metrics.handPoints}/42
              </div>
            )}
            {cameraOn && videoReady && (
              <button
                type="button"
                onClick={() => setShowFilterPanel((v) => !v)}
                aria-label="카메라 명암 조절"
                className="absolute z-20 grid h-9 w-9 place-items-center rounded-full border border-white/30 text-white text-base shadow"
                style={{
                  top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                  right: 12,
                  background: showFilterPanel ? '#FF1F8E' : 'rgba(0,0,0,0.55)',
                }}
              >
                ☀
              </button>
            )}
            {cameraOn && videoReady && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
                className="absolute z-20 grid h-9 w-9 place-items-center rounded-full border border-white/30 text-white text-base shadow"
                style={{
                  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
                  right: 12,
                  background: 'rgba(0,0,0,0.55)',
                }}
              >
                {isFullscreen ? '✕' : '⛶'}
              </button>
            )}
            {cameraOn && (
              <BrightnessControl
                filter={cameraFilter}
                onChange={updateCameraFilter}
                onReset={resetCameraFilter}
                visible={showFilterPanel}
                onClose={() => setShowFilterPanel(false)}
              />
            )}
          </div>
          {cameraError ? <p className="text-xs text-rose-500 px-1">{cameraError}</p> : null}
          <DanceAvatarCoachPanel
            active={cameraOn}
            score={score}
            issue={issue}
            metrics={metrics}
            isAnalyzing={isAnalyzing}
          />
          <PoseFeedbackOverlay
            score={score}
            issue={issue}
            summary={summary}
            metrics={metrics}
            feedbackList={feedbackList}
          />
        </div>
      </div>
    </div>
  );
}

function avatarPoseFromMetrics(metrics) {
  const armSpread = Math.max(18, Math.min(48, (metrics?.armAccuracy || 45) * 0.48));
  const kneeBend = Math.max(0, Math.min(18, 18 - (metrics?.legAccuracy || 55) * 0.12));
  const shoulderTilt = Math.max(-10, Math.min(10, (metrics?.shoulderTiltDeg || 0) * 0.7));
  const torsoLean = Math.max(-12, Math.min(12, (metrics?.torsoLeanDeg || 0) * 0.7));
  const energy = Math.max(0.92, Math.min(1.12, 0.92 + (metrics?.danceActivity || 0) / 500));
  return { armSpread, kneeBend, shoulderTilt, torsoLean, energy };
}

function getCorrectionFocus(metrics) {
  if ((metrics?.poseConfidence || 0) < 55) return '전신이 보이도록 카메라에서 1~2걸음 뒤로 이동';
  if ((metrics?.armAccuracy || 0) < 65) return '팔 라인을 더 크게 펴서 손끝까지 길게';
  if ((metrics?.legAccuracy || 0) < 65) return '무릎 굽힘/펴짐을 더 확실하게';
  if ((metrics?.postureBalance || 0) < 65) return '어깨와 골반 수평을 맞춰 코어 고정';
  if ((metrics?.danceActivity || 0) < 55) return '손목 궤적을 크게 써서 에너지 업';
  return '현재 자세 안정적 - 다음은 박자 시작점을 더 정확하게';
}

function DanceAvatarCoachPanel({ active, score, issue, metrics, isAnalyzing }) {
  const pose = avatarPoseFromMetrics(metrics || {});
  const focus = getCorrectionFocus(metrics || {});
  const accuracyColor = score >= 80 ? '#1DB971' : score >= 60 ? '#F59E0B' : '#FF1F8E';

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-[#111111]">AI 아바타 자세 코치</p>
          <p className="text-xs text-[#888888]">
            {active
              ? isAnalyzing
                ? '카메라 자세를 실시간 아바타로 변환 중'
                : 'AI 포즈 모델 준비 중'
              : '카메라를 켜면 내 자세 기반 아바타가 생성됩니다'}
          </p>
        </div>
        <span className="rounded-full px-2 py-1 text-[10px] font-black text-white" style={{ background: accuracyColor }}>
          {Math.round(score || 0)}점
        </span>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
        <div className="rounded-2xl bg-[#090909] p-2 h-36 grid place-items-center overflow-hidden relative">
          <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_center,#FF1F8E44,transparent_68%)]" />
          <svg width="112" height="128" viewBox="0 0 112 128" className="relative drop-shadow-[0_0_18px_rgba(255,31,142,0.55)]">
            <circle cx="56" cy="18" r="11" fill="#fff" />
            <line x1={56 - pose.shoulderTilt} y1="34" x2={56 + pose.torsoLean} y2="70" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
            <line x1={56 - pose.shoulderTilt} y1="38" x2={56 - pose.armSpread} y2="62" stroke="#22D3EE" strokeWidth="6" strokeLinecap="round" />
            <line x1={56 - pose.armSpread} y1="62" x2={34 - pose.armSpread * 0.18} y2={86 - pose.kneeBend} stroke="#22D3EE" strokeWidth="6" strokeLinecap="round" />
            <line x1={56 - pose.shoulderTilt} y1="38" x2={56 + pose.armSpread} y2="62" stroke="#22D3EE" strokeWidth="6" strokeLinecap="round" />
            <line x1={56 + pose.armSpread} y1="62" x2={78 + pose.armSpread * 0.18} y2={86 - pose.kneeBend} stroke="#22D3EE" strokeWidth="6" strokeLinecap="round" />
            <line x1={56 + pose.torsoLean} y1="70" x2="42" y2={104 - pose.kneeBend} stroke="#FF1F8E" strokeWidth="7" strokeLinecap="round" />
            <line x1="42" y1={104 - pose.kneeBend} x2={30 / pose.energy} y2="120" stroke="#FF1F8E" strokeWidth="7" strokeLinecap="round" />
            <line x1={56 + pose.torsoLean} y1="70" x2="70" y2={104 - pose.kneeBend} stroke="#FF1F8E" strokeWidth="7" strokeLinecap="round" />
            <line x1="70" y1={104 - pose.kneeBend} x2={82 * pose.energy} y2="120" stroke="#FF1F8E" strokeWidth="7" strokeLinecap="round" />
            <circle cx="56" cy="70" r="5" fill="#FFD166" />
          </svg>
        </div>

        <div className="space-y-2 min-w-0">
          <div className="rounded-xl bg-[#F5F5F7] p-3">
            <p className="text-[11px] font-bold text-[#FF1F8E]">지금 고칠 포인트</p>
            <p className="mt-1 text-sm font-semibold text-[#111111] leading-snug">{focus}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <MiniMetric label="팔" value={metrics?.armAccuracy || 0} />
            <MiniMetric label="하체" value={metrics?.legAccuracy || 0} />
            <MiniMetric label="균형" value={metrics?.postureBalance || 0} />
          </div>
          <p className="text-[11px] text-[#777777] leading-snug">{issue}</p>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-2">
      <p className="text-[#888888]">{label}</p>
      <p className="font-black text-[#111111]">{Math.round(value)}%</p>
    </div>
  );
}
