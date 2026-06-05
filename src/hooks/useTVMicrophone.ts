// @ts-nocheck
import { useCallback, useRef, useState } from 'react';
import { useLiveAudioMeter } from './useLiveAudioMeter';

export function useTVMicrophone() {
  const [isTracking, setIsTracking] = useState(false);
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null);

  const { volumeLevel, pitchFeedback, tuningState, pitchAccuracy } = useLiveAudioMeter({
    stream,
    active: isTracking && !!stream,
    targetMidi: 60,
  });

  const pitchScore =
    pitchAccuracy > 0
      ? pitchAccuracy
      : tuningState === 'in-tune'
        ? Math.min(100, 75 + volumeLevel * 0.2)
        : tuningState === 'idle'
          ? 0
          : Math.max(35, 65 - Math.abs(volumeLevel - 50) * 0.3);

  const startTracking = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsTracking(true);
    } catch (err) {
      console.error('마이크 시작 실패:', err);
    }
  }, []);

  const stopTracking = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setIsTracking(false);
  }, []);

  const getStream = useCallback(() => streamRef.current, []);

  return {
    isTracking,
    startTracking,
    stopTracking,
    volumeLevel,
    pitchFeedback,
    tuningState,
    pitchScore,
    pitchAccuracy,
    getStream,
  };
}

export default useTVMicrophone;
