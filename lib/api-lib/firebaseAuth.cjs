/**
 * Firebase ID token verification + admin role check (server-side).
 * Admin: users/{uid}.role === 'admin' OR ADMIN_UIDS / ADMIN_EMAILS env.
 */
const { getAdmin } = require('./firebaseAdmin.cjs');

function parseBearerToken(req) {
  const raw = req.headers.authorization || req.headers.Authorization || '';
  if (!raw.startsWith('Bearer ')) return null;
  return raw.slice(7).trim() || null;
}

async function verifyIdToken(token) {
  const { admin, error } = getAdmin();
  if (!admin) {
    return { ok: false, code: 'FIREBASE_ADMIN_UNAVAILABLE', detail: error };
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { ok: true, decoded, uid: decoded.uid, email: decoded.email || null };
  } catch (err) {
    return { ok: false, code: 'INVALID_TOKEN', detail: err?.message || String(err) };
  }
}

async function isAdminUser(admin, uid, email) {
  const adminUids = (process.env.ADMIN_UIDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (adminUids.includes(uid)) return true;
  if (email && adminEmails.includes(String(email).toLowerCase())) return true;

  const snap = await admin.firestore().collection('users').doc(String(uid)).get();
  const role = snap.exists ? snap.data()?.role : null;
  return role === 'admin';
}

async function requireAuth(req) {
  const token = parseBearerToken(req);
  if (!token) {
    return { ok: false, code: 'AUTH_REQUIRED', status: 401 };
  }
  const verified = await verifyIdToken(token);
  if (!verified.ok) {
    return { ok: false, code: verified.code, status: 401, detail: verified.detail };
  }
  return { ok: true, uid: verified.uid, email: verified.email, decoded: verified.decoded };
}

async function requireAdmin(req) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) {
    return { ok: false, code: 'ADMIN_ACCESS_REQUIRED', status: authResult.status || 401, detail: authResult.detail };
  }
  const { admin, error } = getAdmin();
  if (!admin) {
    return { ok: false, code: 'FIREBASE_ADMIN_UNAVAILABLE', status: 500, detail: error };
  }
  const adminOk = await isAdminUser(admin, authResult.uid, authResult.email);
  if (!adminOk) {
    return { ok: false, code: 'ADMIN_ACCESS_REQUIRED', status: 403 };
  }
  return { ok: true, uid: authResult.uid, email: authResult.email, admin };
}

module.exports = {
  parseBearerToken,
  verifyIdToken,
  requireAuth,
  requireAdmin,
  isAdminUser,
};
