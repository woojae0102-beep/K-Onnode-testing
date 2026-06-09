// @ts-nocheck
import React, { useState } from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';

export function MemberPositionPicker({ groupId, onSelect, onBack }) {
  const group = GROUP_DATA[groupId];
  const [hoveredMember, setHoveredMember] = useState(null);

  if (!group) return null;

  const hovered = group.members.find((m) => m.id === hoveredMember);

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
      <div style={{ width: '100%', maxWidth: 600 }}>
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

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            {group.nameKr} 중 누구로 연습할까요?
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            선택한 멤버 자리를 내가 채웁니다
            <br />
            나머지 {group.memberCount - 1}명은 AI 아바타가 됩니다
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
            paddingBottom: '56.25%',
            background: '#0a0a14',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            marginBottom: 24,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, #0a0a14 0%, #050510 100%)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: '15%',
                left: '10%',
                right: '10%',
                height: 1,
                background: 'rgba(255,255,255,0.06)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '60%',
                height: '40%',
                background:
                  'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 70%)',
              }}
            />
          </div>

          {group.members.map((member) => {
            const isHovered = hoveredMember === member.id;
            return (
              <button
                key={member.id}
                type="button"
                onMouseEnter={() => setHoveredMember(member.id)}
                onMouseLeave={() => setHoveredMember(null)}
                onClick={() => onSelect(member.id)}
                style={{
                  position: 'absolute',
                  left: `${member.defaultX * 100}%`,
                  top: `${member.defaultY * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: isHovered ? 64 : 52,
                  height: isHovered ? 64 : 52,
                  borderRadius: '50%',
                  background: isHovered ? `${member.color}44` : `${member.color}22`,
                  border: `2px solid ${isHovered ? member.color : `${member.color}66`}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: isHovered
                    ? `0 0 24px ${member.color}60`
                    : `0 0 8px ${member.color}20`,
                  zIndex: isHovered ? 10 : 1,
                }}
              >
                <span style={{ fontSize: isHovered ? 22 : 18 }}>{member.avatar}</span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: member.color,
                    marginTop: 2,
                    letterSpacing: '0.02em',
                  }}
                >
                  {member.nameKr}
                </span>
              </button>
            );
          })}
        </div>

        {hovered ? (
          <div
            style={{
              padding: '16px 20px',
              background: `${hovered.color}11`,
              border: `1px solid ${hovered.color}33`,
              borderRadius: 12,
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
              {hovered.nameKr} 파트로 연습하기
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
              클릭해서 선택하세요
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(group.memberCount, 4)}, 1fr)`,
            gap: 8,
          }}
        >
          {group.members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(member.id)}
              style={{
                padding: '12px 8px',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${member.color}33`,
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{member.avatar}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: member.color }}>
                {member.nameKr}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MemberPositionPicker;
