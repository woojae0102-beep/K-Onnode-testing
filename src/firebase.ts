// @ts-nocheck
// 공용 Firebase 초기화 모듈
// App.jsx, AuthContext 등 모든 곳에서 동일한 인스턴스를 사용하도록 통일합니다.

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

declare global {
  // eslint-disable-next-line no-var
  var __firebase_config: unknown;
  // eslint-disable-next-line no-var
  var __app_id: string | undefined;
  interface Window {
    __firebase_config?: unknown;
    __app_id?: string;
  }
}

function readFirebaseConfig(): Record<string, string> | null {
  const fromGlobal =
    typeof (globalThis as any).__firebase_config !== 'undefined'
      ? (globalThis as any).__firebase_config
      : typeof window !== 'undefined' && (window as any).__firebase_config
      ? (window as any).__firebase_config
      : null;
  const fromEnv = (import.meta as any).env?.VITE_FIREBASE_CONFIG || null;
  const raw = fromGlobal || fromEnv;
  if (raw) {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      const isPlaceholder =
        trimmed === '__firebase_config' ||
        trimmed === 'undefined' ||
        trimmed === 'null';
      if (!isPlaceholder && trimmed.startsWith('{')) {
        try {
          return JSON.parse(trimmed);
        } catch {
          // fall through
        }
      }
    } else if (typeof raw === 'object') {
      return raw as Record<string, string>;
    }
  }

  const env = (import.meta as any).env || {};
  const byKeys: Record<string, string | undefined> = {
    apiKey: env.VITE_FIREBASE_API_KEY?.trim(),
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: env.VITE_FIREBASE_PROJECT_ID?.trim(),
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: env.VITE_FIREBASE_APP_ID?.trim(),
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID?.trim(),
  };

  if (byKeys.apiKey && byKeys.authDomain && byKeys.projectId && byKeys.appId) {
    return byKeys as Record<string, string>;
  }
  return null;
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _initError = '';

try {
  const cfg = readFirebaseConfig();
  if (!cfg?.apiKey || !cfg?.projectId) {
    throw new Error(
      'Firebase 설정값이 비어 있습니다. (__firebase_config 또는 VITE_FIREBASE_CONFIG 필요)',
    );
  }
  _app = initializeApp(cfg);
  _auth = getAuth(_app);
  _db = getFirestore(_app);
} catch (err) {
  _initError = err instanceof Error ? err.message : 'Firebase 초기화 실패';
}

export const app = _app;
export const auth = _auth as Auth;
export const db = _db as Firestore;
export const firebaseInitError = _initError;

export const appId =
  typeof (globalThis as any).__app_id !== 'undefined'
    ? (globalThis as any).__app_id
    : typeof window !== 'undefined' && (window as any).__app_id
    ? (window as any).__app_id
    : (import.meta as any).env?.VITE_APP_ID || 'onnode-desktop-v17';
