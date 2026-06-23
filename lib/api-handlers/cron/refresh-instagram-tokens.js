const { getAdmin } = require(`${process.cwd()}/lib/api-lib/firebaseAdmin.cjs`);

function okAuth(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return (req.headers.authorization || req.headers.Authorization) === `Bearer ${secret}`;
}

async function refreshFacebookToken(currentToken) {
  const appId = process.env.VITE_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Facebook OAuth env is required');
  const res = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: currentToken,
  }).toString()}`);
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(data.error?.message || 'Instagram token refresh failed');
  return data;
}

async function resolvePage(accessToken, preferredPageId) {
  const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(accessToken)}`);
  const pages = await pagesRes.json().catch(() => ({}));
  if (!pagesRes.ok) throw new Error(pages.error?.message || 'Facebook page token fetch failed');
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

async function refreshDoc(admin, doc) {
  const data = doc.data() || {};
  if (!data.accessToken) return { ok: false, reason: 'missing-token' };
  const token = await refreshFacebookToken(data.accessToken);
  const expiresIn = Number(token.expires_in || 0) || 60 * 24 * 60 * 60;
  const page = await resolvePage(token.access_token, data.pageId);
  await doc.ref.set({
    connected: true,
    accessToken: token.access_token,
    expiresIn,
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + expiresIn * 1000),
    pageId: page.pageId || data.pageId || '',
    pageAccessToken: page.pageAccessToken || data.pageAccessToken || '',
    accountName: page.accountName || data.accountName || 'Instagram',
    accountId: page.accountId || data.accountId || '',
    tokenRefreshStatus: 'success',
    tokenRefreshError: '',
    lastTokenRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
    lastTokenRefreshAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true, accountName: page.accountName || data.accountName || 'Instagram' };
}

module.exports = async function handler(req, res) {
  if (!okAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { admin, error } = getAdmin();
  if (!admin) return res.status(500).json({ error: error || 'Firebase Admin unavailable' });
  const snap = await admin.firestore().collectionGroup('social_accounts').where('platform', '==', 'instagram').get();
  const results = [];
  for (const doc of snap.docs) {
    if (doc.data()?.connected !== true) continue;
    try {
      results.push({ path: doc.ref.path, ...(await refreshDoc(admin, doc)) });
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
  return res.status(200).json({
    success: true,
    refreshedAt: new Date().toISOString(),
    total: results.length,
    successCount: results.filter((r) => r.ok).length,
    failedCount: results.filter((r) => !r.ok).length,
    results,
  });
};

