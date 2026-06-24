// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { getGroupData } from '../../data/groupPracticeData';
import { getSongCoverCandidates, resolveSongCover } from '../../services/songCoverResolver';

export function SongAlbumArt({ song, size = 140, className = '', showGroupLabel = true }) {
  const group = song?.groupId ? getGroupData(song.groupId) : null;
  const candidates = useMemo(() => getSongCoverCandidates(song), [song]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState(null);

  useEffect(() => {
    setCandidateIndex(0);
    setResolvedUrl(null);
    if (!song?.id) return undefined;
    let cancelled = false;
    resolveSongCover(song).then((url) => {
      if (!cancelled && url) setResolvedUrl(url);
    });
    return () => { cancelled = true; };
  }, [song?.id]);

  const srcList = useMemo(() => {
    const list = resolvedUrl
      ? [resolvedUrl, ...candidates.filter((c) => c !== resolvedUrl)]
      : candidates;
    return [...new Set(list.filter(Boolean))];
  }, [resolvedUrl, candidates]);

  const src = srcList[candidateIndex] || null;
  const showImage = !!src && candidateIndex < srcList.length;
  const allFailed = candidateIndex >= srcList.length;

  const handleError = () => {
    setCandidateIndex((i) => i + 1);
  };

  return (
    <div
      className={`group-studio-song-art ${className}`}
      style={{
        width: size,
        height: size,
        background: showImage && !allFailed
          ? '#0a0a14'
          : `linear-gradient(135deg, ${song?.albumColor || '#333'}, ${song?.albumColor2 || '#555'})`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {showImage && !allFailed ? (
        <img
          key={src}
          src={src}
          alt={song?.title || ''}
          loading="lazy"
          onError={handleError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : null}
      {(allFailed || !showImage) && showGroupLabel ? (
        <span className="group-studio-song-art-label">{group?.nameKr || song?.title || ''}</span>
      ) : null}
    </div>
  );
}

export default SongAlbumArt;
