# Google / Kakao 소셜 로그인 구현 가이드

K-Onnode 프로젝트에 적용된 **Google + Kakao 소셜 로그인** 구현 기준 문서입니다.

---

## 1. 구현 프롬프트 (다른 프로젝트/AI에게 줄 때)

```text
React + Firebase Auth + Vercel 서버리스로 Google/Kakao 소셜 로그인을 구현해줘.

[공통]
- Firebase Authentication 사용
- 로그인 상태는 React Context(AuthContext)로 전역 관리
- Firestore users/{uid}에 프로필 저장 (onboardingCompleted 포함)
- 모바일/PWA는 popup 대신 redirect 우선
- "자동 로그인 유지" 체크박스:
  - ON: browserLocalPersistence
  - OFF: browserSessionPersistence

[Google]
- Firebase GoogleAuthProvider 사용
- 데스크톱: signInWithPopup
- 모바일/PWA: signInWithRedirect + getRedirectResult
- Firebase Console에서 Google 로그인 활성화

[Kakao]
- Kakao JavaScript SDK 2.7.2 사용
- Kakao.Auth.authorize({ redirectUri }) redirect 방식
- 콜백 경로: /oauth/callback/kakao
- redirectUri는 로컬/프로덕션 자동 분기
- 서버 API POST /api/auth/kakao-token:
  1) code + redirectUri로 카카오 access token 교환
  2) 카카오 사용자 정보 조회
  3) Firebase Admin createCustomToken(uid: kakao:{kakaoId})
- 프론트는 customToken으로 signInWithCustomToken
- AuthContext useEffect에서 /oauth/callback/kakao?code=... 처리

[환경변수]
프론트(VITE_):
- VITE_FIREBASE_*
- VITE_KAKAO_APP_KEY
- VITE_KAKAO_REDIRECT_URI_DEV
- VITE_KAKAO_REDIRECT_URI_PROD

서버(VITE_ 없음):
- KAKAO_REST_API_KEY
- KAKAO_CLIENT_SECRET (카카오에서 Client Secret 사용 시)
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

[Kakao Developers]
- JS SDK 도메인: localhost, 배포 도메인
- Redirect URI:
  http://localhost:5173/oauth/callback/kakao
  https://your-domain.vercel.app/oauth/callback/kakao
- Client Secret 사용 시 Vercel에 KAKAO_CLIENT_SECRET 등록
- scope는 기본 동의항목만 (account_email 권한 없으면 scope 요청 금지)
```

---

## 2. 전체 흐름

### Google 로그인

```mermaid
sequenceDiagram
  participant U as 사용자
  participant App as AuthContext
  participant FB as Firebase Auth
  participant FS as Firestore

  U->>App: Google 로그인 클릭
  alt 모바일/PWA
    App->>FB: signInWithRedirect
    FB-->>App: getRedirectResult
  else 데스크톱
    App->>FB: signInWithPopup
  end
  FB-->>App: Firebase User
  App->>FS: users/{uid} 생성/조회
```

### Kakao 로그인

```mermaid
sequenceDiagram
  participant U as 사용자
  participant App as AuthContext
  participant K as Kakao
  participant API as /api/auth/kakao-token
  participant FB as Firebase Auth

  U->>App: 카카오 로그인 클릭
  App->>K: Kakao.Auth.authorize(redirectUri)
  K-->>App: /oauth/callback/kakao?code=...
  App->>API: POST { code, redirectUri }
  API->>K: token + user/me
  API-->>App: { customToken }
  App->>FB: signInWithCustomToken
  FB-->>App: 로그인 완료
```

---

## 3. 필수 환경 변수

### 프론트엔드 (`.env` / Vercel `Production` 포함)

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

VITE_KAKAO_APP_KEY=              # Kakao JavaScript 키
VITE_KAKAO_REDIRECT_URI_DEV=http://localhost:5173/oauth/callback/kakao
VITE_KAKAO_REDIRECT_URI_PROD=https://k-onnode.vercel.app/oauth/callback/kakao
```

### 서버 (Vercel, `VITE_` 없음)

```env
KAKAO_REST_API_KEY=              # Kakao REST API 키
KAKAO_CLIENT_SECRET=             # Client Secret "사용함"일 때만

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## 4. 외부 콘솔 설정

### Firebase Console

1. Authentication → Sign-in method → **Google** 활성화
2. Authentication → Sign-in method → **Email/Password** (이메일 로그인용)
3. 프로젝트 설정 → 서비스 계정 → **새 비공개 키** → Admin SDK용 env 등록

### Kakao Developers

1. **플랫폼** → Web → JS SDK 도메인 등록
   - `http://localhost:5173`
   - `https://k-onnode.vercel.app`
2. **카카오 로그인** → Redirect URI 등록
   - `http://localhost:5173/oauth/callback/kakao`
   - `https://k-onnode.vercel.app/oauth/callback/kakao`
3. **앱 키**
   - JavaScript 키 → `VITE_KAKAO_APP_KEY`
   - REST API 키 → `KAKAO_REST_API_KEY`
4. **Client Secret** 사용 시 → `KAKAO_CLIENT_SECRET`도 Vercel에 등록

---

## 5. 핵심 파일 구조

