// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { getSongById } from '../../data/groupStudioSongs';
import { GROUP_DATA } from '../../data/groupPracticeData';
import {
  getSongPracticeCount,
  isSongFavorite,
  toggleSongFavorite,
  addRecentSong,
} from '../../services/groupStudioStorage';
import '../../styles/group-studio.css';

const DIFFICULTY_LABELS = ['', 'Easy', 'Normal', 'Medium', 'Hard', 'Expert'];

export function SongDetailScreen({ songId, onStart, onBack }) {
  const song = getSongById(songId);
  const group = song ? GROUP_DATA[song.groupId] : null;
  const [fav, setFav] = useState(false);
  const [practiceCount, setPracticeCount] = useState(0);

  useEffect(() => {
    if (!songId) return;
    setFav(isSongFavorite(songId));
    setPracticeCount(getSongPracticeCount(songId));
    addRecentSong(songId);
  }, [songId]);

  if (!song || !group) return null;

  const handleFav = () => {
    toggleSongFavorite(songId);
    setFav(isSongFavorite(songId));
  };

  return (
    <div className="group-studio">
      <div className="group-studio-ambient" />
      <div className="group-studio-inner">
        <button type="button" className="group-studio-back" onClick={onBack}>
          ← 뒤로
        </button>

        <div className="group-studio-detail-hero">
          <div
            className="group-studio-detail-art"
            style={{
              background: `linear-gradient(145deg, ${song.albumColor}, ${song.albumColor2})`,
            }}
          />
          <div className="group-studio-detail-meta">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1>{song.title}</h1>
                <p>{group.nameKr} · {group.name}</p>
              </div>
              <button type="button" className="group-studio-fav-btn" onClick={handleFav}>
                {fav ? '★' : '☆'}
              </button>
            </div>
          </div>
        </div>

        <div className="group-studio-stats">
          <div className="group-studio-stat">
            BPM<strong>{song.bpm}</strong>
          </div>
          <div className="group-studio-stat">
            난이도<strong>{DIFFICULTY_LABELS[song.difficulty]}</strong>
          </div>
          <div className="group-studio-stat">
            연습 횟수<strong>{practiceCount}회</strong>
          </div>
          <div className="group-studio-stat">
            멤버<strong>{group.memberCount}인조</strong>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 28 }}>
          나머지 {group.memberCount - 1}명의 멤버가 AI 페르소나로 함께 연습합니다.
          내 포지션을 선택하고 그룹 스테이지에 합류하세요.
        </p>

        <button
          type="button"
          className="group-studio-start-btn"
          style={{
            background: `linear-gradient(135deg, ${song.albumColor}, ${song.albumColor2})`,
            boxShadow: `0 0 32px ${song.albumColor}50`,
          }}
          onClick={onStart}
        >
          Start Group Practice
        </button>
      </div>
    </div>
  );
}

export default SongDetailScreen;
