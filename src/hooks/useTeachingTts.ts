// @ts-nocheck
import { useCallback, useRef } from 'react';
import { useJudgeVoice } from './useJudgeVoice';

/**
 * ElevenLabs data URL 재생 실패 시 Web Speech API 폴백
 */
export function useTeachingTts() {
  const { speak, stop, supported: speechSupported } = useJudgeVoice();
  const audioRef = useRef(null);

  const playAudioUrl = useCallback(
    async (url, fallbackText = '') => {
      stop?.();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (url) {
        try {
          await new Promise((resolve, reject) => {
            const audio = new Audio(url);
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
        await speak(fallbackText, 'teaching-tts-fallback');
        return { source: 'webspeech' };
      }
      return { source: 'none' };
    },
    [speak, stop, speechSupported]
  );

  const speakCoaching = useCallback(
    async (text, id = 'coach') => {
      if (!text) return;
      stop?.();
      if (speechSupported) {
        await speak(text, id);
      }
    },
    [speak, stop, speechSupported]
  );

  return { playAudioUrl, speakCoaching, speechSupported };
}

export default useTeachingTts;
