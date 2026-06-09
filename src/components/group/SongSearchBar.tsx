// @ts-nocheck
import React from 'react';

export function SongSearchBar({ value, onChange, placeholder = 'Search songs, artists, members' }) {
  return (
    <div className="group-studio-search">
      <span style={{ fontSize: 16, opacity: 0.5 }}>🔍</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="곡, 아티스트, 멤버 검색"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

export default SongSearchBar;
