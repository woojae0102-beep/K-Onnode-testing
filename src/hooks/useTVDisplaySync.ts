// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { initTvSession, patchTvSession, tvSessionDocRef } from '../services/tvSessionApi';

export function useTVDisplaySync(code, { role = 'phone' } = {}) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code || !db) return undefined;
    const ref = tvSessionDocRef(code);
    if (!ref) return undefined;
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setState(snap.exists() ? snap.data() : null);
        setError('');
      },
      (err) => setError(err?.message || 'TV 세션 동기화 오류'),
    );
    return () => unsub();
  }, [code]);

  const publish = useCallback(
    async (patch, overrideCode) => {
      const effectiveCode = overrideCode || code;
      if (!effectiveCode || role !== 'phone') return false;
      try {
        await patchTvSession(effectiveCode, patch);
        return true;
      } catch (e) {
        setError(e?.message || 'TV 상태 전송 실패');
        return false;
      }
    },
    [code, role],
  );

  const initSession = useCallback(
    async (payload, overrideCode) => {
      const effectiveCode = overrideCode || code;
      if (!effectiveCode) return false;
      try {
        await initTvSession(effectiveCode, payload);
        setError('');
        return true;
      } catch (e) {
        setError(e?.message || 'TV 세션 생성 실패');
        return false;
      }
    },
    [code],
  );

  return { state, publish, initSession, error };
}

export default useTVDisplaySync;
