// @ts-nocheck
import { useCallback, useRef, useState } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch {
      setError('마이크 권한이 필요합니다.');
      throw new Error('마이크 권한이 필요합니다.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve, reject) => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === 'inactive') {
        reject(new Error('녹음 중이 아닙니다.'));
        return;
      }
      mr.addEventListener(
        'stop',
        () => {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
          setIsRecording(false);
          mediaRecorderRef.current = null;
          resolve(file);
        },
        { once: true }
      );
      mr.stop();
    });
  }, []);

  return { isRecording, error, startRecording, stopRecording };
}

export default useAudioRecorder;
