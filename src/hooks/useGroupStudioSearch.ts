// @ts-nocheck
import { useMemo, useState } from 'react';
import { STUDIO_SONGS } from '../data/groupStudioSongs';

function normalize(q) {
  return (q || '').trim().toLowerCase();
}

export function useGroupStudioSearch(songs = STUDIO_SONGS) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];

    return songs.filter((song) =>
      song.searchTags.some((tag) => normalize(tag).includes(q)),
    );
  }, [query, songs]);

  return { query, setQuery, results, hasQuery: normalize(query).length > 0 };
}

export default useGroupStudioSearch;
