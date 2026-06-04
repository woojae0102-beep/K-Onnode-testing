// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import VideoUploader from '../components/teaching/VideoUploader';
import TeachingStepBar from '../components/teaching/TeachingStepBar';
import TeachingPracticePanel from '../components/teaching/TeachingPracticePanel';
import TeachingReviewPanel from '../components/teaching/TeachingReviewPanel';
import TeachingUploadFallback from '../components/teaching/TeachingUploadFallback';
import { AnalysisLoadingScreen } from '../components/teaching/AnalysisLoadingScreen';
import SplitScreenPlayer from '../components/teaching/SplitScreenPlayer';
import SkeletonOverlay from '../components/teaching/SkeletonOverlay';
import PersonaTeacher from '../components/teaching/PersonaTeacher';
import JointHeatmap from '../components/teaching/JointHeatmap';
import { useDanceAnalysis } from '../hooks/useDanceAnalysis';
import { useSpotifyAnalysis } from '../hooks/useSpotifyAnalysis';
import { saveTeachingReport } from '../services/teachingReportStore';

const JOINT_KO = {
  left_wrist: '왼팔',
  right_wrist: '오른팔',
  left_elbow: '왼팔꿈치',
  right_elbow: '오른팔꿈치',
  left_knee: '왼다리',
  right_knee: '오른다리',
};

function toEmbed(url) {
  const idMatch = url.match(/(?:v=|youtu\.be\/|\/embed\/|shorts\/)([\w-]{11})/);
  if (!idMatch) return '';
  return `https://www.youtube.com/embed/${idMatch[1]}`;
}

