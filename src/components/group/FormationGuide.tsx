// @ts-nocheck
import React from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';

const FORMATION_LABELS = {
  line: '일자 대형',
  v_shape: 'V자 대형',
  diamond: '다이아몬드 대형',
  scattered: '자유 대형',
};

export function FormationGuide({ groupId, myMemberId }) {
  const group = GROUP_DATA[groupId];
  if (!group) return null;

  const myMember = group.members.find((m) => m.id === myMemberId);
  const formation = FORMATION_LABELS[group.defaultFormation] || '대형';

  return (
    <div
      style={{
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
      }}
    >
      <span style={{ color: myMember?.color || '#fff', fontWeight: 600 }}>
        {formation}
      </span>
      {' · '}
      {myMember?.nameKr} 포지션
    </div>
  );
}

export default FormationGuide;
