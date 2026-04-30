// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DifficultySlider from '../components/dance/DifficultySlider';
import MirrorModeToggle from '../components/dance/MirrorModeToggle';
import PoseFeedbackOverlay from '../components/dance/PoseFeedbackOverlay';
import YouTubeImport from '../components/dance/YouTubeImport';
import { usePoseDetection } from '../hooks/usePoseDetection';

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
  const streamRef = useRef(null);
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
    setVideoReady(false);
    setCameraOn(false);
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
    attachStreamToVideo().then((ok) => {
      if (ok) {
        setVideoReady(true);
      } else {
        setCameraError('카메라 영상 연결이 불안정합니다. 카메라를 껐다가 다시 켜주세요.');
        setVideoReady(false);
      }
    });
  }, [cameraOn]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
          <div className="rounded-xl border border-[#E5E5E5] bg-black h-56 md:h-64 relative overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`h-full w-full object-cover scale-x-[-1] transition-opacity duration-150 ${cameraOn ? 'opacity-100' : 'opacity-0'}`}
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
              <div className="absolute right-3 top-3 z-10 rounded-lg bg-black/55 px-2 py-1 text-[10px] text-white">
                포즈 {metrics.trackedPoints}/33 · 손 {metrics.handPoints}/42
              </div>
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
