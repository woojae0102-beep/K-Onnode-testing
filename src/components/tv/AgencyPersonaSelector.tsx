// @ts-nocheck
import React from 'react';
import type { Agency } from '../../types/tv';
import { getAllAgencies, getAgencyInfo } from '../../hooks/useAgencyPersona';

export function AgencyPersonaSelector({
  selected,
  onSelect,
}: {
  selected: Agency;
  onSelect: (agency: Agency) => void;
}) {
  const agencies = getAllAgencies();

  return (
    <div style={{ width: '100%', maxWidth: 560 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          marginBottom: 16,
          textAlign: 'center',
        }}
      >
        코치 기획사 선택
      </div>
      <div
        className="tv-entry-agencies"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}
      >
        {agencies.map((agency) => {
          const info = getAgencyInfo(agency);
          const isSelected = selected === agency;
          return (
            <button
              key={agency}
              type="button"
              onClick={() => onSelect(agency)}
              style={{
                padding: '16px 8px',
                background: isSelected ? `${info.color}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isSelected ? info.color : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isSelected ? `0 0 20px ${info.color}40` : 'none',
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: isSelected ? info.color : 'rgba(255,255,255,0.6)',
                  marginBottom: 6,
                }}
              >
                {info.name}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                {info.focus}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AgencyPersonaSelector;
