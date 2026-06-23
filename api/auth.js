const { getAdmin } = require('../lib/api-lib/firebaseAdmin.cjs');
const socialHandler = require('../lib/api-handlers/auth/social');

function actionFromReq(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const raw = url.searchParams.get('path') || '';
  return raw.split('/').filter(Boolean)[0] || '';
}

function partsFromReq(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const raw = url.searchParams.get('path') || '';
  return raw.split('/').filter(Boolean);
}

async function exchangeKakaoCode({ code, redirectUri }) {
  const clientId = process.env.KAKAO_REST_API_KEY || '';
  const clientSecret = process.env.KAKAO_CLIENT_SECRET || '';
  if (!clientId) throw Object.assign(new Error('KAKAO_REST_API_KEY is required'), { statusCode: 500, code: 'kakao_rest_api_key_missing' });
  if (!redirectUri) throw Object.assign(new Error('redirectUri required'), { statusCode: 400, code: 'redirect_uri_required' });
  const params = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri || '', code });
  if (clientSecret) params.set('client_secret', clientSecret);
  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: params.toString(),
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !token.access_token) throw Object.assign(new Error(token.error_description || token.error || 'Kakao token exchange failed'), { statusCode: 502, code: 'kakao_token_exchange_failed', detail: token });
  const userRes = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${token.access_token}` } });
  const kakaoUser = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !kakaoUser.id) throw Object.assign(new Error(kakaoUser.msg || kakaoUser.error || 'Kakao user fetch failed'), { statusCode: 502, code: 'kakao_user_fetch_failed', detail: kakaoUser });
  return kakaoUser;
}

async function kakaoToken(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { admin, error } = getAdmin();
  if (!admin) return res.status(500).json({ error: 'firebase_admin_unavailable', detail: error });
  try {
    const body = req.body || {};
    let kakaoUser = null;
    let { kakaoId, email, nickname, profileImage } = body;
    if (body.code) {
      kakaoUser = await exchangeKakaoCode({ code: body.code, redirectUri: body.redirectUri });
      kakaoId = kakaoUser.id;
      email = kakaoUser.kakao_account?.email || '';
      nickname = kakaoUser.kakao_account?.profile?.nickname || '';
      profileImage = kakaoUser.kakao_account?.profile?.profile_image_url || '';
    }
    if (!kakaoId) return res.status(400).json({ error: 'kakao_id_required' });
    const uid = `kakao:${kakaoId}`;
    try {
      await admin.auth().getUser(uid);
      if (nickname || profileImage || email) {
        await admin.auth().updateUser(uid, { ...(email ? { email, emailVerified: true } : {}), ...(nickname ? { displayName: nickname } : {}), ...(profileImage ? { photoURL: profileImage } : {}) });
      }
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        await admin.auth().createUser({ uid, ...(email ? { email, emailVerified: true } : {}), ...(nickname ? { displayName: nickname } : {}), ...(profileImage ? { photoURL: profileImage } : {}) });
      } else throw err;
    }
    const customToken = await admin.auth().createCustomToken(uid, { provider: 'kakao', kakaoId: String(kakaoId), email: email || null, nickname: nickname || null });
    return res.status(200).json({ customToken, kakaoUser });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      error: err.code || 'token_creation_failed',
      detail: err.message || String(err),
      kakaoDetail: err.detail || undefined,
    });
  }
}

async function verifyToken(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { admin, error } = getAdmin();
  if (!admin) return res.status(500).json({ error: 'firebase_admin_unavailable', detail: error });
  const { idToken } = req.body || {};
  if (!idToken) return res.status(400).json({ error: 'idToken required' });
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return res.status(200).json({ uid: decoded.uid, email: decoded.email || null, displayName: decoded.name || null, photoURL: decoded.picture || null, provider: decoded.firebase?.sign_in_provider || null, claims: { ...decoded } });
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token', detail: err.message || String(err) });
  }
}

function featuresForPlan(plan) {
  const free = ['dance_basic', 'vocal_basic', 'korean_basic', 'ai_coach_basic', 'report_basic'];
  const premium = [...free, 'dance_persona', 'dance_advanced', 'vocal_soul', 'vocal_advanced', 'korean_advanced', 'ai_coach_advanced', 'audition_mode', 'agency_audition', 'monthly_eval', 'instrument_training', 'report_advanced', 'unlimited_storage'];
  return plan === 'pro' ? [...premium, 'pro_coaching', 'priority_review', 'one_to_one_session'] : plan === 'premium' ? premium : free;
}

async function subscriptionWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { admin, error } = getAdmin();
  if (!admin) return res.status(500).json({ error: 'firebase_admin_unavailable', detail: error });
  const body = req.body || {};
  const uid = body.uid || body.data?.object?.metadata?.uid || body.data?.object?.client_reference_id;
  if (!uid) return res.status(400).json({ error: 'unrecognized_payload' });
  const isCancel = /cancel|delete|pause/i.test(body.event || body.type || body.alert_name || '');
  const plan = isCancel ? 'free' : (body.plan || body.data?.object?.metadata?.plan || 'premium');
  const subscription = {
    plan,
    status: isCancel ? 'cancelled' : (body.status || 'active'),
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    features: featuresForPlan(plan),
    lastEvent: body.event || body.type || body.alert_name || 'subscription.updated',
    source: body.source || (body.alert_name ? 'paddle' : body.type ? 'stripe' : 'internal'),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await admin.firestore().collection('users').doc(String(uid)).set({ subscription }, { merge: true });
  return res.status(200).json({ ok: true, applied: { uid, plan, status: subscription.status } });
}

module.exports = async function handler(req, res) {
  const parts = partsFromReq(req);
  const action = parts[0] || actionFromReq(req);
  if (action === 'kakao-token') return kakaoToken(req, res);
  if (action === 'verify-token') return verifyToken(req, res);
  if (action === 'subscription-webhook') return subscriptionWebhook(req, res);
  if (action === 'social') {
    const subPath = parts.slice(1).join('/');
    req.url = `/api/auth/social?path=${encodeURIComponent(subPath)}`;
    return socialHandler(req, res);
  }
  return res.status(404).json({ error: 'Unknown auth action', action });
};

