// @ts-nocheck
import { useCallback, useState } from 'react';
import { getGroupData } from '../data/groupPracticeData';
import { buildSkeletonFramesFromAnalysis } from '../services/videoAnalysisUtils';
import { suggestTrackToMemberMap } from '../services/formationMatching';
import {
  buildChoreoCacheKey,
  buildFileCacheKey,
  getCachedChoreo,
  saveCachedChoreo,
  isChoreoCacheValid,
  CHOREO_CACHE_PIPELINE_VERSION,
} from '../services/groupChoreoCache';
import {
  buildReferenceVideoCacheKey,
  getReferenceVideoObjectUrl,
  saveReferenceVideo,
} from '../services/referenceVideoStore';
import {
  CHOREO_DEFAULT_SAMPLE_FPS,
  resolveMinAiReferenceTracks,
} from '../config/choreoExtractConfig';
import { buildSkeletonData } from '../utils/skeletonDataUtils';
import { prepareAnalysisVideo } from '../utils/choreoVideoUtils';
import {
  createHolisticMotionDetector,
  runHolisticVideoAnalysis,
} from '../services/motion/MotionExtractionEngine';

async function createPoseDetector(groupMemberCount, onStatus, { lenient = false } = {}) {
  return createHolisticMotionDetector(groupMemberCount, onStatus, { lenient });
}

