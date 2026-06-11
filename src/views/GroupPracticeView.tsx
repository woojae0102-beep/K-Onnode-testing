// @ts-nocheck
import React, { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGroupStudio } from '../hooks/useGroupStudio';
import { getSongById } from '../data/groupStudioSongs';
import { GROUP_DATA } from '../data/groupPracticeData';
import { saveTeachingReport } from '../services/teachingReportStore';
import { recordPracticeSession } from '../services/groupStudioStorage';
import { buildSessionKey, savePracticeSession } from '../services/practiceHistoryStore';
import GroupStudioHome from '../components/group/GroupStudioHome';
import SongDetailScreen from '../components/group/SongDetailScreen';
import PositionPicker from '../components/group/PositionPicker';
import GroupStudioSession from '../components/group/GroupStudioSession';
import ChoreoExtractScreen from '../components/group/ChoreoExtractScreen';
import PerformanceReport from '../components/group/PerformanceReport';
import type { Agency } from '../types/tv';
import '../styles/group-studio.css';

export default function GroupPracticeView({
  agency = 'hybe',
  onHome,
}: {
  agency?: Agency;
  onHome?: () => void;
}) {
  const { user } = useAuth();
  const {
    phase,
    selectedSongId,
    selectedMemberId,
    skeletonData,
    sessionResult,
    sessionComparison,
    selectSong,
    startPositionSelect,
    selectPosition,
    completeChoreoExtract,
    practiceVideo,
    practiceDuration,
    endSession,
    retry,
    goHome,
    goBack,
  } = useGroupStudio();

  const song = selectedSongId ? getSongById(selectedSongId) : null;
  const groupId = song?.groupId;

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
    <div className="group-studio">
      {phase === 'home' && (
        <GroupStudioHome onSelectSong={selectSong} onBack={onHome ? handleGoHome : undefined} />
      )}
      {phase === 'song_detail' && selectedSongId && (
        <SongDetailScreen songId={selectedSongId} onStart={startPositionSelect} onBack={goBack} />
      )}
      {phase === 'position_select' && selectedSongId && (
        <PositionPicker songId={selectedSongId} onSelect={selectPosition} onBack={goBack} />
      )}
      {phase === 'choreo_extract' && selectedSongId && selectedMemberId && (
        <ChoreoExtractScreen
          songId={selectedSongId}
          memberId={selectedMemberId}
          onComplete={completeChoreoExtract}
          onBack={goBack}
        />
      )}
      {phase === 'practice' && selectedSongId && groupId && selectedMemberId && skeletonData && (
        <GroupStudioSession
          songId={selectedSongId}
          groupId={groupId}
          myMemberId={selectedMemberId}
          skeletonData={skeletonData}
          referenceYoutubeUrl={practiceVideo?.youtubeUrl}
          practiceDuration={practiceDuration}
          agency={agency}
          onEnd={handleEnd}
          onHome={handleGoHome}
        />
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
