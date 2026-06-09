// @ts-nocheck
import React, { useMemo } from 'react';
import PracticeComparisonPanel from '../common/PracticeComparisonPanel';
import PracticeResultActions from '../common/PracticeResultActions';

export default function KoreanSessionResult({
  mode,
  feedback,
  metrics,
  songTitle,
  comparison,
  onRetry,
  onHome,
}) {
  const overall = Math.round(metrics?.overall ?? metrics?.accuracy ?? feedback?.score ?? 0);
  const modeLabel = {
    pronunciation: '발음 연습',
    follow: '따라 읽기',
    correction: '교정 연습',
    lyricsVocab: '가사·어휘',
  }[mode] || '한국어 연습';

  const coachText = feedback?.summary || feedback?.feedback || feedback?.message || '연습이 완료되었습니다.';

  const scoreColor = overall > 80 ? '#00B894' : overall > 60 ? '#F9CA24' : '#FF4757';

  return (
    <div
      style={{
        marginTop: 16,
        padding: 20,
        background: '#fff',
        border: '1px solid #E5E5E5',
        borderRadius: 16,
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '0.15em', color: '#888', textTransform: 'uppercase' }}>
        연습 완료
      </p>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>
        {modeLabel} 피드백
      </h2>
      {songTitle ? (
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#888' }}>{songTitle}</p>
      ) : null}

      {overall > 0 ? (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{overall}</div>
          <div style={{ fontSize: 11, color: '#aaa', letterSpacing: '0.1em' }}>PRACTICE SCORE</div>
        </div>
      ) : null}

      <PracticeComparisonPanel comparison={comparison} accent="#FF1F8E" dark={false} />

      <div
        style={{
          padding: 14,
          background: '#F8F8FA',
          borderRadius: 12,
          fontSize: 14,
          lineHeight: 1.7,
          color: '#444',
          marginBottom: 8,
        }}
      >
        {coachText}
      </div>

      <PracticeResultActions
        onRetry={onRetry}
        onHome={onHome}
        dark={false}
        accent="#FF1F8E"
      />
    </div>
  );
}
