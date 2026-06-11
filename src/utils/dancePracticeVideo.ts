// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';

const RX_MV = /(official\s*(?:m\/?v|music\s*video|video|audio)|뮤직비디오|\bMV\b|M\/V|\(MV\)|music\s*video|teaser|lyric|가사|audio\s*ver)/i;
const RX_DANCE = /(dance\s*practice|dance\s*rehearsal|choreography|choreo|안무|연습|연습실|practice\s*room|rehearsal|studio\s*choom|스튜디오\s*춤|안무영상|안무연습|choreography\s*video|dance\s*cover\s*practice)/i;
const RX_EXCLUDE = /(reaction|리액션|vlog|브이로그|behind\s*the|making\s*film|interview|라이브|live\s*clip|fancam\s*edit|#shorts|쇼츠)/i;

export function isMusicVideoTitle(title) {
  return RX_MV.test(String(title || ''));
}

export function isDancePracticeTitle(title) {
  const t = String(title || '');
  if (RX_EXCLUDE.test(t)) return false;
  if (isMusicVideoTitle(t)) return false;
  return RX_DANCE.test(t);
}

export function scoreDancePracticeTitle(title) {
  const t = String(title || '');
  if (RX_EXCLUDE.test(t)) return -100;
  if (isMusicVideoTitle(t)) return -50;
  let score = 0;
  if (/dance\s*practice/i.test(t)) score += 30;
  if (/안무/i.test(t)) score += 28;
  if (/연습실|practice\s*room/i.test(t)) score += 25;
  if (/choreography|choreo/i.test(t)) score += 20;
  if (/studio\s*choom|스튜디오\s*춤/i.test(t)) score += 18;
  if (/rehearsal/i.test(t)) score += 12;
  return score;
}

export function buildDancePracticeQuery(song) {
  const group = GROUP_DATA[song?.groupId];
  const groupName = group?.name || song?.groupId || '';
  const groupKr = group?.nameKr || '';
  const title = song?.title || '';
  return `${groupName} ${groupKr} ${title} 안무 연습 dance practice`.trim();
}

export function pickBestDancePracticeVideo(items = []) {
  return items
    .map((item) => ({ item, score: scoreDancePracticeTitle(item.title) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item || null;
}

export function isValidPracticeVideoSaved(saved) {
  if (!saved?.videoId) return false;
  if (saved.videoType === 'dance_practice') return true;
  if (saved.title && isDancePracticeTitle(saved.title)) return true;
  if (saved.title && isMusicVideoTitle(saved.title)) return false;
  return saved.videoType !== 'music_video';
}
