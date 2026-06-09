// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';

export function GroupResultScreen({ result, groupId, memberId, onRetry, onHome }) {
  const group = GROUP_DATA[groupId];
  const member = group?.members.find((m) => m.id === memberId);
  const [coachReview, setCoachReview] = useState('');
  const [loading, setLoading] = useState(true);

  const overall = result?.overall || result?.scores?.overall || 0;
  const duration = result?.duration || 0;
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);

  const strengths = result?.strengths || (overall > 75
    ? ['그룹 대형 유지가 안정적이에요', '멤버들과 타이밍이 잘 맞아요']
    : ['연습 의지가 좋아요']);
  const weaknesses = result?.weaknesses || (overall < 70
    ? ['포지션 이동 타이밍을 더 맞춰보세요', '팔·다리 각도를 레퍼런스와 비교해 보세요']
    : ['세부 동작 정확도를 높여보세요']);
  const recommendations = result?.recommendations || [
    '느린 템포로 먼저 포지션만 맞춰 연습하세요',
    '거울 앞에서 그룹 대형을 확인하며 반복하세요',
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/group/group-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId,
            memberId,
            groupName: group?.nameKr,
            memberName: member?.nameKr,
            overall,
            duration,
            scores: result?.scores,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.feedback) setCoachReview(data.feedback);
        }
      } catch {
        /* fallback below */
      }
      if (!cancelled) {
        setCoachReview(
          (prev) =>
            prev ||
            (overall >= 80
              ? `${member?.nameKr || '멤버'} 파트 훌륭해요! 그룹과의 싱크가 매우 좋습니다. 무대에서도 자신감 있게 보여줄 수 있을 거예요.`
              : overall >= 60
                ? `${member?.nameKr || '멤버'} 파트 괜찮아요! 포지션 유지는 좋지만, 동작 타이밍을 조금 더 맞춰보세요.`
                : `${member?.nameKr || '멤버'} 파트 연습이 시작됐어요! 레퍼런스 영상을 보며 느린 템포로 반복 연습해보세요.`),
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, memberId, group, member, overall, duration, result]);

  const scoreColor = overall > 80 ? '#00FF88' : overall > 60 ? '#FFD700' : '#FF4444';

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#030308',
        padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px calc(40px + env(safe-area-inset-bottom, 0px))',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            GROUP PRACTICE RESULT
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            {group?.nameKr} · {member?.nameKr} 파트
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            연습 시간 {mins}:{secs.toString().padStart(2, '0')}
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            padding: '32px 24px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${member?.color || '#FF1F8E'}33`,
            borderRadius: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
            {overall}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.15em',
              marginTop: 8,
            }}
          >
            SYNC SCORE
          </div>
        </div>

        <div
          style={{
            padding: '20px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: member?.color, marginBottom: 10 }}>
            AI 코치 리뷰
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>
            {loading ? '코치 리뷰 생성 중...' : coachReview}
          </div>
        </div>

        {[
          { title: '강점', items: strengths, color: '#00FF88' },
          { title: '개선점', items: weaknesses, color: '#FFD700' },
          { title: '추천 연습', items: recommendations, color: '#A78BFA' },
        ].map((section) => (
          <div
            key={section.title}
            style={{
              padding: '16px 20px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: section.color, marginBottom: 8 }}>
              {section.title}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.7 }}>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              flex: 1,
              padding: '14px',
              background: member?.color || '#FF1F8E',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            다시 연습
          </button>
          <button
            type="button"
            onClick={onHome}
            style={{
              flex: 1,
              padding: '14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            처음으로
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupResultScreen;
