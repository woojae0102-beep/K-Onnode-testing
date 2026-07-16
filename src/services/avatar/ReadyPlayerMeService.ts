// @ts-nocheck
/**
 * Ready Player Me — stylized persona GLB 생성/캐시
 * VITE_RPM_SUBDOMAIN 설정 시 커스텀 아바타 URL 사용
 */
import { GROUP_DATA } from '../../data/groupPracticeData';

const RPM_SUBDOMAIN = import.meta.env.VITE_RPM_SUBDOMAIN || '';
const AVATAR_CACHE_DB = 'onnode_avatar_assets_v1';
const AVATAR_STORE = 'avatars';

/** 멤버별 시각 구분용 RPM 데모 GLB 풀 (생성 API 미연결 시 사용) */
const DEMO_GLB_POOL = [
  'https://models.readyplayer.me/64bfa15f0e72fc558b8f1144.glb?meshLod=0&textureAtlas=1024',
  'https://models.readyplayer.me/64bfa1670e72fc558b8f1145.glb?meshLod=0&textureAtlas=1024',
  'https://models.readyplayer.me/64bfa1880e72fc558b8f1146.glb?meshLod=0&textureAtlas=1024',
  'https://models.readyplayer.me/64bfa1a90e72fc558b8f1147.glb?meshLod=0&textureAtlas=1024',
  'https://models.readyplayer.me/64bfa1ca0e72fc558b8f1148.glb?meshLod=0&textureAtlas=1024',
  'https://models.readyplayer.me/64bfa1eb0e72fc558b8f1149.glb?meshLod=0&textureAtlas=1024',
  'https://models.readyplayer.me/64bfa20c0e72fc558b8f1150.glb?meshLod=0&textureAtlas=1024',
  'https://models.readyplayer.me/64bfa22d0e72fc558b8f1151.glb?meshLod=0&textureAtlas=1024',
];

function hashMemberSeed(memberId: string) {
  let h = 0;
  for (let i = 0; i < memberId.length; i += 1) {
    h = (h * 31 + memberId.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickDemoGlb(memberId: string) {
  return DEMO_GLB_POOL[hashMemberSeed(memberId) % DEMO_GLB_POOL.length];
}

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
  return pickDemoGlb(memberId);
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
