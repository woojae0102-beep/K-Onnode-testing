// Firebase Admin SDK 싱글톤 초기화 모듈
// /api/auth/* 서버리스 핸들러에서 공통으로 사용합니다.
//
// 환경변수:
//  - FIREBASE_PROJECT_ID
//  - FIREBASE_CLIENT_EMAIL
//  - FIREBASE_PRIVATE_KEY  (\n 이스케이프 포함된 PEM)
//
// 참고: Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성

let cached = null;
let initError = '';

function normalizePrivateKey(raw) {
  if (!raw) return '';

  // Vercel/로컬 .env 모두에서 발생 가능한 케이스를 정리합니다.
  // 1) "-----BEGIN...\n...-----END...\n" 처럼 따옴표가 값에 포함된 경우 제거
  // 2) \n 이스케이프 문자열을 실제 줄바꿈으로 변환
  // 3) Windows CRLF가 섞여도 PEM 파싱 가능하도록 \r 제거
  let key = String(raw).trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, '\n').replace(/\r/g, '');
  return key;
}

function getAdmin() {
  if (cached || initError) {
    return { admin: cached, error: initError };
  }
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
