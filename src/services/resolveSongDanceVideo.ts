// @ts-nocheck
import { searchYoutubeDance } from './groupStudioApi';
import { getSongVideo, saveSongVideo } from './groupStudioStorage';
import {
  buildDancePracticeQuery,
  isValidPracticeVideoSaved,
  pickBestDancePracticeVideo,
  isMusicVideoTitle,
} from '../utils/dancePracticeVideo';

export async function resolveSongDanceVideo(song, { force = false } = {}) {
  if (!song?.id) return null;

  const saved = getSongVideo(song.id);
  if (!force && isValidPracticeVideoSaved(saved)) {
    return saved;
  }

  const query = buildDancePracticeQuery(song);
  const items = await searchYoutubeDance(query, 10);
  const best = pickBestDancePracticeVideo(items);

  if (!best?.videoId) {
    return saved?.videoId && !isMusicVideoTitle(saved.title) ? saved : null;
  }

  const entry = {
    videoId: best.videoId,
    youtubeUrl: best.youtubeUrl,
    title: best.title,
    durationSec: best.durationSec,
    videoType: 'dance_practice',
  };
  saveSongVideo(song.id, entry);
  return entry;
}

export default resolveSongDanceVideo;
