// @ts-nocheck
import React, { useEffect, useState } from 'react';
import type { Agency, SessionData } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';
import { buildLocalCoachReview } from '../../utils/tvCoachReview';
import CoachReviewBlock from './CoachReviewBlock';

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.max(1, Math.ceil(target / (duration / 16)));
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
    feedback: [],
    coachReview: '',
  };

  const animatedScore = useCountUp(data.overallScore);
  const coachReview = data.coachReview || buildLocalCoachReview(data);
  const feedbackList = data.feedback || [];

  const mins = Math.floor((data.sessionTime || 0) / 60)
    .toString()
    .padStart(2, '0');
  const secs = ((data.sessionTime || 0) % 60).toString().padStart(2, '0');

  return (
    <div className="tv-mode tv-result-screen">
      <div className="tv-result-inner">
        <header className="tv-result-header">
          <p className="tv-result-eyebrow">연습 완료</p>
          <h1 className="tv-result-title">코치 피드백</h1>
          <p className="tv-result-meta">
            {agency.toUpperCase()} · {mins}:{secs}
          </p>
        </header>

        <div className="tv-result-score-card">
          <span className="tv-result-score-label">종합 점수</span>
          <span
            className="tv-result-score-value"
            style={{
              color: animatedScore > 80 ? '#00FF88' : animatedScore > 60 ? '#FFD700' : '#FF8888',
            }}
          >
            {animatedScore}
          </span>
        </div>

        <CoachReviewBlock agency={agency} reviewText={coachReview} />

        {data.weaknesses?.length > 0 ? (
          <section className="tv-result-section">
            <h2 className="tv-result-section-title">보완이 필요한 부분</h2>
            {data.weaknesses.map((w, i) => (
              <div key={i} className="tv-result-item tv-result-item-warn">
                {w}
              </div>
            ))}
          </section>
        ) : null}

        {feedbackList.length > 0 ? (
          <section className="tv-result-section">
            <h2 className="tv-result-section-title">연습 중 분석 기록</h2>
            {feedbackList.slice(0, 6).map((fb, i) => (
              <div key={i} className="tv-result-item">
                <span className="tv-result-fb-time">{fb.timestamp}</span>
                <span>{fb.message}</span>
              </div>
            ))}
          </section>
        ) : null}

        {data.recommendations?.length > 0 ? (
          <section className="tv-result-section">
            <h2 className="tv-result-section-title">다음 연습 추천</h2>
            {data.recommendations.map((rec, i) => (
              <div key={i} className="tv-result-item">
                <span className="tv-result-rec-num" style={{ color: agencyColor }}>
                  {i + 1}
                </span>
                {rec}
              </div>
            ))}
          </section>
        ) : null}

        <div className="tv-result-actions">
          <button
            type="button"
            className="tv-result-btn tv-result-btn-primary"
            style={{ background: agencyColor }}
            onClick={onRetry}
          >
            다시 연습
          </button>
          <button type="button" className="tv-result-btn tv-result-btn-secondary" onClick={onHome}>
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}

export default TrainingResultScreen;
