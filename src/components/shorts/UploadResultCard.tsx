// @ts-nocheck
import React from 'react';

export default function UploadResultCard({ result }) {
  const ok = result?.success;
  return (
    <div style={{ padding: 16, borderRadius: 14, background: ok ? 'rgba(0,255,136,0.08)' : 'rgba(255,68,68,0.08)', border: `1px solid ${ok ? 'rgba(0,255,136,0.22)' : 'rgba(255,68,68,0.22)'}`, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', textTransform: 'capitalize' }}>{result?.platform}</div>
          <div style={{ fontSize: 12, color: ok ? '#00FF88' : '#FF6B6B', marginTop: 4 }}>
            {ok ? '업로드 완료' : result?.error || '업로드 실패'}
          </div>
        </div>
        {ok && result?.url ? (
          <a href={result.url} target="_blank" rel="noreferrer" style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: '#fff', textDecoration: 'none', fontSize: 12 }}>
            열기
          </a>
        ) : null}
      </div>
    </div>
  );
}
