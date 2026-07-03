// @ts-nocheck
import { useCallback, useState } from 'react';
import { getSongVideo } from '../services/groupStudioStorage';
import { buildPracticeSessionData } from '../utils/buildPracticeSessionData';
import { loadReferenceVideoForPractice } from '../hooks/useGroupChoreoExtract';

export function useGroupStudio() {
  const [phase, setPhase] = useState('home');
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [practiceSessionData, setPracticeSessionData] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionComparison, setSessionComparison] = useState(null);
  const [practiceVideo, setPracticeVideo] = useState(null);

  const selectSong = useCallback((songId) => {
    setSelectedSongId(songId);
    setPhase('song_detail');
  }, []);

  const startPositionSelect = useCallback(() => {
    setPhase('position_select');
  }, []);

  const selectPosition = useCallback((memberId) => {
    setSelectedMemberId(memberId);
    setPhase('choreo_extract');
  }, []);

  const completeChoreoExtract = useCallback(async (frames, meta = {}) => {
    const groupId = meta.groupId || meta.danceDatabase?.groupId;
    const songId = selectedSongId || meta.danceDatabase?.songId;
    const userMemberId = selectedMemberId || meta.danceDatabase?.positionMap?.userMemberId || '';

    if (!groupId || !songId || !userMemberId) {
      console.error('[useGroupStudio] missing ids for practice session', { groupId, songId, userMemberId });
      window.alert('연습 세션 데이터를 구성할 수 없습니다. 다시 시도해 주세요.');
      return;
    }

    const saved = getSongVideo(selectedSongId);
    const userVideo = saved?.videoType === 'user_youtube' ? saved : null;
    const videoId = meta.videoId || userVideo?.videoId || null;
    const youtubeUrl = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : userVideo?.youtubeUrl || null;

    const refPlayback = await loadReferenceVideoForPractice(songId, videoId || meta.danceDatabase?.videoId);

    const sessionData = buildPracticeSessionData({
      frames,
      danceDatabase: meta.danceDatabase || null,
      groupId,
      songId,
      userMemberId,
      sourceVideoDurationSec: meta.sourceVideoDurationSec ?? meta.danceDatabase?.sourceVideoDurationSec ?? null,
      referenceVideo: {
        videoId,
        youtubeUrl,
        fromCache: !!meta.fromCache,
        blobCacheKey: refPlayback?.blobCacheKey ?? null,
        localPlaybackUrl: refPlayback?.localPlaybackUrl ?? null,
        durationSec: meta.sourceVideoDurationSec ?? meta.danceDatabase?.sourceVideoDurationSec ?? null,
      },
    });

    if (!sessionData) {
      window.alert('스켈레톤·타임라인·포메이션 데이터가 불완전합니다. 안무를 다시 추출해 주세요.');
      return;
    }

    setPracticeSessionData(sessionData);
    setPracticeVideo({
      videoId: sessionData.referenceVideo.videoId,
      youtubeUrl: sessionData.referenceVideo.localPlaybackUrl || sessionData.referenceVideo.youtubeUrl,
      fromCache: sessionData.referenceVideo.fromCache,
      blobCacheKey: sessionData.referenceVideo.blobCacheKey,
    });
    setPhase('practice');
  }, [selectedSongId, selectedMemberId]);

  const endSession = useCallback((result, comparison = null) => {
    setSessionResult(result);
    setSessionComparison(comparison);
    setPhase('result');
  }, []);

  const retry = useCallback(() => {
    setSessionResult(null);
    setSessionComparison(null);
    setPhase('practice');
  }, []);

  const goHome = useCallback(() => {
    setPhase('home');
    setSelectedSongId(null);
    setSelectedMemberId(null);
    setPracticeSessionData(null);
    setSessionResult(null);
    setSessionComparison(null);
    setPracticeVideo(null);
  }, []);

  const goBack = useCallback(() => {
    if (phase === 'song_detail') {
      setPhase('home');
      setSelectedSongId(null);
    } else if (phase === 'position_select') {
      setPhase('song_detail');
      setSelectedMemberId(null);
    } else if (phase === 'choreo_extract') {
      setPhase('position_select');
      setSelectedMemberId(null);
    } else if (phase === 'practice') {
      setPhase('choreo_extract');
      setPracticeSessionData(null);
    }
  }, [phase]);

  return {
    phase,
    selectedSongId,
    selectedMemberId,
    practiceSessionData,
    /** @deprecated practiceSessionData.frames 사용 */
    skeletonData: practiceSessionData?.frames ?? null,
    /** @deprecated practiceSessionData.duration 사용 */
    practiceDuration: practiceSessionData?.duration ?? null,
    /** @deprecated practiceSessionData 내 formation/memberTracks 사용 */
    danceDatabase: null,
    sessionResult,
    sessionComparison,
    practiceVideo,
    selectSong,
    startPositionSelect,
    selectPosition,
    completeChoreoExtract,
    endSession,
    retry,
    goHome,
    goBack,
    setPhase,
    setPracticeSessionData,
    /** @deprecated setPracticeSessionData 사용 */
    setSkeletonData: setPracticeSessionData,
  };
}

export default useGroupStudio;
