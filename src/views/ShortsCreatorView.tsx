// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import ShortsPreview from '../components/shorts/ShortsPreview';
import ShortsEditor from '../components/shorts/ShortsEditor';
import PlatformSelector from '../components/shorts/PlatformSelector';
import UploadProgress from '../components/shorts/UploadProgress';
import UploadResultCard from '../components/shorts/UploadResultCard';
import { useFFmpeg } from '../hooks/useFFmpeg';
import { useSocialUpload } from '../hooks/useSocialUpload';
import { GROUP_DATA } from '../data/groupPracticeData';

function trackLabel(type) {
  return {
    dance: 'K-POP 댄스 연습',
    vocal: 'K-POP 보컬 연습',
    group: '그룹 스튜디오 연습',
    korean: '한국어 발음 연습',
  }[type] || 'ONNODE AI 연습';
}

function defaultTags(trackType, groupId) {
  const tags = ['ONNODE', 'KPOP', 'AIcoach', 'KPOPpractice'];
  if (trackType === 'dance') tags.push('dance', 'KPOPdance', '댄스');
  if (trackType === 'vocal') tags.push('vocal', 'singing', '보컬');
  if (trackType === 'group') tags.push('groupdance', '그룹연습');
  if (trackType === 'korean') tags.push('Korean', '한국어', '발음');
  const group = groupId ? GROUP_DATA[groupId] : null;
  if (group?.name) tags.push(group.name, group.nameKr);
  return [...new Set(tags)].slice(0, 12);
}

function defaultCaption(trackType, groupId, memberId) {
  const group = groupId ? GROUP_DATA[groupId] : null;
  const member = group?.members?.find((m) => m.id === memberId);
  if (trackType === 'group' && group) {
    return `${group.nameKr} ${member?.nameKr ? `${member.nameKr} 파트 ` : ''}그룹 연습\nONNODE AI Coach로 트레이닝 중!`;
  }
  return `${trackLabel(trackType)}\nONNODE AI Coach와 함께 연습 중!`;
}

async function createTemplateVideoBlob({ trackType, score = 0, caption = '' }) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.start(250);
  const start = performance.now();
  await new Promise((resolve) => {
    const draw = () => {
      const elapsed = (performance.now() - start) / 1000;
      const grad = ctx.createLinearGradient(0, 0, 720, 1280);
      grad.addColorStop(0, '#030308');
      grad.addColorStop(1, '#271040');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 720, 1280);
      ctx.fillStyle = 'rgba(255,31,142,0.22)';
      ctx.beginPath();
      ctx.arc(360 + Math.sin(elapsed) * 80, 320, 260, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '700 54px Inter, Arial, sans-serif';
      ctx.fillText(trackLabel(trackType), 360, 430);
      ctx.font = '900 170px Inter, Arial, sans-serif';
      ctx.fillStyle = score >= 80 ? '#00FF88' : score >= 60 ? '#FFD700' : '#FF6B6B';
      ctx.fillText(String(Math.round(score || 0)), 360, 650);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '500 30px Inter, Arial, sans-serif';
      String(caption || 'ONNODE AI Coach').split('\n').slice(0, 3).forEach((line, i) => {
        ctx.fillText(line.slice(0, 28), 360, 780 + i * 42);
      });
      ctx.font = '800 28px Inter, Arial, sans-serif';
      ctx.fillStyle = '#FF1F8E';
      ctx.fillText('ONNODE AI COACH', 360, 1130);
      if (elapsed < 6) requestAnimationFrame(draw);
      else {
        recorder.stop();
        resolve();
      }
    };
    draw();
  });
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  return new Blob(chunks, { type: 'video/webm' });
}

export default function ShortsCreatorView({
  videoBlob,
  scoreData,
  trackType = 'dance',
  groupId = null,
  memberId = null,
  overallScore = 0,
  onClose,
}) {
  const [phase, setPhase] = useState('preview');
  const [sourceBlob, setSourceBlob] = useState(videoBlob || null);
  const [shortsBlob, setShortsBlob] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [caption, setCaption] = useState(() => defaultCaption(trackType, groupId, memberId));
  const [tags, setTags] = useState(() => defaultTags(trackType, groupId));
  const [uploadResults, setUploadResults] = useState([]);
  const { createShorts, createThumbnail, progress } = useFFmpeg();
  const { uploadMany, progressByPlatform, storageProgress } = useSocialUpload();

  useEffect(() => {
    setCaption(defaultCaption(trackType, groupId, memberId));
    setTags(defaultTags(trackType, groupId));
  }, [trackType, groupId, memberId]);

  const generateShorts = async () => {
    setIsGenerating(true);
    try {
      const input = sourceBlob || await createTemplateVideoBlob({ trackType, score: overallScore, caption });
      setSourceBlob(input);
      const blob = await createShorts({
        videoBlob: input,
        duration: 60,
        highlightScore: scoreData,
        addWatermark: true,
        addCaption: [{ start: 0, end: 3, text: trackLabel(trackType) }],
        trackType,
      });
      setShortsBlob(blob);
      setThumbnail(await createThumbnail(blob));
      setPhase('editing');
    } catch (err) {
      alert(err?.message || '쇼츠 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const startUpload = async () => {
    if (!shortsBlob || !selectedPlatforms.length) return;
    setPhase('uploading');
    const results = await uploadMany({
      platforms: selectedPlatforms,
      videoBlob: shortsBlob,
      caption,
      tags,
      trackType,
    });
    setUploadResults(results);
    setPhase('complete');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(3,3,8,0.97)', backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <button type="button" onClick={onClose} style={{ position: 'fixed', top: 18, right: 18, width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 22, cursor: 'pointer' }}>
        ×
      </button>
      <div style={{ width: '100%', maxWidth: 520, margin: 'auto' }}>
        {phase === 'preview' ? (
          <ShortsPreview videoBlob={sourceBlob} scoreData={scoreData} trackType={trackType} onGenerateShorts={generateShorts} isGenerating={isGenerating} progress={progress} />
        ) : null}
        {phase === 'editing' && shortsBlob ? (
          <ShortsEditor shortsBlob={shortsBlob} thumbnail={thumbnail} caption={caption} tags={tags} onCaptionChange={setCaption} onTagsChange={setTags} onNext={() => setPhase('platform_select')} onBack={() => setPhase('preview')} />
        ) : null}
        {phase === 'platform_select' ? (
          <PlatformSelector selectedPlatforms={selectedPlatforms} onSelect={setSelectedPlatforms} onUpload={startUpload} onBack={() => setPhase('editing')} />
        ) : null}
        {phase === 'uploading' ? (
          <UploadProgress platforms={selectedPlatforms} progressByPlatform={progressByPlatform} storageProgress={storageProgress} />
        ) : null}
        {phase === 'complete' ? (
          <div>
            <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 18 }}>업로드 결과</div>
            {uploadResults.map((result) => <UploadResultCard key={result.platform} result={result} />)}
            <button type="button" onClick={onClose} style={{ width: '100%', marginTop: 10, padding: 15, borderRadius: 12, border: 'none', background: '#FF1F8E', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
              완료
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
