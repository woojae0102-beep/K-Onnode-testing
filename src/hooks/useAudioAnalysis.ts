// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildVocalPitchFeedback, detectPitchHzAutocorr, hzToMidiFloat, midiToNoteName } from '../training/trainingPitch';
import { useSettingsStore } from '../store/settingsSlice';
import { buildAudioConstraints, micSensitivityToGain } from '../utils/mediaSettings';

const ANALYZE_INTERVAL_MS = 90;
const WAVE_BAR_COUNT = 48;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function smooth(prev, next, alpha = 0.22) {
  if (!Number.isFinite(prev)) return next;
  return prev + (next - prev) * alpha;
}

function calcRms(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
  return Math.sqrt(sum / Math.max(1, data.length));
}

function buildWaveBars(data) {
  if (!data?.length) return Array.from({ length: WAVE_BAR_COUNT }, () => 6);
  const chunk = Math.max(1, Math.floor(data.length / WAVE_BAR_COUNT));
  const out = [];
  for (let i = 0; i < WAVE_BAR_COUNT; i += 1) {
    const start = i * chunk;
    const end = Math.min(data.length, start + chunk);
    let acc = 0;
    for (let k = start; k < end; k += 1) acc += Math.abs(data[k]);
    const avg = acc / Math.max(1, end - start);
    out.push(clamp(Math.round(avg * 220), 4, 100));
  }
  return out;
}

function calcStabilityScore(recentHz) {
  if (recentHz.length < 6) return 50;
  const mids = recentHz.map((h) => hzToMidiFloat(h)).filter((x) => Number.isFinite(x));
  if (mids.length < 6) return 50;
  const mean = mids.reduce((a, b) => a + b, 0) / mids.length;
  const variance = mids.reduce((acc, m) => acc + (m - mean) ** 2, 0) / mids.length;
  const std = Math.sqrt(variance);
  return clamp(100 - std * 34);
}

function calcRhythmScoreFromOnsets(onsetsMs) {
  if (onsetsMs.length < 4) return 50;
  const intervals = [];
  for (let i = 1; i < onsetsMs.length; i += 1) intervals.push(onsetsMs[i] - onsetsMs[i - 1]);
  if (!intervals.length) return 50;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((acc, n) => acc + (n - mean) ** 2, 0) / intervals.length;
  const std = Math.sqrt(variance);
  return clamp(100 - std * 0.18);
}

