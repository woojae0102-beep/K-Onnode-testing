// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import type { Agency, SessionData } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';

const SCORE_LABELS = {
  rhythm: '리듬',
  posture: '자세',
  angle: '각도',
  expression: '표현력',
  energy: '에너지',
  stability: '안정성',
};

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

export function TrainingResultScreen({
  sessionData,
  agency,
  onRetry,
  onHome,
}: {
  sessionData: SessionData | null;
  agency: Agency;
  onRetry: () => void;
  onHome: () => void;
}) {
  const agencyColor = AGENCY_COLORS[agency];
  const data = sessionData || {
    overallScore: 0,
    scores: {},
    growthRate: 0,
    strengths: [],
    weaknesses: [],
    recommendations: [],
    passProbability: 0,
    sessionTime: 0,
  };

  const animatedScore = useCountUp(data.overallScore);

  const radarData = useMemo(
    () =>
      Object.entries(SCORE_LABELS).map(([key, label]) => ({
        subject: label,
        score: data.scores?.[key] || 0,
      })),
    [data.scores],
  );

  const growthPositive = data.growthRate >= 0;

  return (
    <div
      className="tv-mode"
      style={{
        minHeight: '100vh',
        background: '#030308',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${agencyColor}15 0%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 48px', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            연습생 리포트
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>TV 트레이닝 세션 완료</div>
          <div style={{ fontSize: 13, color: agencyColor, marginTop: 6 }}>
            {agency.toUpperCase()} 코치 평가
          </div>
        </div>

        {/* 종합 점수 */}
        <div
          className="tv-panel"
          style={{
            padding: 28,
            textAlign: 'center',
            marginBottom: 16,
            border: `1px solid ${agencyColor}33`,
          }}
        >
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
            오늘 종합 점수
          </div>
          <div
            className="neon-text"
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: animatedScore > 80 ? '#00FF88' : animatedScore > 60 ? '#FFD700' : '#FF4444',
              lineHeight: 1,
            }}
          >
            {animatedScore}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>/ 100</div>
        </div>

        {/* 성장률 */}
        <div
          className="tv-panel"
          style={{
            padding: 20,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>전주 대비 성장률</span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: growthPositive ? '#00FF88' : '#FF4444',
            }}
          >
            {growthPositive ? '↑' : '↓'} {Math.abs(data.growthRate)}%
          </span>
        </div>

        {/* 레이더 차트 */}
        <div className="tv-panel" style={{ padding: 20, marginBottom: 16, height: 280 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
            항목별 분석
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <Radar
                dataKey="score"
                stroke={agencyColor}
                fill={agencyColor}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* 강점 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#00FF88', marginBottom: 8, fontWeight: 600 }}>
            강점 TOP 2
          </div>
          {data.strengths.map((s, i) => (
            <div
              key={i}
              style={{
                padding: '14px 16px',
                background: 'rgba(0,255,136,0.08)',
                border: '1px solid rgba(0,255,136,0.2)',
                borderRadius: 10,
                marginBottom: 8,
                fontSize: 14,
              }}
            >
              ✨ {s}
            </div>
          ))}
        </div>

        {/* 약점 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#FF4444', marginBottom: 8, fontWeight: 600 }}>
            개선 필요 TOP 2
          </div>
          {data.weaknesses.map((w, i) => (
            <div
              key={i}
              style={{
                padding: '14px 16px',
                background: 'rgba(255,68,68,0.08)',
                border: '1px solid rgba(255,68,68,0.2)',
                borderRadius: 10,
                marginBottom: 8,
                fontSize: 14,
              }}
            >
              ⚠️ {w}
            </div>
          ))}
        </div>

        {/* 합격 가능성 */}
        <div className="tv-panel" style={{ padding: 20, marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 10,
              fontSize: 13,
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>
              {agency.toUpperCase()} 기준 합격 가능성
            </span>
            <span style={{ color: agencyColor, fontWeight: 700 }}>{data.passProbability}%</span>
          </div>
          <div
            style={{
              height: 8,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${data.passProbability}%`,
                background: `linear-gradient(90deg, ${agencyColor}, #FF1F8E)`,
                borderRadius: 4,
                transition: 'width 1s ease',
                boxShadow: `0 0 12px ${agencyColor}60`,
              }}
            />
          </div>
        </div>

        {/* 추천 과제 */}
        <div className="tv-panel" style={{ padding: 20, marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
            다음 주 추천 연습 과제
          </div>
          {data.recommendations.map((rec, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                marginBottom: 10,
                fontSize: 14,
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: `${agencyColor}22`,
                  border: `1px solid ${agencyColor}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  flexShrink: 0,
                  color: agencyColor,
                }}
              >
                {i + 1}
              </span>
              {rec}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: '16px',
              background: `linear-gradient(135deg, ${agencyColor}, #FF1F8E)`,
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: `0 0 30px ${agencyColor}40`,
            }}
          >
            다시 도전
          </button>
          <button
            type="button"
            onClick={onHome}
            style={{
              padding: '16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}

export default TrainingResultScreen;
