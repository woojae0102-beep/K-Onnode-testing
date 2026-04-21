// @ts-nocheck
import React from 'react';

export default function PlaceholderView({ title, description, badge }) {
  return (
    <div
      style={{
        padding: 24,
        maxWidth: 860,
        margin: '0 auto',
        minHeight: '100%',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #F0F0F0',
          borderRadius: 12,
          padding: 28,
        }}
      >
        {badge ? (
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 20,
              background: '#FF1F8E18',
              color: '#FF1F8E',
              marginBottom: 12,
              letterSpacing: '0.04em',
            }}
          >
            {badge}
          </span>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            color: '#111111',
            lineHeight: 1.35,
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13,
              color: '#888888',
              lineHeight: 1.6,
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
