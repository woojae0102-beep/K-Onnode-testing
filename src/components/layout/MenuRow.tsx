// @ts-nocheck
import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function MenuRow({ icon, label, active = false, onClick, trailing = null, showChevron = false }) {
  const [hover, setHover] = React.useState(false);

  const background = active ? '#FFF0F7' : hover ? '#F5F5F5' : 'transparent';
  const color = active ? '#FF1F8E' : '#111111';

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 16px',
        borderRadius: 8,
        background,
        color,
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        transition: 'background 0.15s ease',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {trailing}
      {showChevron ? (
        <ChevronRight size={14} style={{ color: '#CCCCCC', flexShrink: 0 }} />
      ) : null}
    </button>
  );
}

export function SectionTitle({ children }) {
  return (
    <p
      style={{
        fontSize: 10,
        color: '#AAAAAA',
        padding: '12px 16px 4px',
        margin: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  );
}
