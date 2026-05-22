// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettingsStore } from '../store/settingsSlice';
import { buildAudioConstraints, micSensitivityToGain } from '../utils/mediaSettings';

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeKorean(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^0-9a-zA-Z가-힣]/g, '');
}

function levenshteinDistance(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }, () => 0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function similarityScore(reference, spoken) {
  const a = normalizeKorean(reference);
  const b = normalizeKorean(spoken);
  if (!a.length || !b.length) return 0;
  const distance = levenshteinDistance(a, b);
  const ratio = 1 - distance / Math.max(a.length, b.length, 1);
  return clamp(Math.round(ratio * 100));
}

function buildRealtimeFeedback({ similarity, clarity, pace, confidence, active, hasSpeech }) {
  if (!active) return ['녹음을 시작하면 실시간 피드백이 표시됩니다.'];
  if (!hasSpeech) return ['아직 음성이 감지되지 않았어요. 한 문장을 또렷하게 말해보세요.'];

  const tips = [];
  if (similarity < 60) tips.push('기준 문장과 다른 발음/음절이 있습니다. 천천히 한 글자씩 맞춰보세요.');
  if (clarity < 60) tips.push('목소리 크기가 낮거나 흔들립니다. 마이크에 조금 더 가까이 말해보세요.');
  if (pace < 60) tips.push('말하는 속도가 일정하지 않습니다. 박자처럼 일정하게 끊어 말해보세요.');
  if (confidence < 55) tips.push('발음을 더 분명하게 또박또박 말하면 인식률이 올라갑니다.');
  if (!tips.length) tips.push('좋아요! 발음과 속도가 안정적입니다. 억양 디테일을 더 살려보세요.');
  return tips.slice(0, 3);
}

export function useKoreanSpeechCoach({ active = false, referenceText = '' } = {}) {
  const micSensitivity = useSettingsStore((s) => s.settings.micSensitivity);
  const noiseFilter = useSettingsStore((s) => s.settings.noiseFilter);
  const mediaSettings = useMemo(() => ({ micSensitivity, noiseFilter }), [micSensitivity, noiseFilter]);
  const micGain = micSensitivityToGain(mediaSettings.micSensitivity);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [micError, setMicError] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [recognitionActive, setRecognitionActive] = useState(false);
  const [confidenceScore, setConfidenceScore] = useState(0);

  const audioStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const volumeTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const shouldKeepRecognitionRef = useRef(false);
  const startAtRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setRecognitionActive(false);
      setVolumeLevel(0);
      setInterimTranscript('');
      if (volumeTimerRef.current) {
        clearInterval(volumeTimerRef.current);
        volumeTimerRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      return undefined;
    }

    let cancelled = false;
    startAtRef.current = Date.now();
    setMicError('');

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMicError('이 브라우저는 마이크 분석을 지원하지 않습니다.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: buildAudioConstraints(mediaSettings),
          video: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        audioStreamRef.current = stream;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        gain.gain.value = micGain;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = mediaSettings.noiseFilter ? 0.6 : 0.45;
        source.connect(gain);
        gain.connect(analyser);
        analyserRef.current = analyser;

        volumeTimerRef.current = setInterval(() => {
          const target = analyserRef.current;
          if (!target) return;
          const wave = new Float32Array(target.fftSize);
          target.getFloatTimeDomainData(wave);
          let sum = 0;
          for (let i = 0; i < wave.length; i += 1) sum += wave[i] * wave[i];
          const rms = Math.sqrt(sum / Math.max(1, wave.length));
          setVolumeLevel(clamp(Math.round(rms * 250)));
        }, 100);
      } catch (error) {
        const name = error?.name || '';
        if (name === 'NotAllowedError') setMicError('마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
        else if (name === 'NotFoundError') setMicError('사용 가능한 마이크를 찾지 못했습니다.');
        else setMicError('마이크를 시작하지 못했습니다.');
      }
    })();

    return () => {
      cancelled = true;
      if (volumeTimerRef.current) {
        clearInterval(volumeTimerRef.current);
        volumeTimerRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [active, mediaSettings.micSensitivity, mediaSettings.noiseFilter, micGain]);

  useEffect(() => {
    if (!active) {
      shouldKeepRecognitionRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      return undefined;
    }

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setSpeechSupported(false);
      return undefined;
    }
    setSpeechSupported(true);
    setSpeechError('');
    shouldKeepRecognitionRef.current = true;

    const recognition = new RecognitionCtor();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setRecognitionActive(true);
    };
    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      let confSum = 0;
      let confCount = 0;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = String(result?.[0]?.transcript || '').trim();
        const conf = Number(result?.[0]?.confidence || 0);
        if (result.isFinal) {
          finalText += ` ${text}`;
          if (conf > 0) {
            confSum += conf;
            confCount += 1;
          }
        } else {
          interim += ` ${text}`;
        }
      }
      if (finalText.trim()) setTranscript((prev) => `${prev} ${finalText}`.trim());
      setInterimTranscript(interim.trim());
      if (confCount > 0) setConfidenceScore(clamp(Math.round((confSum / confCount) * 100)));
    };
    recognition.onerror = (event) => {
      const err = event?.error || 'unknown';
      if (err !== 'aborted' && err !== 'no-speech') setSpeechError(`음성 인식 오류: ${err}`);
    };
    recognition.onend = () => {
      setRecognitionActive(false);
      if (!shouldKeepRecognitionRef.current) return;
      try {
        recognition.start();
      } catch {}
    };

    try {
      recognition.start();
    } catch (error) {
      setSpeechError('음성 인식을 시작하지 못했습니다.');
    }

    return () => {
      shouldKeepRecognitionRef.current = false;
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, [active]);

  const combinedTranscript = useMemo(() => `${transcript} ${interimTranscript}`.trim(), [interimTranscript, transcript]);

  const metrics = useMemo(() => {
    const elapsedSec = Math.max(1, (Date.now() - startAtRef.current) / 1000);
    const spokenLen = normalizeKorean(combinedTranscript).length;
    const similarity = referenceText ? similarityScore(referenceText, combinedTranscript) : clamp(spokenLen * 5);
    const charsPerSec = spokenLen / elapsedSec;
    const pace = clamp(100 - Math.abs(charsPerSec - 3.2) * 22);
    const clarity = clamp(100 - Math.abs(volumeLevel - 45) * 1.4);
    const confidence = confidenceScore || 50;
    const hasSpeech = spokenLen > 1;
    const overall = Math.round(similarity * 0.45 + pace * 0.2 + clarity * 0.2 + confidence * 0.15);
    const feedbacks = buildRealtimeFeedback({
      similarity,
      clarity,
      pace,
      confidence,
      active,
      hasSpeech,
    });
    return {
      similarity,
      pace,
      clarity,
      confidence,
      overall,
      elapsedSec: Number(elapsedSec.toFixed(1)),
      hasSpeech,
      feedbacks,
    };
  }, [active, combinedTranscript, confidenceScore, referenceText, volumeLevel]);

  return {
    transcript,
    interimTranscript,
    combinedTranscript,
    volumeLevel,
    micError,
    speechError,
    speechSupported,
    recognitionActive,
    metrics,
    resetTranscript: () => {
      setTranscript('');
      setInterimTranscript('');
    },
  };
}
