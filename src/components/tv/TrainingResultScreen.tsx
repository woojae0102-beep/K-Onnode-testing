// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Agency, SessionData } from '../../types/tv';
import { AGENCY_COLORS } from '../../types/tv';
import { buildLocalCoachReview } from '../../utils/tvCoachReview';
import CoachReviewBlock from './CoachReviewBlock';
import PracticeComparisonPanel from '../common/PracticeComparisonPanel';
import PracticeResultActions from '../common/PracticeResultActions';

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
  comparison,
  onRetry,
  onHome,
}: {
  sessionData: SessionData | null;
  agency: Agency;
  comparison?: object | null;
  onRetry: () => void;
  onHome: () => void;
}) {
  const { t } = useTranslation();
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
          <p className="tv-result-eyebrow">{t('tv.result.eyebrow')}</p>
          <h1 className="tv-result-title">{t('tv.result.title')}</h1>
          <p className="tv-result-meta">
            {agency.toUpperCase()} · {mins}:{secs}
          </p>
        </header>

        <div className="tv-result-score-card">
          <span className="tv-result-score-label">{t('tv.result.overallScore')}</span>
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

        <PracticeComparisonPanel comparison={comparison} accent={agencyColor} dark />

        {data.weaknesses?.length > 0 ? (
          <section className="tv-result-section">
            <h2 className="tv-result-section-title">{t('tv.result.weaknesses')}</h2>
            {data.weaknesses.map((w, i) => (
              <div key={i} className="tv-result-item tv-result-item-warn">
                {w}
              </div>
            ))}
          </section>
        ) : null}

        {feedbackList.length > 0 ? (
          <section className="tv-result-section">
            <h2 className="tv-result-section-title">{t('tv.result.feedbackLog')}</h2>
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
            <h2 className="tv-result-section-title">{t('tv.result.recommendations')}</h2>
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

        <PracticeResultActions onRetry={onRetry} onHome={onHome} accent={agencyColor} dark />
      </div>
    </div>
  );
}

export default TrainingResultScreen;
