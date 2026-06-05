// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { buildVocalPitchFeedback, detectPitchHzAutocorr } from '../training/trainingPitch';

const TICK_MS = 100;

function calcRms(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
  return Math.sqrt(sum / Math.max(1, data.length));
}

/**
 * Lightweight live mic meter using an existing MediaStream (from useMediaRecorder).
 */
export function useLiveAudioMeter({ stream, active = false, targetMidi = 60 } = {}) {
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [pitchFeedback, setPitchFeedback] = useState('마이크에 대고 연습해 보세요.');
  const [tuningState, setTuningState] = useState('idle');
  const timerRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    if (!active || !stream) {
      setVolumeLevel(0);
      setTuningState('idle');
      setPitchFeedback('마이크에 대고 연습해 보세요.');
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      ctxRef.current?.close?.();
      ctxRef.current = null;
      return undefined;
    }

    let cancelled = false;
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return undefined;

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    ctx.resume?.().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    timerRef.current = setInterval(() => {
      if (cancelled) return;
      analyser.getFloatTimeDomainData(buf);
      const rms = calcRms(buf);
      setVolumeLevel(Math.min(100, Math.round(rms * 400)));
      const hz = detectPitchHzAutocorr(buf, ctx.sampleRate);
      if (!hz || rms < 0.008) {
        setTuningState('idle');
        setPitchFeedback(rms < 0.008 ? '목소리를 더 크게 내 보세요.' : '음정을 감지하는 중...');
        return;
      }
      const fb = buildVocalPitchFeedback(hz, targetMidi);
      setPitchFeedback(fb.feedback);
      if (Math.abs(fb.centsRaw ?? 0) <= 15) setTuningState('in-tune');
      else if ((fb.centsRaw ?? 0) > 0) setTuningState('sharp');
      else setTuningState('flat');
    }, TICK_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      source.disconnect();
      ctx.close?.();
      ctxRef.current = null;
    };
  }, [active, stream, targetMidi]);

  return { volumeLevel, pitchFeedback, tuningState };
}

export default useLiveAudioMeter;
