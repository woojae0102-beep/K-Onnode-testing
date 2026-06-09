// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import '../styles/tv-mode.css';
import type { Agency, SessionData, TrainingMode } from '../types/tv';
import { useAuth } from '../contexts/AuthContext';
import TVModeEntry from '../components/tv/TVModeEntry';
import TVLayout from '../components/tv/TVLayout';
import GroupPracticeView from './GroupPracticeView';
import TVCompareTeachingScreen from '../components/tv/TVCompareTeachingScreen';
import TrainingResultScreen from '../components/tv/TrainingResultScreen';
import { saveTeachingReport } from '../services/teachingReportStore';
import { buildSessionKey, savePracticeSession } from '../services/practiceHistoryStore';

type Phase = 'entry' | 'training' | 'compare' | 'result';

export default function TVModeView({ onNavigate } = {}) {
  const { user } = useAuth();
  const [phase, setPhase] = useState('entry');
  const [selectedAgency, setSelectedAgency] = useState('hybe');
  const [selectedMode, setSelectedMode] = useState('dance');
  const [sessionData, setSessionData] = useState(null);
  const [sessionComparison, setSessionComparison] = useState(null);

  const handleStart = useCallback((agency: Agency, mode: TrainingMode) => {
    setSelectedAgency(agency);
    setSelectedMode(mode);
    setPhase('training');
  }, []);

  const handleEnd = useCallback(async (data: SessionData) => {
    setSessionData(data);
    setPhase('compare');

    const domain = data.mode === 'vocal' ? 'tv-vocal' : 'tv-dance';
    const sessionKey = buildSessionKey(domain, { agency: data.agency });
    const { comparison } = savePracticeSession(domain, sessionKey, {
      overallScore: data.overallScore,
      scores: data.scores,
      sessionTime: data.sessionTime,
      agency: data.agency,
      mode: data.mode,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      recommendations: data.recommendations,
      completedAt: new Date().toISOString(),
    });
    setSessionComparison(comparison);

    saveTeachingReport('tv-mode', {
      title: `트레이닝 — ${data.agency.toUpperCase()} ${data.mode === 'dance' ? '댄스' : '보컬'}`,
      overallScore: data.overallScore,
      scores: data.scores,
      sessionTime: data.sessionTime,
      agency: data.agency,
      mode: data.mode,
      growthRate: data.growthRate,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      recommendations: data.recommendations,
      passProbability: data.passProbability,
      coachReview: data.coachReview,
      feedback: data.feedback,
      completedAt: new Date().toISOString(),
    });

    try {
      await fetch('/api/tv/training-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: user?.uid || null }),
      });
    } catch {
      /* local report already saved */
    }
  }, []);

  const handleRetry = useCallback(() => {
    setSessionData(null);
    setSessionComparison(null);
    setPhase('training');
  }, []);

  const handleRestartTraining = useCallback(() => {
    setSessionData(null);
    setPhase('training');
  }, []);

  const handleHome = useCallback(async () => {
    document.body.classList.remove('tv-active', 'tv-result-open');
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
    setPhase('entry');
    setSessionData(null);
    setSessionComparison(null);
    onNavigate?.('home');
  }, [onNavigate]);

  useEffect(() => {
    if (phase === 'result') {
      document.body.classList.add('tv-result-open');
    } else {
      document.body.classList.remove('tv-result-open');
    }
    return () => document.body.classList.remove('tv-result-open');
  }, [phase]);

  if (phase === 'entry') {
    return <TVModeEntry onStart={handleStart} onBack={() => onNavigate?.('home')} />;
  }

  if (phase === 'training' && selectedMode === 'group') {
    return <GroupPracticeView agency={selectedAgency} onHome={handleHome} />;
  }

  if (phase === 'training') {
    return (
      <TVLayout agency={selectedAgency} mode={selectedMode} onExit={handleEnd} onHome={handleHome} />
    );
  }

  if (phase === 'compare') {
    return (
      <TVCompareTeachingScreen
        sessionData={sessionData}
        agency={selectedAgency}
        mode={selectedMode}
        comparison={sessionComparison}
        onShowResult={() => setPhase('result')}
        onRetrySession={handleRestartTraining}
        onHome={handleHome}
      />
    );
  }

  return (
    <TrainingResultScreen
      sessionData={sessionData}
      agency={selectedAgency}
      comparison={sessionComparison}
      onRetry={handleRetry}
      onHome={handleHome}
    />
  );
}
