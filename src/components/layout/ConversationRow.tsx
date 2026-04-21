// @ts-nocheck
import React from 'react';

function getInitials(name) {
  if (!name) return '?';
  const trimmed = String(name).trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return trimmed.slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function ConversationRow({ conversation, active = false, onClick }) {
  const [hover, setHover] = React.useState(false);
  const { name, online, unread, lastMessage, timestamp } = conversation;

  const background = active ? '#FFF0F7' : hover ? '#F5F5F5' : 'transparent';

  return (
    <button
      type="button"
      onClick={() => onClick?.(conversation)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        borderRadius: 8,
        background,
        color: '#111111',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#FF1F8E18',
            color: '#FF1F8E',
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {getInitials(name)}
        </div>
        {online ? (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              right: -1,
              bottom: -1,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#22C55E',
              border: '2px solid #FFFFFF',
            }}
          />
        ) : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: '#111111',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </p>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: 12,
            color: '#888888',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {lastMessage || ''}
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: '#AAAAAA' }}>{formatTimestamp(timestamp)}</span>
        {unread > 0 ? (
          <span
            style={{
              minWidth: 18,
              height: 18,
              padding: '0 6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 9,
              background: '#FF1F8E',
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {unread}
          </span>
        ) : null}
      </div>
    </button>
  );
}
