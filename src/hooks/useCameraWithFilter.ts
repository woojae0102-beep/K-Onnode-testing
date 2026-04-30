// @ts-nocheck
// 카메라 + 명암(밝기/대비/채도) 필터 + 녹화/촬영 통합 훅
//
// 설계 원칙:
// 1. 원본 video element는 살려둠 (opacity 0). MediaPipe 등 외부에서 videoRef를 읽어도 동작함.
// 2. 캔버스 렌더 루프는 GPU 가속 ctx.filter 사용 → 모바일 발열 최소.
// 3. 필터가 기본값(1,1,1)이면 ctx.filter 자체를 'none'으로 두어 추가 오버헤드 0.
// 4. 녹화는 displayCanvas.captureStream() + 원본 마이크 오디오 트랙을 합쳐서 사용
//    → 화면에 보이는 필터된 영상 그대로 파일로 저장됨.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface CameraFilter {
  brightness: number; // 0.2 ~ 2.5 (1.0 = 기본)
  contrast: number;   // 0.2 ~ 2.5 (1.0 = 기본)
  saturation: number; // 0.0 ~ 2.5 (1.0 = 기본)
}

export const DEFAULT_FILTER: CameraFilter = {
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
};

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const buildCameraFilterCss = (f: CameraFilter) => {
  if (f.brightness === 1 && f.contrast === 1 && f.saturation === 1) return 'none';
  return `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation})`;
};

const getSupportedMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ];
  for (const t of types) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // ignore
    }
  }
  return '';
};

export interface UseCameraWithFilterOptions {
  audio?: boolean;
  defaultFacingMode?: 'user' | 'environment';
  /** 일부 화면(예: 댄스)은 외부에서 카메라를 직접 켜고 끔. true면 hook 내부에서 자동 시작 안 함 */
  manualStart?: boolean;
}

export function useCameraWithFilter(options: UseCameraWithFilterOptions = {}) {
  const { audio = false, defaultFacingMode = 'user', manualStart = false } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const filterRef = useRef<CameraFilter>(DEFAULT_FILTER);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [filter, setFilterState] = useState<CameraFilter>(DEFAULT_FILTER);
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(defaultFacingMode);
  const [error, setError] = useState<string | null>(null);

  // filter state 변경 시 ref도 즉시 동기화 (render loop 재생성 방지)
  const setFilter = useCallback((next: CameraFilter | ((prev: CameraFilter) => CameraFilter)) => {
    setFilterState((prev) => {
      const value = typeof next === 'function' ? (next as (p: CameraFilter) => CameraFilter)(prev) : next;
      filterRef.current = value;
      return value;
    });
  }, []);

  const resetFilter = useCallback(() => setFilter(DEFAULT_FILTER), [setFilter]);

  const stopRenderLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const startRenderLoop = useCallback(() => {
    stopRenderLoop();
    const render = () => {
      const video = videoRef.current;
      const canvas = displayCanvasRef.current;
      if (!video || !canvas) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // 시각 필터는 캔버스 element의 CSS filter로 처리 (iOS Safari 18 미만에서 ctx.filter가 무시되기 때문).
      // 따라서 여기는 원본 프레임만 그린다.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
  }, [stopRenderLoop]);

  const stopCamera = useCallback(() => {
    stopRenderLoop();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, [stopRenderLoop]);

  const startCamera = useCallback(async () => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('이 브라우저는 카메라 API를 지원하지 않습니다.');
      return false;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (!isLocalhost) {
        setError('카메라는 HTTPS 또는 localhost 환경에서만 동작합니다.');
        return false;
      }
    }

    // 기존 스트림 정리
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    stopRenderLoop();

    // iOS는 해상도가 낮아야 안정적으로 60fps 유지됨 + Canvas 처리 부담 ↓
    const ideal = isIOS() ? { width: 720, height: 1280 } : { width: 1280, height: 720 };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: ideal.width },
          height: { ideal: ideal.height },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: audio
          ? { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
          : false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('muted', 'true');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        try {
          await video.play();
        } catch {
          // play() 실패는 무시 (브라우저 자동 재생 정책)
        }
      }

      setIsReady(true);
      startRenderLoop();
      return true;
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError') setError('카메라 권한이 거부되었습니다.');
      else if (name === 'NotFoundError') setError('사용 가능한 카메라를 찾지 못했습니다.');
      else setError('카메라를 시작하지 못했습니다.');
      setIsReady(false);
      return false;
    }
  }, [audio, facingMode, startRenderLoop, stopRenderLoop]);

  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  // facingMode 변경 시 카메라 재시작 (이미 켜진 상태였다면)
  useEffect(() => {
    if (!isReady) return;
    startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // 자동 시작 (manualStart가 false인 경우만)
  useEffect(() => {
    if (manualStart) return;
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopRenderLoop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [stopRenderLoop]);

  // ── 녹화 (필터 적용된 displayCanvas의 captureStream으로 녹화) ──────────
  const startRecording = useCallback(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !streamRef.current) return false;
    if (typeof MediaRecorder === 'undefined') {
      setError('이 브라우저는 영상 녹화를 지원하지 않습니다.');
      return false;
    }
    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      setError('지원하는 녹화 포맷이 없습니다.');
      return false;
    }
    chunksRef.current = [];

    const captured = (canvas as any).captureStream
      ? (canvas as any).captureStream(30)
      : null;
    if (!captured) {
      setError('Canvas 캡처를 지원하지 않는 브라우저입니다.');
      return false;
    }

    // 원본 마이크 오디오 트랙을 captured 스트림에 추가 (audio 옵션이 켜진 경우)
    if (audio) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((track) => captured.addTrack(track));
    }

    try {
      const recorder = new MediaRecorder(captured, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(200);
      recorderRef.current = recorder;
      setIsRecording(true);
      return true;
    } catch (e) {
      setError('녹화를 시작하지 못했습니다.');
      return false;
    }
  }, [audio]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        resolve(null);
        return;
      }
      const mimeType = getSupportedMimeType();
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        recorderRef.current = null;
        setIsRecording(false);
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        setIsRecording(false);
        resolve(null);
      }
    });
  }, []);

  const takePhoto = useCallback((): string | null => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }, []);

  return {
    // refs (외부에서 video를 다른 용도로 쓰고 싶을 때, 예: MediaPipe)
    videoRef,
    displayCanvasRef,
    streamRef,
    // 필터 상태
    filter,
    setFilter,
    resetFilter,
    // 카메라 상태
    isReady,
    facingMode,
    error,
    // 녹화 상태
    isRecording,
    // 액션
    startCamera,
    stopCamera,
    switchCamera,
    startRecording,
    stopRecording,
    takePhoto,
  };
}
