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

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value._seconds) return value._seconds * 1000;
  if (value.seconds) return value.seconds * 1000;
  return 0;
}

function shouldRefreshTikTok(data) {
  const expiresAt = timestampMillis(data.expiresAt);
  // TikTok access token은 보통 24시간이라 6시간 이하로 남으면 갱신합니다.
  return !data.accessToken || !expiresAt || expiresAt - Date.now() <= 6 * 60 * 60 * 1000;
}

async function refreshTikTokToken(currentRefreshToken) {
  const clientKey = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error('TIKTOK_CLIENT_KEY/VITE_TIKTOK_CLIENT_KEY와 TIKTOK_CLIENT_SECRET이 필요합니다.');
  }
  if (!currentRefreshToken) throw new Error('TikTok refresh token이 없습니다. 다시 연동해주세요.');

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken,
    }).toString(),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error?.message || data.error || 'TikTok 토큰 갱신 실패');
  }
  return data;
}

async function refreshAccount(admin, doc) {
  const data = doc.data() || {};
  if (!shouldRefreshTikTok(data)) {
    return { ok: true, skipped: true, reason: 'access-token-still-valid' };
  }

  const token = await refreshTikTokToken(data.refreshToken);
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
  if (!assertCronAuth(req)) return json(res, 401, { error: 'Unauthorized' });

  const { admin, error } = getAdmin();
  if (!admin) return json(res, 500, { error: error || 'Firebase Admin 초기화 실패' });

  try {
    const snap = await admin.firestore()
      .collectionGroup('social_accounts')
      .where('platform', '==', 'tiktok')
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
      successCount: results.filter((r) => r.ok && !r.skipped).length,
      skippedCount: results.filter((r) => r.skipped).length,
      failedCount: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    return json(res, 500, { error: 'TikTok token refresh failed', message: err.message || String(err) });
  }
};
