// @ts-nocheck
import React, { useEffect, useMemo } from 'react';

const TRACK_INFO = {
  dance: { label: '댄스 연습', icon: '댄스', color: '#FF1F8E' },
  vocal: { label: '보컬 연습', icon: '보컬', color: '#6C5CE7' },
  group: { label: '그룹 연습', icon: '그룹', color: '#00B894' },
  korean: { label: '한국어 연습', icon: '한국어', color: '#F39C12' },
};

export default function ShortsPreview({ videoBlob, scoreData, trackType, onGenerateShorts, isGenerating, progress }) {
  const info = TRACK_INFO[trackType] || TRACK_INFO.dance;
  const videoUrl = useMemo(() => (videoBlob ? URL.createObjectURL(videoBlob) : ''), [videoBlob]);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.42)', marginBottom: 8 }}>
          연습 완료
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>쇼츠로 만들어볼까요?</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.52)' }}>최고 점수 구간을 세로형 쇼츠로 자동 편집합니다.</div>
      </div>

      <div style={{ width: '100%', aspectRatio: '9 / 16', maxHeight: 360, background: '#0a0a14', borderRadius: 18, overflow: 'hidden', marginBottom: 18, position: 'relative', border: '1px solid rgba(255,255,255,0.08)' }}>
        {videoUrl ? (
          <video src={videoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', padding: 20, textAlign: 'center' }}>
            녹화 영상이 없어 점수 카드 기반 쇼츠를 생성합니다.
          </div>
        )}
        <div style={{ position: 'absolute', top: 12, left: 12, padding: '6px 10px', background: 'rgba(0,0,0,0.72)', borderRadius: 999, fontSize: 12, color: '#fff', border: `1px solid ${info.color}66` }}>
          {info.label}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        {['자동 하이라이트', 'ONNODE 워터마크', '9:16 세로 변환', '캡션 삽입'].map((label) => (
          <div key={label} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.42)' }}>자동 적용</div>
          </div>
        ))}
      </div>

      {isGenerating ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
            <span>쇼츠 생성 중</span>
            <span style={{ color: info.color }}>{progress}%</span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${info.color}, #6C5CE7)`, transition: 'width 0.25s' }} />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onGenerateShorts}
        disabled={isGenerating}
        style={{ width: '100%', padding: '15px 18px', border: 'none', borderRadius: 14, background: isGenerating ? 'rgba(255,31,142,0.35)' : 'linear-gradient(135deg, #FF1F8E, #6C5CE7)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: isGenerating ? 'not-allowed' : 'pointer', boxShadow: '0 0 28px rgba(255,31,142,0.32)' }}
      >
        {isGenerating ? '생성 중...' : '쇼츠 자동 생성'}
      </button>
    </div>
  );
}
