// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

type Props = {
  language?: string;
  accentColor?: string;
  prompt?: string;
  disabled?: boolean;
  onSubmit: (text: string) => void;
};

export default function MicResponseInput({
  language = 'ko',
  accentColor = '#FF1F8E',
  prompt = '심사위원의 질문에 답해주세요.',
  disabled = false,
  onSubmit,
}: Props) {
  const {
    transcript,
    finalTranscript,
    isListening,
    supported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition(language);

  const [textValue, setTextValue] = useState('');

  useEffect(() => {
    setTextValue(finalTranscript);
  }, [finalTranscript]);

  const handleMicClick = () => {
    if (disabled) return;
    if (isListening) {
      const result = stopListening();
      if (result) {
        onSubmit(result);
        resetTranscript();
        setTextValue('');
      }
    } else {
      resetTranscript();
      setTextValue('');
      startListening();
    }
  };

  const handleTextSubmit = () => {
    const value = textValue.trim();
    if (!value) return;
    onSubmit(value);
    resetTranscript();
    setTextValue('');
  };

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: `1px solid ${accentColor}55`,
        borderRadius: 16,
        padding: 12,
        color: '#FFF',
      }}
    >
      <p
        style={{
          margin: '0 0 8px',
          fontSize: 11,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        {prompt}
      </p>

      {/* Voice mic */}
      {supported ? (
        <button
          type="button"
          onClick={handleMicClick}
          disabled={disabled}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 999,
            border: `1px solid ${isListening ? '#FF3B3B' : accentColor}`,
            background: isListening ? '#FF3B3B22' : `${accentColor}22`,
            color: '#FFF',
            fontSize: 13,
            fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isListening ? '#FF3B3B' : accentColor,
              animation: isListening ? 'micPulse 1s infinite' : 'none',
            }}
          />
          {isListening ? '🔴 답변 완료' : '🎙 마이크로 답변하기'}
        </button>
      ) : (
        <div
          style={{
            padding: '8px 10px',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 10,
            fontSize: 11,
            color: 'rgba(255,255,255,0.7)',
            marginBottom: 8,
          }}
        >
          이 브라우저는 음성 인식을 지원하지 않습니다. 아래에 텍스트로 답변해주세요.
        </div>
      )}

      {/* Live transcript */}
      {isListening ? (
        <div
          style={{
            marginTop: 10,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '8px 10px',
            fontSize: 12.5,
            minHeight: 40,
            color: '#FFFFFF',
            lineHeight: 1.4,
          }}
        >
          {finalTranscript}
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>{transcript}</span>
          {!finalTranscript && !transcript ? (
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>말씀해주세요...</span>
          ) : null}
        </div>
      ) : null}

      {/* Text fallback */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 10,
        }}
      >
        <input
          type="text"
          placeholder="또는 텍스트로 입력..."
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleTextSubmit();
            }
          }}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(0,0,0,0.4)',
            color: '#FFF',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={handleTextSubmit}
          disabled={disabled || !textValue.trim()}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            background: accentColor,
            color: '#FFF',
            border: 'none',
            fontWeight: 800,
            fontSize: 12,
            cursor: disabled || !textValue.trim() ? 'not-allowed' : 'pointer',
            opacity: disabled || !textValue.trim() ? 0.5 : 1,
          }}
        >
          전송
        </button>
      </div>

      {error ? (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#FF8A8A' }}>{error}</p>
      ) : null}

      <style>{`
        @keyframes micPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
      `}</style>
    </div>
  );
}
