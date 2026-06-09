// @ts-nocheck
import React, { useRef, useState } from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { useSkeletonExtract } from '../../hooks/useSkeletonExtract';
import SkeletonExtractor from './SkeletonExtractor';

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];

export function VideoUploadStep({ groupId, memberId, onExtracted, onBack }) {
  const group = GROUP_DATA[groupId];
  const member = group?.members.find((m) => m.id === memberId);
  const fileInputRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const { isExtracting, progress, step, error, videoRef, extractFromFile } = useSkeletonExtract();

  if (!group || !member) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      alert('mp4, mov, webm 형식의 영상만 업로드할 수 있습니다.');
      return;
    }
    setVideoFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleStartExtraction = async () => {
    if (!videoFile) return;
    const data = await extractFromFile(videoFile, groupId);
    if (data) {
      setTimeout(() => onExtracted(data), 600);
    }
  };

  if (isExtracting) {
    return (
      <>
        <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
        <SkeletonExtractor progress={progress} step={step} memberCount={group.memberCount} />
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#030308',
        padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px calc(40px + env(safe-area-inset-bottom, 0px))',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />

      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 13,
          cursor: 'pointer',
          marginBottom: 24,
        }}
      >
        ← 뒤로
      </button>

      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            레퍼런스 영상 업로드
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            {group.nameKr} · {member.nameKr} 파트 연습용 영상을 올려주세요
            <br />
            원본 영상은 저장하지 않고 스켈레톤 데이터만 추출합니다
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            padding: '32px 24px',
            background: 'rgba(255,255,255,0.03)',
            border: '2px dashed rgba(255,255,255,0.12)',
            borderRadius: 16,
            cursor: 'pointer',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 15, color: '#fff', fontWeight: 600, marginBottom: 4 }}>
            {videoFile ? videoFile.name : '영상 파일 선택'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            mp4 · mov · webm 지원
          </div>
        </button>

        {previewUrl ? (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <video
              src={previewUrl}
              controls
              style={{ width: '100%', maxHeight: 240, display: 'block', background: '#000' }}
            />
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid rgba(255,68,68,0.3)',
              borderRadius: 10,
              color: '#FF4444',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!videoFile}
          onClick={handleStartExtraction}
          style={{
            width: '100%',
            padding: '16px',
            background: videoFile
              ? `linear-gradient(135deg, ${member.color}, #FF1F8E)`
              : 'rgba(255,255,255,0.06)',
            border: 'none',
            borderRadius: 12,
            color: videoFile ? '#fff' : 'rgba(255,255,255,0.3)',
            fontSize: 15,
            fontWeight: 600,
            cursor: videoFile ? 'pointer' : 'not-allowed',
            boxShadow: videoFile ? `0 0 24px ${member.color}40` : 'none',
          }}
        >
          {videoFile ? '스켈레톤 분석 시작' : '영상을 먼저 선택하세요'}
        </button>

        <div
          style={{
            marginTop: 24,
            padding: '14px 16px',
            background: 'rgba(0,255,136,0.06)',
            border: '1px solid rgba(0,255,136,0.15)',
            borderRadius: 10,
            fontSize: 12,
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.6,
          }}
        >
          💡 저작권 보호: 원본 영상은 분석 후 즉시 삭제되며, 스켈레톤 좌표만 사용합니다.
          그룹 멤버 {group.memberCount}명의 동작이 AI 아바타로 재현됩니다.
        </div>
      </div>
    </div>
  );
}

export default VideoUploadStep;
