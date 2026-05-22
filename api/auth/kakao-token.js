// POST /api/auth/kakao-token
// 카카오 인증 코드 또는 카카오 ID → Firebase Custom Token 발급
//
// Body A (SDK v2 redirect): { code, redirectUri }
// Body B (legacy SDK v1 popup): { kakaoId, email?, nickname?, profileImage? }
// Resp: { customToken, kakaoUser? }

const { getAdmin } = require('../_lib/firebaseAdmin');

async function exchangeKakaoCode({ code, redirectUri }) {
  const clientId = process.env.KAKAO_REST_API_KEY || '';
  const clientSecret = process.env.KAKAO_CLIENT_SECRET || '';
  if (!clientId) {
    const err = new Error('KAKAO_REST_API_KEY is required for Kakao authorization-code flow');
    err.statusCode = 500;
    err.code = 'kakao_rest_api_key_missing';
    throw err;
  }
  if (!redirectUri) {
    const err = new Error('redirectUri required');
    err.statusCode = 400;
    err.code = 'redirect_uri_required';
    throw err;
  }

  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });
  if (clientSecret) {
    tokenParams.set('client_secret', clientSecret);
  }

  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: tokenParams.toString(),
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) {
    const err = new Error(tokenData.error_description || tokenData.error || `Kakao token exchange failed (${tokenRes.status})`);
    err.statusCode = 502;
    err.code = 'kakao_token_exchange_failed';
    err.detail = tokenData;
    throw err;
  }

  const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const kakaoUser = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !kakaoUser.id) {
    const err = new Error(kakaoUser.msg || kakaoUser.error || `Kakao user fetch failed (${userRes.status})`);
    err.statusCode = 502;
    err.code = 'kakao_user_fetch_failed';
    err.detail = kakaoUser;
    throw err;
  }
  return kakaoUser;
}

async function upsertFirebaseKakaoUser(admin, { kakaoId, email, nickname, profileImage }) {
  if (!kakaoId) {
    const err = new Error('kakaoId required');
    err.statusCode = 400;
    err.code = 'kakao_id_required';
    throw err;
  }

  // Firebase UID는 128자 이하의 문자열이어야 합니다.
  const uid = `kakao:${kakaoId}`;

  // 사용자 레코드 존재 여부 확인 (있으면 displayName/photoURL 동기화)
  try {
    await admin.auth().getUser(uid);
    if (nickname || profileImage || email) {
      await admin.auth().updateUser(uid, {
        ...(email ? { email, emailVerified: true } : {}),
        ...(nickname ? { displayName: nickname } : {}),
        ...(profileImage ? { photoURL: profileImage } : {}),
      });
    }
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') {
      await admin.auth().createUser({
        uid,
        ...(email ? { email, emailVerified: true } : {}),
        ...(nickname ? { displayName: nickname } : {}),
        ...(profileImage ? { photoURL: profileImage } : {}),
      });
    } else {
      throw err;
    }
  }

  const customToken = await admin.auth().createCustomToken(uid, {
    provider: 'kakao',
    kakaoId: String(kakaoId),
    email: email || null,
    nickname: nickname || null,
  });

  return { customToken };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { admin, error } = getAdmin();
  if (!admin) {
    return res.status(500).json({ error: 'firebase_admin_unavailable', detail: error });
  }

  const body = req.body || {};
  try {
    let kakaoUser = null;
    let kakaoId = body.kakaoId;
    let email = body.email;
    let nickname = body.nickname;
    let profileImage = body.profileImage;

    if (body.code) {
      kakaoUser = await exchangeKakaoCode({
        code: body.code,
        redirectUri: body.redirectUri,
      });
      kakaoId = kakaoUser.id;
      email = kakaoUser.kakao_account?.email || '';
      nickname = kakaoUser.kakao_account?.profile?.nickname || '';
      profileImage = kakaoUser.kakao_account?.profile?.profile_image_url || '';
    }

    const { customToken } = await upsertFirebaseKakaoUser(admin, {
      kakaoId,
      email,
      nickname,
      profileImage,
    });

    return res.status(200).json({ customToken, kakaoUser });
  } catch (err) {
    console.error('[kakao-token] failed:', err);
    return res.status(err.statusCode || 500).json({
      error: err.code || 'token_creation_failed',
      detail: err && err.message ? err.message : String(err),
      kakaoDetail: err.detail || undefined,
    });
  }
};
