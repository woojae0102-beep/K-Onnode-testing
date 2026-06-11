// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { getAllStudioSongs } from '../data/groupStudioSongs';
import { searchYoutubeDance } from '../services/groupStudioApi';

function normalize(q) {
  return (q || '').trim().toLowerCase();
}

export function useGroupStudioSearch() {
  const [query, setQuery] = useState('');
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [dynamicTick, setDynamicTick] = useState(0);

  useEffect(() => {
    const onUpdate = () => setDynamicTick((t) => t + 1);
    window.addEventListener('onnode-dynamic-songs-update', onUpdate);
    return () => window.removeEventListener('onnode-dynamic-songs-update', onUpdate);
  }, []);

  const allSongs = useMemo(() => getAllStudioSongs(), [dynamicTick]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return allSongs.filter((song) =>
      song.searchTags?.some((tag) => normalize(tag).includes(q))
      || normalize(song.title).includes(q),
    );
  }, [query, allSongs]);

  useEffect(() => {
    const q = normalize(query);
    if (q.length < 2) {
      setYoutubeResults([]);
      setYoutubeError('');
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setYoutubeLoading(true);
      setYoutubeError('');
      try {
        const items = await searchYoutubeDance(query, 6);
        if (!cancelled) setYoutubeResults(items);
      } catch (err) {
        if (!cancelled) {
          setYoutubeResults([]);
          setYoutubeError(err?.message || '');
        }
      } finally {
        if (!cancelled) setYoutubeLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return {
    query,
    setQuery,
    results,
    youtubeResults,
    youtubeLoading,
    youtubeError,
    hasQuery: normalize(query).length > 0,
  };
}

export default useGroupStudioSearch;
