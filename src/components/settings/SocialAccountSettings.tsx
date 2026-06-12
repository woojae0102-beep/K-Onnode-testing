// @ts-nocheck
import React from 'react';
import { useSocialAuth } from '../../contexts/SocialAuthContext';

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', note: '쇼츠 업로드 / 채널 정보 조회' },
  { id: 'instagram', label: 'Instagram', note: '릴스 업로드, Business/Creator 계정 필요' },
  { id: 'tiktok', label: 'TikTok', note: 'Content Posting API 권한 필요' },
];

export default function SocialAccountSettings() {
  const {
    accounts,
    connectYouTube,
    connectInstagram,
    connectTikTok,
    disconnect,
    refreshStatus,
  } = useSocialAuth();
  const connectMap = { youtube: connectYouTube, instagram: connectInstagram, tiktok: connectTikTok };

  return (
    <section style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 16, padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>SNS 계정 연동</h3>
          <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6, color: '#777' }}>
            쇼츠 업로드 토큰은 서버와 Firestore에만 저장되고, 앱 화면에는 연결 상태만 표시됩니다.
          </p>
        </div>
        <button type="button" onClick={() => refreshStatus()} style={{ border: '1px solid #E5E5E5', background: '#F8F8FA', color: '#555', borderRadius: 999, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>
          새로고침
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLATFORMS.map((platform) => {
          const account = accounts?.[platform.id];
          const connected = account?.connected;
          return (
            <div key={platform.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid #EFEFEF', borderRadius: 12, background: '#FCFCFD' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 14, color: '#1a1a1a' }}>{platform.label}</strong>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: connected ? '#E8FFF4' : '#F2F2F2', color: connected ? '#00A36C' : '#888' }}>
                    {connected ? '연동됨' : '미연동'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
                  {connected ? `${account.accountName || platform.label} 계정으로 업로드합니다.` : platform.note}
                </p>
              </div>
              {connected ? (
                <button type="button" onClick={() => disconnect(platform.id)} style={{ border: '1px solid #FFD4D4', background: '#FFF5F5', color: '#D63031', borderRadius: 999, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>
                  해제
                </button>
              ) : (
                <button type="button" onClick={() => connectMap[platform.id]?.()} style={{ border: 'none', background: '#FF1F8E', color: '#fff', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  연동
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