| 파일 | 역할 |
|------|------|
| `src/contexts/AuthContext.tsx` | Google/Kakao 로그인, persistence, Kakao 콜백 처리 |
| `src/screens/AuthScreen.tsx` | 로그인 화면, 소셜 버튼, 자동 로그인 체크 |
| `src/components/auth/SocialLoginButton.tsx` | Google/Kakao 버튼 UI |
| `api/auth.js` | `/api/auth/kakao-token` 등 인증 API 통합 라우터 |
| `lib/api-lib/firebaseAdmin.js` | Firebase Admin SDK 초기화 |
| `index.html` | Kakao SDK 2.7.2 스크립트 |
| `src/main.jsx` | `AuthProvider` + 미로그인 시 `AuthScreen` |

---

## 6. 핵심 코드

### 6-1. `index.html` — Kakao SDK

```html
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"></script>
```

### 6-2. Google 로그인 (`AuthContext.tsx`)

```typescript
const loginWithGoogle = useCallback(async (options?: LoginOptions) => {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithProvider(provider, 'google', options);
}, [signInWithProvider]);

// signInWithProvider 내부:
// - 모바일/PWA → signInWithRedirect
// - 데스크톱 → signInWithPopup (차단 시 redirect 폴백)
// - rememberLogin → setPersistence(local / session)
```

### 6-3. Kakao 로그인 시작 (`AuthContext.tsx`)

```typescript
const loginWithKakao = useCallback(async (options?: LoginOptions) => {
  await applyAuthPersistence(!!options?.rememberLogin);
  await ensureKakaoInit(); // window.Kakao.init(VITE_KAKAO_APP_KEY)

  const redirectUri = getKakaoRedirectUri();
  // PROD → VITE_KAKAO_REDIRECT_URI_PROD
  // DEV  → VITE_KAKAO_REDIRECT_URI_DEV

  window.localStorage.setItem('onnode.auth.pendingProvider', 'kakao');
  window.localStorage.setItem('onnode.auth.kakaoRedirectUri', redirectUri);
  window.localStorage.setItem(
    'onnode.auth.rememberLogin',
    options?.rememberLogin ? 'true' : 'false',
  );

  window.Kakao.Auth.authorize({ redirectUri });
}, [createUserDocument]);
```

### 6-4. Kakao 콜백 처리 (`AuthContext.tsx`)

```typescript
// pathname === '/oauth/callback/kakao' 일 때
const code = new URLSearchParams(window.location.search).get('code');
const redirectUri = localStorage.getItem('onnode.auth.kakaoRedirectUri');

const res = await fetch('/api/auth/kakao-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, redirectUri }),
});
const { customToken, kakaoUser } = await res.json();

await applyAuthPersistence(getPendingRememberLogin());
const result = await signInWithCustomToken(auth, customToken);
await createUserDocument(result.user, {
  provider: 'kakao',
  email: kakaoUser?.kakao_account?.email || '',
  displayName: kakaoUser?.kakao_account?.profile?.nickname || '',
  photoURL: kakaoUser?.kakao_account?.profile?.profile_image_url || null,
});
window.history.replaceState({}, '', '/');
```

### 6-5. 서버: Kakao → Firebase Custom Token (`api/auth/kakao-token.js`)

```javascript
// 1) authorization code → access token
const tokenParams = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: process.env.KAKAO_REST_API_KEY,
  redirect_uri: redirectUri,
  code,
});
if (process.env.KAKAO_CLIENT_SECRET) {
  tokenParams.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
}

// 2) access token → 사용자 정보
// GET https://kapi.kakao.com/v2/user/me

// 3) Firebase uid = `kakao:{kakaoId}`
const customToken = await admin.auth().createCustomToken(uid, {
  provider: 'kakao',
  kakaoId: String(kakaoId),
});

return { customToken, kakaoUser };
```

### 6-6. UI 버튼 (`SocialLoginButton.tsx`)

```tsx
const { loginWithGoogle, loginWithKakao } = useAuth();

const handleLogin = async () => {
  if (provider === 'google') await loginWithGoogle({ rememberLogin });
  else if (provider === 'kakao') await loginWithKakao({ rememberLogin });
};
```

### 6-7. 앱 진입점 (`main.jsx`)

```jsx
<AuthProvider>
  <AppGate /> {/* 미로그인 → AuthScreen, 로그인 → App */}
</AuthProvider>
```

---

## 7. 자주 나는 오류와 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `VITE_KAKAO_APP_KEY is missing` | Vercel env가 Development만 설정 | Production/All Environments에 등록 |
| `kakao.min.js 404` | 잘못된 SDK 버전 | `2.7.2` 사용 |
| `invalid_scope: account_email` | 카카오 앱에 이메일 권한 없음 | `scope` 파라미터 제거 |
| `KOE010 Bad client credentials` | REST API 키 또는 Client Secret 불일치 | `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` 확인 |
| 로그인 후 루프 | redirectUri 불일치 | Kakao Developers URI와 코드의 URI 완전 일치 |
| 카카오 502 | Firebase Admin env 누락 | `FIREBASE_*` 3종 Vercel 등록 |

---

## 8. 배포 체크리스트

1. GitHub push → Vercel 자동 배포
2. Vercel 환경 변수 **Production**에 모두 등록
3. Kakao Redirect URI에 **배포 URL** 등록
4. Firebase Authorized domains에 **vercel.app** 도메인 추가
5. 배포 후 카카오/구글 로그인 각각 1회 테스트

---

## 9. localStorage 키 참고

| 키 | 용도 |
|----|------|
| `onnode.auth.pendingProvider` | redirect 후 provider 식별 (`google` / `kakao`) |
| `onnode.auth.kakaoRedirectUri` | 카카오 콜백 시 token 교환에 사용할 redirect URI |
| `onnode.auth.rememberLogin` | 자동 로그인 유지 여부 (`true` / `false`) |
