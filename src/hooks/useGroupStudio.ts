// @ts-nocheck
import { useCallback, useState } from 'react';
import { getSongById } from '../data/groupStudioSongs';
import { getSongVideo } from '../services/groupStudioStorage';

export function useGroupStudio() {
  const [phase, setPhase] = useState('home');
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [skeletonData, setSkeletonData] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionComparison, setSessionComparison] = useState(null);
  const [practiceVideo, setPracticeVideo] = useState(null);
  const [practiceDuration, setPracticeDuration] = useState(null);

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

  const completeChoreoExtract = useCallback((frames, meta = {}) => {
    setSkeletonData(frames);
    const song = getSongById(selectedSongId);
    const saved = getSongVideo(selectedSongId);
    setPracticeVideo({
      videoId: meta.videoId || saved?.videoId || null,
      youtubeUrl: meta.videoId
        ? `https://www.youtube.com/watch?v=${meta.videoId}`
        : saved?.youtubeUrl || song?.youtubeUrl || null,
      fromCache: !!meta.fromCache,
    });
    setPracticeDuration(meta.durationSec || song?.duration || frames?.[frames.length - 1]?.timestamp || 180);
    setPhase('practice');
  }, [selectedSongId]);

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
    setSkeletonData(null);
    setSessionResult(null);
    setSessionComparison(null);
    setPracticeVideo(null);
    setPracticeDuration(null);
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
      setSkeletonData(null);
    }
  }, [phase]);

  return {
    phase,
    selectedSongId,
    selectedMemberId,
    skeletonData,
    sessionResult,
    sessionComparison,
    practiceVideo,
    practiceDuration,
    selectSong,
    startPositionSelect,
    selectPosition,
    completeChoreoExtract,
    endSession,
    retry,
    goHome,
    goBack,
    setPhase,
    setSkeletonData,
  };
}

export default useGroupStudio;
