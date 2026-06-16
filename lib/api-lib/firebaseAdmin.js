// Firebase Admin SDK singleton helper.
// Serverless endpoint files import this module; it is not an endpoint itself.

let cached = null;
let initError = '';

function normalizePrivateKey(raw) {
  if (!raw) return '';
  let key = String(raw).trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n').replace(/\r/g, '');
}

function getAdmin() {
  if (cached || initError) return { admin: cached, error: initError };

  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKeyRaw) {
        initError =
          'firebase-admin 환경변수 누락: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY 를 설정해주세요.';
        return { admin: null, error: initError };
      }

      const privateKey = normalizePrivateKey(privateKeyRaw);
      if (
        !privateKey.includes('-----BEGIN PRIVATE KEY-----') ||
        !privateKey.includes('-----END PRIVATE KEY-----')
      ) {
        initError =
          'FIREBASE_PRIVATE_KEY 형식이 올바르지 않습니다. PEM 헤더/푸터와 \\n 줄바꿈 이스케이프를 확인해주세요.';
        return { admin: null, error: initError };
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    cached = admin;
    return { admin: cached, error: '' };
  } catch (err) {
    initError =
      err && err.code === 'MODULE_NOT_FOUND'
        ? 'firebase-admin 패키지가 설치되어 있지 않습니다. `npm install firebase-admin` 후 다시 시도해주세요.'
        : `firebase-admin 초기화 실패: ${err && err.message ? err.message : String(err)}`;
    return { admin: null, error: initError };
  }
}

module.exports = { getAdmin };
