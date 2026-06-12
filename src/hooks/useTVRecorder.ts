// @ts-nocheck
import { useCallback, useRef, useState } from 'react';

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'audio/webm'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export function useTVRecorder() {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const revokeUrl = useCallback(() => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);
  }, [recordedUrl]);

  const startRecording = useCallback((stream) => {
    if (!stream || typeof MediaRecorder === 'undefined') return false;
    try {
      revokeUrl();
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setIsRecording(true);
      return true;
    } catch {
      return false;
    }
  }, [revokeUrl]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false);
        resolve({ url: recordedUrl || null, blob: recordedBlob || null });
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setIsRecording(false);
        recorderRef.current = null;
        resolve({ url, blob });
      };
      try {
        recorder.stop();
      } catch {
        setIsRecording(false);
        resolve({ url: null, blob: null });
      }
    });
  }, [recordedBlob, recordedUrl]);

  const clearRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    revokeUrl();
    setIsRecording(false);
  }, [revokeUrl]);

  return {
    recordedUrl,
    recordedBlob,
    isRecording,
    startRecording,
    stopRecording,
    clearRecording,
  };
}

export default useTVRecorder;
