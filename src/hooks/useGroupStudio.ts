// @ts-nocheck
import { useCallback, useState } from 'react';
import { getSongById } from '../data/groupStudioSongs';
import { getSongVideo } from '../services/groupStudioStorage';
import { loadProductionDanceAsset } from '../services/group/ProductionDanceAssetLoader';
import { buildGroupMotionContentFromProductionAsset } from '../services/group/buildGroupMotionContentFromProduction';
import { getGroupRuntimeActors } from '../services/group/getGroupRuntimeActors';
import { buildGroupPracticeRuntime } from '../services/group/buildGroupPracticeRuntime';
import {
  setGroupModeActive,
  logGroupModeRuntimeVerification,
} from '../services/group/groupModeRuntimeGuard';
import { buildPracticeSessionFromContent } from '../utils/buildPracticeSessionFromContent';
import { loadReferenceVideoForPractice } from './useGroupChoreoExtract';

export function useGroupStudio() {
  const [phase, setPhase] = useState('home');
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [practiceSessionData, setPracticeSessionData] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionComparison, setSessionComparison] = useState(null);
  const [practiceVideo, setPracticeVideo] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState(null);

  const selectSong = useCallback((songId) => {
    setSelectedSongId(songId);
    setPhase('song_detail');
  }, []);

  const startPositionSelect = useCallback(() => {
    setPhase('position_select');
  }, []);

  const loadAndStartPractice = useCallback(async (memberId, songId) => {
    const song = getSongById(songId);
    if (!song) {
      setContentError('곡 정보를 찾을 수 없습니다.');
      setPhase('content_loading');
      return;
    }

    setContentLoading(true);
    setContentError(null);
    setPhase('content_loading');
    setGroupModeActive(true);

    try {
      const saved = getSongVideo(songId);
      const videoId = saved?.videoId ?? null;

      const { asset: productionAsset } = await loadProductionDanceAsset({ groupId: song.groupId, songId });
      const runtimeActors = getGroupRuntimeActors(productionAsset, memberId);

      const content = await buildGroupMotionContentFromProductionAsset(productionAsset);
      content.source = 'production';

      const runtime = buildGroupPracticeRuntime(content, memberId);
      const refPlayback = await loadReferenceVideoForPractice(songId, videoId);
      const youtubeUrl = videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : saved?.youtubeUrl || null;

      const sessionData = await buildPracticeSessionFromContent({
        content,
        runtime,
        referenceVideo: {
          videoId,
          youtubeUrl,
          fromCache: true,
          blobCacheKey: refPlayback?.blobCacheKey ?? null,
          localPlaybackUrl: refPlayback?.localPlaybackUrl ?? null,
          durationSec: content.durationSec,
        },
      });

      if (!sessionData) {
        throw new Error('Pre-built 콘텐츠로 연습 세션을 구성하지 못했습니다.');
      }

      setPracticeSessionData({
        ...sessionData,
        productionDanceAsset: productionAsset,
        groupRuntimeActors: runtimeActors,
      });
      setPracticeVideo({
        videoId: sessionData.referenceVideo?.videoId,
        youtubeUrl: sessionData.referenceVideo?.localPlaybackUrl
          || sessionData.referenceVideo?.youtubeUrl,
        fromCache: true,
        blobCacheKey: sessionData.referenceVideo?.blobCacheKey,
      });
      setPhase('practice');
      logGroupModeRuntimeVerification();
    } catch (err) {
      console.error('[useGroupStudio] pre-built content load failed', err);
      setContentError((err as Error)?.message || '콘텐츠 로드 실패');
      setPhase('content_loading');
    } finally {
      setContentLoading(false);
    }
  }, []);

  const selectPosition = useCallback((memberId) => {
    setSelectedMemberId(memberId);
    if (selectedSongId) {
      loadAndStartPractice(memberId, selectedSongId);
    }
  }, [selectedSongId, loadAndStartPractice]);

  /** @deprecated choreo_extract 제거 — pre-built loader 사용 */
  const completeChoreoExtract = useCallback(async () => {
    console.warn('[useGroupStudio] completeChoreoExtract is deprecated. Use pre-built content loader.');
  }, []);

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
    setGroupModeActive(false);
    setPhase('home');
    setSelectedSongId(null);
    setSelectedMemberId(null);
    setPracticeSessionData(null);
    setSessionResult(null);
    setSessionComparison(null);
    setPracticeVideo(null);
    setContentError(null);
  }, []);

  const goBack = useCallback(() => {
    if (phase === 'song_detail') {
      setPhase('home');
      setSelectedSongId(null);
    } else if (phase === 'position_select') {
      setPhase('song_detail');
      setSelectedMemberId(null);
    } else if (phase === 'content_loading') {
      setPhase('position_select');
      setSelectedMemberId(null);
      setContentError(null);
    } else if (phase === 'practice') {
      setPhase('position_select');
      setPracticeSessionData(null);
    }
  }, [phase]);

  return {
    phase,
    selectedSongId,
    selectedMemberId,
    practiceSessionData,
    skeletonData: practiceSessionData?.frames ?? null,
    practiceDuration: practiceSessionData?.duration ?? null,
    danceDatabase: null,
    sessionResult,
    sessionComparison,
    practiceVideo,
    contentLoading,
    contentError,
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
    setSkeletonData: setPracticeSessionData,
  };
}

export default useGroupStudio;
