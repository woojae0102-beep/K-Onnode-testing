// @ts-nocheck
import React, { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGroupPractice } from '../hooks/useGroupPractice';
import { saveTeachingReport } from '../services/teachingReportStore';
import GroupSelector from '../components/group/GroupSelector';
import MemberPositionPicker from '../components/group/MemberPositionPicker';
import VideoUploadStep from '../components/group/VideoUploadStep';
import GroupStageView from '../components/group/GroupStageView';
import GroupResultScreen from '../components/group/GroupResultScreen';
import type { Agency } from '../types/tv';

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
    selectedGroup,
    selectedMemberId,
    skeletonData,
    sessionResult,
    selectGroup,
    selectMember,
    setExtractedData,
    endSession,
    retry,
    goHome,
    goBack,
  } = useGroupPractice();

  const handleEnd = useCallback(
    async (result) => {
      const enriched = {
        ...result,
        strengths:
          result.overall >= 80
            ? ['그룹 대형 유지가 안정적이에요', '멤버들과 타이밍이 잘 맞아요']
            : ['연습 의지가 좋아요'],
        weaknesses:
          result.overall < 70
            ? ['포지션 이동 타이밍을 더 맞춰보세요']
            : ['세부 동작 정확도를 높여보세요'],
        recommendations: ['느린 템포로 포지션 연습을 반복하세요'],
      };

      saveTeachingReport('group-practice', {
        title: `그룹 연습 — ${result.groupName} ${result.memberName}`,
        overallScore: result.overall,
        scores: result.scores,
        sessionTime: result.duration,
        agency,
        mode: 'group',
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
              rhythm: result.scores?.overall || result.overall,
              posture: result.scores?.position || 0,
              angle: result.scores?.formation || 0,
              expression: 0,
              energy: 0,
              stability: 0,
            },
            strengths: enriched.strengths,
            weaknesses: enriched.weaknesses,
            recommendations: enriched.recommendations,
            userId: user?.uid || null,
            groupId: result.groupId,
            memberId: result.memberId,
          }),
        });
      } catch {
        /* local report saved */
      }

      endSession(enriched);
    },
    [agency, user, endSession],
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
    <div style={{ minHeight: '100dvh', background: '#030308', fontFamily: 'Inter, sans-serif' }}>
      {phase === 'group_select' && (
        <GroupSelector onSelect={selectGroup} onBack={onHome ? handleGoHome : undefined} />
      )}
      {phase === 'member_select' && selectedGroup && (
        <MemberPositionPicker groupId={selectedGroup} onSelect={selectMember} onBack={goBack} />
      )}
      {phase === 'video_upload' && selectedGroup && selectedMemberId && (
        <VideoUploadStep
          groupId={selectedGroup}
          memberId={selectedMemberId}
          onExtracted={setExtractedData}
          onBack={goBack}
        />
      )}
      {phase === 'ready' && selectedGroup && selectedMemberId && skeletonData && (
        <GroupStageView
          groupId={selectedGroup}
          myMemberId={selectedMemberId}
          skeletonData={skeletonData}
          agency={agency}
          onEnd={handleEnd}
          onHome={handleGoHome}
        />
      )}
      {phase === 'result' && sessionResult && selectedGroup && selectedMemberId && (
        <GroupResultScreen
          result={sessionResult}
          groupId={selectedGroup}
          memberId={selectedMemberId}
          onRetry={retry}
          onHome={handleGoHome}
        />
      )}
    </div>
  );
}
