// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';

function norm(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const EXTRA_ALIASES = {
  blackpink: ['blackpink', '블랙핑크', 'blink', 'yg'],
  twice: ['twice', '트와이스', 'jyp'],
  bts: ['bts', '방탄', 'bangtan', 'hybe', 'bighit'],
  itzy: ['itzy', '있지', 'it\'z'],
  aespa: ['aespa', '에스파', 'sm town', 'smtown'],
  ive: ['ive', '아이브', 'starship'],
  newjeans: ['newjeans', '뉴진스', 'ador'],
};

export function inferGroupId(...texts) {
  const combined = norm(texts.filter(Boolean).join(' '));
  if (!combined) return null;

  for (const [groupId, group] of Object.entries(GROUP_DATA)) {
    const names = [group.name, group.nameKr, groupId].map(norm).filter(Boolean);
    if (names.some((name) => name.length > 2 && combined.includes(name))) {
      return groupId;
    }
  }

  for (const [groupId, aliases] of Object.entries(EXTRA_ALIASES)) {
    if (aliases.some((alias) => combined.includes(norm(alias)))) {
      return groupId;
    }
  }

  return null;
}

export default inferGroupId;