function median(numbers) {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function useAudioAnalysis({ active = false, targetMidi = 60 } = {}) {
  const micSensitivity = useSettingsStore((s) => s.settings.micSensitivity);
  const noiseFilter = useSettingsStore((s) => s.settings.noiseFilter);
  const mediaSettings = useMemo(() => ({ micSensitivity, noiseFilter }), [micSensitivity, noiseFilter]);
  const micGain = micSensitivityToGain(mediaSettings.micSensitivity);
  const [pitchSeries, setPitchSeries] = useState([]);
  const [pitchScore, setPitchScore] = useState(0);
  const [rhythmScore, setRhythmScore] = useState(0);
  const [liveScore, setLiveScore] = useState(0);
  const [voiceScore, setVoiceScore] = useState(0);
  const [emotionScore, setEmotionScore] = useState(0);
  const [currentHz, setCurrentHz] = useState(null);
  const [currentNote, setCurrentNote] = useState('-');
  const [currentCents, setCurrentCents] = useState(null);
  const [targetNote, setTargetNote] = useState(midiToNoteName(targetMidi));
  const [tuningState, setTuningState] = useState('idle');
  const [pitchFeedback, setPitchFeedback] = useState('마이크를 켜고 노래를 시작하세요.');
  const [pitchAccuracy, setPitchAccuracy] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [waveBars, setWaveBars] = useState(Array.from({ length: WAVE_BAR_COUNT }, () => 6));
  const [micError, setMicError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [suggestedMidi, setSuggestedMidi] = useState(null);
  const [suggestedNote, setSuggestedNote] = useState('-');

  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const sampleRateRef = useRef(44100);
  const historyHzRef = useRef([]);
  const onsetMsRef = useRef([]);
  const prevRmsRef = useRef(0);
  const tickRef = useRef(0);
  const suggestedMidiRef = useRef(null);
  const pitchScoreRef = useRef(0);
  const rhythmScoreRef = useRef(0);
  const voiceScoreRef = useRef(0);
  const emotionScoreRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setIsListening(false);
      setCurrentHz(null);
      setCurrentNote('-');
      setCurrentCents(null);
      setTuningState('idle');
      setVolumeLevel(0);
      setPitchFeedback('마이크를 켜고 노래를 시작하세요.');
      setWaveBars(Array.from({ length: WAVE_BAR_COUNT }, () => 6));
      setSuggestedMidi(null);
      setSuggestedNote('-');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      return undefined;
    }

    let cancelled = false;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMicError('이 브라우저는 마이크 API를 지원하지 않습니다.');
          return;
        }
        setMicError('');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: buildAudioConstraints(mediaSettings),
          video: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        sampleRateRef.current = ctx.sampleRate;

        const source = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        gain.gain.value = micGain;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = mediaSettings.noiseFilter ? 100 : 40;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = mediaSettings.noiseFilter ? 1500 : 5000;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = mediaSettings.noiseFilter ? 0.6 : 0.45;
        source.connect(gain);
        gain.connect(hp);
        hp.connect(lp);
        lp.connect(analyser);
        analyserRef.current = analyser;

        tickRef.current = 0;
        historyHzRef.current = [];
        onsetMsRef.current = [];
        prevRmsRef.current = 0;
        suggestedMidiRef.current = null;
        pitchScoreRef.current = 0;
        rhythmScoreRef.current = 0;
        voiceScoreRef.current = 0;
        emotionScoreRef.current = 0;
        setPitchSeries([]);
        setIsListening(true);
        setTargetNote(midiToNoteName(targetMidi));

        timerRef.current = setInterval(() => {
          const analyzer = analyserRef.current;
          if (!analyzer) return;
          const now = performance.now();
          const wave = new Float32Array(analyzer.fftSize);
          analyzer.getFloatTimeDomainData(wave);
          const rms = calcRms(wave);
          const vol = clamp(Math.round(rms * 220));
          setVolumeLevel(vol);
          setWaveBars(buildWaveBars(wave));

          const energyRise = rms - prevRmsRef.current;
          const noiseGate = mediaSettings.noiseFilter ? 0.03 : 0.018;
          const energyGate = mediaSettings.noiseFilter ? 0.012 : 0.007;
          if (rms > noiseGate && energyRise > energyGate) {
            const last = onsetMsRef.current[onsetMsRef.current.length - 1] || 0;
            if (now - last > 190) {
              onsetMsRef.current.push(now);
              onsetMsRef.current = onsetMsRef.current.slice(-12);
            }
          }
          prevRmsRef.current = rms;

          const hz = detectPitchHzAutocorr(analyzer, sampleRateRef.current);
          if (hz && hz > 70 && hz < 1200) {
            const midiFloat = hzToMidiFloat(hz);
            const note = midiFloat == null ? '-' : midiToNoteName(Math.round(midiFloat));
            const pitchFb = buildVocalPitchFeedback(hz, targetMidi);
            historyHzRef.current.push(hz);
            historyHzRef.current = historyHzRef.current.slice(-24);
            const recentMidi = historyHzRef.current
              .map((value) => hzToMidiFloat(value))
              .filter((value) => Number.isFinite(value))
              .slice(-18);
            const med = median(recentMidi);
            if (med != null) {
              const rounded = clamp(Math.round(med), 48, 84);
              if (suggestedMidiRef.current == null || Math.abs(rounded - suggestedMidiRef.current) >= 1) {
                suggestedMidiRef.current = rounded;
                setSuggestedMidi(rounded);
                setSuggestedNote(midiToNoteName(rounded));
              }
            }

            const nextPitchScore = smooth(pitchScoreRef.current, pitchFb.accuracy, 0.28);
            const nextRhythmScore = smooth(rhythmScoreRef.current, calcRhythmScoreFromOnsets(onsetMsRef.current), 0.2);
            const nextVoiceScore = smooth(voiceScoreRef.current, calcStabilityScore(historyHzRef.current), 0.25);
            const emotionRaw = clamp((vol * 0.45 + nextRhythmScore * 0.55));
            const nextEmotionScore = smooth(emotionScoreRef.current, emotionRaw, 0.25);

            pitchScoreRef.current = nextPitchScore;
            rhythmScoreRef.current = nextRhythmScore;
            voiceScoreRef.current = nextVoiceScore;
            emotionScoreRef.current = nextEmotionScore;

            tickRef.current += 1;
            setCurrentHz(hz);
            setCurrentNote(note);
            setCurrentCents(Math.round(pitchFb.centsRaw ?? 0));
            if (Math.abs(pitchFb.centsRaw ?? 0) <= 12) setTuningState('in-tune');
            else if ((pitchFb.centsRaw ?? 0) > 0) setTuningState('sharp');
            else setTuningState('flat');
            setPitchAccuracy(Math.round(nextPitchScore));
            setPitchFeedback(pitchFb.feedback);
            setPitchScore(Math.round(nextPitchScore));
            setRhythmScore(Math.round(nextRhythmScore));
            setVoiceScore(Math.round(nextVoiceScore));
            setEmotionScore(Math.round(nextEmotionScore));
            setPitchSeries((prev) => [...prev.slice(-59), { idx: tickRef.current, hz: Number(hz.toFixed(1)), note }]);
          } else {
            const nextRhythmScore = smooth(rhythmScoreRef.current, calcRhythmScoreFromOnsets(onsetMsRef.current), 0.16);
            const nextEmotionScore = smooth(emotionScoreRef.current, clamp(vol * 0.65 + nextRhythmScore * 0.35), 0.2);
            rhythmScoreRef.current = nextRhythmScore;
            emotionScoreRef.current = nextEmotionScore;
            setCurrentHz(null);
            setCurrentNote('-');
            setCurrentCents(null);
            setTuningState('idle');
            setPitchFeedback('음성을 감지하는 중입니다. 한 음절을 길게 불러보세요.');
            setRhythmScore(Math.round(nextRhythmScore));
            setEmotionScore(Math.round(nextEmotionScore));
          }

          const totalLive = Math.round(
            pitchScoreRef.current * 0.38 + rhythmScoreRef.current * 0.24 + voiceScoreRef.current * 0.24 + emotionScoreRef.current * 0.14
          );
          setLiveScore(totalLive);
        }, ANALYZE_INTERVAL_MS);
      } catch (error) {
        const name = error?.name || '';
        if (name === 'NotAllowedError') {
          setMicError('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해주세요.');
        } else if (name === 'NotFoundError') {
          setMicError('사용 가능한 마이크를 찾지 못했습니다.');
        } else {
          setMicError('마이크를 시작하지 못했습니다. 브라우저 권한과 장치를 확인해주세요.');
        }
        setIsListening(false);
      }
    };

    start();
    return () => {
      cancelled = true;
      setIsListening(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [active, targetMidi, mediaSettings.micSensitivity, mediaSettings.noiseFilter, micGain]);

  useEffect(() => {
    setTargetNote(midiToNoteName(targetMidi));
  }, [targetMidi]);

  const summary = useMemo(() => {
    const total = Math.round((pitchScore * 0.4 + rhythmScore * 0.25 + voiceScore * 0.2 + emotionScore * 0.15));
    return {
      total,
      pitch: Math.round(pitchScore),
      rhythm: Math.round(rhythmScore),
      voice: Math.round(voiceScore),
      emotion: Math.round(emotionScore),
    };
  }, [emotionScore, pitchScore, rhythmScore, voiceScore]);

  return {
    pitchSeries,
    pitchScore: Math.round(pitchScore),
    rhythmScore: Math.round(rhythmScore),
    liveScore: Math.round(liveScore),
    summary,
    currentHz,
    currentNote,
    currentCents,
    targetNote,
    tuningState,
    pitchFeedback,
    pitchAccuracy,
    volumeLevel,
    waveBars,
    micError,
    isListening,
    suggestedMidi,
    suggestedNote,
  };
}
