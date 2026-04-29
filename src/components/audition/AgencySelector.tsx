// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AGENCY_AUDITIONS } from '../../data/agencyAuditions';

export default function AgencySelector({ onSelect }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        minHeight: '100%',
        background: '#0A0A0A',
        padding: 'clamp(16px, 4vw, 40px) clamp(14px, 3vw, 24px)',
        boxSizing: 'border-box',
        color: '#FFFFFF',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1
          style={{
            fontSize: 'clamp(20px, 5vw, 28px)',
            fontWeight: 800,
            margin: '0 0 8px',
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
          }}
        >
          🏆 {t('audition.agencyAudition', { defaultValue: '기획사 오디션' })}
        </h1>
        <p style={{ fontSize: 13, color: '#A0A0A0', margin: '0 0 20px' }}>
          {t('audition.selectAgency', { defaultValue: '오디션 볼 기획사를 선택하세요' })}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
            gap: 12,
          }}
        >
          {AGENCY_AUDITIONS.map((agency) => (
            <AgencyCard key={agency.id} agency={agency} onClick={() => onSelect?.(agency.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgencyCard({ agency, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        background: '#1A1A1A',
        border: `1px solid ${hover ? agency.accentColor : '#333'}`,
        borderRadius: 16,
        padding: 20,
        cursor: 'pointer',
        color: '#FFFFFF',
        transition: 'all 0.2s ease',
        boxShadow: hover ? `0 8px 28px ${agency.accentColor}40` : 'none',
        transform: hover ? 'translateY(-2px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 32, lineHeight: 1 }}>{agency.logo}</div>

      <div>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>
          {agency.name}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>{agency.subName}</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {agency.knownArtists.slice(0, 3).map((a) => (
          <span
            key={a}
            style={{
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 999,
              background: `${agency.accentColor}22`,
              color: agency.accentColor,
              fontWeight: 600,
            }}
          >
            {a}
          </span>
        ))}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: '#CCCCCC',
          lineHeight: 1.5,
          minHeight: 36,
        }}
      >
        {agency.philosophy}
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTop: '1px solid #2A2A2A',
        }}
      >
        <span style={{ fontSize: 11, color: '#888' }}>
          합격 기준 <strong style={{ color: agency.accentColor, fontSize: 13 }}>{agency.passingScore}점</strong>
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {agency.judges.map((j) => (
            <div
              key={j.id}
              title={`${j.name} · ${j.title}`}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: '#0A0A0A',
                border: `1.5px solid ${j.accentColor}`,
                display: 'grid',
                placeItems: 'center',
                fontSize: 14,
              }}
            >
              {j.avatar}
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}
