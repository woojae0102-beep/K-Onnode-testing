// @ts-nocheck
import { applySpeechRate } from './playbackSpeed';

function pickLangCode(language) {
  switch (language) {
    case 'ja':
      return 'ja-JP';
    case 'en':
      return 'en-US';
    default:
      return 'ko-KR';
  }
}

function pitchFromAvgHz(avgPitch) {
  const hz = Number(avgPitch) || 220;
  if (hz > 280) return 1.25;
  if (hz > 220) return 1.1;
  if (hz > 170) return 1.0;
  return 0.88;
}

export function speakCoverLines({
  lines = [],
  voiceProfile,
  language = 'ko',
  playbackSpeed = 1,
  onLineStart,
  onComplete,
}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return () => {};
  const synth = window.speechSynthesis;
  synth.cancel();

  const pitch = pitchFromAvgHz(voiceProfile?.avgPitch);
  const rate = applySpeechRate(0.92, playbackSpeed);
  let idx = 0;

  const speakNext = () => {
    if (idx >= lines.length) {
      onComplete?.();
      return;
    }
    const line = lines[idx];
    const text = typeof line === 'string' ? line : line?.text || '';
    if (!text.trim()) {
      idx += 1;
      speakNext();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = pickLangCode(language);
    utter.rate = rate;
    utter.pitch = pitch;
    utter.onstart = () => onLineStart?.(idx, text);
    utter.onend = () => {
      idx += 1;
      window.setTimeout(speakNext, 280);
    };
    utter.onerror = () => {
      idx += 1;
      speakNext();
    };
    synth.speak(utter);
  };

  speakNext();
  return () => synth.cancel();
}

export function speakLineWithCoaching({
  lineText = '',
  tip = '',
  intro = '',
  voiceProfile,
  language = 'ko',
  playbackSpeed = 1,
  onStart,
  onComplete,
}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onComplete?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();

  const pitch = pitchFromAvgHz(voiceProfile?.avgPitch ?? voiceProfile?.profile?.avgPitch);
  const rate = applySpeechRate(0.92, playbackSpeed);
  const queue = [intro, lineText, tip].filter((t) => t && String(t).trim());
  let idx = 0;

  const speakNext = () => {
    if (idx >= queue.length) {
      onComplete?.();
      return;
    }
    const text = queue[idx];
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = pickLangCode(language);
    utter.rate = rate;
    utter.pitch = pitch;
    utter.onstart = () => {
      if (idx === (intro ? 1 : 0) || (!intro && idx === 0)) onStart?.(text);
    };
    utter.onend = () => {
      idx += 1;
      window.setTimeout(speakNext, intro && idx === 1 ? 180 : 320);
    };
    utter.onerror = () => {
      idx += 1;
      speakNext();
    };
    synth.speak(utter);
  };

  speakNext();
  return () => synth.cancel();
}
