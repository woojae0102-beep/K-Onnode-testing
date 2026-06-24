// @ts-nocheck
import { useEffect, useState } from 'react';
import { preloadGroupAvatars } from '../services/avatar/ReadyPlayerMeService';

export function useGroupAvatarAssets(groupId: string, memberIds: string[]) {
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!groupId || !memberIds?.length) {
      setAssets({});
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    preloadGroupAvatars(groupId, memberIds)
      .then((map) => {
        if (!cancelled) setAssets(map);
      })
      .catch(() => {
        if (!cancelled) setAssets({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, memberIds.join(',')]);

  return { assets, loading };
}

export default useGroupAvatarAssets;
