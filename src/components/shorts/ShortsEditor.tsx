// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';

export default function ShortsEditor({
  shortsBlob,
  thumbnail,
  caption,
  tags,
  onCaptionChange,
  onTagsChange,
  onNext,
  onBack,
}) {
  const [tagInput, setTagInput] = useState((tags || []).join(', '));
  const videoUrl = useMemo(() => (shortsBlob ? URL.createObjectURL(shortsBlob) : ''), [shortsBlob]);
  const thumbUrl = useMemo(() => (thumbnail ? URL.createObjectURL(thumbnail) : ''), [thumbnail]);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  }, [videoUrl, thumbUrl]);

  const applyTags = (value) => {
    setTagInput(value);
    onTagsChange?.(
      value
        .split(',')
        .map((v) => v.trim().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 15),
    );
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>쇼츠 편집</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>캡션과 해시태그를 확인해 주세요.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, marginBottom: 16 }}>
        <div style={{ aspectRatio: '9 / 16', borderRadius: 14, overflow: 'hidden', background: '#0a0a14', border: '1px solid rgba(255,255,255,0.08)' }}>
          {videoUrl ? <video src={videoUrl} controls muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>캡션</label>
          <textarea
            value={caption}
            onChange={(e) => onCaptionChange?.(e.target.value)}
            rows={6}
            style={{ resize: 'vertical', minHeight: 120, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', padding: 12, fontSize: 13, lineHeight: 1.6 }}
          />
        </div>
      </div>

      <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>해시태그</label>
      <input
        value={tagInput}
        onChange={(e) => applyTags(e.target.value)}
        placeholder="ONNODE, KPOP, practice"
        style={{ width: '100%', marginTop: 8, marginBottom: 18, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '12px 14px', fontSize: 13 }}
      />

      {thumbUrl ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', marginBottom: 18 }}>
          <img src={thumbUrl} alt="" style={{ width: 54, height: 80, objectFit: 'cover', borderRadius: 8 }} />
          <div>
            <div style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>자동 썸네일 생성됨</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>업로드 플랫폼 정책에 따라 적용 여부가 달라질 수 있습니다.</div>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onBack} style={{ flex: 0.42, padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer' }}>
          이전
        </button>
        <button type="button" onClick={onNext} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#FF1F8E', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
          플랫폼 선택
        </button>
      </div>
    </div>
  );
}
