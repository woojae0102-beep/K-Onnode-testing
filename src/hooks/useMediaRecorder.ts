// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';

function pickMime(hasVideo) {
  const types = hasVideo
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

/**
 * Camera/mic preview + session recording for teaching flows.
 * Live analysis uses the same stream (no second getUserMedia).
 */
export function useMediaRecorder({ mode = 'video' } = {}) {
  const hasVideo = mode === 'video';
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState('');

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const videoRef = useRef(null);

  const attachPreview = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.play().catch(() => {});
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startPreview = useCallback(async () => {
    setError('');
    try {
      stopTracks();
      const constraints = hasVideo
        ? { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsPreviewing(true);
      attachPreview();
      return stream;
    } catch {
      const msg = hasVideo ? '카메라·마이크 권한이 필요합니다.' : '마이크 권한이 필요합니다.';
      setError(msg);
      throw new Error(msg);
    }
  }, [attachPreview, hasVideo, stopTracks]);

  const stopPreview = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsPreviewing(false);
    setElapsedSec(0);
    stopTracks();
  }, [stopTracks]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return false;
    const mimeType = pickMime(hasVideo);
    if (!mimeType) {
      setError('이 브라우저는 녹화를 지원하지 않습니다.');
      return false;
    }
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType });
    mr.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = mr;
    mr.start(250);
    setIsRecording(true);
    setElapsedSec(0);
    timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return true;
  }, [hasVideo]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve, reject) => {
      const mr = recorderRef.current;
      if (!mr || mr.state === 'inactive') {
        reject(new Error('녹음 중이 아닙니다.'));
        return;
      }
      mr.addEventListener(
        'stop',
        () => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsRecording(false);
          recorderRef.current = null;
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || (hasVideo ? 'video/webm' : 'audio/webm') });
          const ext = hasVideo ? 'webm' : 'webm';
          const file = new File([blob], `session-${Date.now()}.${ext}`, { type: blob.type });
          resolve(file);
        },
        { once: true }
      );
      mr.stop();
    });
  }, [hasVideo]);

  useEffect(() => {
    if (isPreviewing) attachPreview();
  }, [isPreviewing, attachPreview]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  return {
    videoRef,
    streamRef,
    isPreviewing,
    isRecording,
    elapsedSec,
    error,
    startPreview,
    stopPreview,
    startRecording,
    stopRecording,
  };
}

export default useMediaRecorder;
