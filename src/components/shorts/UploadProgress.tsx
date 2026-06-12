// @ts-nocheck
import React from 'react';

export default function UploadProgress({ platforms = [], progressByPlatform = {}, storageProgress = 0 }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>업로드 중</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 22 }}>Firebase Storage에 저장한 뒤 플랫폼에 순차 업로드합니다.</div>
      <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#fff', marginBottom: 8 }}>
          <span>임시 영상 저장</span>
          <span>{storageProgress}%</span>
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${storageProgress}%`, height: '100%', background: '#00FF88' }} />
        </div>
      </div>
      {platforms.map((platform) => {
        const pct = progressByPlatform[platform] || 0;
        return (
          <div key={platform} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#fff', marginBottom: 8 }}>
              <span>{platform}</span>
              <span>{pct}%</span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #FF1F8E, #6C5CE7)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
