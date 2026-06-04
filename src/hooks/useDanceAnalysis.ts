// @ts-nocheck
import { useCallback, useState } from 'react';
import { extractSkeletonFromVideo, alignFrameSeries } from '../utils/extractVideoSkeleton';
import type { DanceAnalysisResult, FrameData } from '../types/teaching';
import type { SongAnalysis } from './useSpotifyAnalysis';

export function useDanceAnalysis() {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [myFrames, setMyFrames] = useState([]);
  const [referenceFrames, setReferenceFrames] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const extractMyVideo = useCallback(async (file, onStep) => {
    setStep(2);
    onStep?.(2);
    const frames = await extractSkeletonFromVideo(file, {
      onProgress: (p) => setProgress(p * 0.4),
    });
    setMyFrames(frames);
    return frames;
  }, []);

  const extractReferenceVideo = useCallback(async (fileOrUrl, onStep) => {
    setStep(3);
    onStep?.(3);
    const frames = await extractSkeletonFromVideo(fileOrUrl, {
      onProgress: (p) => setProgress(40 + p * 0.35),
    });
    setReferenceFrames(frames);
    return frames;
  }, []);

  const runServerAnalysis = useCallback(
    async (myF, refF, songAnalysis) => {
      setStep(4);
      const { my, ref } = alignFrameSeries(myF, refF);
      const res = await fetch('/api/teaching/dance-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myFrames: my,
          referenceFrames: ref,
          songAnalysis,
        }),
      });
      if (!res.ok) throw new Error('댄스 분석 API 오류');
      const data = await res.json();
      setResult(data);
      setStep(6);
      return data;
    },
    []
  );

  const analyze = useCallback(
    async ({
      myFile,
      referenceFile,
      referenceUrl,
      songAnalysis,
      onStepChange,
    }) => {
      setError('');
      setIsRunning(true);
      setProgress(0);
      try {
        onStepChange?.(1);
        setStep(1);

        const myF = await extractMyVideo(myFile, onStepChange);
        const refSource = referenceFile || referenceUrl;
        if (!refSource) throw new Error('레퍼런스 영상이 필요합니다.');
        const refF = await extractReferenceVideo(refSource, onStepChange);

        onStepChange?.(4);
        setStep(4);
        setProgress(78);
        onStepChange?.(5);
        setStep(5);
        const data = await runServerAnalysis(myF, refF, songAnalysis);
        setProgress(100);
        onStepChange?.(6);
        return data;
      } catch (e) {
        setError(String(e?.message || e));
        throw e;
      } finally {
        setIsRunning(false);
      }
    },
    [extractMyVideo, extractReferenceVideo, runServerAnalysis]
  );

  const reset = useCallback(() => {
    setStep(1);
    setProgress(0);
    setMyFrames([]);
    setReferenceFrames([]);
    setResult(null);
    setError('');
  }, []);

  const getFrameAt = useCallback(
    (time) => {
      const pick = (frames) => {
        if (!frames?.length) return null;
        let best = frames[0];
        for (const f of frames) {
          if (Math.abs(f.timestamp - time) < Math.abs(best.timestamp - time)) best = f;
        }
        return best;
      };
      const { ref } = alignFrameSeries(myFrames, referenceFrames);
      const refAligned = ref;
      const idx = myFrames.findIndex((f) => f.timestamp >= time);
      const i = idx < 0 ? myFrames.length - 1 : idx;
      return {
        my: myFrames[i] || pick(myFrames),
        ref: refAligned[i] || pick(refAligned),
        comparison: result?.frameComparisons?.find((c) => Math.abs(c.timestamp - time) < 0.2),
      };
    },
    [myFrames, referenceFrames, result]
  );

  return {
    step,
    progress,
    myFrames,
    referenceFrames,
    result,
    error,
    isRunning,
    analyze,
    reset,
    getFrameAt,
  };
}

export default useDanceAnalysis;
