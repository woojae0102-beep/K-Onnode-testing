// @ts-nocheck
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import EmailInput from '../components/auth/EmailInput';

export interface SignUpScreenProps {
  onBack: () => void;
  onSwitchToLogin: () => void;
}

interface FormData {
  email: string;
  password: string;
  passwordConfirm: string;
  displayName: string;
  birthYear: string;
  country: string;
  language: string;
}

function describeError(code: string | undefined): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다.';
    case 'auth/weak-password':
      return '비밀번호가 너무 약합니다. (최소 8자)';
    case 'auth/invalid-email':
      return '올바른 이메일 주소를 입력해주세요.';
    case 'auth/operation-not-allowed':
      return '이메일 가입이 비활성화되어 있습니다. 관리자에게 문의해주세요.';
    default:
      return '회원가입에 실패했습니다. 다시 시도해주세요.';
  }
}

export default function SignUpScreen({
  onBack,
  onSwitchToLogin,
}: SignUpScreenProps) {
  const { signUpWithEmail } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    passwordConfirm: '',
    displayName: '',
    birthYear: '',
    country: 'KR',
    language: 'ko',
  });

  const update = (patch: Partial<FormData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!formData.email || !formData.password || !formData.displayName) {
      setError('모든 필수 항목을 입력해주세요.');
      return;
    }
    if (!formData.email.includes('@')) {
      setError('올바른 이메일 주소를 입력해주세요.');
      return;
    }
    if (formData.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    try {
      await signUpWithEmail({
        email: formData.email.trim(),
        password: formData.password,
        displayName: formData.displayName.trim(),
        birthYear: formData.birthYear ? parseInt(formData.birthYear, 10) : 0,
        country: formData.country,
        language: formData.language,
      });
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
          회원가입
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
          label="닉네임"
          required
          value={formData.displayName}
          onChange={(v) => update({ displayName: v })}
          placeholder="사용할 닉네임"
          autoComplete="nickname"
        />

        <EmailInput
          label="이메일"
          type="email"
          required
          value={formData.email}
          onChange={(v) => update({ email: v })}
          placeholder="이메일 주소"
          autoComplete="email"
        />

        <EmailInput
          label="비밀번호"
          type="password"
          required
          value={formData.password}
          onChange={(v) => update({ password: v })}
          placeholder="8자 이상"
          autoComplete="new-password"
          hint="영문, 숫자, 특수문자 조합 권장"
        />

        <EmailInput
          label="비밀번호 확인"
          type="password"
          required
          value={formData.passwordConfirm}
          onChange={(v) => update({ passwordConfirm: v })}
          placeholder="비밀번호 재입력"
          autoComplete="new-password"
        />

        <EmailInput
          label="출생연도 (선택)"
          type="number"
          value={formData.birthYear}
          onChange={(v) => update({ birthYear: v })}
          placeholder="예: 2000"
          min={1950}
          max={2020}
        />

        <div>
          <label
            style={{
              color: '#888',
              fontSize: 12,
              display: 'block',
              marginBottom: 6,
            }}
          >
            국가
          </label>
          <select
            value={formData.country}
            onChange={(e) => update({ country: e.target.value })}
            className="auth-input"
          >
            <option value="KR">🇰🇷 한국</option>
            <option value="US">🇺🇸 미국</option>
            <option value="JP">🇯🇵 일본</option>
            <option value="CN">🇨🇳 중국</option>
            <option value="TH">🇹🇭 태국</option>
            <option value="PH">🇵🇭 필리핀</option>
            <option value="ID">🇮🇩 인도네시아</option>
            <option value="VN">🇻🇳 베트남</option>
            <option value="OTHER">🌍 기타</option>
          </select>
        </div>

        <div>
          <label
            style={{
              color: '#888',
              fontSize: 12,
              display: 'block',
              marginBottom: 6,
            }}
          >
            사용 언어
          </label>
          <select
            value={formData.language}
            onChange={(e) => update({ language: e.target.value })}
            className="auth-input"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="th">ไทย</option>
            <option value="vi">Tiếng Việt</option>
          </select>
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
          {isLoading ? '가입 중...' : '회원가입 완료'}
        </button>

        <div
          style={{
            textAlign: 'center',
            color: '#444',
            fontSize: 12,
          }}
        >
          이미 계정이 있으신가요?{' '}
          <span
            onClick={onSwitchToLogin}
            style={{
              color: '#FF1F8E',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            로그인
          </span>
        </div>
      </form>
    </div>
  );
}
