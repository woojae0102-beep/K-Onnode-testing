// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import JudgeSpeechBubble from './JudgeSpeechBubble';

type Judge = {
  id: string;
  name?: string;
  avatar?: string;
  accentColor?: string;
  title?: string;
};

type Message = {
  id: number;
  judgeId: string;
  text: string;
  type?: string;
};

type Props = {
  judges: Judge[];
  messages: Message[];
  currentSpeaker?: string | null;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  agencyAccent?: string;
  compact?: boolean;
  emptyText?: string;
};

export default function JudgeDialogBox({
  judges,
  messages,
  currentSpeaker = null,
  voiceEnabled = true,
  onToggleVoice,
  agencyAccent = '#FF1F8E',
  compact = false,
  emptyText = '심사위원이 곧 입장합니다...',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, currentSpeaker]);

  const currentJudge = currentSpeaker ? judges.find((j) => j.id === currentSpeaker) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(0,0,0,0.55)',
        border: `1px solid ${agencyAccent}44`,
        borderRadius: 16,
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: `1px solid ${agencyAccent}33`,
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>💬</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#FFF' }}>
            JUDGE TALK
          </span>
        </div>
        {onToggleVoice ? (
          <button
            type="button"
            onClick={onToggleVoice}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#FFF',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            aria-label={voiceEnabled ? '음성 끄기' : '음성 켜기'}
          >
            {voiceEnabled ? '🔊 음성 ON' : '🔇 음성 OFF'}
          </button>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{emptyText}</p>
        ) : (
          messages.map((msg) => {
            const judge = judges.find((j) => j.id === msg.judgeId) || null;
            return (
              <JudgeSpeechBubble
                key={msg.id}
                judge={judge}
                text={msg.text}
                type={msg.type as any}
                isCurrent={currentSpeaker === msg.judgeId}
                compact={compact}
              />
            );
          })
        )}

        {currentJudge ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: currentJudge.accentColor || '#FFF',
              fontWeight: 700,
              opacity: 0.85,
              paddingLeft: 4,
            }}
          >
            <span>{currentJudge.avatar} {currentJudge.name}</span>
            <span style={{ display: 'inline-flex', gap: 3 }}>
              <span className="judge-typing-dot" />
              <span className="judge-typing-dot" style={{ animationDelay: '0.15s' }} />
              <span className="judge-typing-dot" style={{ animationDelay: '0.3s' }} />
            </span>
          </div>
        ) : null}
      </div>

      <style>{`
        .judge-typing-dot {
          display: inline-block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: currentColor;
          animation: judgeTypingDot 1s infinite ease-in-out;
        }
        @keyframes judgeTypingDot {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
