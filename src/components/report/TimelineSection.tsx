// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';

const KIND_COLOR = {
  good: '#1DB971',
  warn: '#F59E0B',
  bad: '#EF4444',
};

export default function TimelineSection({ items = [] }) {
  const { t } = useTranslation();
  if (!items.length) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: '#888888' }}>
        {t('report.noTimeline')}
      </p>
    );
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          bottom: 6,
          width: 1,
          background: '#E5E5E5',
        }}
      />
      {items.map((item, idx) => {
        const dotColor = KIND_COLOR[item.kind] || '#888888';
        return (
          <div
            key={`${item.startTime}-${idx}`}
            style={{ position: 'relative', paddingBottom: 14 }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: -18,
                top: 4,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: dotColor,
                border: '2px solid #FFFFFF',
                boxShadow: '0 0 0 1px #E5E5E5',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, color: '#888888' }}>
                  {item.startTime} ~ {item.endTime}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#111111' }}>{item.comment}</p>
              </div>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 12,
                  background: `${dotColor}1A`,
                  color: dotColor,
                }}
              >
                {t('report.score', { value: item.score })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
