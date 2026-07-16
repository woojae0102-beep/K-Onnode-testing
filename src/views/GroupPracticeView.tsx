// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGroupStudio } from '../hooks/useGroupStudio';
import { useStudioSession } from '../hooks/useStudioSession';
import { getSongById } from '../data/groupStudioSongs';
import { GROUP_DATA } from '../data/groupPracticeData';
import { saveTeachingReport } from '../services/teachingReportStore';
import { recordPracticeSession } from '../services/groupStudioStorage';
import { buildSessionKey, savePracticeSession } from '../services/practiceHistoryStore';
import GroupStudioHome from '../components/group/GroupStudioHome';
import SongDetailScreen from '../components/group/SongDetailScreen';
import PositionPicker from '../components/group/PositionPicker';
import GroupStudioSession from '../components/group/GroupStudioSession';
import GroupContentLoadingScreen from '../components/group/GroupContentLoadingScreen';
import PerformanceReport from '../components/group/PerformanceReport';
import PracticeValidationError from '../components/group/PracticeValidationError';
import StudioConnectModal from '../components/studio/StudioConnectModal';
import { validatePracticeData } from '../utils/practiceDataValidation';
import { logRecoverableErrors } from '../utils/practiceValidationDebug';
import type { Agency } from '../types/tv';
import '../styles/group-studio.css';
import '../styles/studio-mode.css';

