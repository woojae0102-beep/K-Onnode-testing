// @ts-nocheck
import { GROUP_DATA as CORE_GROUP_DATA } from '../data/groupPracticeData';
import { buildAliasIndex } from '../data/kpopGroupRegistry';

const DYNAMIC_GROUPS_KEY = 'onnode_dynamic_groups_v1';
const MIN_CONFIDENCE = 8;

/** 레이블/방송 채널 — 단독으로는 그룹 추론 금지 */
export const LABEL_NOISE = new Set([
  'hybe', 'bighit', 'big hit', 'jyp', 'jyp entertainment', 'sm entertainment', 'smtown', 'sm town',
  'yg entertainment', 'ygfamily', 'starship', 'pledis', 'cube entertainment', 'fantagio', 'ador',
  'kakao entertainment', '1thek', 'mnet', 'studio choom', 'm2', 'kbs world', 'inkigayo', 'music bank',
  'official', 'topic', 'genie music', 'melon', 'bugs',
]);

const memoryDynamic = {};

function norm(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function slugify(text) {
  return norm(text).replace(/[^a-z0-9\u3131-\uD79D]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

function loadDynamicGroups() {
  if (typeof window === 'undefined') return { ...memoryDynamic };
  try {
    const raw = window.localStorage.getItem(DYNAMIC_GROUPS_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return { ...stored, ...memoryDynamic };
  } catch {
    return { ...memoryDynamic };
  }
}

function persistDynamicGroups(all) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DYNAMIC_GROUPS_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('onnode-dynamic-groups-update'));
  } catch {
    /* ignore */
  }
}

function stripGroupMeta(group) {
  if (!group) return null;
  const { aliases, isDynamic, createdAt, ...rest } = group;
  return rest;
}

/** 정적 + 동적 그룹 통합 카탈로그 (GROUP_DATA는 groupPracticeData에서 확장 병합됨) */
export function getFullGroupCatalog() {
  return {
    ...CORE_GROUP_DATA,
    ...loadDynamicGroups(),
  };
}

export function getGroupData(groupId) {
  if (!groupId) return null;
  const dynamic = loadDynamicGroups()[groupId];
  if (dynamic) return stripGroupMeta(dynamic);
  return CORE_GROUP_DATA[groupId] || null;
}

let aliasIndex = null;
function getAliasIndex() {
  if (!aliasIndex) {
    aliasIndex = buildAliasIndex(getFullGroupCatalog());
  }
  return aliasIndex;
}

export function invalidateGroupCatalogCache() {
  aliasIndex = null;
}

function isLabelText(text) {
  const n = norm(text);
  if (!n) return true;
  return [...LABEL_NOISE].some((label) => n === label || n.includes(label));
}

function containsAlias(combined, alias) {
  const a = norm(alias);
  if (!a || a.length < 2 || LABEL_NOISE.has(a)) return false;
  if (a.length <= 3) {
    return new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(combined);
  }
  return combined.includes(a);
}

function scoreTextAgainstCatalog(text, weight = 1) {
  const combined = norm(text);
  if (!combined || isLabelText(combined)) return [];

  const scores = {};
  getAliasIndex().forEach(({ groupId, alias }) => {
    if (containsAlias(combined, alias)) {
      scores[groupId] = Math.max(scores[groupId] || 0, (6 + alias.length) * weight);
    }
  });
  return Object.entries(scores).map(([groupId, score]) => ({ groupId, score }));
}

export function extractTitleArtist(title) {
  const raw = String(title || '').trim();
  const parts = raw.split(/\s*[-|–:]\s*/);
  if (parts.length > 1) {
    const first = parts[0].trim();
    if (first.length >= 2 && first.length <= 40 && !/official|mv|music video|audio|performance/i.test(first)) {
      return first;
    }
  }
  return '';
}

export function resolveGroupFromTrendItem(item) {
  const title = item?.title || '';
  const artist = item?.artist || '';
  const channel = item?.channel || '';
  const titleArtist = extractTitleArtist(title);

  const scoreMap = {};

  scoreTextAgainstCatalog(titleArtist, 3).forEach(({ groupId, score }) => {
    scoreMap[groupId] = (scoreMap[groupId] || 0) + score;
  });
  scoreTextAgainstCatalog(artist, 2.5).forEach(({ groupId, score }) => {
    scoreMap[groupId] = (scoreMap[groupId] || 0) + score;
  });
  scoreTextAgainstCatalog(title, 1.5).forEach(({ groupId, score }) => {
    scoreMap[groupId] = (scoreMap[groupId] || 0) + score;
  });

  if (!isLabelText(channel)) {
    scoreTextAgainstCatalog(channel, 1).forEach(({ groupId, score }) => {
      scoreMap[groupId] = (scoreMap[groupId] || 0) + score;
    });
  }

  const ranked = Object.entries(scoreMap)
    .map(([groupId, score]) => ({ groupId, score }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length >= 2 && ranked[0].score - ranked[1].score < 4) {
    return { groupId: null, confidence: 0, artistHint: titleArtist || artist, group: null };
  }

  const best = ranked[0];
  if (best && best.score >= MIN_CONFIDENCE) {
    return {
      groupId: best.groupId,
      confidence: best.score,
      artistHint: titleArtist || artist,
      group: getGroupData(best.groupId),
    };
  }

  return { groupId: null, confidence: 0, artistHint: titleArtist || artist, group: null };
}

function buildPlaceholderMembers(count) {
  const COLORS = ['#FF6348', '#FFD700', '#FF1F8E', '#A78BFA', '#6EE7B7', '#93C5FD', '#FCD34D', '#F87171'];
  const AVATARS = ['⭐', '💫', '🌟', '✨', '💖', '🔥', '💜', '💙'];
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    return {
      id: `member-${i + 1}`,
      name: `Member ${i + 1}`,
      nameKr: `멤버 ${i + 1}`,
      color: COLORS[i % COLORS.length],
      avatar: AVATARS[i % AVATARS.length],
      defaultX: t,
      defaultY: 0.4,
      position: { default: { x: t, y: 0.4 } },
    };
  });
}

