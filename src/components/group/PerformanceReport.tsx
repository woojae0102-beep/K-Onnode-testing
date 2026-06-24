// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSongById } from '../../data/groupStudioSongs';
import { GROUP_DATA } from '../../data/groupPracticeData';
import '../../styles/group-studio.css';
import PracticeComparisonPanel from '../common/PracticeComparisonPanel';
import PracticeResultActions from '../common/PracticeResultActions';
import ShortsCreatorView from '../../views/ShortsCreatorView';

function scoreColor(v) {
  if (v > 80) return '#00FF88';
  if (v > 60) return '#FFD700';
  return '#FF4444';
}

export function PerformanceReport({ result, songId, memberId, comparison, onRetry, onHome }) {
  const { t } = useTranslation();
  const song = getSongById(songId);
  const group = song ? GROUP_DATA[song.groupId] : null;
  const member = group?.members.find((m) => m.id === memberId);
  const [coachReview, setCoachReview] = useState('');
  const [loading, setLoading] = useState(true);
  const [showShorts, setShowShorts] = useState(false);

  const sync = result?.syncScores || result?.scores || {};
  const overall = result?.overall || result?.avgScore || sync.overall || 0;
  const duration = result?.duration || 0;
  const missedBeats = result?.missedBeats ?? 0;
  const worstMoments = result?.worstMoments || [];
  const bestMoments = result?.bestMoments || [];
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);

  const formatMoment = (timeSec) => {
    const m = Math.floor(timeSec / 60);
    const s = Math.floor(timeSec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const metrics = ['position', 'timing', 'pose', 'formation', 'energy'];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/group/group-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: song?.groupId,
            memberId,
            groupName: group?.nameKr,
            memberName: member?.nameKr,
            songTitle: song?.title,
            overall,
            duration,
            scores: sync,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.feedback) setCoachReview(data.feedback);
        }
      } catch {
        /* fallback */
      }
      if (!cancelled) {
        setCoachReview(
          (prev) =>
            prev ||
            (overall >= 80
              ? t('groupStudio.feedback.excellent', { song: song?.title, member: member?.nameKr })
              : overall >= 60
                ? t('groupStudio.feedback.good', { song: song?.title })
                : t('groupStudio.feedback.start', { song: song?.title })),
        );
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [song, group, member, memberId, overall, duration, sync]);

  return (
    <div className="group-studio">
      <div className="group-studio-ambient" />
      <div className="group-studio-inner">
        <header style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', margin: '0 0 12px' }}>
            {t('groupStudio.reportTag')}
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{song?.title}</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            {group?.nameKr} · {member?.nameKr} · {mins}:{secs.toString().padStart(2, '0')}
          </p>
        </header>

        <div
          style={{
            textAlign: 'center',
            padding: '28px 20px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${member?.color || '#FF1F8E'}33`,
            borderRadius: 20,
            marginBottom: 24,
          }}
        >
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', letterSpacing: '0.1em' }}>
            {t('groupStudio.overallSync')}
          </p>
          <div style={{ fontSize: 72, fontWeight: 900, color: scoreColor(overall), lineHeight: 1 }}>
            {overall}
          </div>
        </div>

        <div className="group-studio-sync-grid">
          {metrics.map((key) => (
            <div key={key} className="group-studio-sync-item">
              <span>{t(`groupStudio.metrics.${key}`)}</span>
              <strong style={{ color: scoreColor(sync[key] || 0) }}>{sync[key] || 0}</strong>
            </div>
          ))}
        </div>

        {(missedBeats > 0 || worstMoments.length > 0 || bestMoments.length > 0) ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div className="group-studio-sync-item">
              <span>놓친 박자</span>
              <strong style={{ color: missedBeats > 3 ? '#FF4444' : '#FFD700' }}>{missedBeats}</strong>
            </div>
            {worstMoments.length > 0 ? (
              <div className="group-studio-sync-item">
                <span>최악 구간</span>
                <strong style={{ color: '#FF4444', fontSize: 13 }}>
                  {worstMoments.map(formatMoment).join(' · ')}
                </strong>
              </div>
            ) : null}
            {bestMoments.length > 0 ? (
              <div className="group-studio-sync-item">
                <span>최고 구간</span>
                <strong style={{ color: '#00FF88', fontSize: 13 }}>
                  {bestMoments.map(formatMoment).join(' · ')}
                </strong>
              </div>
            ) : null}
          </div>
        ) : null}

        <PracticeComparisonPanel
          comparison={comparison}
          accent={member?.color || song?.albumColor || '#FF1F8E'}
          dark
        />

        <div
          style={{
            padding: '20px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: member?.color, marginBottom: 10 }}>
            {t('groupStudio.coachReview')}
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, margin: 0 }}>
            {loading ? t('groupStudio.generating') : coachReview}
          </p>
        </div>

        <PracticeResultActions
          onRetry={onRetry}
          onHome={onHome}
          onShorts={() => setShowShorts(true)}
          accent={song?.albumColor || '#FF1F8E'}
          dark
        />
      </div>
      {showShorts ? (
        <ShortsCreatorView
          videoBlob={result?.recordedBlob}
          scoreData={result?.scoreTimeline}
          trackType="group"
          groupId={song?.groupId}
          memberId={memberId}
          overallScore={overall}
          onClose={() => setShowShorts(false)}
        />
      ) : null}
    </div>
  );
}

export default PerformanceReport;
