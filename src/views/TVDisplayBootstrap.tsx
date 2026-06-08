// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { initTvSession } from '../services/tvSessionApi';
import StudioTVDisplay from './StudioTVDisplay';
import { TV_HOST_MODE, buildStudioTvLandingUrl, generateStudioCode } from '../utils/tvConnect';
import '../styles/studio-mode.css';

function TVLoader() {
  return (
    <div className="tv-display-loader">
      <div className="tv-display-spinner" />
      <p>ONNODE STUDIO 연습실 준비 중...</p>
    </div>
  );
}

async function initHostSession(code) {
  await initTvSession(code, {
    status: 'host-waiting',
    studioMode: true,
    feedback: '모바일 앱 → 트레이닝 → TV 연결 → 아래 코드 입력',
    practiceStep: 1,
    practiceStepLabel: '연결 대기',
  });
}

export default function TVDisplayBootstrap({ code: initialCode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState(initialCode === TV_HOST_MODE ? '' : initialCode);
  const isHost = initialCode === TV_HOST_MODE;

  useEffect(() => {
    if (!isHost || code) return;
    const hostCode = generateStudioCode();
    setCode(hostCode);
    initHostSession(hostCode).catch((e) => console.error(e));
  }, [isHost, code]);

  useEffect(() => {
    if (!auth) {
      setError('Firebase가 설정되지 않았습니다.');
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setReady(true);
        setError('');
        return;
      }
      try {
        await signInAnonymously(auth);
      } catch (e) {
        setError(
          e?.message ||
            '익명 로그인 실패. Firebase Console → Authentication → Sign-in method에서「익명」을 활성화하세요.',
        );
      }
    });

    return () => unsub();
  }, []);

  if (error) {
    return (
      <div className="tv-display-error-screen">
        <h1>STUDIO MODE 오류</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!ready || !code) return <TVLoader />;

  if (isHost) {
    return (
      <>
        <div className="studio-tv-host-banner">
          <span>ONNODE TV 연습실</span>
          <p>모바일 앱 → 트레이닝 → TV 연결 → 아래 코드 입력</p>
          <strong>{code}</strong>
          <small>{buildStudioTvLandingUrl()}</small>
        </div>
        <StudioTVDisplay code={code} isHost={isHost} />
      </>
    );
  }

  return <StudioTVDisplay code={code} isHost={isHost} />;
}
