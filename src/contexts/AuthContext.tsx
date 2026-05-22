// @ts-nocheck
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  AuthProvider as FirebaseAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { FREE_FEATURES, PlanId } from '../data/subscriptionPlans';

export type AuthTrack = 'dance' | 'vocal' | 'korean';

export interface SubscriptionInfo {
  plan: PlanId;
  status: 'active' | 'inactive' | 'cancelled';
  expiresAt: Date | null;
  features: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  country: string;
  language: string;
  birthYear: number | null;
  tracks: AuthTrack[];
  goal: string;
  subscription: SubscriptionInfo;
  onboardingCompleted: boolean;
  provider: 'google' | 'apple' | 'kakao' | 'email' | string;
  createdAt: Date;
}

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
  birthYear: number;
  country: string;
  language: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithKakao: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (data: SignUpData) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

declare global {
  interface Window {
    Kakao?: any;
  }
}

// 모바일 디바이스 판별: iPhone / iPad / Android 기반 단말
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPad는 최신 iPadOS에서 "Macintosh"로 위장되므로 touch 포인트로도 확인
  const isIpadOS =
    /Macintosh/i.test(ua) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  return (
    /android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i.test(ua) ||
    isIpadOS
  );
}

// PWA(standalone)로 설치돼 실행 중인지
function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)');
  return (mq && mq.matches) || (window.navigator as any).standalone === true;
}

// 진행중인 소셜 로그인 종류 (redirect 후 createUserDocument 시 provider 결정용)
const PENDING_PROVIDER_KEY = 'onnode.auth.pendingProvider';
const PENDING_KAKAO_REDIRECT_URI_KEY = 'onnode.auth.kakaoRedirectUri';

const env = (import.meta as any).env || {};
const KAKAO_APP_KEY = env.VITE_KAKAO_APP_KEY || env.VITE_KAKAO_JS_KEY || '';
const KAKAO_SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
const KAKAO_REDIRECT_URI_DEV =
  env.VITE_KAKAO_REDIRECT_URI_DEV ||
  'http://localhost:5173/oauth/callback/kakao';
const KAKAO_REDIRECT_URI_PROD =
  env.VITE_KAKAO_REDIRECT_URI_PROD ||
  'https://k-onnode.vercel.app/oauth/callback/kakao';
const KAKAO_CALLBACK_PATH = '/oauth/callback/kakao';

function getKakaoRedirectUri() {
  // Vite production build(Vercel 포함)는 배포 콜백을 사용합니다.
  // 개발 서버에서는 Kakao Developers에 등록한 localhost 콜백을 사용합니다.
  if (env.PROD) return KAKAO_REDIRECT_URI_PROD;
  return KAKAO_REDIRECT_URI_DEV;
}

function getPendingKakaoRedirectUri() {
  if (typeof window === 'undefined') return getKakaoRedirectUri();
  try {
    return (
      window.localStorage.getItem(PENDING_KAKAO_REDIRECT_URI_KEY) ||
      getKakaoRedirectUri()
    );
  } catch {
    return getKakaoRedirectUri();
  }
}

function isKakaoCallbackPage() {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === KAKAO_CALLBACK_PATH;
}

function waitForKakaoSdk(timeoutMs = 5000) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Kakao) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ready);
    };

    const existingScript = document.querySelector(`script[src="${KAKAO_SDK_SRC}"]`);
    const script =
      existingScript ||
      Object.assign(document.createElement('script'), {
        src: KAKAO_SDK_SRC,
      });

    script.addEventListener('load', () => finish(!!window.Kakao), { once: true });
    script.addEventListener('error', () => finish(false), { once: true });

    if (!existingScript) {
      document.head.appendChild(script);
    }

    window.setTimeout(() => finish(!!window.Kakao), timeoutMs);
  });
}

async function ensureKakaoInit() {
  if (typeof window === 'undefined') return false;
  const sdkReady = await waitForKakaoSdk();
  if (!sdkReady || !window.Kakao) {
    console.warn('[Kakao] SDK script is not ready.');
    return false;
  }
  if (!window.Kakao.isInitialized || !window.Kakao.isInitialized()) {
    const appKey = import.meta.env.VITE_KAKAO_APP_KEY || KAKAO_APP_KEY;
    if (!appKey) {
      console.warn('[Kakao] VITE_KAKAO_APP_KEY is missing from the deployed bundle.');
      return false;
    }
    try {
      window.Kakao.init(appKey);
    } catch (err) {
      console.error('[Kakao] init failed:', err);
      return false;
    }
  }
  return !!window.Kakao.isInitialized?.();
}

