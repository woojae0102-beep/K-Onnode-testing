// @ts-nocheck
import { useCallback, useState } from 'react';
import { fileToBase64, getAudioDuration } from '../utils/fileToBase64';

export function useVocalClone() {
  const [voiceId, setVoiceId] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [cloneProgress, setCloneProgress] = useState(0);
  const [coverUrl, setCoverUrl] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const cloneVoice = useCallback(async (audioFile, audioName = 'user_voice') => {
    setError('');
    setIsCloning(true);
    setCloneProgress(10);
    try {
      const audioBuffer = await fileToBase64(audioFile);
      const res = await fetch('/api/teaching/vocal-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBuffer,
          audioName,
          mimeType: audioFile.type || 'audio/mp3',
        }),
      });
      setCloneProgress(70);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '목소리 클론 실패');
      }
      const data = await res.json();
      setVoiceId(data.voiceId || '');
      setVoiceName(data.voiceName || audioName);
      setCloneProgress(100);
      return data;
    } catch (e) {
      setError(String(e?.message || e));
      throw e;
    } finally {
      setIsCloning(false);
    }
  }, []);

  const analyzeVocal = useCallback(async (audioFile, songInfo, options = {}) => {
    setError('');
    try {
      const myAudioBase64 = await fileToBase64(audioFile);
      const durationSec = await getAudioDuration(audioFile);
      const res = await fetch('/api/teaching/vocal-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myAudioBase64,
          mimeType: audioFile.type,
          songInfo,
          songAnalysis: songInfo,
          durationSec,
          language: options.language || 'ko',
          spotifyTrackId: songInfo?.trackId,
        }),
      });
      if (!res.ok) throw new Error('보컬 분석 실패');
      const data = await res.json();
      setAnalysis(data);
      return data;
    } catch (e) {
      setError(String(e?.message || e));
      throw e;
    }
  }, []);

  const generateCover = useCallback(
    async ({ voiceId: vid, lyrics, songTitle, songAnalysis, targetPitches, language }) => {
      setError('');
      setIsGenerating(true);
      try {
        const res = await fetch('/api/teaching/vocal-cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceId: vid || voiceId,
            lyrics: lyrics || '',
            songTitle: songTitle || '',
            songAnalysis,
            targetPitches: targetPitches || analysis?.targetPitchSeries,
            language: language || 'ko',
          }),
        });
        if (!res.ok) throw new Error('모범창 생성 실패');
        const data = await res.json();
      const url = data.audioUrl || (data.audioBase64 ? `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}` : '');
      setCoverUrl(url);
      return { ...data, audioUrl: url, fallbackText: data.fallbackText || lyrics || '' };
      } catch (e) {
        setError(String(e?.message || e));
        throw e;
      } finally {
        setIsGenerating(false);
      }
    },
    [voiceId, analysis]
  );

  const reset = useCallback(() => {
    setVoiceId('');
    setVoiceName('');
    setCloneProgress(0);
    setCoverUrl('');
    setAnalysis(null);
    setError('');
  }, []);

  return {
    voiceId,
    voiceName,
    cloneProgress,
    coverUrl,
    analysis,
    error,
    isCloning,
    isGenerating,
    cloneVoice,
    analyzeVocal,
    generateCover,
    reset,
  };
}

export default useVocalClone;
