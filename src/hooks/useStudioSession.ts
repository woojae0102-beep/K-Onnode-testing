// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useWebRtcSession from './useWebRtcSession';
import { useTVDisplaySync } from './useTVDisplaySync';
import { buildTVDisplayUrl, generateStudioCode, isValidStudioCode } from '../utils/tvConnect';
import { getAgencyInfo } from './useAgencyPersona';
import { db, appId } from '../firebase';

function serializePose(poseData) {
  if (!poseData?.joints) return null;
  return {
    joints: poseData.joints,
    jointAccuracies: poseData.jointAccuracies || {},
    timestamp: poseData.timestamp || Date.now(),
  };
}

export function useStudioSession({
  localStream = null,
  mode = 'dance',
  agency = 'hybe',
  referenceVideoUrl = '',
  songTitle = '',
  playbackRate = 1,
  getCurrentTime = null,
  feedbackText = '',
  feedbackItems = [],
  score = 0,
  scores = null,
  vocalMetrics = null,
  poseData = null,
  practiceStep = 1,
  practiceStepLabel = '워밍업',
  isPaused = false,
  isPlaying = true,
}) {
  const [sessionCode, setSessionCode] = useState('');
  const [studioEnabled, setStudioEnabled] = useState(false);
  const lastPosePublishRef = useRef(0);
  const persona = getAgencyInfo(agency);

  const displayUrl = useMemo(
    () => (sessionCode ? buildTVDisplayUrl(sessionCode) : ''),
    [sessionCode],
  );

  const { state: tvState, publish, initSession } = useTVDisplaySync(sessionCode, { role: 'phone' });

  const webrtc = useWebRtcSession({
    db,
    appId,
    sessionId: sessionCode,
    role: 'mobile',
    localStream: studioEnabled ? localStream : null,
    enabled: studioEnabled && !!sessionCode && !!localStream,
  });

  const publishStudioState = useCallback(
    (extra = {}) => {
      if (!studioEnabled || !sessionCode) return;
      const beatAccuracy = scores?.rhythm ?? score;
      publish({
        mode,
        agency,
        referenceVideoUrl: referenceVideoUrl || '',
        songTitle: songTitle || tvState?.songTitle || '연습 곡',
        playbackRate,
        currentTime: typeof getCurrentTime === 'function' ? getCurrentTime() : 0,
        feedback: feedbackText || tvState?.feedback || '',
        feedbackItems: (feedbackItems || []).slice(-3),
        score,
        scores,
        beatAccuracy,
        vocalMetrics: vocalMetrics || null,
        poseSnapshot: serializePose(poseData),
        practiceStep,
        practiceStepLabel,
        isPaused,
        isPlaying: isPlaying && !isPaused,
        coachName: persona.coachName,
        coachAvatar: persona.coachAvatar,
        coachTagline: persona.coachTagline,
        webrtcStatus: webrtc.status,
        status: webrtc.status === 'connected' ? 'live' : studioEnabled ? 'waiting' : 'idle',
        studioMode: true,
        ...extra,
      });
    },
    [
      studioEnabled,
      sessionCode,
      mode,
      agency,
      referenceVideoUrl,
      songTitle,
      playbackRate,
      getCurrentTime,
      feedbackText,
      feedbackItems,
      score,
      scores,
      vocalMetrics,
      poseData,
      practiceStep,
      practiceStepLabel,
      isPaused,
      isPlaying,
      persona,
      webrtc.status,
      publish,
      tvState?.songTitle,
      tvState?.feedback,
    ],
  );

  const startStudio = useCallback(
    async (presetCode = '') => {
      const code = isValidStudioCode(presetCode) ? String(presetCode).trim() : generateStudioCode();
      setSessionCode(code);
      setStudioEnabled(true);
      await initSession({
        status: 'waiting',
        mode,
        agency,
        referenceVideoUrl: referenceVideoUrl || '',
        songTitle: songTitle || '연습 곡',
        playbackRate,
        currentTime: 0,
        isPlaying: false,
        isPaused: false,
        feedback: 'TV 연습실 준비 중...',
        practiceStep: 1,
        practiceStepLabel: '연결 대기',
        score: 0,
        coachName: persona.coachName,
        coachAvatar: persona.coachAvatar,
        studioMode: true,
      });
    },
    [agency, initSession, mode, playbackRate, persona, referenceVideoUrl, songTitle],
  );

  const joinStudio = useCallback(
    async (code) => {
      if (!isValidStudioCode(code)) return false;
      await startStudio(code);
      return true;
    },
    [startStudio],
  );

  const stopStudio = useCallback(() => {
    setStudioEnabled(false);
    publish({ status: 'ended', feedback: '스튜디오 연결이 종료되었습니다.', studioMode: false });
  }, [publish]);

  useEffect(() => {
    publishStudioState();
  }, [
    publishStudioState,
    feedbackText,
    score,
    scores,
    vocalMetrics,
    webrtc.status,
    isPaused,
    practiceStep,
    practiceStepLabel,
  ]);

  useEffect(() => {
    if (!studioEnabled || !sessionCode) return undefined;
    const timer = window.setInterval(() => {
      publishStudioState();
    }, 400);
    return () => clearInterval(timer);
  }, [studioEnabled, sessionCode, publishStudioState]);

  useEffect(() => {
    if (!studioEnabled || !sessionCode || !poseData) return;
    const now = Date.now();
    if (now - lastPosePublishRef.current < 200) return;
    lastPosePublishRef.current = now;
    publish({ poseSnapshot: serializePose(poseData) });
  }, [poseData, studioEnabled, sessionCode, publish]);

  return {
    sessionCode,
    displayUrl,
    studioEnabled,
    tvState,
    webrtcStatus: webrtc.status,
    webrtcError: webrtc.error,
    startStudio,
    joinStudio,
    stopStudio,
    isConnected: webrtc.status === 'connected',
    publishStudioState,
  };
}

export default useStudioSession;
