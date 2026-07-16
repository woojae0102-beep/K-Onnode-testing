// @ts-nocheck
/**
 * Group Mode — 웹캠 미리보기 전용 (MediaPipe / Pose 추출 없음).
 */
import { useCallback, useRef, useState } from 'react';
import { applyInlineVideoAttributes, buildMobileVideoConstraints } from '../utils/mobileMedia';

export function useGroupWebcamPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStream = useCallback(() => streamRef.current, []);

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
  }, []);

  const startPreview = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: buildMobileVideoConstraints(),
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        applyInlineVideoAttributes(videoRef.current);
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsActive(true);
      return stream;
    } catch (err) {
      const msg = (err as Error)?.message || '카메라를 시작할 수 없습니다.';
      setError(msg);
      throw err;
    }
  }, []);

  return {
    videoRef,
    canvasRef,
    isActive,
    isTracking: isActive,
    cameraHealth: { error },
    error,
    getStream,
    startPreview,
    stopPreview,
    startTracking: startPreview,
    stopTracking: stopPreview,
    poseData: null,
    fitMode: 'contain' as const,
  };
}

export default useGroupWebcamPreview;
