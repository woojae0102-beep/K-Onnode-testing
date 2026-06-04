// @ts-nocheck
import { useCallback, useState } from 'react';
import { fileToBase64 } from '../utils/fileToBase64';
import { useLanguageStore } from '../store/languageStore';

export function useKoreanPronunciation() {
  const language = useLanguageStore((s) => s.language) || 'ko';
  const [analysis, setAnalysis] = useState(null);
  const [correctedAudioUrl, setCorrectedAudioUrl] = useState('');
  const [correctedFallbackText, setCorrectedFallbackText] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchLyrics = useCallback(async (songTitle, artistName) => {
    const res = await fetch('/api/teaching/korean-lyrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songTitle, artistName }),
    });
    if (!res.ok) throw new Error('가사 불러오기 실패');
    const data = await res.json();
    return data.lyrics || '';
  }, []);

  const analyze = useCallback(
    async (audioFile, targetText) => {
      setError('');
      setIsAnalyzing(true);
      try {
        const audioBase64 = await fileToBase64(audioFile);
        const res = await fetch('/api/teaching/korean-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            targetText,
            referenceText: targetText,
            mimeType: audioFile.type,
            language,
          }),
        });
        if (!res.ok) throw new Error('발음 분석 실패');
        const data = await res.json();
        setAnalysis(data);
        return data;
      } catch (e) {
        setError(String(e?.message || e));
        throw e;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [language]
  );

  const cloneAndCorrect = useCallback(
    async (audioFile, targetText) => {
      setError('');
      setIsGenerating(true);
      try {
        const audioBuffer = await fileToBase64(audioFile);
        const cloneRes = await fetch('/api/teaching/vocal-clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBuffer, audioName: 'korean-user', mimeType: audioFile.type }),
        });
        const cloneData = await cloneRes.json();
        const vid = cloneData.voiceId || '';
        setVoiceId(vid);

        const res = await fetch('/api/teaching/korean-cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceId: vid,
            text: targetText,
            language,
          }),
        });
        if (!res.ok) throw new Error('교정 발음 생성 실패');
        const data = await res.json();
        const url = data.audioUrl || (data.audioBase64 ? `data:audio/mpeg;base64,${data.audioBase64}` : '');
        setCorrectedAudioUrl(url);
        setCorrectedFallbackText(data.fallbackText || targetText);
        return data;
      } catch (e) {
        setError(String(e?.message || e));
        throw e;
      } finally {
        setIsGenerating(false);
      }
    },
    [language]
  );

  const reset = useCallback(() => {
    setAnalysis(null);
    setCorrectedAudioUrl('');
    setCorrectedFallbackText('');
    setVoiceId('');
    setError('');
  }, []);

  return {
    analysis,
    correctedAudioUrl,
    correctedFallbackText,
    voiceId,
    error,
    isAnalyzing,
    isGenerating,
    analyze,
    cloneAndCorrect,
    fetchLyrics,
    reset,
  };
}

export default useKoreanPronunciation;