function normalizeSubscription(
  raw: any,
): SubscriptionInfo {
  if (!raw) {
    return {
      plan: 'free',
      status: 'active',
      expiresAt: null,
      features: FREE_FEATURES,
    };
  }
  let expiresAt: Date | null = null;
  if (raw.expiresAt instanceof Timestamp) {
    expiresAt = raw.expiresAt.toDate();
  } else if (raw.expiresAt instanceof Date) {
    expiresAt = raw.expiresAt;
  } else if (typeof raw.expiresAt === 'string') {
    const d = new Date(raw.expiresAt);
    expiresAt = isNaN(d.getTime()) ? null : d;
  }
  return {
    plan: (raw.plan as PlanId) || 'free',
    status: raw.status || 'active',
    expiresAt,
    features:
      Array.isArray(raw.features) && raw.features.length > 0
        ? raw.features
        : FREE_FEATURES,
  };
}

function normalizeProfile(uid: string, data: any): UserProfile {
  let createdAt = new Date();
  if (data?.createdAt instanceof Timestamp) {
    createdAt = data.createdAt.toDate();
  } else if (data?.createdAt instanceof Date) {
    createdAt = data.createdAt;
  } else if (typeof data?.createdAt === 'string') {
    const d = new Date(data.createdAt);
    if (!isNaN(d.getTime())) createdAt = d;
  }

  return {
    uid,
    email: data?.email || '',
    displayName: data?.displayName || '',
    photoURL: data?.photoURL ?? null,
    country: data?.country || 'KR',
    language: data?.language || 'ko',
    birthYear: data?.birthYear ?? null,
    tracks: Array.isArray(data?.tracks) ? (data.tracks as AuthTrack[]) : [],
    goal: data?.goal || '',
    subscription: normalizeSubscription(data?.subscription),
    onboardingCompleted: !!data?.onboardingCompleted,
    provider: data?.provider || 'email',
    createdAt,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 페이지 로드 직후 SDK를 미리 초기화해 로그인 버튼 클릭 시점의 실패 가능성을 줄입니다.
  useEffect(() => {
    ensureKakaoInit().then((ready) => {
      if (!ready) return;
      console.info('[Kakao] SDK initialized.');
    });
  }, []);

  const loadUserProfile = useCallback(async (uid: string) => {
    if (!db) return null;
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const profile = normalizeProfile(uid, docSnap.data());
      setUserProfile(profile);
      return profile;
    }
    return null;
  }, []);

  const createUserDocument = useCallback(
    async (firebaseUser: User, extra?: Partial<UserProfile>) => {
      if (!db) return;
      const docRef = doc(db, 'users', firebaseUser.uid);
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        setUserProfile(normalizeProfile(firebaseUser.uid, existing.data()));
        return;
      }

      const profile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || extra?.email || '',
        displayName:
          firebaseUser.displayName || extra?.displayName || '',
        photoURL: firebaseUser.photoURL || extra?.photoURL || null,
        country: extra?.country || 'KR',
        language: extra?.language || 'ko',
        birthYear: extra?.birthYear ?? null,
        tracks: (extra?.tracks as AuthTrack[]) || [],
        goal: extra?.goal || '',
        subscription: extra?.subscription || {
          plan: 'free',
          status: 'active',
          expiresAt: null,
          features: FREE_FEATURES,
        },
        onboardingCompleted: extra?.onboardingCompleted ?? false,
        provider: extra?.provider || 'email',
        createdAt: new Date(),
      };

      await setDoc(docRef, {
        ...profile,
        createdAt: serverTimestamp(),
      });
      setUserProfile(profile);
    },
    [],
  );

  // 모바일/PWA에서 signInWithRedirect 로 로그인 후 돌아왔을 때 처리
  useEffect(() => {
    if (!auth) return;
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const pending =
            typeof window !== 'undefined'
              ? window.localStorage.getItem(PENDING_PROVIDER_KEY) || undefined
              : undefined;
          try {
            window.localStorage.removeItem(PENDING_PROVIDER_KEY);
          } catch {
            /* noop */
          }
          await createUserDocument(result.user, {
            provider: (pending as UserProfile['provider']) || 'google',
          });
        }
      } catch (err) {
        console.error('[Auth] getRedirectResult failed:', err);
      }
    })();
  }, [createUserDocument]);

  // Firebase 인증 상태 감지
  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        // 과거 익명 로그인(signInAnonymously) 으로 남아있는 세션은
        // 정식 로그인으로 인정하지 않고 즉시 로그아웃합니다.
        if (fbUser?.isAnonymous) {
          try {
            await signOut(auth);
          } catch (err) {
            console.warn('[Auth] sign out anonymous failed:', err);
          }
          setUser(null);
          setUserProfile(null);
          return;
        }

        if (fbUser) {
          setUser(fbUser);
          const profile = await loadUserProfile(fbUser.uid);
          // 소셜 로그인 등으로 새로 가입된 경우 문서가 없을 수 있음
          if (!profile) {
            await createUserDocument(fbUser);
          }
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (err) {
        console.error('[Auth] state change failed:', err);
      } finally {
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, [loadUserProfile, createUserDocument]);

  // Kakao SDK v2 redirect callback 처리
  useEffect(() => {
    if (!auth || !isKakaoCallbackPage()) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      console.error('[Kakao] authorize failed:', {
        error,
        description: params.get('error_description'),
      });
      window.history.replaceState({}, '', '/');
      return;
    }
    if (!code) return;

    (async () => {
      try {
        const redirectUri = getPendingKakaoRedirectUri();
        const res = await fetch('/api/auth/kakao-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`카카오 토큰 발급 실패: ${text || res.status}`);
        }
        const { customToken, kakaoUser } = await res.json();
        if (!customToken) throw new Error('카카오 customToken 응답이 비어 있습니다.');

        const result = await signInWithCustomToken(auth, customToken);
        await createUserDocument(result.user, {
          provider: 'kakao',
          email: kakaoUser?.kakao_account?.email || '',
          displayName: kakaoUser?.kakao_account?.profile?.nickname || '',
          photoURL:
            kakaoUser?.kakao_account?.profile?.profile_image_url || null,
        });
      } catch (err) {
        console.error('[Kakao] callback processing failed:', err);
      } finally {
        try {
          window.localStorage.removeItem(PENDING_PROVIDER_KEY);
          window.localStorage.removeItem(PENDING_KAKAO_REDIRECT_URI_KEY);
        } catch {
          /* noop */
        }
        window.history.replaceState({}, '', '/');
      }
    })();
  }, [createUserDocument]);

  // 모바일/PWA에서는 popup 차단 가능성이 높아 redirect 를 우선 사용합니다.
  // popup 시도 → 차단/실패시 자동으로 redirect 로 폴백합니다.
  const signInWithProvider = useCallback(
    async (
      provider: FirebaseAuthProvider,
      providerName: UserProfile['provider'],
    ) => {
      if (!auth) throw new Error('Firebase 인증이 초기화되지 않았습니다.');

      const preferRedirect = isMobileDevice() || isStandalonePWA();
      const tryRedirect = async () => {
        try {
          window.localStorage.setItem(PENDING_PROVIDER_KEY, providerName);
        } catch {
          /* noop */
        }
        await signInWithRedirect(auth, provider);
        // signInWithRedirect 는 페이지를 떠나므로 이후 코드는 실행되지 않습니다.
      };

      if (preferRedirect) {
        await tryRedirect();
        return;
      }

      try {
        const result = await signInWithPopup(auth, provider);
        await createUserDocument(result.user, { provider: providerName });
      } catch (err: any) {
        const code = err?.code || '';
        // 모바일 외 환경에서도 팝업 차단 / 작업 도중 종료 시 redirect 폴백
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment' ||
          code === 'auth/web-storage-unsupported'
        ) {
          await tryRedirect();
          return;
        }
        throw err;
      }
    },
    [createUserDocument],
  );

  // ── 로그인 메서드 ───────────────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithProvider(provider, 'google');
  }, [signInWithProvider]);

  const loginWithApple = useCallback(async () => {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('name');
    provider.addScope('email');
    await signInWithProvider(provider, 'apple');
  }, [signInWithProvider]);

  const loginWithKakao = useCallback(async () => {
    if (!auth) throw new Error('Firebase 인증이 초기화되지 않았습니다.');
    if (!(await ensureKakaoInit())) {
      throw new Error(
        '카카오 SDK가 준비되지 않았습니다. .env의 VITE_KAKAO_APP_KEY와 index.html의 SDK 스크립트를 확인하세요.',
      );
    }

    const redirectUri = getKakaoRedirectUri();

    // Kakao JavaScript SDK v2는 Kakao.Auth.login() 대신 authorize()를 사용합니다.
    // authorize()는 카카오 인증 페이지로 이동하고, /oauth/callback/kakao 로 돌아옵니다.
    if (typeof window.Kakao.Auth.authorize === 'function') {
      try {
        window.localStorage.setItem(PENDING_PROVIDER_KEY, 'kakao');
        window.localStorage.setItem(PENDING_KAKAO_REDIRECT_URI_KEY, redirectUri);
      } catch {
        /* noop */
      }
      window.Kakao.Auth.authorize({
        redirectUri,
        scope: 'profile_nickname,profile_image,account_email',
      });
      return;
    }

    // 구형 Kakao SDK(v1)를 쓰는 경우만 popup 방식으로 폴백합니다.
    if (typeof window.Kakao.Auth.login !== 'function') {
      throw new Error(
        '카카오 SDK 로그인 함수가 없습니다. Kakao SDK v2에서는 Auth.authorize가 필요합니다.',
      );
    }

    // 1) 카카오 SDK(v1) 로그인
    await new Promise<void>((resolve, reject) => {
      window.Kakao.Auth.login({
        success: () => resolve(),
        fail: (err: unknown) => reject(err),
      });
    });

    // 2) 카카오 사용자 정보
    const kakaoUser: any = await new Promise((resolve, reject) => {
      window.Kakao.API.request({
        url: '/v2/user/me',
        success: resolve,
        fail: reject,
      });
    });

    // 3) 서버에서 Firebase Custom Token 발급
    const res = await fetch('/api/auth/kakao-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kakaoId: kakaoUser.id,
        email: kakaoUser.kakao_account?.email,
        nickname: kakaoUser.kakao_account?.profile?.nickname,
        profileImage:
          kakaoUser.kakao_account?.profile?.profile_image_url || null,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`카카오 토큰 발급 실패: ${text || res.status}`);
    }
    const { customToken } = await res.json();
    if (!customToken) throw new Error('카카오 customToken 응답이 비어 있습니다.');

    // 4) Firebase Custom Token 로그인
    const result = await signInWithCustomToken(auth, customToken);

    // 5) 프로필 문서 생성/갱신
    await createUserDocument(result.user, {
      provider: 'kakao',
      email: kakaoUser.kakao_account?.email || '',
      displayName: kakaoUser.kakao_account?.profile?.nickname || '',
      photoURL:
        kakaoUser.kakao_account?.profile?.profile_image_url || null,
    });
  }, [createUserDocument]);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!auth) throw new Error('Firebase 인증이 초기화되지 않았습니다.');
      const result = await signInWithEmailAndPassword(auth, email, password);
      await loadUserProfile(result.user.uid);
    },
    [loadUserProfile],
  );

  const signUpWithEmail = useCallback(
    async (data: SignUpData) => {
      if (!auth) throw new Error('Firebase 인증이 초기화되지 않았습니다.');
      const result = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password,
      );
      try {
        await updateProfile(result.user, { displayName: data.displayName });
      } catch (err) {
        console.warn('[Auth] updateProfile failed:', err);
      }
      await createUserDocument(result.user, {
        provider: 'email',
        displayName: data.displayName,
        birthYear: data.birthYear || null,
        country: data.country,
        language: data.language,
        email: data.email,
      });
    },
    [createUserDocument],
  );

  const logout = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
  }, []);

  const updateUserProfile = useCallback(
    async (data: Partial<UserProfile>) => {
      if (!db || !user) return;
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, data, { merge: true });
      setUserProfile((prev) => (prev ? { ...prev, ...data } : prev));
    },
    [user],
  );

  const refreshSubscription = useCallback(async () => {
    if (!user) return;
    await loadUserProfile(user.uid);
  }, [user, loadUserProfile]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      userProfile,
      isLoading,
      isAuthenticated: !!user,
      loginWithGoogle,
      loginWithApple,
      loginWithKakao,
      loginWithEmail,
      signUpWithEmail,
      logout,
      updateUserProfile,
      refreshSubscription,
    }),
    [
      user,
      userProfile,
      isLoading,
      loginWithGoogle,
      loginWithApple,
      loginWithKakao,
      loginWithEmail,
      signUpWithEmail,
      logout,
      updateUserProfile,
      refreshSubscription,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
