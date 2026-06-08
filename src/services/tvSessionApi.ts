// @ts-nocheck
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../firebase';

export function tvSessionDocRef(code) {
  if (!db) return null;
  return doc(db, 'artifacts', appId, 'public', 'data', 'tvSessions', String(code));
}

export async function initTvSession(code, payload = {}) {
  if (!db) {
    throw new Error('Firebase가 연결되지 않았습니다.');
  }
  if (!code) {
    throw new Error('연결 코드가 없습니다.');
  }
  const ref = tvSessionDocRef(code);
  await setDoc(
    ref,
    {
      code: String(code),
      status: 'waiting',
      createdAt: Date.now(),
      serverTs: serverTimestamp(),
      ...payload,
    },
    { merge: true },
  );
  return true;
}

export async function patchTvSession(code, patch = {}) {
  if (!db || !code) return false;
  const ref = tvSessionDocRef(code);
  await setDoc(
    ref,
    {
      ...patch,
      code: String(code),
      updatedAt: Date.now(),
      serverTs: serverTimestamp(),
    },
    { merge: true },
  );
  return true;
}
