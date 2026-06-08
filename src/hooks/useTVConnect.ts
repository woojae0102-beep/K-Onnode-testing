// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import useWebRtcSession from './useWebRtcSession';
import { useTVDisplaySync } from './useTVDisplaySync';
import { buildTVDisplayUrl, generateTVSessionCode } from '../utils/tvConnect';
import { db, appId } from '../firebase';

export function useTVConnect({
  localStream = null,
  mode = 'dance',
  agency = 'hybe',
  referenceVideoUrl = '',
  playbackRate = 1,
  getCurrentTime = null,
  feedbackText = '',
  score = 0,
  vocalMetrics = null,
}) {
  const [sessionCode, setSessionCode] = useState('');
  const [tvEnabled, setTvEnabled] = useState(false);

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
    localStream: tvEnabled ? localStream : null,
    enabled: tvEnabled && !!sessionCode && !!localStream,
  });

  const startTVConnect = useCallback(async () => {
    const code = generateTVSessionCode();
    setSessionCode(code);
    setTvEnabled(true);
    await initSession({
      status: 'waiting',
      mode,
      agency,
      referenceVideoUrl: referenceVideoUrl || '',
      playbackRate,
      currentTime: 0,
      isPlaying: false,
      feedback: 'TV에서 연결을 기다리는 중...',
      score: 0,
    });
  }, [agency, initSession, mode, playbackRate, referenceVideoUrl]);

  const stopTVConnect = useCallback(() => {
    setTvEnabled(false);
    publish({ status: 'ended', feedback: '연결이 종료되었습니다.' });
  }, [publish]);

  useEffect(() => {
    if (!tvEnabled || !sessionCode) return;
    publish({
      mode,
      agency,
      referenceVideoUrl: referenceVideoUrl || '',
      playbackRate,
      currentTime: typeof getCurrentTime === 'function' ? getCurrentTime() : 0,
      feedback: feedbackText || tvState?.feedback || '',
      score,
      vocalMetrics: vocalMetrics || null,
      webrtcStatus: webrtc.status,
      status: webrtc.status === 'connected' ? 'live' : 'waiting',
    });
  }, [
    tvEnabled,
    sessionCode,
    mode,
    agency,
    referenceVideoUrl,
    playbackRate,
    feedbackText,
    score,
    vocalMetrics,
    webrtc.status,
    publish,
    getCurrentTime,
    tvState?.feedback,
  ]);

  useEffect(() => {
    if (!tvEnabled || !sessionCode) return undefined;
    const timer = window.setInterval(() => {
      publish({
        currentTime: typeof getCurrentTime === 'function' ? getCurrentTime() : 0,
        playbackRate,
        referenceVideoUrl: referenceVideoUrl || '',
      });
    }, 500);
    return () => clearInterval(timer);
  }, [tvEnabled, sessionCode, getCurrentTime, playbackRate, referenceVideoUrl, publish]);

  return {
    sessionCode,
    displayUrl,
    tvEnabled,
    tvState,
    webrtcStatus: webrtc.status,
    webrtcError: webrtc.error,
    startTVConnect,
    stopTVConnect,
    isConnected: webrtc.status === 'connected',
  };
}

export default useTVConnect;
