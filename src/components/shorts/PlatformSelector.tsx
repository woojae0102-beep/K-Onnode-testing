// @ts-nocheck
import React from 'react';
import { useSocialAuth } from '../../contexts/SocialAuthContext';

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube 쇼츠', color: '#FF0000', desc: '60초 이하 세로 영상은 쇼츠로 분류됩니다.' },
  { id: 'instagram', label: 'Instagram 릴스', color: '#E1306C', desc: '비즈니스/크리에이터 계정이 필요합니다.' },
  { id: 'tiktok', label: 'TikTok', color: '#010101', desc: 'TikTok Content Posting API 권한이 필요합니다.' },
];

export default function PlatformSelector({ selectedPlatforms, onSelect, onUpload, onBack }) {
  const { isConnected, connectYouTube, connectInstagram, connectTikTok } = useSocialAuth();
  const connectMap = { youtube: connectYouTube, instagram: connectInstagram, tiktok: connectTikTok };

  const toggle = (id) => {
    if (!isConnected(id)) return;
    onSelect?.(
      selectedPlatforms.includes(id)
        ? selectedPlatforms.filter((p) => p !== id)
        : [...selectedPlatforms, id],
    );
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>어디에 올릴까요?</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>연동된 계정만 선택할 수 있습니다.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {PLATFORMS.map((platform) => {
          const connected = isConnected(platform.id);
          const selected = selectedPlatforms.includes(platform.id);
          return (
            <div
              key={platform.id}
              onClick={() => toggle(platform.id)}
              style={{ padding: 16, borderRadius: 14, background: selected ? `${platform.color}20` : 'rgba(255,255,255,0.045)', border: `1px solid ${selected ? `${platform.color}88` : 'rgba(255,255,255,0.08)'}`, cursor: connected ? 'pointer' : 'default' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${selected ? platform.color : 'rgba(255,255,255,0.2)'}`, background: selected ? platform.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800 }}>
                  {selected ? '✓' : ''}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{platform.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 3 }}>{platform.desc}</div>
                </div>
                {connected ? (
                  <span style={{ fontSize: 11, color: '#00FF88', padding: '4px 9px', borderRadius: 999, background: 'rgba(0,255,136,0.1)' }}>연동됨</span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      connectMap[platform.id]?.();
                    }}
                    style={{ padding: '7px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12, cursor: 'pointer' }}
                  >
                    연동하기
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onBack} style={{ flex: 0.42, padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer' }}>
          이전
        </button>
        <button type="button" onClick={onUpload} disabled={!selectedPlatforms.length} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: selectedPlatforms.length ? 'linear-gradient(135deg, #FF1F8E, #6C5CE7)' : 'rgba(255,255,255,0.09)', color: '#fff', fontWeight: 800, cursor: selectedPlatforms.length ? 'pointer' : 'not-allowed' }}>
          {selectedPlatforms.length ? `${selectedPlatforms.length}개 플랫폼 업로드` : '플랫폼을 선택하세요'}
        </button>
      </div>
    </div>
  );
}
