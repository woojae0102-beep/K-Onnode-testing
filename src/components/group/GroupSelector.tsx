// @ts-nocheck
import React from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';

export function GroupSelector({ onSelect, onBack }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#030308',
        padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px calc(40px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,31,142,0.15) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', width: '100%', maxWidth: 600 }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← 뒤로
          </button>
        ) : null}

        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            GROUP PRACTICE MODE
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.02em',
              marginBottom: 8,
            }}
          >
            그룹 연습
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            그룹을 선택하면 나머지 멤버들이
            <br />
            AI 아바타로 나타나 함께 연습해요
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 14,
          }}
        >
          {Object.entries(GROUP_DATA).map(([id, group]) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              style={{
                padding: '20px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,31,142,0.08)';
                e.currentTarget.style.borderColor = 'rgba(255,31,142,0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {group.members.slice(0, 5).map((member) => (
                  <div
                    key={member.id}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: `${member.color}33`,
                      border: `1px solid ${member.color}66`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    {member.avatar}
                  </div>
                ))}
                {group.members.length > 5 ? (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.5)',
                    }}
                  >
                    +{group.members.length - 5}
                  </div>
                ) : null}
              </div>

              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                {group.nameKr}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                {group.memberCount}인조 · {group.name}
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          style={{
            width: '100%',
            marginTop: 14,
            padding: '16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 16,
            cursor: 'default',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 13,
          }}
        >
          + 직접 영상 올려서 연습하기 (준비 중)
        </button>
      </div>
    </div>
  );
}

export default GroupSelector;
