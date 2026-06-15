// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useSocialAuth } from '../../contexts/SocialAuthContext';

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', note: '쇼츠 업로드 / 채널 정보 조회' },
  { id: 'instagram', label: 'Instagram', note: '릴스 업로드, Business/Creator 계정 필요' },
  { id: 'tiktok', label: 'TikTok', note: 'Content Posting API 권한 필요' },
];

function formatFirestoreDate(value) {
  const millis = value?._seconds ? value._seconds * 1000 : value?.seconds ? value.seconds * 1000 : null;
  if (!millis) return '';
  return new Date(millis).toLocaleDateString('ko-KR');
}

export default function SocialAccountSettings() {
  const {
    accounts,
    connectYouTube,
    connectInstagram,
    connectTikTok,
    disconnect,
    refreshStatus,
    lastError,
    setLastError,
  } = useSocialAuth();
  const [workingPlatform, setWorkingPlatform] = useState('');
  const [message, setMessage] = useState('');
  const connectMap = { youtube: connectYouTube, instagram: connectInstagram, tiktok: connectTikTok };

  useEffect(() => {
    if (lastError) setMessage(lastError);
  }, [lastError]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'ONNODE_SOCIAL_AUTH_SUCCESS') {
        setMessage(`${event.data.platform} 계정 연동이 완료되었습니다.`);
        setWorkingPlatform('');
      }
      if (event.data?.type === 'ONNODE_SOCIAL_AUTH_ERROR') {
        setMessage(event.data.error || 'SNS 연동에 실패했습니다.');
        setWorkingPlatform('');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const handleConnect = async (platform) => {
    setWorkingPlatform(platform);
    setMessage('');
    setLastError?.('');
    try {
      await connectMap[platform]?.();
      setMessage('인증 팝업을 열었습니다. 플랫폼 로그인을 완료해주세요.');
    } catch (err) {
      setMessage(err?.message || String(err));
      setWorkingPlatform('');
    }
  };

  const handleDisconnect = async (platform) => {
    setWorkingPlatform(platform);
    setMessage('');
    setLastError?.('');
    try {
      await disconnect(platform);
      setMessage(`${platform} 연동을 해제했습니다.`);
    } catch (err) {
      setMessage(err?.message || String(err));
    } finally {
      setWorkingPlatform('');
    }
  };

  const handleRefresh = async () => {
    setMessage('');
    try {
      await refreshStatus();
      setMessage('SNS 연동 상태를 새로고침했습니다.');
    } catch (err) {
      setMessage(err?.message || String(err));
    }
  };

  return (
    <section style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 16, padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>SNS 계정 연동</h3>
          <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6, color: '#777' }}>
            쇼츠 업로드 토큰은 서버와 Firestore에만 저장되고, 앱 화면에는 연결 상태만 표시됩니다.
          </p>
        </div>
        <button type="button" onClick={handleRefresh} style={{ border: '1px solid #E5E5E5', background: '#F8F8FA', color: '#555', borderRadius: 999, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>
          새로고침
        </button>
      </div>
      {message ? (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: message.includes('필요') || message.includes('실패') || message.includes('차단') || message.includes('오류') ? '#FFF5F5' : '#F2FFF8', border: `1px solid ${message.includes('필요') || message.includes('실패') || message.includes('차단') || message.includes('오류') ? '#FFD4D4' : '#CFF5DE'}`, color: message.includes('필요') || message.includes('실패') || message.includes('차단') || message.includes('오류') ? '#C0392B' : '#087A4A', fontSize: 12, lineHeight: 1.6 }}>
          {message}
        </div>
      ) : null}
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
                {connected && (platform.id === 'instagram' || platform.id === 'tiktok') ? (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: account.tokenRefreshStatus === 'failed' ? '#D63031' : '#999' }}>
                    {account.tokenRefreshStatus === 'failed'
                      ? `토큰 갱신 실패: ${account.tokenRefreshError || '다시 연동이 필요할 수 있습니다.'}`
                      : `자동 갱신 사용 중${formatFirestoreDate(account.expiresAt) ? ` · Access Token 만료 예정: ${formatFirestoreDate(account.expiresAt)}` : ''}`}
                  </p>
                ) : null}
              </div>
              {connected ? (
                <button type="button" onClick={() => handleDisconnect(platform.id)} disabled={workingPlatform === platform.id} style={{ border: '1px solid #FFD4D4', background: '#FFF5F5', color: '#D63031', borderRadius: 999, padding: '8px 12px', fontSize: 12, cursor: workingPlatform === platform.id ? 'not-allowed' : 'pointer', opacity: workingPlatform === platform.id ? 0.6 : 1 }}>
                  {workingPlatform === platform.id ? '처리 중' : '해제'}
                </button>
              ) : (
                <button type="button" onClick={() => handleConnect(platform.id)} disabled={workingPlatform === platform.id} style={{ border: 'none', background: '#FF1F8E', color: '#fff', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: workingPlatform === platform.id ? 'not-allowed' : 'pointer', opacity: workingPlatform === platform.id ? 0.65 : 1 }}>
                  {workingPlatform === platform.id ? '여는 중' : '연동'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