export default function GroupPracticeView({
  agency = 'hybe',
  onHome,
}: {
  agency?: Agency;
  onHome?: () => void;
}) {
  const { user } = useAuth();
  const screenRef = useRef(null);
  const [studioModalOpen, setStudioModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    phase,
    selectedSongId,
    selectedMemberId,
    practiceSessionData,
    sessionResult,
    sessionComparison,
    selectSong,
    startPositionSelect,
    selectPosition,
    contentLoading,
    contentError,
    practiceVideo,
    endSession,
    retry,
    goHome,
    goBack,
  } = useGroupStudio();

  const song = selectedSongId ? getSongById(selectedSongId) : null;
  const groupId = song?.groupId;
  const studio = useStudioSession({
    localStream: null,
    mode: 'group',
    agency,
    songTitle: song ? `${song.title} · 그룹 스튜디오` : '그룹 스튜디오',
    practiceStep: 1,
    practiceStepLabel: '그룹 스튜디오',
    isPlaying: false,
  });

  useEffect(() => {
    const updateFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };
    updateFullscreen();
    document.addEventListener('fullscreenchange', updateFullscreen);
    document.addEventListener('webkitfullscreenchange', updateFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreen);
      document.removeEventListener('webkitfullscreenchange', updateFullscreen);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (fullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await document.webkitExitFullscreen?.();
      } else {
        const target = screenRef.current || document.documentElement;
        if (target.requestFullscreen) await target.requestFullscreen();
        else await target.webkitRequestFullscreen?.();
      }
    } catch {
      /* fullscreen can be blocked by browser/device settings */
    }
  }, []);

  const handleEnd = useCallback(
    async (result) => {
      const group = groupId ? GROUP_DATA[groupId] : null;
      const member = group?.members.find((m) => m.id === result.memberId);

      recordPracticeSession(result.songId || selectedSongId, {
        overall: result.overall,
        completed: true,
      });

      const sessionKey = buildSessionKey('group-practice', {
        songId: result.songId || selectedSongId,
        memberId: result.memberId,
      });
      const { comparison } = savePracticeSession('group-practice', sessionKey, {
        overall: result.overall,
        overallScore: result.overall,
        syncScores: result.syncScores || result.scores,
        scores: result.syncScores || result.scores,
        duration: result.duration,
        songId: result.songId || selectedSongId,
        memberId: result.memberId,
        songTitle: result.songTitle,
        completedAt: new Date().toISOString(),
      });

      saveTeachingReport('group-practice', {
        title: `${result.songTitle || song?.title} — ${member?.nameKr}`,
        overallScore: result.overall,
        scores: result.syncScores || result.scores,
        sessionTime: result.duration,
        agency,
        mode: 'group',
        songId: result.songId || selectedSongId,
        groupId: result.groupId,
        memberId: result.memberId,
        completedAt: new Date().toISOString(),
      });

      try {
        await fetch('/api/tv/training-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            overallScore: result.overall,
            agency,
            mode: 'group',
            sessionTime: result.duration,
            scores: {
              rhythm: result.syncScores?.timing || 0,
              posture: result.syncScores?.position || 0,
              angle: result.syncScores?.pose || 0,
              expression: result.syncScores?.formation || 0,
              energy: result.syncScores?.energy || 0,
              stability: result.overall,
            },
            userId: user?.uid || null,
            songId: result.songId || selectedSongId,
            groupId: result.groupId,
            memberId: result.memberId,
          }),
        });
      } catch {
        /* local report saved */
      }

      endSession(result, comparison);
    },
    [agency, user, endSession, selectedSongId, song, groupId],
  );

  const practiceValidation = useMemo(() => {
    if (phase !== 'practice' || !selectedSongId || !groupId || !selectedMemberId) return null;
    return validatePracticeData({
      practiceSessionData,
      groupId,
      songId: selectedSongId,
      userMemberId: selectedMemberId,
    });
  }, [phase, practiceSessionData, groupId, selectedSongId, selectedMemberId]);

  useEffect(() => {
    if (!practiceValidation) return;
    if (practiceValidation.recoverableErrors?.length) {
      logRecoverableErrors('GroupPracticeView', practiceValidation.recoverableErrors);
    }
    if (practiceValidation.valid && practiceValidation.warnings?.length) {
      console.warn('[GroupPracticeView] practice validation warnings (non-blocking)', practiceValidation.warnings);
    }
  }, [practiceValidation]);

  const handleGoHome = useCallback(async () => {
    document.body.classList.remove('tv-active', 'tv-result-open');
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
    goHome();
    onHome?.();
  }, [goHome, onHome]);

  return (
    <div ref={screenRef} className="group-studio">
      {phase !== 'practice' ? (
        <>
          <div className="group-studio-top-controls">
            <button
              type="button"
              className={`studio-tv-btn ${studio.isConnected ? 'is-live' : ''}`}
              onClick={() => setStudioModalOpen(true)}
            >
              📺 TV 연결
            </button>
            <button
              type="button"
              className={`studio-tv-btn studio-fullscreen-btn ${isFullscreen ? 'is-live' : ''}`}
              onClick={handleToggleFullscreen}
            >
              {isFullscreen ? '전체 화면 해제' : '전체 화면'}
            </button>
          </div>
          <StudioConnectModal
            open={studioModalOpen}
            onClose={() => setStudioModalOpen(false)}
            mode="group"
            sessionCode={studio.sessionCode}
            displayUrl={studio.displayUrl}
            studioEnabled={studio.studioEnabled}
            isConnected={studio.isConnected}
            webrtcStatus={studio.webrtcStatus}
            syncError={studio.syncError}
            webrtcError={studio.webrtcError}
            onStartStudio={studio.startStudio}
            onJoinStudio={studio.joinStudio}
            onStopStudio={() => {
              studio.stopStudio();
              setStudioModalOpen(false);
            }}
          />
        </>
      ) : null}
      {phase === 'home' && (
        <GroupStudioHome onSelectSong={selectSong} onBack={onHome ? handleGoHome : undefined} />
      )}
      {phase === 'song_detail' && selectedSongId && (
        <SongDetailScreen songId={selectedSongId} onStart={startPositionSelect} onBack={goBack} />
      )}
      {phase === 'position_select' && selectedSongId && (
        <PositionPicker songId={selectedSongId} onSelect={selectPosition} onBack={goBack} />
      )}
      {phase === 'content_loading' && (
        <GroupContentLoadingScreen
          message={contentLoading ? 'Pre-built 모션 콘텐츠 로드 중...' : '준비 중...'}
          error={contentError}
          onBack={goBack}
        />
      )}
      {phase === 'practice' && selectedSongId && groupId && selectedMemberId && practiceValidation && (
        practiceValidation.valid ? (
          <GroupStudioSession
            practiceSessionData={practiceSessionData}
            referenceYoutubeUrl={
              practiceSessionData.referenceVideo?.localPlaybackUrl
              || practiceSessionData.referenceVideo?.youtubeUrl
              || practiceVideo?.youtubeUrl
            }
            agency={agency}
            onEnd={handleEnd}
            onHome={handleGoHome}
          />
        ) : (
          <PracticeValidationError
            validation={practiceValidation}
            onRetry={goBack}
            onHome={handleGoHome}
          />
        )
      )}
      {phase === 'result' && sessionResult && selectedSongId && selectedMemberId && (
        <PerformanceReport
          result={sessionResult}
          songId={selectedSongId}
          memberId={selectedMemberId}
          comparison={sessionComparison}
          onRetry={retry}
          onHome={handleGoHome}
        />
      )}
    </div>
  );
}
