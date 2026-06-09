// @ts-nocheck
import { useCallback, useState } from 'react';
import type { GroupPracticePhase, GroupSessionResult, SkeletonFrameData } from '../types/groupPractice';

export function useGroupPractice() {
  const [phase, setPhase] = useState('group_select');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [skeletonData, setSkeletonData] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);

  const selectGroup = useCallback((groupId) => {
    setSelectedGroup(groupId);
    setPhase('member_select');
  }, []);

  const selectMember = useCallback((memberId) => {
    setSelectedMemberId(memberId);
    setPhase('video_upload');
  }, []);

  const setExtractedData = useCallback((data) => {
    setSkeletonData(data);
    setPhase('ready');
  }, []);

  const endSession = useCallback((result) => {
    setSessionResult(result);
    setPhase('result');
  }, []);

  const retry = useCallback(() => {
    setSessionResult(null);
    setPhase('ready');
  }, []);

  const goHome = useCallback(() => {
    setPhase('group_select');
    setSelectedGroup(null);
    setSelectedMemberId(null);
    setSkeletonData(null);
    setSessionResult(null);
  }, []);

  const goBack = useCallback(() => {
    if (phase === 'member_select') {
      setPhase('group_select');
      setSelectedGroup(null);
    } else if (phase === 'video_upload') {
      setPhase('member_select');
      setSelectedMemberId(null);
    }
  }, [phase]);

  return {
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
    setPhase,
  };
}

export default useGroupPractice;
