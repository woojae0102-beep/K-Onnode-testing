// @ts-nocheck
import React from 'react';

export interface EmailInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number';
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  min?: string | number;
  max?: string | number;
  hint?: string;
  error?: string | null;
}

// 입력 타입별 모바일 키보드 최적화
function getInputMode(type?: string): React.HTMLAttributes<HTMLInputElement>['inputMode'] {
  if (type === 'email') return 'email';
  if (type === 'number') return 'numeric';
  if (type === 'password') return 'text';
  return 'text';
}

export default function EmailInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  autoComplete,
  disabled = false,
  min,
  max,
  hint,
  error,
}: EmailInputProps) {
  return (
    <div>
      {label && (
        <label
          style={{
            color: '#888',
            fontSize: 12,
            display: 'block',
            marginBottom: 6,
          }}
        >
          {label}{' '}
          {required && <span style={{ color: '#FF1F8E' }}>*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        min={min}
        max={max}
        inputMode={getInputMode(type)}
        autoCapitalize={
          type === 'email' || type === 'password' ? 'none' : 'sentences'
        }
        autoCorrect={type === 'email' || type === 'password' ? 'off' : 'on'}
        spellCheck={type === 'email' || type === 'password' ? false : undefined}
        enterKeyHint={type === 'password' ? 'go' : 'next'}
        className="auth-input"
        style={{
          borderColor: error ? '#E24B4A' : undefined,
        }}
      />
      {hint && !error && (
        <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>{hint}</div>
      )}
      {error && (
        <div style={{ color: '#E24B4A', fontSize: 12, marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}
