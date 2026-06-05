// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../store/settingsSlice';
import {
  applyInlineVideoAttributes,
  buildMobileAudioConstraints,
  buildMobileVideoConstraints,
  mimeToRecordingExtension,
  pickRecorderMimeType,
} from '../utils/mobileMedia';

/**
 * Camera/mic preview + session recording for teaching flows.
 * Mobile (iPhone/Galaxy): user gesture required before startPreview().
 */
export function useMediaRecorder({ mode = 'video' } = {}) {
  const hasVideo = mode === 'video';
  const noiseFilter = useSettingsStore((s) => s.settings.noiseFilter);
  const micSensitivity = useSettingsStore((s) => s.settings.micSensitivity);
  const cameraDefault = useSettingsStore((s) => s.settings.cameraDefault);
  const mediaSettings = { noiseFilter, micSensitivity, cameraDefault };

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
      applyInlineVideoAttributes(video);
      video.srcObject = stream;
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
    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = '이 브라우저는 카메라/마이크를 지원하지 않습니다. Safari·Chrome 최신 버전을 사용해 주세요.';
      setError(msg);
      throw new Error(msg);
    }
    try {
      stopTracks();
      const constraints = hasVideo
        ? {
            video: buildMobileVideoConstraints(mediaSettings),
            audio: buildMobileAudioConstraints(mediaSettings),
          }
        : { audio: buildMobileAudioConstraints(mediaSettings) };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsPreviewing(true);
      attachPreview();
      return stream;
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      const msg = denied
        ? hasVideo
          ? '카메라·마이크 권한을 허용해 주세요. (설정 → Safari/Chrome → 카메라·마이크)'
          : '마이크 권한을 허용해 주세요.'
        : hasVideo
        ? '카메라를 시작하지 못했습니다. 다른 앱이 카메라를 쓰고 있지 않은지 확인해 주세요.'
        : '마이크를 시작하지 못했습니다.';
      setError(msg);
      throw new Error(msg);
    }
  }, [attachPreview, hasVideo, mediaSettings, stopTracks]);

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
    const mimeType = pickRecorderMimeType(hasVideo);
    chunksRef.current = [];
    try {
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = mr;
      mr.start(250);
      setIsRecording(true);
      setElapsedSec(0);
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
      return true;
    } catch {
      setError('녹화를 시작하지 못했습니다. iPhone은 Safari, 갤럭시는 Chrome을 권장합니다.');
      return false;
    }
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
          const type = mr.mimeType || pickRecorderMimeType(hasVideo) || (hasVideo ? 'video/mp4' : 'audio/mp4');
          const blob = new Blob(chunksRef.current, { type });
          const ext = mimeToRecordingExtension(type, hasVideo);
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