export function useGroupChoreoExtract() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [currentFrameDetectedCount, setCurrentFrameDetectedCount] = useState(0);
  const [expectedMemberCount, setExpectedMemberCount] = useState(0);
  const [insufficientWarning, setInsufficientWarning] = useState(null);
  const abortRef = { current: false };

  const cancel = useCallback(() => {
    abortRef.current = true;
    setIsExtracting(false);
    setStep('취소됨');
  }, []);

  const loadFromCache = useCallback(async (songId, videoId) => {
    const cacheKey = buildChoreoCacheKey(songId, videoId);
    const cached = await getCachedChoreo(cacheKey);
    if (!cached?.frames?.length || !isChoreoCacheValid(cached)) return null;
    setFromCache(true);
    return cached.frames;
  }, []);

  const extractAnalysisFromVideo = useCallback(
    async (video, groupId, detector, onProgress, options = {}) => {
      const group = getGroupData(groupId);
      if (!group) return null;

      const expected = group.memberCount;
      abortRef.current = false;

      return runHolisticVideoAnalysis({
        video,
        groupId,
        detector,
        expectedMemberCount: expected,
        sampleFps: options.sampleFps,
        onProgress,
        onFrameDetected: options.onFrameDetected,
        abortRef,
      });
    },
    [],
  );

  const extractFromVideoElement = useCallback(
    async (video, groupId, focusMemberId, detector, onProgress, options = {}) => {
      const analysisResult = await extractAnalysisFromVideo(video, groupId, detector, onProgress, options);
      if (!analysisResult) return null;
      const trackToMemberMap = suggestTrackToMemberMap(
        groupId,
        focusMemberId,
        analysisResult.trackIdToInitialPosition,
      );
      return buildSkeletonFramesFromAnalysis(analysisResult, trackToMemberMap, focusMemberId);
    },
    [extractAnalysisFromVideo],
  );

  const analyzeWithRetry = useCallback(
    async (video, groupId, onStatus, onFrameDetected, preloadedDetector = null) => {
      const group = getGroupData(groupId);
      if (!group) return null;

      const expected = group.memberCount;
      const minTracksRequired = resolveMinAiReferenceTracks(expected);
      setExpectedMemberCount(minTracksRequired);
      setInsufficientWarning(null);

      const attempt = async (lenient, label, existingDetector) => {
        onStatus?.(`${label}...`);
        const detector =
          existingDetector || (await createPoseDetector(expected, onStatus, { lenient }));
        const result = await extractAnalysisFromVideo(
          video,
          groupId,
          detector,
          (pct, msg) => {
            setProgress(Math.round(15 + pct * 0.8));
            setStep(msg);
          },
          { onFrameDetected },
        );
        if (!existingDetector) detector.close?.();
        return result;
      };

      let analysisResult = null;
      let firstAttemptError = null;
      try {
        analysisResult = await attempt(
          false,
          `${group.nameKr} 안무 분석`,
          preloadedDetector,
        );
      } catch (err) {
        firstAttemptError = err;
        console.warn('[useGroupChoreoExtract] 1차 분석 실패 — lenient 재분석 시도', err);
      }

      if (analysisResult && analysisResult.peakTrackCount < minTracksRequired && !abortRef.current) {
        setStep(
          `AI 참조 ${minTracksRequired}명 중 ${analysisResult.peakTrackCount}명만 감지됐습니다. 더 정밀하게 재분석합니다...`,
        );
        analysisResult = await attempt(true, '재분석', null);
      } else if (!analysisResult && firstAttemptError && !abortRef.current) {
        setStep('멤버 수가 부족해 더 관대한 조건으로 재분석합니다...');
        analysisResult = await attempt(true, '재분석', null);
      }

      if (!analysisResult) return { ok: false, reason: 'no_detection' };

      if (analysisResult.peakTrackCount < minTracksRequired) {
        return {
          ok: false,
          reason: 'insufficient',
          found: analysisResult.peakTrackCount,
          expected,
          analysisResult,
        };
      }

      return { ok: true, analysisResult };
    },
    [extractAnalysisFromVideo],
  );

  const extractAnalysis = useCallback(
    async ({ songId, groupId, videoId, file, videoRef, youtubePlayerRef }) => {
      const group = getGroupData(groupId);
      if (!group) return null;

      setError('');
      setFromCache(false);
      setInsufficientWarning(null);
      abortRef.current = false;
      setIsExtracting(true);
      setProgress(5);
      setStep('준비 중...');
      setCurrentFrameDetectedCount(0);
      setExpectedMemberCount(group.memberCount);

      let cleanup = () => {};
      let referenceBlob = null;

      try {
        const video = videoRef?.current;
        if (!video) throw new Error('비디오 요소가 없습니다.');

        const status = (msg) => setStep(msg);
        let detectorPromise = null;

        const prepPromise = prepareAnalysisVideo(video, {
          file,
          videoId,
          onStatus: status,
          youtubePlayerRef,
        });

        if (videoId && youtubePlayerRef && !file) {
          detectorPromise = createPoseDetector(group.memberCount, null);
        }

        const prep = await prepPromise;
        cleanup = prep.cleanup;
        referenceBlob = prep.blob || file || null;

        if (abortRef.current) throw new Error('취소되었습니다.');

        setProgress(12);

        const onFrameDetected = ({ trackedCount, expectedMemberCount: exp }) => {
          setCurrentFrameDetectedCount(trackedCount);
          setExpectedMemberCount(exp);
        };

        let preloadedDetector = null;
        if (detectorPromise) {
          preloadedDetector = await detectorPromise;
        }

        const analysisOutcome = await analyzeWithRetry(
          video,
          groupId,
          status,
          onFrameDetected,
          preloadedDetector,
        );

        preloadedDetector?.close?.();

        const resolvedVideoId = videoId || (file ? buildFileCacheKey(songId, file).split(':').slice(1).join(':') : null);
        await persistReferenceVideo({
          songId,
          videoId: resolvedVideoId,
          groupId,
          blob: referenceBlob,
          durationSec: video.duration,
        });

        cleanup();

        if (analysisOutcome?.reason === 'insufficient') {
          setInsufficientWarning({
            found: analysisOutcome.found,
            expected: analysisOutcome.expected,
          });
          setIsExtracting(false);
          return {
            insufficient: true,
            found: analysisOutcome.found,
            expected: analysisOutcome.expected,
            analysisResult: analysisOutcome.analysisResult,
            songId,
            groupId,
            videoId: videoId || (file ? `file:${file.name}` : null),
          };
        }

        if (!analysisOutcome?.ok || !analysisOutcome.analysisResult) {
          throw new Error('영상에서 동작을 감지하지 못했습니다. 안무 연습 영상인지 확인하거나 파일을 직접 업로드해 주세요.');
        }

        if (analysisOutcome.analysisResult.memberCountPadded) {
          setInsufficientWarning({
            found: analysisOutcome.analysisResult.peakTrackCount ?? analysisOutcome.analysisResult.detectedMemberCount,
            expected: group.memberCount,
            padded: true,
          });
        }

        setProgress(100);
        setStep('분석 완료 — 멤버 매칭을 확인해주세요');
        setIsExtracting(false);
        return {
          analysisResult: analysisOutcome.analysisResult,
          songId,
          groupId,
          videoId: videoId || (file ? `file:${file.name}` : null),
        };
      } catch (err) {
        console.error('[useGroupChoreoExtract.extractAnalysis]', err);
        cleanup();
        setError(err?.message || '안무 분석에 실패했습니다.');
        setIsExtracting(false);
        return null;
      }
    },
    [extractAnalysisFromVideo, analyzeWithRetry],
  );

  const extractChoreo = useCallback(
    async ({
      songId,
      groupId,
      videoId,
      focusMemberId,
      file,
      skipCache = false,
      videoRef,
      youtubePlayerRef,
    }) => {
      const group = getGroupData(groupId);
      if (!group) return null;

      setError('');
      setFromCache(false);
      setInsufficientWarning(null);

      if (!skipCache) {
        const cacheVideoId = videoId || (file ? buildFileCacheKey(songId, file) : null);
        const cacheKey = file ? buildFileCacheKey(songId, file) : buildChoreoCacheKey(songId, videoId);
        const cached = await getCachedChoreo(cacheKey);
        if (cached?.frames?.length && isChoreoCacheValid(cached)) {
          setProgress(100);
          setStep('캐시된 안무 데이터를 불러왔습니다.');
          setFromCache(true);
          return cached.frames;
        }
      }

      abortRef.current = false;
      setIsExtracting(true);
      setProgress(5);
      setStep('준비 중...');

      let cleanup = () => {};
      let referenceBlob = null;

      try {
        const video = videoRef?.current;
        if (!video) throw new Error('비디오 요소가 없습니다.');

        const status = (msg) => setStep(msg);
        const prep = await prepareAnalysisVideo(video, {
          file,
          videoId,
          onStatus: status,
          youtubePlayerRef,
        });
        cleanup = prep.cleanup;
        referenceBlob = prep.blob || file || null;

        const onFrameDetected = ({ trackedCount, expectedMemberCount: exp }) => {
          setCurrentFrameDetectedCount(trackedCount);
          setExpectedMemberCount(exp);
        };

        const outcome = await analyzeWithRetry(video, groupId, status, onFrameDetected);

        const resolvedVideoId = videoId || (file ? buildFileCacheKey(songId, file).split(':').slice(1).join(':') : null);
        await persistReferenceVideo({
          songId,
          videoId: resolvedVideoId,
          groupId,
          blob: referenceBlob,
          durationSec: video.duration,
        });

        cleanup();

        if (outcome?.reason === 'insufficient') {
          setInsufficientWarning({ found: outcome.found, expected: outcome.expected });
          throw new Error(
            `AI 참조 ${outcome.expected}명 중 ${outcome.found}명만 감지됐습니다. `
            + '선택 멤버를 제외한 다른 멤버가 보이는 영상을 사용해 주세요.',
          );
        }

        if (!outcome?.ok) {
          throw new Error(
            videoId
              ? 'YouTube 영상 추출에 실패했습니다. 영상 파일을 직접 업로드해 주세요.'
              : '영상에서 동작을 감지하지 못했습니다.',
          );
        }

        const trackToMemberMap = suggestTrackToMemberMap(
          groupId,
          focusMemberId,
          outcome.analysisResult.trackIdToInitialPosition,
        );
        const frames = buildSkeletonFramesFromAnalysis(
          outcome.analysisResult,
          trackToMemberMap,
          focusMemberId,
        );

        if (!frames?.length) {
          throw new Error('스켈레톤 데이터 생성에 실패했습니다.');
        }

        await persistCache(
          songId,
          videoId || (file ? buildFileCacheKey(songId, file) : null),
          frames,
          groupId,
          videoId,
          file,
          outcome.analysisResult.sourceVideoDurationSec,
        );
        setProgress(100);
        setStep('안무 추출 완료!');
        setIsExtracting(false);
        return frames;
      } catch (err) {
        console.error('[useGroupChoreoExtract]', err);
        cleanup();
        setError(err?.message || '안무 추출에 실패했습니다.');
        setIsExtracting(false);
        return null;
      }
    },
    [analyzeWithRetry, loadFromCache],
  );

  return {
    isExtracting,
    progress,
    step,
    error,
    fromCache,
    cancel,
    loadFromCache,
    extractChoreo,
    extractAnalysis,
    currentFrameDetectedCount,
    expectedMemberCount,
    insufficientWarning,
  };
}

