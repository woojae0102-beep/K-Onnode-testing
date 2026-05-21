// @ts-nocheck
import React, { useState } from 'react';
import SocialLoginButton from '../components/auth/SocialLoginButton';
import LoginScreen from './LoginScreen';
import SignUpScreen from './SignUpScreen';

type Mode = 'landing' | 'login' | 'signup';

// 환경변수로 소셜 로그인 제공자를 토글합니다.
// .env 에서 VITE_ENABLE_APPLE_LOGIN=false 처럼 명시적으로 끄지 않는 한 모두 표시됩니다.
const env = (import.meta as any).env || {};
const ENABLE_GOOGLE = env.VITE_ENABLE_GOOGLE_LOGIN !== 'false';
const ENABLE_KAKAO = env.VITE_ENABLE_KAKAO_LOGIN !== 'false';
const ENABLE_APPLE = env.VITE_ENABLE_APPLE_LOGIN !== 'false';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('landing');

  if (mode === 'login') {
    return (
      <LoginScreen
        onBack={() => setMode('landing')}
        onSwitchToSignUp={() => setMode('signup')}
      />
    );
  }
  if (mode === 'signup') {
    return (
      <SignUpScreen
        onBack={() => setMode('landing')}
        onSwitchToLogin={() => setMode('login')}
      />
    );
  }

  return (
    <div className="auth-screen auth-screen--centered">
      {/* 배경 그라디언트 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 0%, #FF1F8E22 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 400,
          margin: '0 auto',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              width: 72,
              height: 72,
              background: '#FF1F8E',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 700,
              color: '#fff',
              margin: '0 auto 16px',
              boxShadow: '0 12px 40px rgba(255,31,142,0.45)',
            }}
          >
            O
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}>
            ONNODE
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>
            AI K-POP 댄스 · 보컬 · 한국어 코치
          </div>
        </div>

        {/* 소개 문구 */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 40,
            maxWidth: 320,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: '#fff',
              lineHeight: 1.4,
            }}
          >
            K-POP을 배우는
            <br />
            가장 똑똑한 방법
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#666',
              marginTop: 10,
              lineHeight: 1.6,
            }}
          >
            AI 심사위원에게 실시간 피드백을 받고
            <br />
            실제 기획사 오디션을 경험해보세요
          </div>
        </div>

        {/* 소셜 로그인 버튼들 */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {ENABLE_GOOGLE && <SocialLoginButton provider="google" />}
          {ENABLE_KAKAO && <SocialLoginButton provider="kakao" />}
          {ENABLE_APPLE && <SocialLoginButton provider="apple" />}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '4px 0',
            }}
          >
            <div style={{ flex: 1, height: 1, background: '#222' }} />
            <span style={{ color: '#444', fontSize: 12 }}>또는</span>
            <div style={{ flex: 1, height: 1, background: '#222' }} />
          </div>

          <button
            type="button"
            onClick={() => setMode('login')}
            className="auth-btn-ghost"
          >
            이메일로 로그인
          </button>

          <button
            type="button"
            onClick={() => setMode('signup')}
            className="auth-btn-primary"
          >
            이메일로 회원가입
          </button>
        </div>

        {/* 하단 약관 */}
        <div
          style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: 11,
            color: '#444',
            lineHeight: 1.6,
          }}
        >
          가입 시 <span style={{ color: '#666' }}>서비스 이용약관</span> 및{' '}
          <span style={{ color: '#666' }}>개인정보 처리방침</span>에
          <br />
          동의하는 것으로 간주됩니다
        </div>
      </div>
    </div>
  );
}
