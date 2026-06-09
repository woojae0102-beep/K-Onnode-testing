// @ts-nocheck
import { useCallback, useState } from 'react';
import { getSongById } from '../data/groupStudioSongs';
import { generateDemoSkeleton } from '../utils/generateDemoSkeleton';

export function useGroupStudio() {
  const [phase, setPhase] = useState('home');
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [skeletonData, setSkeletonData] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionComparison, setSessionComparison] = useState(null);

  const selectSong = useCallback((songId) => {
    setSelectedSongId(songId);
    setPhase('song_detail');
  }, []);

  const startPositionSelect = useCallback(() => {
    setPhase('position_select');
  }, []);

  const selectPosition = useCallback((memberId) => {
    setSelectedMemberId(memberId);
    const song = getSongById(selectedSongId);
    if (song) {
      const demo = generateDemoSkeleton(song.groupId, song.duration, 10, song.bpm);
      setSkeletonData(demo);
    }
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
  }, []);

  const goBack = useCallback(() => {
    if (phase === 'song_detail') {
      setPhase('home');
      setSelectedSongId(null);
    } else if (phase === 'position_select') {
      setPhase('song_detail');
      setSelectedMemberId(null);
    } else if (phase === 'practice') {
      setPhase('position_select');
      setSelectedMemberId(null);
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
    selectSong,
    startPositionSelect,
    selectPosition,
    endSession,
    retry,
    goHome,
    goBack,
    setPhase,
    setSkeletonData,
  };
}

export default useGroupStudio;
