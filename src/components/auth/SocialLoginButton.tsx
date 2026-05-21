// @ts-nocheck
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export type SocialProvider = 'google' | 'kakao' | 'apple';

interface ProviderConfig {
  label: string;
  bg: string;
  color: string;
  border: string;
  icon: React.ReactNode;
}

const PROVIDER_CONFIG: Record<SocialProvider, ProviderConfig> = {
  google: {
    label: 'Google로 계속하기',
    bg: '#fff',
    color: '#000',
    border: '1px solid #e0e0e0',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
  kakao: {
    label: '카카오로 계속하기',
    bg: '#FEE500',
    color: '#000',
    border: 'none',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#000">
        <path d="M12 3C6.477 3 2 6.477 2 10.909c0 2.822 1.548 5.302 3.898 6.832L5 21l4.167-2.196A11.2 11.2 0 0012 18.818c5.523 0 10-3.477 10-7.909S17.523 3 12 3z" />
      </svg>
    ),
  },
  apple: {
    label: 'Apple로 계속하기',
    bg: '#000',
    color: '#fff',
    border: '1px solid #333',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
  },
};

export interface SocialLoginButtonProps {
  provider: SocialProvider;
}

export default function SocialLoginButton({
  provider,
}: SocialLoginButtonProps) {
  const { loginWithGoogle, loginWithApple, loginWithKakao } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = PROVIDER_CONFIG[provider];

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (provider === 'google') await loginWithGoogle();
      else if (provider === 'kakao') await loginWithKakao();
      else if (provider === 'apple') await loginWithApple();
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        // 사용자가 팝업을 닫음 - 에러 표시 생략
      } else if (code === 'auth/popup-blocked') {
        setError('팝업이 차단되었습니다. 브라우저 설정을 확인해주세요.');
      } else if (code === 'auth/account-exists-with-different-credential') {
        setError('이미 다른 방식으로 가입된 이메일입니다.');
      } else {
        const reason = err?.message || '';
        setError(
          reason
            ? `로그인 실패: ${reason}`
            : '로그인에 실패했습니다. 다시 시도해주세요.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleLogin}
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '14px',
          minHeight: 48,
          background: config.bg,
          color: config.color,
          border: config.border,
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 500,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          transition: 'opacity 0.15s',
          WebkitTapHighlightColor: 'transparent',
          // iOS Safari 가 button 모서리를 둥글게 처리하지 않는 경우 보정
          WebkitAppearance: 'none',
          appearance: 'none',
        }}
      >
        {isLoading ? (
          <div
            style={{
              width: 18,
              height: 18,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        ) : (
          config.icon
        )}
        {isLoading ? '로그인 중...' : config.label}
      </button>
      {error && (
        <div
          style={{
            color: '#E24B4A',
            fontSize: 12,
            marginTop: 6,
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
