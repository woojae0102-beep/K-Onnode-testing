// @ts-nocheck
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSongById } from '../../data/groupStudioSongs';
import { getGroupData } from '../../data/groupPracticeData';
import { isMemberFavorite, toggleMemberFavorite } from '../../services/groupStudioStorage';
import '../../styles/group-studio.css';

export function PositionPicker({ songId, onSelect, onBack }) {
  const { t } = useTranslation();
  const song = getSongById(songId);
  const group = song ? getGroupData(song.groupId) : null;
  const [hoveredMember, setHoveredMember] = useState(null);
  const [favMembers, setFavMembers] = useState({});

  if (!song || !group) return null;

  const hovered = group.members.find((m) => m.id === hoveredMember);

  const handleFavMember = (e, memberId) => {
    e.stopPropagation();
    toggleMemberFavorite(song.groupId, memberId);
    setFavMembers((prev) => ({
      ...prev,
      [memberId]: isMemberFavorite(song.groupId, memberId),
    }));
  };

  return (
    <div className="group-studio">
      <div className="group-studio-ambient" />
      <div className="group-studio-inner">
        <button type="button" className="group-studio-back" onClick={onBack}>
          {t('groupStudio.home.back')}
        </button>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)', margin: '0 0 8px' }}>
            {song.title}
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
            {t('groupStudio.position.title')}
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            {t('groupStudio.position.subtitle', { group: group.nameKr, count: group.memberCount - 1 })}
          </p>
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
            paddingBottom: '56.25%',
            background: '#0a0a14',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            marginBottom: 24,
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0a0a14 0%, #050510 100%)' }} />
          {group.members.map((member) => {
            const isHovered = hoveredMember === member.id;
            const isFav = favMembers[member.id] ?? isMemberFavorite(song.groupId, member.id);
            return (
              <button
                key={member.id}
                type="button"
                onMouseEnter={() => setHoveredMember(member.id)}
                onMouseLeave={() => setHoveredMember(null)}
                onClick={() => onSelect(member.id)}
                style={{
                  position: 'absolute',
                  left: `${member.defaultX * 100}%`,
                  top: `${member.defaultY * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: isHovered ? 64 : 52,
                  height: isHovered ? 64 : 52,
                  borderRadius: '50%',
                  background: isHovered ? `${member.color}44` : `${member.color}22`,
                  border: `2px solid ${isHovered ? member.color : `${member.color}66`}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: isHovered ? `0 0 24px ${member.color}60` : `0 0 8px ${member.color}20`,
                  zIndex: isHovered ? 10 : 1,
                }}
              >
                <span style={{ fontSize: isHovered ? 22 : 18 }}>{member.avatar}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: member.color, marginTop: 2 }}>
                  {member.nameKr}
                </span>
                {isFav ? (
                  <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 10 }}>★</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {hovered ? (
          <div
            style={{
              padding: '16px 20px',
              background: `${hovered.color}11`,
              border: `1px solid ${hovered.color}33`,
              borderRadius: 12,
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
              {t('groupStudio.position.practiceAs', { member: hovered.nameKr })}
            </div>
            <button
              type="button"
              onClick={(e) => handleFavMember(e, hovered.id)}
              style={{
                marginTop: 8,
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {(favMembers[hovered.id] ?? isMemberFavorite(song.groupId, hovered.id))
                ? t('groupStudio.position.unfavMember')
                : t('groupStudio.position.favMember')}
            </button>
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(group.memberCount, 3)}, 1fr)`,
            gap: 8,
          }}
        >
          {group.members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(member.id)}
              style={{
                padding: '12px 8px',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${member.color}33`,
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{member.avatar}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: member.color }}>{member.nameKr}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PositionPicker;
