// @ts-nocheck
import { useCallback, useState } from 'react';
import { getSongById } from '../data/groupStudioSongs';
import { getSongVideo } from '../services/groupStudioStorage';
import { getGroupRuntimeActors } from '../services/group/getGroupRuntimeActors';
import {
  setGroupModeActive,
  logGroupModeRuntimeVerification,
} from '../services/group/groupModeRuntimeGuard';
import { buildGroupPracticeSessionFromMotionAsset } from '../modes/group/services/buildGroupPracticeSession';
import { loadReferenceVideoForPractice } from '../modes/group/services/referenceVideoLoader';
import { loadProductionMotionAsset } from '../modes/group/services/ProductionMotionAssetLoader';
import {
  productionMotionAssetV2ToGroupMotionAsset,
  productionMotionAssetV2ToLegacyDanceAsset,
} from '../modes/group/runtime/productionMotionAssetV2Mapper';
import { ProductionMotionAssetError } from '../modes/group/types/ProductionMotionAssetV2';

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
      const refPlayback = await loadReferenceVideoForPractice(songId, videoId);
      const youtubeUrl = videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : saved?.youtubeUrl || null;
      const referenceVideo = {
        videoId,
        youtubeUrl,
        fromCache: true,
        blobCacheKey: refPlayback?.blobCacheKey ?? null,
        localPlaybackUrl: refPlayback?.localPlaybackUrl ?? null,
      };

      const loadResult = await loadProductionMotionAsset({
        groupId: song.groupId,
        songId,
      });

      if (loadResult.loadStatus === 'authority_blocked') {
        const blocked = loadResult.authorityBlocked!;
        throw new ProductionMotionAssetError(blocked.failureCode, blocked.message);
      }

      const productionMotionV2 = loadResult.asset;

      const motionAsset = productionMotionAssetV2ToGroupMotionAsset(productionMotionV2);
      const productionAsset = productionMotionAssetV2ToLegacyDanceAsset(productionMotionV2);

      if (motionAsset.status !== 'motion_asset_ready') {
        throw new Error('Production Motion Asset이 준비되지 않았습니다.');
      }

      const runtimeActors = getGroupRuntimeActors(productionAsset, memberId);

      const { session: sessionData, runtime } = await buildGroupPracticeSessionFromMotionAsset({
        motionAsset,
        selectedMemberId: memberId,
        referenceVideo: {
          ...referenceVideo,
          durationSec: motionAsset.durationSec,
        },
      });

      if (!sessionData) {
        throw new Error('Pre-built 콘텐츠로 연습 세션을 구성하지 못했습니다.');
      }

      setPracticeSessionData({
        ...sessionData,
        productionDanceAsset: productionAsset,
        productionMotionAssetV2: productionMotionV2,
        productionAuthorityVerification: loadResult.authorityVerification,
        groupRuntimeActors: runtimeActors,
        groupPracticeRuntime: runtime,
        groupMotionAsset: motionAsset,
        motionAssetStatus: motionAsset.status,
        devMotionFixture: false,
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
      console.error('[useGroupStudio] production motion load failed', err);
      const message = err instanceof ProductionMotionAssetError
        ? `${err.code}: ${err.message}`
        : ((err as Error)?.message || 'Production Motion Asset이 준비되지 않았습니다.');
      setContentError(message);
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

  const completeChoreoExtract = useCallback(async () => {
    console.warn('[useGroupStudio] completeChoreoExtract is deprecated.');
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
    devMotionFixture: false,
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
