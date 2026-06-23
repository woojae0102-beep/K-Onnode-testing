// @ts-nocheck
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import EmailInput from '../components/auth/EmailInput';

export interface LoginScreenProps {
  onBack: () => void;
  onSwitchToSignUp: () => void;
}

function describeError(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-email':
      return '올바른 이메일 주소를 입력해주세요.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호가 올바르지 않습니다. 카카오로 가입한 계정이라면 뒤로 가서 “카카오로 계속하기”를 눌러주세요.';
    case 'auth/too-many-requests':
      return '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/user-disabled':
      return '비활성화된 계정입니다.';
    default:
      return '로그인에 실패했습니다. 다시 시도해주세요.';
  }
}

export default function LoginScreen({
  onBack,
  onSwitchToSignUp,
}: LoginScreenProps) {
  const { loginWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err: any) {
      setError(describeError(err?.code));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
          maxWidth: 400,
          width: '100%',
          margin: '0 auto 24px',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로"
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: 22,
            cursor: 'pointer',
            padding: 8,
            margin: '-8px 0 -8px -8px',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          ←
        </button>
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 500 }}>
          이메일 로그인
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: 400,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <EmailInput
          label="이메일"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="이메일 주소"
          autoComplete="email"
          required
        />

        <EmailInput
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="비밀번호"
          autoComplete="current-password"
          required
        />

        <div
          style={{
            color: '#777',
            fontSize: 12,
            lineHeight: 1.5,
            marginTop: -6,
          }}
        >
          이 화면은 ONNODE 이메일 회원가입 계정 전용입니다. 카카오 계정은 이전 화면의
          “카카오로 계속하기” 버튼으로 로그인해주세요.
        </div>

        {error && (
          <div
            style={{
              background: '#2a1015',
              border: '1px solid #E24B4A44',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#E24B4A',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="auth-btn-primary"
          style={{ marginTop: 8 }}
        >
          {isLoading ? '로그인 중...' : '로그인'}
        </button>

        <div
          style={{
            textAlign: 'center',
            color: '#444',
            fontSize: 12,
          }}
        >
          아직 계정이 없으신가요?{' '}
          <span
            onClick={onSwitchToSignUp}
            style={{
              color: '#FF1F8E',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            회원가입
          </span>
        </div>
      </form>
    </div>
  );
}