export default function DanceTeachingView({ onNavigate }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('setup');
  const [myFile, setMyFile] = useState(null);
  const [refFile, setRefFile] = useState(null);
  const [myUrl, setMyUrl] = useState('');
  const [refUrl, setRefUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [loadingStep, setLoadingStep] = useState(1);
  const [analyzeError, setAnalyzeError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loop, setLoop] = useState(false);

  const myVideoRef = useRef(null);
  const refVideoRef = useRef(null);
  const rafRef = useRef(null);

  const { analyze, result, error, isRunning, getFrameAt, reset: resetAnalysis } = useDanceAnalysis();
  const { songAnalysis, analyzeSong, isAnalyzing: isSongAnalyzing } = useSpotifyAnalysis();

  useEffect(() => {
    if (myFile) setMyUrl(URL.createObjectURL(myFile));
    return () => {
      if (myUrl && myFile) URL.revokeObjectURL(myUrl);
    };
  }, [myFile]);

  useEffect(() => {
    if (refFile) setRefUrl(URL.createObjectURL(refFile));
    return () => {
      if (refUrl && refFile) URL.revokeObjectURL(refUrl);
    };
  }, [refFile]);

  const duration = myVideoRef.current?.duration || refVideoRef.current?.duration || 60;
  const framePair = getFrameAt(currentTime);

  const coachingComment = useMemo(() => {
    const worst = framePair?.comparison?.worstJoint || result?.topProblems?.[0];
    return {
      problemJoint: worst || 'left_wrist',
      instruction: worst
        ? `${JOINT_KO[worst] || worst} 위치를 레퍼런스와 맞춰 보세요.`
        : '전신 리듬을 유지하면서 동작 크기를 키워 보세요.',
      personaStyle: songAnalysis?.danceAttitude || '',
    };
  }, [framePair, result, songAnalysis]);

  const tick = useCallback(() => {
    const v = myVideoRef.current;
    if (v && !v.paused) setCurrentTime(v.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (phase === 'teaching' && isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }
    return undefined;
  }, [phase, isPlaying, tick]);

  const jointHeatmapScores = useMemo(() => {
    const scores = {};
    (result?.frameComparisons || []).forEach((frame) => {
      Object.entries(frame.jointAccuracies || {}).forEach(([joint, val]) => {
        scores[joint] = scores[joint] == null ? val : (scores[joint] + val) / 2;
      });
    });
    return scores;
  }, [result]);

  useEffect(() => {
    if (phase !== 'result' || !result) return;
    const acc = result.overallAccuracy ?? 0;
    saveTeachingReport('dance', {
      overall: acc,
      metrics: { overall: acc },
      feedback: result.feedback,
      topProblems: result.topProblems,
      updatedAt: Date.now(),
    });
  }, [phase, result]);

  const syncVideos = (time, playing) => {
    [myVideoRef, refVideoRef].forEach((ref) => {
      const el = ref.current;
      if (!el) return;
      if (Math.abs(el.currentTime - time) > 0.15) el.currentTime = time;
      el.playbackRate = playbackRate;
      if (playing) el.play().catch(() => {});
      else el.pause();
    });
  };

  const handlePlayPause = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    syncVideos(currentTime, next);
  };

  const handleSeek = (t) => {
    setCurrentTime(t);
    syncVideos(t, isPlaying);
  };

  const handleStartAnalysis = async () => {
    if (!myFile || !(refFile || refUrl)) return;
    if (!refFile && refUrl && /youtube\.com|youtu\.be/i.test(refUrl)) {
      setAnalyzeError('유튜브는 분석용 레퍼런스로 쓸 수 없습니다. mp4/webm 파일을 업로드해 주세요.');
      return;
    }
    setAnalyzeError('');
    setPhase('analyzing');
    setLoadingStep(1);
    try {
      const q = [songTitle, songArtist].filter(Boolean).join(' ');
      let sa = songAnalysis;
      if (q && !sa) sa = await analyzeSong(q);
      await analyze({
        myFile,
        referenceFile: refFile,
        referenceUrl: refFile ? null : refUrl,
        songAnalysis: sa,
        onStepChange: setLoadingStep,
      });
      setPhase('teaching');
      setCurrentTime(0);
    } catch (e) {
      setAnalyzeError(String(e?.message || error || '분석에 실패했습니다.'));
      setPhase('review');
    }
  };

  const handleYoutubeLoad = () => {
    const embed = toEmbed(youtubeUrl);
    if (!embed) {
      alert('올바른 유튜브 URL을 입력해주세요.');
      return;
    }
    setRefUrl(embed);
  };

  const handleSpotifySearch = () => {
    const q = [songTitle, songArtist].filter(Boolean).join(' ');
    if (q) analyzeSong(q);
  };

  const hasRef = refFile || refUrl;

  if (phase === 'setup') {
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white p-4 md:p-6">
        <TeachingStepBar current="setup" />
        <h1 className="text-xl font-bold mb-1">{t('teaching.session.danceTitle')}</h1>
        <p className="text-sm text-white/50 mb-6">{t('teaching.session.danceSubtitle')}</p>
        <VideoUploader
          label="원본/레퍼런스 영상 (파일 필수)"
          hint="분석용: mp4/webm 파일 업로드 · 유튜브는 연습 미리보기만"
          showYoutube
          youtubeUrl={youtubeUrl}
          onYoutubeUrlChange={setYoutubeUrl}
          onYoutubeLoad={handleYoutubeLoad}
          onFile={setRefFile}
          className="mb-4"
        />
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6 space-y-3">
          <p className="text-sm font-semibold">곡 정보 (선택)</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="곡명"
              className="flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              value={songArtist}
              onChange={(e) => setSongArtist(e.target.value)}
              placeholder="아티스트"
              className="flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSpotifySearch}
              disabled={isSongAnalyzing}
              className="rounded-lg px-4 py-2 bg-white/10 text-sm font-semibold shrink-0"
            >
              Spotify
            </button>
          </div>
          {songAnalysis ? (
            <p className="text-xs text-[#FF1F8E]">
              {songAnalysis.trackName} — {songAnalysis.personaName}
            </p>
          ) : null}
        </div>
        <TeachingUploadFallback
          label="내 댄스 영상 파일"
          hint="mp4, webm · 최대 500MB"
          onFile={(f) => {
            setMyFile(f);
            setPhase('review');
          }}
        />
        <button
          type="button"
          disabled={!hasRef}
          onClick={() => setPhase('practice')}
          className="w-full py-4 rounded-xl font-bold text-white disabled:opacity-40 mt-4"
          style={{ background: '#FF1F8E' }}
        >
          {t('teaching.session.practiceFirst')}
        </button>
      </div>
    );
  }

  if (phase === 'practice') {
    const refPreview =
      refUrl?.includes('youtube.com/embed') ? (
        <iframe title="ref" src={`${refUrl}?mute=1`} className="w-full h-full" />
      ) : refUrl ? (
        <video src={refUrl} className="w-full h-full object-cover" muted playsInline />
      ) : null;
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white p-4 md:p-6">
        <TeachingStepBar current="practice" />
        <TeachingPracticePanel
          mode="dance"
          referencePreview={refPreview}
          onComplete={(file) => {
            setMyFile(file);
            setPhase('review');
          }}
          onCancel={() => setPhase('setup')}
        />
      </div>
    );
  }

  if (phase === 'review') {
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white p-4 md:p-6">
        <TeachingStepBar current="review" />
        {(analyzeError || error) ? (
          <p className="text-rose-400 text-sm mb-4">{analyzeError || error}</p>
        ) : null}
        <TeachingReviewPanel
          file={myFile}
          mode="dance"
          isLoading={isRunning}
          onRetake={() => {
            setMyFile(null);
            setPhase('practice');
          }}
          onAnalyze={handleStartAnalysis}
        />
      </div>
    );
  }

  if (phase === 'analyzing') {
    return (
      <div className="min-h-full bg-[#0a0a0f]">
        <AnalysisLoadingScreen currentStep={loadingStep} />
        {analyzeError ? (
          <p className="text-center text-rose-400 text-sm px-6 -mt-4 pb-8">{analyzeError}</p>
        ) : null}
      </div>
    );
  }

  if (phase === 'result') {
    const acc = result?.overallAccuracy ?? 0;
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white p-6">
        <h2 className="text-2xl font-bold mb-6">세션 결과</h2>
        <div className="flex justify-center mb-8">
          <div
            className="w-36 h-36 rounded-full flex items-center justify-center text-3xl font-black border-4"
            style={{ borderColor: '#FF1F8E', color: '#FF1F8E' }}
          >
            {acc}%
          </div>
        </div>
        <JointHeatmap jointScores={jointHeatmapScores} />
        {result?.feedback ? (
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2 mb-6 mt-6">
            <p>{result.feedback.overall}</p>
            <ul className="text-sm text-white/70 list-disc pl-4">
              {(result.feedback.problems || []).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
            <p className="text-emerald-400 text-sm">{result.feedback.praise}</p>
          </div>
        ) : null}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              resetAnalysis();
              setPhase('setup');
              setMyFile(null);
              setRefFile(null);
            }}
            className="flex-1 py-3 rounded-xl bg-white/10"
          >
            다시 연습
          </button>
          <button type="button" onClick={() => onNavigate?.('saved-videos')} className="flex-1 py-3 rounded-xl bg-[#FF1F8E]">
            저장
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#0a0a0f] p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">댄스 티칭</h2>
        <button type="button" onClick={() => setPhase('result')} className="text-sm text-[#FF1F8E]">
          결과 보기
        </button>
      </div>
      <SplitScreenPlayer
        leftLabel="내 영상"
        rightLabel="AI 티칭 (정답 스켈레톤)"
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        loop={loop}
        onSeek={handleSeek}
        onPlayPause={handlePlayPause}
        onRateChange={(r) => {
          setPlaybackRate(r);
          syncVideos(currentTime, isPlaying);
        }}
        onLoopToggle={() => setLoop((l) => !l)}
        leftContent={
          <>
            <video
              ref={myVideoRef}
              src={myUrl}
              className="w-full h-full object-contain"
              muted
              playsInline
              loop={loop}
              onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
              onEnded={() => loop && handleSeek(0)}
            />
            <SkeletonOverlay frame={framePair?.my} comparisonFrame={framePair?.ref} mode="mine" />
          </>
        }
        rightContent={
          <>
            {refUrl?.includes('youtube.com/embed') ? (
              <iframe
                title="reference"
                src={`${refUrl}${refUrl.includes('?') ? '&' : '?'}autoplay=0&mute=1`}
                className="w-full h-full opacity-50 pointer-events-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : (
              <video
                ref={refVideoRef}
                src={refUrl}
                className="w-full h-full object-contain opacity-40"
                muted
                playsInline
                loop={loop}
              />
            )}
            <SkeletonOverlay frame={framePair?.ref} mode="reference" />
            <PersonaTeacher
              comment={coachingComment}
              personaName={songAnalysis?.personaName || 'AI 댄스 코치'}
              personaAvatar="💃"
            />
          </>
        }
      />
    </div>
  );
}