async function persistReferenceVideo({ songId, videoId, groupId, blob, durationSec }) {
  if (!blob || !songId) return null;
  const cacheKey = buildReferenceVideoCacheKey(songId, videoId || 'default');
  await saveReferenceVideo({
    cacheKey,
    songId,
    videoId: videoId || 'default',
    groupId,
    mimeType: blob.type || 'video/mp4',
    sizeBytes: blob.size || 0,
    durationSec: durationSec || 0,
    blob,
  });
  return cacheKey;
}

async function persistCache(
  songId,
  videoId,
  frames,
  groupId,
  sourceVideoId,
  file = null,
  durationSec = 0,
) {
  const cacheKey = file
    ? buildFileCacheKey(songId, file)
    : buildChoreoCacheKey(songId, sourceVideoId || videoId);
  const refKey = buildReferenceVideoCacheKey(songId, sourceVideoId || videoId || 'default');
  const fps = CHOREO_DEFAULT_SAMPLE_FPS;
  const duration = durationSec > 0
    ? durationSec
    : frames.length > 0
      ? (frames[frames.length - 1].frameIndex ?? frames.length - 1) / fps + 1 / fps
      : 0;
  await saveCachedChoreo({
    cacheKey,
    songId,
    videoId: sourceVideoId || videoId,
    groupId,
    frames,
    frameCount: frames.length,
    durationSec: duration,
    pipelineVersion: CHOREO_CACHE_PIPELINE_VERSION,
    referenceVideoKey: refKey,
    sampleFps: fps,
    skeletonData: buildSkeletonData(frames, fps, duration),
  });
}

export async function loadReferenceVideoForPractice(songId, videoId) {
  const cacheKey = buildReferenceVideoCacheKey(songId, videoId || 'default');
  const url = await getReferenceVideoObjectUrl(cacheKey);
  return url ? { blobCacheKey: cacheKey, localPlaybackUrl: url } : null;
}

export default useGroupChoreoExtract;
