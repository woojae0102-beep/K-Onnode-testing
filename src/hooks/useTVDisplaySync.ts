// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../firebase';

function tvSessionRef(code) {
  return doc(db, 'artifacts', appId, 'public', 'data', 'tvSessions', String(code).toUpperCase());
}

export function useTVDisplaySync(code, { role = 'phone' } = {}) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code || !db) return undefined;
    const unsub = onSnapshot(
      tvSessionRef(code),
      (snap) => {
        setState(snap.exists() ? snap.data() : null);
        setError('');
      },
      (err) => setError(err?.message || 'TV 세션 동기화 오류'),
    );
    return () => unsub();
  }, [code]);

  const publish = useCallback(
    async (patch) => {
      if (!code || !db || role !== 'phone') return;
      try {
        await setDoc(
          tvSessionRef(code),
          {
            ...patch,
            code: String(code).toUpperCase(),
            updatedAt: Date.now(),
            serverTs: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (e) {
        setError(e?.message || 'TV 상태 전송 실패');
      }
    },
    [code, role],
  );

  const initSession = useCallback(
    async (payload) => {
      if (!code || !db) return;
      await setDoc(tvSessionRef(code), {
        code: String(code).toUpperCase(),
        status: 'waiting',
        createdAt: Date.now(),
        serverTs: serverTimestamp(),
        ...payload,
      });
    },
    [code],
  );

  return { state, publish, initSession, error };
}

export default useTVDisplaySync;
