// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DifficultySlider from '../components/dance/DifficultySlider';
import MirrorModeToggle from '../components/dance/MirrorModeToggle';
import PoseFeedbackOverlay from '../components/dance/PoseFeedbackOverlay';
import YouTubeImport from '../components/dance/YouTubeImport';
import { usePoseDetection } from '../hooks/usePoseDetection';
import BrightnessControl from '../components/camera/BrightnessControl';
import { DEFAULT_FILTER } from '../hooks/useCameraWithFilter';

const DEFAULT_YOUTUBE_URL =
  'https://www.youtube.com/watch?v=MPyvBYaCoLc&list=RDMPyvBYaCoLc&start_radio=1';
const DEFAULT_EMBED_URL =
  'https://www.youtube.com/embed/MPyvBYaCoLc?list=RDMPyvBYaCoLc';

function buildIframeSrc(embedUrl) {
  if (!embedUrl) return '';
  const params = 'autoplay=1&playsinline=1&mute=1&rel=0';
  return embedUrl.includes('?') ? `${embedUrl}&${params}` : `${embedUrl}?${params}`;
}

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
  const filterRafRef = useRef(0);
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

  useEffect(() => {
    fetch('/api/dance/set-difficulty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty }),
    }).catch(() => {});
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
    if (filterRafRef.current) {
      cancelAnimationFrame(filterRafRef.current);
      filterRafRef.current = 0;
    }
    setVideoReady(false);
    setCameraOn(false);
  };

  const updateCameraFilter = (next) => {
    cameraFilterRef.current = next;
    setCameraFilter(next);
  };

  const resetCameraFilter = () => updateCameraFilter(DEFAULT_FILTER);

  const buildFilterString = (f) => {
    if (f.brightness === 1 && f.contrast === 1 && f.saturation === 1) return 'none';
    return `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation})`;
  };

  const startFilterRenderLoop = () => {
    if (filterRafRef.current) cancelAnimationFrame(filterRafRef.current);
    const loop = () => {
      const v = videoRef.current;
      const c = displayCanvasRef.current;
      if (!v || !c) {
        filterRafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
        filterRafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
      }
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.filter = buildFilterString(cameraFilterRef.current);
        ctx.drawImage(v, 0, 0, c.width, c.height);
      }
      filterRafRef.current = requestAnimationFrame(loop);
    };
    filterRafRef.current = requestAnimationFrame(loop);
  };

  const attachStreamToVideo = async () => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video) return false;
    try {
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute('muted', 'true');
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
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
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
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
    <div className="min-h-full p-4 md:p-6 bg-[#F5F5F7]">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
          <YouTubeImport onLoad={setVideoUrl} initialUrl={DEFAULT_YOUTUBE_URL} />
          <div className="rounded-xl overflow-hidden border border-[#E5E5E5] bg-black h-[260px] md:h-[360px]">
            {videoUrl ? (
              <iframe
                title="dance-video"
                src={buildIframeSrc(videoUrl)}
                className="w-full h-full"
                style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="h-full grid place-items-center text-white text-sm">{t('dance.emptyVideo')}</div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-[#888888]">{t('dance.speed')}</p>
              <div className="flex gap-2">
                {[0.25, 0.5, 0.75, 1.0].map((item) => (
                  <button key={item} type="button" className={`rounded-lg px-2 py-1 text-xs border ${rate === item ? 'border-[#FF1F8E] text-[#FF1F8E]' : 'border-[#E5E5E5] text-[#888888]'}`} onClick={() => setRate(item)}>
                    {item}x
                  </button>
                ))}
              </div>
            </div>
            <MirrorModeToggle value={mirror} onChange={setMirror} />
            <DifficultySlider value={difficulty} onChange={setDifficulty} />
          </div>
        </div>

        <div className="xl:col-span-2 space-y-3">
          <div
            ref={cameraBoxRef}
            className={`rounded-xl border border-[#E5E5E5] bg-black relative overflow-hidden ${
              isFullscreen ? 'dance-camera-fs' : 'h-56 md:h-64'
            }`}
          >
            {/* 원본 video: MediaPipe 분석용으로 살아있어야 하므로 opacity 0으로 숨김 */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-cover opacity-0 pointer-events-none"
            />
            {/* 필터 적용된 디스플레이 캔버스 */}
            <canvas
              ref={displayCanvasRef}
              className={`h-full w-full object-cover scale-x-[-1] transition-opacity duration-150 ${
                cameraOn ? 'opacity-100' : 'opacity-0'
              }`}
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
                className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/30 text-white text-base shadow"
                style={{ background: showFilterPanel ? '#FF1F8E' : 'rgba(0,0,0,0.55)' }}
              >
                ☀
              </button>
            )}
            {cameraOn && videoReady && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
                className="absolute right-3 bottom-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/30 text-white text-base shadow"
                style={{ background: 'rgba(0,0,0,0.55)' }}
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
