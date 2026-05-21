// POST /api/auth/verify-token
// 클라이언트가 보낸 ID 토큰을 검증해 사용자 정보를 반환합니다.
//
// Body: { idToken }
// Resp: { uid, email, displayName, photoURL, claims }

const { getAdmin } = require('../_lib/firebaseAdmin');

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
  const { idToken } = body;
  if (!idToken) {
    return res.status(400).json({ error: 'idToken required' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return res.status(200).json({
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      photoURL: decoded.picture || null,
      provider: decoded.firebase?.sign_in_provider || null,
      claims: {
        ...decoded,
      },
    });
  } catch (err) {
    console.error('[verify-token] failed:', err);
    return res.status(401).json({
      error: 'invalid_token',
      detail: err && err.message ? err.message : String(err),
    });
  }
};