function inferDefaultMemberCount(artistName) {
  const n = norm(artistName);
  if (/\biu\b|아이유|solo/.test(n)) return 1;
  if (/seventeen|13/.test(n)) return 13;
  return 5;
}

export function ensureGroupForArtist(artistName, hints = {}) {
  const name = String(artistName || '').trim();
  if (!name || name.length < 2 || isLabelText(name)) return null;

  const resolved = resolveGroupFromTrendItem({ title: `${name} -`, artist: name });
  if (resolved.groupId) return resolved.groupId;

  const id = slugify(name);
  if (!id) return null;

  const catalog = loadDynamicGroups();
  if (catalog[id]) return id;
  if (CORE_GROUP_DATA[id]) return id;

  const memberCount = hints.memberCount || inferDefaultMemberCount(name);
  const group = {
    name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    nameKr: hints.nameKr || name,
    memberCount,
    defaultFormation: memberCount <= 4 ? 'diamond' : 'line',
    aliases: [name, id],
    members: buildPlaceholderMembers(memberCount),
    isDynamic: true,
    createdAt: Date.now(),
  };

  catalog[id] = group;
  memoryDynamic[id] = group;
  persistDynamicGroups(catalog);
  invalidateGroupCatalogCache();
  return id;
}

export function ensureGroupForTrendItem(item) {
  const resolved = resolveGroupFromTrendItem(item);
  if (resolved.groupId) return resolved.groupId;

  const hint = resolved.artistHint || extractTitleArtist(item?.title) || item?.artist;
  if (hint && !isLabelText(hint)) {
    return ensureGroupForArtist(hint);
  }
  return null;
}

export function assertSongGroupMatch(song, source) {
  if (!song?.groupId || !source) return true;
  const resolved = resolveGroupFromTrendItem(source);
  if (!resolved.groupId || resolved.confidence < MIN_CONFIDENCE) return true;
  return song.groupId === resolved.groupId;
}

export default getGroupData;
