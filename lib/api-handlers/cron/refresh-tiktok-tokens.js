const { getAdmin } = require(`${process.cwd()}/lib/api-lib/firebaseAdmin.js`);

function okAuth(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return (req.headers.authorization || req.headers.Authorization) === `Bearer ${secret}`;
}

function tsMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value._seconds) return value._seconds * 1000;
  if (value.seconds) return value.seconds * 1000;
  return 0;
}

async function refreshTikTok(refreshToken) {
  const clientKey = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error('TikTok OAuth env is required');
  if (!refreshToken) throw new Error('TikTok refresh token is missing');
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || 'TikTok token refresh failed');
  return data;
}

async function refreshDoc(admin, doc) {
  const data = doc.data() || {};
  const expiresAt = tsMillis(data.expiresAt);
  if (data.accessToken && expiresAt && expiresAt - Date.now() > 6 * 60 * 60 * 1000) {
    return { ok: true, skipped: true };
  }
  const token = await refreshTikTok(data.refreshToken);
  const expiresIn = Number(token.expires_in || 0) || 24 * 60 * 60;
  const refreshExpiresIn = Number(token.refresh_expires_in || 0) || null;
  const update = {
    connected: true,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || data.refreshToken,
    expiresIn,
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + expiresIn * 1000),
    tokenRefreshStatus: 'success',
    tokenRefreshError: '',
    lastTokenRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
    lastTokenRefreshAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (refreshExpiresIn) {
    update.refreshExpiresIn = refreshExpiresIn;
    update.refreshExpiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + refreshExpiresIn * 1000);
  }
  await doc.ref.set(update, { merge: true });
  return { ok: true, skipped: false };
}

module.exports = async function handler(req, res) {
  if (!okAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { admin, error } = getAdmin();
  if (!admin) return res.status(500).json({ error: error || 'Firebase Admin unavailable' });
  const snap = await admin.firestore().collectionGroup('social_accounts').where('platform', '==', 'tiktok').get();
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
    successCount: results.filter((r) => r.ok && !r.skipped).length,
    skippedCount: results.filter((r) => r.skipped).length,
    failedCount: results.filter((r) => !r.ok).length,
    results,
  });
};
