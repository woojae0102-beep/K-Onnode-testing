// @ts-nocheck
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from './AuthContext';

const SocialAuthContext = createContext(null);

const CALLBACKS = {
  youtube: '/auth/youtube/callback',
  instagram: '/auth/instagram/callback',
  tiktok: '/auth/tiktok/callback',
};

async function getIdToken() {
  const user = await waitForAuthUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  return user.getIdToken();
}

async function waitForAuthUser(timeoutMs = 8000) {
  if (auth?.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    if (!auth) {
      reject(new Error('Firebase Auth가 초기화되지 않았습니다.'));
      return;
    }
    const timeout = window.setTimeout(() => {
      unsub();
      reject(new Error('로그인 상태 확인 시간이 초과되었습니다. 다시 로그인 후 시도해주세요.'));
    }, timeoutMs);
    const unsub = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsub();
      resolve(user);
    }, (err) => {
      window.clearTimeout(timeout);
      unsub();
      reject(err);
    });
  });
}

function openPopup(url, title) {
  const popup = window.open(url, title, 'width=520,height=720,scrollbars=yes,resizable=yes');
  if (!popup) {
    throw new Error('브라우저가 팝업을 차단했습니다. 팝업을 허용한 뒤 다시 연동해주세요.');
  }
  popup.focus?.();
  return popup;
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64Url(array);
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64Url(new Uint8Array(digest));
}

export function SocialAuthProvider({ children }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState('');

  const refreshStatus = useCallback(async () => {
    if (!auth?.currentUser) {
      setAccounts({});
      return {};
    }
    const idToken = await getIdToken();
    const res = await fetch('/api/auth/social/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'SNS 연동 상태를 불러오지 못했습니다.');
    const next = data.accounts || {};
    setAccounts(next);
    return next;
  }, []);

  useEffect(() => {
    if (!user) {
      setAccounts({});
      return;
    }
    refreshStatus().catch(() => {});
  }, [user, refreshStatus]);

  const connectYouTube = useCallback(async () => {
    setLastError('');
    await getIdToken();
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID가 필요합니다.');
    const redirectUri = `${window.location.origin}${CALLBACKS.youtube}`;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ].join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', 'youtube');
    return openPopup(authUrl.toString(), 'YouTube 연동');
  }, []);

  const connectInstagram = useCallback(async () => {
    setLastError('');
    await getIdToken();
    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    if (!appId) throw new Error('VITE_FACEBOOK_APP_ID가 필요합니다.');
    const redirectUri = `${window.location.origin}${CALLBACKS.instagram}`;
    const scope = ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement', 'pages_show_list'].join(',');
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', 'instagram');
    return openPopup(authUrl.toString(), 'Instagram 연동');
  }, []);

  const connectTikTok = useCallback(async () => {
    setLastError('');
    await getIdToken();
    const clientKey = import.meta.env.VITE_TIKTOK_CLIENT_KEY;
    if (!clientKey) throw new Error('VITE_TIKTOK_CLIENT_KEY가 필요합니다.');
    const redirectUri = `${window.location.origin}${CALLBACKS.tiktok}`;
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem('onnode_tiktok_code_verifier', verifier);
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.set('client_key', clientKey);
    authUrl.searchParams.set('scope', 'user.info.basic,video.publish,video.upload');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', 'tiktok');
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    return openPopup(authUrl.toString(), 'TikTok 연동');
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const platform = Object.entries(CALLBACKS).find(([, callbackPath]) => callbackPath === path)?.[0];
    if (!platform) return;
    const run = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams(window.location.search);
        const code = qs.get('code');
        if (!code) throw new Error('OAuth code가 없습니다.');
        const idToken = await getIdToken();
        const codeVerifier = platform === 'tiktok' ? sessionStorage.getItem('onnode_tiktok_code_verifier') : '';
        const res = await fetch('/api/auth/social/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            platform,
            code,
            codeVerifier,
            redirectUri: `${window.location.origin}${CALLBACKS[platform]}`,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'SNS 연동에 실패했습니다.');
        window.opener?.postMessage({ type: 'ONNODE_SOCIAL_AUTH_SUCCESS', platform, account: data.account }, window.location.origin);
        window.close();
      } catch (err) {
        const message = err?.message || String(err);
        setLastError(message);
        window.opener?.postMessage({ type: 'ONNODE_SOCIAL_AUTH_ERROR', platform, error: message }, window.location.origin);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'ONNODE_SOCIAL_AUTH_SUCCESS') {
        setLastError('');
        refreshStatus().catch(() => {});
      }
      if (event.data?.type === 'ONNODE_SOCIAL_AUTH_ERROR') {
        setLastError(event.data.error || 'SNS 연동에 실패했습니다.');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refreshStatus]);

  const disconnect = useCallback(async (platform) => {
    const idToken = await getIdToken();
    await fetch('/api/auth/social/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, platform }),
    });
    await refreshStatus();
  }, [refreshStatus]);

  const isConnected = useCallback((platform) => accounts?.[platform]?.connected === true, [accounts]);

  const value = useMemo(() => ({
    accounts,
    loading,
    lastError,
    setLastError,
    connectYouTube,
    connectInstagram,
    connectTikTok,
    disconnect,
    isConnected,
    refreshStatus,
  }), [accounts, loading, lastError, connectYouTube, connectInstagram, connectTikTok, disconnect, isConnected, refreshStatus]);

  const callbackPlatform = typeof window !== 'undefined'
    ? Object.entries(CALLBACKS).find(([, callbackPath]) => callbackPath === window.location.pathname)?.[0]
    : null;

  if (callbackPlatform) {
    return (
      <SocialAuthContext.Provider value={value}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#fff', padding: 24, textAlign: 'center' }}>
          <div style={{ maxWidth: 420, width: '100%', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: 24, background: 'rgba(255,255,255,0.06)' }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>SNS 계정 연동 처리 중</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
              {lastError || `${callbackPlatform} 인증 정보를 저장하고 있습니다. 잠시만 기다려주세요.`}
            </p>
            {lastError ? (
              <button type="button" onClick={() => window.close()} style={{ marginTop: 16, border: 'none', borderRadius: 999, background: '#FF1F8E', color: '#fff', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>
                창 닫기
              </button>
            ) : null}
          </div>
        </div>
      </SocialAuthContext.Provider>
    );
  }

  return <SocialAuthContext.Provider value={value}>{children}</SocialAuthContext.Provider>;
}

export function useSocialAuth() {
  const ctx = useContext(SocialAuthContext);
  if (!ctx) throw new Error('useSocialAuth must be used inside SocialAuthProvider');
  return ctx;
}

export default SocialAuthContext;
