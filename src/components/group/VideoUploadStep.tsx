// @ts-nocheck
import React, { useRef, useState } from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { useVideoAnalysis } from '../../hooks/useVideoAnalysis';
import { buildDanceDatabase, saveDanceDatabase } from '../../services/dance/DanceDatabaseService';
import MemberAutoDetect from './MemberAutoDetect';

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];

export function VideoUploadStep({ groupId, memberId, onExtracted, onBack }) {
  const group = GROUP_DATA[groupId];
  const member = group?.members.find((m) => m.id === memberId);
  const fileInputRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [phase, setPhase] = useState('upload');
  const [localError, setLocalError] = useState('');

  const { analyzeVideo, progress, statusMessage, isAnalyzing, error, cancel } = useVideoAnalysis();

  if (!group || !member) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      alert('mp4, mov, webm 형식의 영상만 업로드할 수 있습니다.');
      return;
    }
    setVideoFile(file);
    setLocalError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const startAnalysis = async () => {
    if (!videoFile) return;
    setPhase('analyzing');
    setLocalError('');

    try {
      const result = await analyzeVideo(videoFile);
      setAnalysisResult(result);
      setPhase('confirm');
    } catch (err) {
      setLocalError(err?.message || '분석에 실패했습니다.');
      setPhase('upload');
    }
  };

  const handleRetry = () => {
    cancel();
    setAnalysisResult(null);
    setPhase('upload');
    setLocalError('');
  };

  if (phase === 'confirm' && analysisResult) {
    return (
      <MemberAutoDetect
        groupId={groupId}
        myMemberId={memberId}
        analysisResult={analysisResult}
        onConfirm={async (trackToMemberMap) => {
          const danceDb = buildDanceDatabase({
            groupId,
            songId: `${groupId}-upload`,
            userMemberId: memberId,
            analysisResult,
            trackToMember: trackToMemberMap,
          });
          await saveDanceDatabase(danceDb);
          const frames = danceDb.skeletonFrames;
          if (!frames.length) {
            setLocalError('매칭된 AI 멤버 데이터가 없습니다. 멤버 매칭을 다시 확인해주세요.');
            setPhase('upload');
            return;
          }
          onExtracted(frames, {
            detectedMemberCount: analysisResult.detectedMemberCount,
            trackCount: trackToMemberMap.size,
            danceDatabase: danceDb,
          });
        }}
        onRetry={handleRetry}
      />
    );
  }

  if (phase === 'analyzing' || isAnalyzing) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#030308',
          padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
            영상 분석 중
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 24, lineHeight: 1.6 }}>
            {statusMessage}
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${member.color}, #6C5CE7)`,
                transition: 'width 0.25s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: member.color }}>{progress}%</div>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              marginTop: 24,
              padding: '8px 16px',
              background: 'none',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.5)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
        </div>
      </div>
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
            인원 자동 감지 + 멤버 추적으로 AI 아바타 동작을 분리합니다
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
            mp4 · mov · webm · 전체 멤버가 보이는 영상 권장
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

        {(localError || error) ? (
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
            {localError || error}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!videoFile}
          onClick={startAnalysis}
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
          {videoFile ? '분석 시작 (인원 자동 감지)' : '영상을 먼저 선택하세요'}
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
          💡 포메이션 변경·가림에도 추적 ID를 유지합니다. 분석 후 멤버 매칭을 직접 확인할 수
          있습니다. 원본 영상은 저장하지 않습니다.
        </div>
      </div>
    </div>
  );
}

export default VideoUploadStep;
