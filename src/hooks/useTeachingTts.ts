// @ts-nocheck
import { useCallback, useRef } from 'react';
import { useJudgeVoice } from './useJudgeVoice';
import { clampPlaybackSpeed } from '../utils/playbackSpeed';

/**
 * ElevenLabs data URL 재생 실패 시 Web Speech API 폴백
 */
export function useTeachingTts() {
  const { speakText, stopSpeaking, supported: speechSupported } = useJudgeVoice();
  const audioRef = useRef(null);

  const playAudioUrl = useCallback(
    async (url, fallbackText = '', playbackSpeed = 1) => {
      const speed = clampPlaybackSpeed(playbackSpeed);
      stopSpeaking?.();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (url) {
        try {
          await new Promise((resolve, reject) => {
            const audio = new Audio(url);
            audio.playbackRate = speed;
            audioRef.current = audio;
            audio.onended = resolve;
            audio.onerror = reject;
            audio.play().catch(reject);
          });
          return { source: 'audio' };
        } catch {
          /* fall through to speech */
        }
      }
      if (fallbackText && speechSupported) {
        await speakText(fallbackText, 'teaching-tts-fallback', speed);
        return { source: 'webspeech' };
      }
      return { source: 'none' };
    },
    [speakText, stopSpeaking, speechSupported],
  );

  const speakCoaching = useCallback(
    async (text, id = 'coach', playbackSpeed = 1) => {
      if (!text) return;
      stopSpeaking?.();
      if (speechSupported) {
        await speakText(text, id, clampPlaybackSpeed(playbackSpeed));
      }
    },
    [speakText, stopSpeaking, speechSupported],
  );

  return { playAudioUrl, speakCoaching, speechSupported, speakText, stopSpeaking };
}

export default useTeachingTts;
