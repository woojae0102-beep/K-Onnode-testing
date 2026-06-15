const { getAdmin } = require('../_lib/firebaseAdmin');

const PLATFORM_COLLECTION = 'social_accounts';

function getRoute(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get('path') || '';
}

function json(res, code, body) {
  return res.status(code).json(body);
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return {};
}

async function verifyUser(idToken) {
  const { admin, error } = getAdmin();
  if (!admin) throw new Error(error || 'Firebase Admin 초기화 실패');
  if (!idToken) throw new Error('idToken이 필요합니다.');
  const decoded = await admin.auth().verifyIdToken(idToken);
  return { admin, uid: decoded.uid };
}

async function exchangeYouTubeCode({ code, redirectUri }) {
  const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth 환경 변수가 필요합니다.');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
  });
  const token = await res.json();
  if (!res.ok) throw new Error(token.error_description || token.error || 'YouTube 토큰 교환 실패');

  let account = { accountName: 'YouTube', accountId: '' };
  if (token.access_token) {
    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const channel = await channelRes.json().catch(() => ({}));
    const item = channel.items?.[0];
    if (item) account = { accountName: item.snippet?.title || 'YouTube', accountId: item.id || '' };
  }
  return { token, account };
}

async function exchangeInstagramCode({ code, redirectUri }) {
  const appId = process.env.VITE_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Facebook OAuth 환경 변수가 필요합니다.');
  const shortRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  }).toString()}`);
  const shortToken = await shortRes.json();
  if (!shortRes.ok) throw new Error(shortToken.error?.message || 'Instagram 토큰 교환 실패');
  const longRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken.access_token,
  }).toString()}`);
  const longToken = await longRes.json();
  if (!longRes.ok) throw new Error(longToken.error?.message || 'Instagram long-lived 토큰 교환 실패');

  const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(longToken.access_token)}`);
  const pages = await pagesRes.json().catch(() => ({}));
  const firstPage = pages.data?.[0];
  let account = { accountName: 'Instagram', accountId: '' };
  if (firstPage?.id) {
    const igRes = await fetch(`https://graph.facebook.com/v18.0/${firstPage.id}?fields=instagram_business_account,name&access_token=${encodeURIComponent(firstPage.access_token || longToken.access_token)}`);
    const ig = await igRes.json().catch(() => ({}));
    account = {
      accountName: ig.name || firstPage.name || 'Instagram',
      accountId: ig.instagram_business_account?.id || firstPage.id,
      pageId: firstPage.id,
      pageAccessToken: firstPage.access_token,
    };
  }
  return { token: longToken, account };
}

async function exchangeTikTokCode({ code, redirectUri, codeVerifier }) {
  const clientKey = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error('TikTok OAuth 환경 변수가 필요합니다.');
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier || '',
    }).toString(),
  });
  const token = await res.json();
  if (!res.ok) throw new Error(token.error_description || token.error || 'TikTok 토큰 교환 실패');
  const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const user = await userRes.json().catch(() => ({}));
  return {
    token,
    account: {
      accountName: user.data?.user?.display_name || 'TikTok',
      accountId: user.data?.user?.open_id || token.open_id || '',
    },
  };
}

async function saveAccount(admin, uid, platform, token, account) {
  const db = admin.firestore();
  const ref = db.collection('users').doc(uid).collection(PLATFORM_COLLECTION).doc(platform);
  const expiresIn = Number(token.expires_in || 0) || null;
  const expiresAt = expiresIn
    ? admin.firestore.Timestamp.fromMillis(Date.now() + expiresIn * 1000)
    : null;
  const refreshExpiresIn = Number(token.refresh_expires_in || 0) || null;
  const refreshExpiresAt = refreshExpiresIn
    ? admin.firestore.Timestamp.fromMillis(Date.now() + refreshExpiresIn * 1000)
    : null;
  await ref.set({
    platform,
    connected: true,
    accountName: account.accountName || platform,
    accountId: account.accountId || '',
    pageId: account.pageId || '',
    accessToken: token.access_token || token.accessToken || '',
    refreshToken: token.refresh_token || token.refreshToken || '',
    refreshExpiresIn,
    refreshExpiresAt,
    pageAccessToken: account.pageAccessToken || '',
    expiresIn,
    expiresAt,
    scope: token.scope || '',
    tokenType: token.token_type || 'Bearer',
    tokenIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastTokenRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return {
    connected: true,
    accountName: account.accountName || platform,
    accountId: account.accountId || '',
    platform,
  };
}

async function handleCallback(req, res) {
  const body = await readJson(req);
  const { admin, uid } = await verifyUser(body.idToken);
  const { platform, code, redirectUri, codeVerifier } = body;
  if (!platform || !code || !redirectUri) return json(res, 400, { error: 'platform, code, redirectUri가 필요합니다.' });
  let exchanged;
  if (platform === 'youtube') exchanged = await exchangeYouTubeCode({ code, redirectUri });
  else if (platform === 'instagram') exchanged = await exchangeInstagramCode({ code, redirectUri });
  else if (platform === 'tiktok') exchanged = await exchangeTikTokCode({ code, redirectUri, codeVerifier });
  else return json(res, 400, { error: '지원하지 않는 플랫폼입니다.' });
  const account = await saveAccount(admin, uid, platform, exchanged.token, exchanged.account);
  return json(res, 200, { ok: true, account });
}

async function handleStatus(req, res) {
  const body = await readJson(req);
  const { admin, uid } = await verifyUser(body.idToken);
  const snap = await admin.firestore().collection('users').doc(uid).collection(PLATFORM_COLLECTION).get();
  const accounts = {};
  snap.forEach((doc) => {
    const data = doc.data() || {};
    accounts[doc.id] = {
      connected: data.connected === true,
      accountName: data.accountName || doc.id,
      accountId: data.accountId || '',
      platform: doc.id,
      expiresAt: data.expiresAt || null,
      tokenRefreshStatus: data.tokenRefreshStatus || '',
      tokenRefreshError: data.tokenRefreshError || '',
      lastTokenRefreshAt: data.lastTokenRefreshAt || null,
      updatedAt: data.updatedAt || null,
    };
  });
  return json(res, 200, { accounts });
}

async function handleDisconnect(req, res) {
  const body = await readJson(req);
  const { admin, uid } = await verifyUser(body.idToken);
  const platform = body.platform;
  if (!platform) return json(res, 400, { error: 'platform이 필요합니다.' });
  await admin.firestore().collection('users').doc(uid).collection(PLATFORM_COLLECTION).doc(platform).set({
    connected: false,
    accessToken: '',
    refreshToken: '',
    pageAccessToken: '',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return json(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
    const route = getRoute(req);
    if (route === 'callback') return handleCallback(req, res);
    if (route === 'status') return handleStatus(req, res);
    if (route === 'disconnect') return handleDisconnect(req, res);
    return json(res, 404, { error: 'Unknown social auth action', path: route });
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) });
  }
};
