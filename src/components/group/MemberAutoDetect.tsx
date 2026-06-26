// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';
import type { AnalysisResult } from '../../services/videoAnalysisTypes';

export function MemberAutoDetect({
  groupId,
  myMemberId,
  analysisResult,
  onConfirm,
  onRetry,
}: {
  groupId: string;
  myMemberId: string;
  analysisResult: AnalysisResult;
  onConfirm: (trackToMemberMap: Map<number, string>) => void;
  onRetry: () => void;
}) {
  const group = GROUP_DATA[groupId];
  const otherMembers = group?.members.filter((m) => m.id !== myMemberId) || [];
  const detectedCount = analysisResult.detectedMemberCount;
  const [trackAssignments, setTrackAssignments] = useState(new Map());
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  useEffect(() => {
    const applyLocalFallback = () => {
      const trackIds = Array.from(analysisResult.trackIdToInitialPosition.keys());
      const sortedTracks = trackIds.sort((a, b) => {
        const posA = analysisResult.trackIdToInitialPosition.get(a)!;
        const posB = analysisResult.trackIdToInitialPosition.get(b)!;
        return posA.x - posB.x;
      });
      const sortedMembers = [...otherMembers].sort((a, b) => a.defaultX - b.defaultX);
      const initialMap = new Map();
      sortedTracks.forEach((trackId, i) => {
        if (sortedMembers[i]) initialMap.set(trackId, sortedMembers[i].id);
      });
      setTrackAssignments(initialMap);
    };

    applyLocalFallback();
    setLoadingSuggestions(false);
  }, [analysisResult, otherMembers]);

  if (!group) return null;

  const countMismatch = detectedCount !== group.memberCount;
  const trackIds = Array.from(analysisResult.trackIdToInitialPosition.keys());

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#030308',
        padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px calc(40px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: countMismatch ? 'rgba(255,68,68,0.15)' : 'rgba(0,255,136,0.15)',
              border: `2px solid ${countMismatch ? '#FF4444' : '#00FF88'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              margin: '0 auto 16px',
            }}
          >
            {countMismatch ? '⚠️' : '✓'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            {detectedCount}명을 감지했습니다
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            {countMismatch
              ? `${group.nameKr}은 ${group.memberCount}명입니다. 영상에 전체 멤버가 잘 나오는지 확인해주세요.`
              : `${group.nameKr} 전체 멤버가 정확히 감지됐어요`}
          </div>
          {loadingSuggestions ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
              포메이션 매칭 중...
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {trackIds.map((trackId) => {
            const assignedMemberId = trackAssignments.get(trackId);
            const assignedMember = otherMembers.find((m) => m.id === assignedMemberId);
            const pos = analysisResult.trackIdToInitialPosition.get(trackId);

            return (
              <div
                key={trackId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 600,
                  }}
                >
                  #{trackId}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', minWidth: 72 }}>
                  x:{pos ? pos.x.toFixed(2) : '—'}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>→</div>
                <select
                  value={assignedMemberId || ''}
                  onChange={(e) => {
                    const newMap = new Map(trackAssignments);
                    if (e.target.value) newMap.set(trackId, e.target.value);
                    else newMap.delete(trackId);
                    setTrackAssignments(newMap);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    padding: '8px 12px',
                    background: assignedMember
                      ? `${assignedMember.color}22`
                      : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${assignedMember?.color || 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 13,
                  }}
                >
                  <option value="">멤버 선택</option>
                  {otherMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nameKr}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
          내 파트({group.members.find((m) => m.id === myMemberId)?.nameKr})는 AI 아바타에서 제외됩니다.
          나머지 멤버 {otherMembers.length}명을 모두 매칭해야 연습을 시작할 수 있어요.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              flex: 0.4,
              padding: '14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            다시 분석
          </button>
          <button
            type="button"
            onClick={() => onConfirm(trackAssignments)}
            disabled={trackAssignments.size < otherMembers.length || loadingSuggestions}
            style={{
              flex: 1,
              padding: '14px',
              background:
                trackAssignments.size >= otherMembers.length && !loadingSuggestions
                  ? 'linear-gradient(135deg, #FF1F8E, #6C5CE7)'
                  : 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor:
                trackAssignments.size >= otherMembers.length && !loadingSuggestions
                  ? 'pointer'
                  : 'not-allowed',
            }}
          >
            확인하고 연습 시작
          </button>
        </div>
      </div>
    </div>
  );
}

export default MemberAutoDetect;
