// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TRACK_COLORS } from '../../mocks/reportMocks';

const TRACK_LABEL_KEY = {
  dance: 'report.trackDance',
  vocal: 'report.trackVocal',
  korean: 'report.trackKorean',
};

export default function RecommendedContent({ items = [], onSelect }) {
  const { t } = useTranslation();
  if (!items.length) return null;
  return (
    <div>
      <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#111111' }}>
        {t('report.sections.content')}
      </p>
      <div
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 6,
          marginRight: -16,
          paddingRight: 16,
        }}
      >
        {items.map((item) => {
          const accent = TRACK_COLORS[item.track] || '#FF1F8E';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect?.(item)}
              style={{
                flexShrink: 0,
                width: 160,
                background: '#FFFFFF',
                border: '0.5px solid #E5E5E5',
                borderRadius: 12,
                padding: 10,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  height: 80,
                  borderRadius: 8,
                  background: item.thumbnailColor || '#F5F5F7',
                  marginBottom: 8,
                }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#111111',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.title}
              </p>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 6,
                  fontSize: 10,
                  padding: '2px 7px',
                  borderRadius: 12,
                  background: `${accent}1A`,
                  color: accent,
                  fontWeight: 500,
                }}
              >
                {t(TRACK_LABEL_KEY[item.track] || 'report.trackDance')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
