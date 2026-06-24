// @ts-nocheck
/**
 * Ready Player Me — stylized persona GLB 생성/캐시
 * VITE_RPM_SUBDOMAIN 설정 시 커스텀 아바타 URL 사용
 */
import { GROUP_DATA } from '../../data/groupPracticeData';

const RPM_SUBDOMAIN = import.meta.env.VITE_RPM_SUBDOMAIN || '';
const AVATAR_CACHE_DB = 'onnode_avatar_assets_v1';
const AVATAR_STORE = 'avatars';

const DEFAULT_DEMO_GLBS: Record<string, string> = {
  default:
    'https://models.readyplayer.me/64bfa15f0e72fc558b8f1144.glb?meshLod=0&textureAtlas=1024',
};

function openAvatarDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AVATAR_CACHE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AVATAR_STORE)) {
        db.createObjectStore(AVATAR_STORE, { keyPath: 'assetKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function buildAvatarAssetKey(groupId: string, memberId: string) {
  return `${groupId}/${memberId}`;
}

export function getReadyPlayerMeAvatarUrl(memberId: string, personaSeed?: string) {
  if (RPM_SUBDOMAIN && personaSeed) {
    return `https://models.readyplayer.me/${personaSeed}.glb?meshLod=0&textureAtlas=1024`;
  }
  return DEFAULT_DEMO_GLBS.default;
}

export async function getOrCreateMemberAvatar({
  groupId,
  memberId,
}: {
  groupId: string;
  memberId: string;
}) {
  const group = GROUP_DATA[groupId];
  const member = group?.members.find((m) => m.id === memberId);
  const assetKey = buildAvatarAssetKey(groupId, memberId);

  const db = await openAvatarDb();
  if (db) {
    const cached = await new Promise((resolve) => {
      const tx = db.transaction(AVATAR_STORE, 'readonly');
      const req = tx.objectStore(AVATAR_STORE).get(assetKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (cached?.glbUrl) return cached;
  }

  const glbUrl = getReadyPlayerMeAvatarUrl(memberId, `${groupId}-${memberId}`);
  const entry = {
    assetKey,
    groupId,
    memberId,
    memberNameKr: member?.nameKr || memberId,
    glbUrl,
    personaColor: member?.color || '#FF1F8E',
    provider: RPM_SUBDOMAIN ? 'ready-player-me' : 'ready-player-me-demo',
    savedAt: new Date().toISOString(),
  };

  if (db) {
    await new Promise((resolve) => {
      const tx = db.transaction(AVATAR_STORE, 'readwrite');
      tx.objectStore(AVATAR_STORE).put(entry);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  return entry;
}

export async function preloadGroupAvatars(groupId: string, memberIds: string[]) {
  const results = await Promise.all(
    memberIds.map((memberId) => getOrCreateMemberAvatar({ groupId, memberId })),
  );
  return Object.fromEntries(results.map((r) => [r.memberId, r]));
}

export default {
  getOrCreateMemberAvatar,
  preloadGroupAvatars,
  buildAvatarAssetKey,
};
