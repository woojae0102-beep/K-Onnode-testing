// @ts-nocheck
import React from 'react';
import type { Agency, FeedbackItem } from '../../types/tv';
import { useAgencyPersona } from '../../hooks/useAgencyPersona';

export function RealtimeFeedbackPanel({
  feedback,
  agency,
  agencyColor,
}: {
  feedback: FeedbackItem[];
  agency: Agency;
  agencyColor: string;
}) {
  const persona = useAgencyPersona(agency);

  return (
    <div
      className="tv-panel"
      style={{
        background: '#0a0a14',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#FF1F8E',
              boxShadow: '0 0 8px #FF1F8E',
              animation: 'tv-pulse 1.5s infinite',
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
            }}
          >
            실시간 피드백
          </span>
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
          {persona.coachName.replace(' 코치', '')} · {persona.feedbackStyle}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 0,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {feedback.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.2)',
              fontSize: 13,
            }}
          >
            트레이닝을 시작하면 피드백이 나타납니다
          </div>
        ) : (
          feedback.map((item, i) => (
            <div
              key={`${item.timestamp}-${i}`}
              style={{
                padding: '10px 12px',
                background:
                  item.type === 'correction'
                    ? 'rgba(255,68,68,0.08)'
                    : item.type === 'praise'
                      ? 'rgba(0,255,136,0.08)'
                      : 'rgba(255,255,255,0.04)',
                border: `1px solid ${
                  item.type === 'correction'
                    ? 'rgba(255,68,68,0.2)'
                    : item.type === 'praise'
                      ? 'rgba(0,255,136,0.2)'
                      : 'rgba(255,255,255,0.06)'
                }`,
                borderRadius: 10,
                borderLeft: `3px solid ${
                  item.type === 'correction'
                    ? '#FF4444'
                    : item.type === 'praise'
                      ? '#00FF88'
                      : agencyColor
                }`,
                animation: i === 0 ? 'tv-fadeIn 0.3s ease' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>
                  {item.type === 'correction' ? '⚠️' : item.type === 'praise' ? '✨' : '💬'}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color:
                      item.type === 'correction'
                        ? '#FF4444'
                        : item.type === 'praise'
                          ? '#00FF88'
                          : agencyColor,
                  }}
                >
                  {item.type === 'correction' ? '교정' : item.type === 'praise' ? '칭찬' : '코칭'}
                  {item.isAI ? ' · AI' : ''}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  {item.timestamp}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.5, fontWeight: 400 }}>
                {item.message}
              </div>
              {item.accuracy != null && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  정확도: {item.accuracy}%
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RealtimeFeedbackPanel;
