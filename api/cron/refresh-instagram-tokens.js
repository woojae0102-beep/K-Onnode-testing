const { getAdmin } = require('../_lib/firebaseAdmin');

function json(res, code, body) {
  return res.status(code).json(body);
}

function assertCronAuth(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = req.headers.authorization || req.headers.Authorization;
  return auth === `Bearer ${cronSecret}`;
}

async function refreshFacebookLongLivedToken(currentToken) {
  const appId = process.env.VITE_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('FACEBOOK_APP_ID/VITE_FACEBOOK_APP_ID와 FACEBOOK_APP_SECRET이 필요합니다.');
  }

  const res = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: currentToken,
  }).toString()}`);
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || 'Facebook long-lived token 갱신 실패');
  }
  return data;
}

async function refreshInstagramBasicToken(currentToken) {
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: currentToken,
  }).toString()}`);
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || 'Instagram basic token 갱신 실패');
  }
  return data;
}

async function resolvePageToken(accessToken, preferredPageId) {
  const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(accessToken)}`);
  const pages = await pagesRes.json().catch(() => ({}));
  if (!pagesRes.ok) {
    throw new Error(pages.error?.message || 'Facebook Page 토큰 조회 실패');
  }
  const page = (pages.data || []).find((item) => item.id === preferredPageId) || pages.data?.[0];
  if (!page) return {};

  const igRes = await fetch(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account,name&access_token=${encodeURIComponent(page.access_token || accessToken)}`);
  const ig = await igRes.json().catch(() => ({}));
  return {
    pageId: page.id,
    pageAccessToken: page.access_token || '',
    accountName: ig.name || page.name || 'Instagram',
    accountId: ig.instagram_business_account?.id || '',
  };
}

async function refreshAccount(admin, doc) {
  const data = doc.data() || {};
  const currentToken = data.accessToken;
  if (!currentToken) {
    await doc.ref.set({
      tokenRefreshStatus: 'skipped',
      tokenRefreshError: '저장된 accessToken이 없습니다.',
      lastTokenRefreshAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: false, reason: 'missing-token' };
  }

  let refreshed;
  let tokenSource = 'facebook_graph';
  try {
    refreshed = await refreshFacebookLongLivedToken(currentToken);
  } catch (facebookError) {
    refreshed = await refreshInstagramBasicToken(currentToken);
    tokenSource = 'instagram_basic';
  }

  const expiresIn = Number(refreshed.expires_in || 0) || 60 * 24 * 60 * 60;
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + expiresIn * 1000);
  const pageInfo = tokenSource === 'facebook_graph'
    ? await resolvePageToken(refreshed.access_token, data.pageId)
    : {};

  await doc.ref.set({
    connected: true,
    tokenSource,
    accessToken: refreshed.access_token,
    expiresIn,
    expiresAt,
    pageId: pageInfo.pageId || data.pageId || '',
    pageAccessToken: pageInfo.pageAccessToken || data.pageAccessToken || '',
    accountName: pageInfo.accountName || data.accountName || 'Instagram',
    accountId: pageInfo.accountId || data.accountId || '',
    tokenRefreshStatus: 'success',
    tokenRefreshError: '',
    lastTokenRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
    lastTokenRefreshAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    ok: true,
    tokenSource,
    accountName: pageInfo.accountName || data.accountName || 'Instagram',
  };
}

module.exports = async function handler(req, res) {
  if (!assertCronAuth(req)) return json(res, 401, { error: 'Unauthorized' });

  const { admin, error } = getAdmin();
  if (!admin) return json(res, 500, { error: error || 'Firebase Admin 초기화 실패' });

  try {
    const snap = await admin.firestore()
      .collectionGroup('social_accounts')
      .where('platform', '==', 'instagram')
      .get();

    const results = [];
    for (const doc of snap.docs) {
      if (doc.data()?.connected !== true) continue;
      try {
        const result = await refreshAccount(admin, doc);
        results.push({ path: doc.ref.path, ...result });
      } catch (err) {
        await doc.ref.set({
          tokenRefreshStatus: 'failed',
          tokenRefreshError: err.message || String(err),
          lastTokenRefreshAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        results.push({ path: doc.ref.path, ok: false, error: err.message || String(err) });
      }
    }

    return json(res, 200, {
      success: true,
      refreshedAt: new Date().toISOString(),
      total: results.length,
      successCount: results.filter((r) => r.ok).length,
      failedCount: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    return json(res, 500, { error: 'Instagram token refresh failed', message: err.message || String(err) });
  }
};
