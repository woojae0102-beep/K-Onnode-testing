// @ts-nocheck
import React, { useEffect, useState } from 'react';
import AgencyCertificate from './AgencyCertificate';

export default function AgencyResult({ agency, rounds, ticketNumber, onRetry, onSelectAgency }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [overallScore, setOverallScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const passed = overallScore >= (agency?.passingScore ?? 70);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const computed = computeOverall(rounds);
      try {
        const res = await fetch('/api/audition/agency-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agencyId: agency.id,
            rounds,
            overallScore: computed,
            language: 'ko',
          }),
        });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (data?.feedbacks?.length) {
          setFeedbacks(data.feedbacks);
          setOverallScore(data.overallScore ?? computed);
        } else {
          setFeedbacks(buildFallbackFeedbacks(agency));
          setOverallScore(computed);
        }
      } catch {
        if (cancelled) return;
        setFeedbacks(buildFallbackFeedbacks(agency));
        setOverallScore(computed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (agency) load();
    return () => {
      cancelled = true;
    };
  }, [agency, rounds]);

  if (!agency) return null;

  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div
      style={{
        minHeight: '100%',
        background: passed ? agency.primaryColor : '#1A1A1A',
        padding: 'clamp(20px, 4vw, 32px) clamp(14px, 3vw, 24px) 80px',
        boxSizing: 'border-box',
        color: '#FFFFFF',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 48 }}>{agency.logo}</span>
          <h1 style={{ margin: '8px 0 4px', fontSize: 22, fontWeight: 800 }}>
            {agency.name} 오디션 심사 결과
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
            합격 기준 {agency.passingScore}점 · 종합 점수 <strong style={{ color: agency.accentColor }}>{overallScore}점</strong>
          </p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
            심사위원이 평가 중입니다...
          </p>
        ) : passed ? (
          <div
            style={{
              border: `3px solid ${agency.accentColor}`,
              borderRadius: 20,
              padding: 28,
              textAlign: 'center',
              marginBottom: 24,
              boxShadow: `0 0 40px ${agency.accentColor}55`,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, color: agency.accentColor, fontWeight: 800 }}>
              🎉 PASS
            </p>
            <h2 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 900 }}>
              {agency.name} 연습생 합격!
            </h2>
          </div>
        ) : (
          <div
            style={{
              border: '1px solid #444',
              borderRadius: 20,
              padding: 24,
              textAlign: 'center',
              marginBottom: 24,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: '#999', fontWeight: 700 }}>
              😢 아쉽게도 이번 오디션에서는 합격하지 못했습니다
            </p>
            <h2 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 800 }}>
              재도전을 권고드립니다
            </h2>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          {feedbacks.map((f, idx) => {
            const judge = agency.judges.find((j) => j.id === f.judgeId) || agency.judges[idx];
            return <FeedbackCard key={f.judgeId || idx} judge={judge} feedback={f} />;
          })}
        </div>

        {passed && (
          <div style={{ marginBottom: 24 }}>
            <AgencyCertificate
              agency={agency}
              ticketNumber={ticketNumber}
              score={overallScore}
              dateString={dateStr}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              flex: 1,
              minWidth: 160,
              background: agency.accentColor,
              color: '#0A0A0A',
              border: 'none',
              padding: '14px 20px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            다시 도전하기
          </button>
          <button
            type="button"
            onClick={onSelectAgency}
            style={{
              flex: 1,
              minWidth: 160,
              background: 'transparent',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '14px 20px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            다른 기획사 선택
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackCard({ judge, feedback }) {
  if (!judge) return null;
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.4)',
        borderLeft: `4px solid ${judge.accentColor}`,
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#0A0A0A',
            border: `2px solid ${judge.accentColor}`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
          }}
        >
          {judge.avatar}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#FFFFFF' }}>
            {judge.name}
          </p>
          <p style={{ margin: 0, fontSize: 10, color: judge.accentColor, fontWeight: 600 }}>
            {judge.title} · {feedback.score ?? '-'}점
          </p>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#EEE', lineHeight: 1.5 }}>
        {feedback.summary}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
        {feedback.strengths && (
          <div
            style={{
              flex: 1,
              minWidth: 140,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            <p style={{ margin: 0, fontSize: 10, color: '#7BD389', fontWeight: 700 }}>잘한 점</p>
            <p style={{ margin: '4px 0 0', color: '#DDD', lineHeight: 1.4 }}>
              {feedback.strengths}
            </p>
          </div>
        )}
        {feedback.improvements && (
          <div
            style={{
              flex: 1,
              minWidth: 140,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            <p style={{ margin: 0, fontSize: 10, color: '#FF9F43', fontWeight: 700 }}>개선할 점</p>
            <p style={{ margin: '4px 0 0', color: '#DDD', lineHeight: 1.4 }}>
              {feedback.improvements}
            </p>
          </div>
        )}
      </div>
      {feedback.signature && (
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: judge.accentColor,
            fontStyle: 'italic',
            fontWeight: 600,
          }}
        >
          "{feedback.signature}"
        </p>
      )}
    </div>
  );
}

function computeOverall(rounds = {}) {
  const vals = Object.values(rounds).filter((v) => typeof v === 'number');
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function buildFallbackFeedbacks(agency) {
  const FALLBACKS = {
    hybe: [
      {
        summary: '음악적 진심은 보였지만 표현력의 일관성이 부족했습니다. 트레이닝 후 6개월 정도 보면 분명 성장 가능합니다.',
        strengths: '자기만의 색깔이 보임',
        improvements: '음정 안정성, 호흡 컨트롤',
        signature: '지금 실력이 아니라 6개월 후가 보입니다',
      },
      {
        summary: '진정성은 느껴졌어요. 다만 무대 위에서의 아우라가 더 필요합니다.',
        strengths: '꾸미지 않은 자연스러움',
        improvements: '무대 장악력, 표정 디테일',
        signature: '진짜를 찾고 있어요',
      },
      {
        summary: 'Globally speaking, vision이 조금 더 분명했으면 좋겠습니다.',
        strengths: '잠재력 있음',
        improvements: '글로벌 어필 포인트, 스타성',
        signature: 'HYBE is global. Can you be global too?',
      },
    ],
    yg: [
      {
        summary: '솔직히 말합니다. 지금 실력으로는 YG 무대에 설 수 없습니다. 처음 3초의 임팩트가 부족했습니다.',
        strengths: '의지는 보임',
        improvements: '실력, 임팩트, YG 감성 모두 부족',
        signature: '여기서 타협은 없어요',
      },
      {
        summary: 'BLACKPINK 안무 기준으로 보면 디테일이 부족합니다. 카운트마다 흐트러짐이 보였습니다.',
        strengths: '체력은 좋음',
        improvements: '동작 정확도, 표정 처리',
        signature: '춤은 기술이 아니라 태도입니다',
      },
      {
        summary: 'Real talk — 진정성은 느껴졌는데 기술이 따라가지 못했습니다. Keep practicing.',
        strengths: '진정성 OK',
        improvements: '플로우, 딜리버리',
        signature: 'Keep it real. YG는 가짜를 싫어해',
      },
    ],
    jyp: [
      {
        summary: '노래에서 살짝 습관이 느껴졌어요. 힘을 더 빼고 자연스럽게 부르면 훨씬 좋아질 거예요.',
        strengths: '음색이 매력적',
        improvements: '비브라토 줄이기, 공기 반 소리 반',
        signature: '노래에 습관이 없어야 합니다. 자연스럽게',
      },
      {
        summary: '에너지는 정말 좋았어요! 다만 후반부에 표정이 굳어졌어요.',
        strengths: '밝은 에너지, 즐기는 모습',
        improvements: '체력 관리, 안무 정확도',
        signature: '에너지 + 정확도 = JYP 댄서',
      },
      {
        summary: '인터뷰 답변에서 진정성이 느껴졌어요. JYP가 추구하는 좋은 사람의 모습이 보였습니다.',
        strengths: '겸손함, 솔직함',
        improvements: '구체적 목표 표현',
        signature: '좋은 사람이 좋은 아티스트가 됩니다',
      },
    ],
    sm: [
      {
        summary: 'SM 아우라는 보였습니다. 다만 비주얼 임팩트가 첫 3초에 부족했습니다.',
        strengths: '무대 매너, 음색의 특별함',
        improvements: '스타일링 방향, 시선 처리',
        signature: 'SM의 기준은 K-POP의 기준입니다',
      },
      {
        summary: '보컬 기본기는 좋습니다. 하지만 SMP 특유의 드라마틱한 표현이 부족했어요.',
        strengths: '발성, 호흡 안정',
        improvements: '감정 디테일, 시선 처리',
        signature: '기술 위에 예술, 예술 위에 아우라',
      },
      {
        summary: '미디어 어필 가능성은 보입니다. 카메라 앞에서 더 빛나는 연습이 필요해요.',
        strengths: '비주얼 베이스',
        improvements: '브랜드 정체성, 자기 표현',
        signature: '아이돌은 예술가이면서 브랜드입니다',
      },
    ],
    starship: [
      {
        summary: 'IVE처럼 균형 잡힌 매력이 보입니다. 실력과 대중성의 밸런스가 좋아요.',
        strengths: '대중성, 친근한 매력',
        improvements: '팀 시너지 연습',
        signature: '실력과 매력, 둘 다 있어야 합니다',
      },
      {
        summary: '기본기는 안정적입니다. 현장에서 바로 쓸 수 있는 실력에 가까워요.',
        strengths: '음정/리듬 안정',
        improvements: '체력 보강, 다양한 장르',
        signature: '기본이 없으면 아무것도 없어요',
      },
      {
        summary: '팬들이 사랑할 수 있는 친근한 매력이 보입니다. 자기 표현을 더 다듬으세요.',
        strengths: '진정성, 긍정 에너지',
        improvements: 'SNS 자기 표현',
        signature: '팬의 마음을 움직일 수 있어야 합니다',
      },
    ],
  };
  const list = FALLBACKS[agency.id] || FALLBACKS.starship;
  return agency.judges.map((j, idx) => ({
    judgeId: j.id,
    score: 65 + Math.floor(Math.random() * 25),
    ...list[idx % list.length],
  }));
}
