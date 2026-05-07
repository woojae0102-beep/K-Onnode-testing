// @ts-nocheck
/**
 * 5+1 단계 오디션 (PHASE 0~5) — 플로우 API + 매 세션 전용 질문 세트
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import JudgeConversation from './JudgeConversation';
import LiveInteractionBar from './LiveInteractionBar';
import BrightnessControl from '../camera/BrightnessControl';
import { useCameraWithFilter, buildCameraFilterCss } from '../../hooks/useCameraWithFilter';
import { useJudgeVoice } from '../../hooks/useJudgeVoice';
import {
  fetchAgencyFlow,
  fetchGeneratedQuestions,
  resolveJudgeIdForCue,
} from '../../hooks/fivePhaseAuditionApi';

const PHASE_PERF_MAX = 180;
const PHASE_LABEL = ['입장·첫인상', '1차 실기+개입', '2차 실기+미션', '압박 인터뷰', '공개 토론', '결과 발표'];

function randInt(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

export default function AuditionFlowStage({ agency, onComplete, onBack }) {
  const { i18n } = useTranslation();
  const language = (i18n?.language || 'ko').slice(0, 2);
  const agencyId = agency?.id || 'hybe';
  const judges = agency?.judges || [];

  const [phase, setPhase] = useState(0);
  /** PHASE 0: opening → 첫 자기소개 → 꼬리질문 */
  const [phase0Step, setPhase0Step] = useState('opening');
  const [questionSet, setQuestionSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [messages, setMessages] = useState([]);
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const msgIdRef = useRef(0);

  const [selfIntroText, setSelfIntroText] = useState('');
  const [interviewAnswers, setInterviewAnswers] = useState([]);
  const interviewAnswersRef = useRef([]);
  useEffect(() => {
    interviewAnswersRef.current = interviewAnswers;
  }, [interviewAnswers]);

  const [phase1Medium] = useState(() => (Math.random() < 0.5 ? 'vocal' : 'dance'));
  const [phase2Medium] = useState(() => (phase1Medium === 'vocal' ? 'dance' : 'vocal'));

  const [perfElapsed, setPerfElapsed] = useState(0);
  const [perfRunning, setPerfRunning] = useState(false);
  const interventionAtRef = useRef(randInt(15, 25));
  const interventionDoneRef = useRef({ p1: false, p2: false });
  const [interventionUi, setInterventionUi] = useState(0);
  const [phase1Redo, setPhase1Redo] = useState(0);
  const [phase2Redo, setPhase2Redo] = useState(0);
  const [lastRedoOk, setLastRedoOk] = useState(null);

  const [interviewIndex, setInterviewIndex] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const cameraBoxRef = useRef(null);
  const voice = useJudgeVoice();

  const {
    videoRef,
    displayCanvasRef,
    streamRef,
    filter,
    setFilter,
    resetFilter,
    isReady,
    displaySurface,
    playbackBlocked,
    resumePlayback,
    error: cameraHookError,
    startCamera,
  } = useCameraWithFilter({ audio: true, surface: 'auto' });

  const cameraState = cameraHookError ? 'error' : isReady ? 'live' : 'requesting';
  const cameraError = cameraHookError || '';
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [orientToast, setOrientToast] = useState('');
  const [layoutRev, setLayoutRev] = useState(0);
  const toastTimerRef = useRef(null);

  const sessionSeedRef = useRef('');
  if (!sessionSeedRef.current) {
    sessionSeedRef.current = `${agencyId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  const sessionBase = useMemo(
    () => ({
      randomSeed: sessionSeedRef.current,
      selfIntroText,
      phase1Medium,
      phase2Medium,
      performanceElapsedSec: perfElapsed,
      phase1Redo,
      phase2Redo,
      lastRedoSucceeded: lastRedoOk,
      questionIndex: interviewIndex,
      interviewQA: interviewAnswers,
      interventionTriggered: interventionDoneRef.current,
    }),
    [agencyId, selfIntroText, phase1Medium, phase2Medium, perfElapsed, phase1Redo, phase2Redo, lastRedoOk, interviewIndex, interviewAnswers],
  );

  const judgeResponsePrompt = useMemo(() => {
    if (phase === 0) return '안내에 따라 말씀해 주세요';
    if (phase === 3) return '질문에 답해 주세요';
    if (phase === 4) return '마지막 발언을 해 주세요 (30초)';
    return '';
  }, [phase]);

  const pushJudgeText = useCallback(async (speaker, text, opts = {}) => {
    if (!text) return;
    const jid = resolveJudgeIdForCue(agencyId, judges, speaker);
    msgIdRef.current += 1;
    setMessages((m) => [
      ...m,
      {
        id: msgIdRef.current,
        judgeId: jid,
        text,
        type: opts.type || 'instruction',
      },
    ]);
    if (voice.enabled) await voice.speakText(text, jid).catch(() => {});
  }, [agencyId, judges, voice]);

  const runFlow = useCallback(async (p, st, sessExtra = {}, qsOverride = null) => {
    try {
      const qs = qsOverride ?? questionSet;
      const res = await fetchAgencyFlow(agencyId, {
        phase: p,
        step: st,
        language,
        applicantProfile: { appliedField: 'total', practiceYears: null },
        questionSet: qs || {},
        session: { ...sessionBase, ...sessExtra },
      });
      const list = Array.isArray(res.cues) ? res.cues : [];
      for (let i = 0; i < list.length; i += 1) {
        const c = list[i];
        const silence = Number(c.silenceDuration || 0) * 1000;
        if (silence > 0)
          await new Promise((r) => setTimeout(r, Math.min(silence, 12000)));
        await pushJudgeText(c.speaker || judges[0]?.name, c.speaking || '', {
          type: c.actionType === 'question' ? 'question' : 'instruction',
        });
        if (c.requiresUserAction) {
          setAwaitingResponse(true);
          return true;
        }
      }
      setAwaitingResponse(false);
      return false;
    } catch (e) {
      setError(e?.message || 'flow 오류');
      return false;
    }
  }, [agencyId, language, questionSet, sessionBase, judges, pushJudgeText]);

  const runFlowWithQs = useCallback(
    async (p, st, sessExtra, qs) => runFlow(p, st, sessExtra, qs),
    [runFlow],
  );

  /* 초기 질문 세트 + PHASE0 오프닝 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const seed = `${agencyId}_${Date.now()}`;
        const qs = await fetchGeneratedQuestions({ agencyId, randomSeed: seed, language });
        if (cancelled) return;
        setQuestionSet(qs);
        await runFlowWithQs(0, 'opening', {}, qs);
        if (!cancelled) {
          setAwaitingResponse(true);
          setPhase0Step('waiting_self_intro');
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || '질문 생성 실패');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 초기 세션 한 번만
  }, []);

  /* 실기 타이머 */
  useEffect(() => {
    if (!perfRunning || cameraState !== 'live') return undefined;
    const id = setInterval(() => setPerfElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [perfRunning, cameraState]);

  useEffect(() => {
    if (phase !== 1 && phase !== 2) return;
    if (!perfRunning) return;
    const tgt = interventionAtRef.current;
    if (perfElapsed !== tgt) return;
    const key = phase === 1 ? 'p1' : 'p2';
    if (interventionDoneRef.current[key]) return;
    interventionDoneRef.current[key] = true;
    (async () => {
      setPerfRunning(false);
      const st = phase === 1 ? 'intervention_primary' : 'intervention_secondary';
      await runFlow(phase, st, { performanceElapsedSec: perfElapsed });
      setInterventionUi((x) => x + 1);
    })();
  }, [perfElapsed, perfRunning, phase, runFlow]);

  const handleTapCamera = useCallback(async () => {
    await resumePlayback();
  }, [resumePlayback]);

  const startPrimary = useCallback(async () => {
    setPerfElapsed(0);
    interventionAtRef.current = randInt(15, 25);
    interventionDoneRef.current.p1 = false;
    setAwaitingResponse(false);
    await runFlow(1, 'instruct_primary', { phase1Medium });
    setPerfRunning(true);
  }, [runFlow, phase1Medium]);

  const finishPrimary = useCallback(async () => {
    setPerfRunning(false);
    await runFlow(1, phase1Redo > 0 ? 'redo_feedback' : 'redo_feedback', { phase1Redo, lastRedoSucceeded: lastRedoOk !== false });
    setPhase(2);
    setPerfElapsed(0);
    interventionAtRef.current = randInt(15, 25);
    interventionDoneRef.current.p2 = false;
    await runFlow(2, 'instruct_secondary', { phase2Medium });
    setPerfRunning(true);
  }, [runFlow, phase1Redo, lastRedoOk]);

  const finishSecondary = useCallback(async () => {
    setPerfRunning(false);
    await runFlow(2, 'redo_secondary', { phase2Redo, lastRedoSucceeded: lastRedoOk !== false });
    setPhase(3);
    setInterviewIndex(0);
    await runFlow(3, 'pressure_interview_tick', {});
    setAwaitingResponse(true);
  }, [runFlow, phase2Redo, lastRedoOk]);

  const handleUserResponse = useCallback(async (text) => {
    if (!text) return;
    setAwaitingResponse(false);

    if (phase === 0 && phase0Step === 'waiting_self_intro') {
      setSelfIntroText(text);
      setPhase0Step('followup');
      await runFlow(0, 'intro_followup', { selfIntroText: text });
      setAwaitingResponse(true);
      return;
    }
    if (phase === 0 && phase0Step === 'followup') {
      setPhase(1);
      await startPrimary();
      return;
    }
    if (phase === 3) {
      setInterviewAnswers((prev) => {
        const idx = prev.length;
        const curQ = questionSet?.phaseQuestions?.phase3_main?.[idx]
          || questionSet?.phaseQuestions?.phase3_followup?.[idx]
          || `질문 ${idx + 1}`;
        const qa = [...prev, { question: curQ, answer: text }];
        const done = qa.length >= 3;
        if (done) {
          queueMicrotask(async () => {
            setPhase(4);
            await runFlow(4, 'public_debate', { interviewQA: qa });
            await runFlow(4, 'final_word_prompt', { interviewQA: qa });
            setAwaitingResponse(true);
          });
        } else {
          const next = qa.length;
          queueMicrotask(async () => {
            setInterviewIndex(next);
            await runFlow(3, 'pressure_interview_tick', { questionIndex: next, interviewQA: qa });
            setAwaitingResponse(true);
          });
        }
        return qa;
      });
      return;
    }
    if (phase === 4) {
      const fullQA = [...interviewAnswersRef.current, { question: 'final_statement', answer: text }];
      setPhase(5);
      await runFlow(5, 'reveal_cards', { finalWords: text });
      await runFlow(5, 'average_reveal', {});
      await runFlow(5, 'final_verdict_copy', {});
      onComplete?.({
        rounds: {
          vocal: phase1Medium === 'vocal' ? randInt(65, 82) : randInt(58, 75),
          dance: phase2Medium === 'dance' ? randInt(65, 82) : randInt(58, 75),
          interview: `flow-v2-complete`,
          fivePhaseAudition: true,
          agencyId,
          transcriptSummary: messages,
          selfIntroText,
          qa: fullQA,
          questionSet,
          phase1Medium,
          phase2Medium,
          phase1Redo,
          phase2Redo,
        },
      });
    }
  }, [
    phase,
    phase0Step,
    questionSet,
    messages,
    agencyId,
    phase1Medium,
    phase2Medium,
    phase1Redo,
    phase2Redo,
    selfIntroText,
    onComplete,
    startPrimary,
    runFlow,
  ]);

  /* 오디오 레벨 (기존 AuditionStage와 동일 패턴) */
  const [audioLevel, setAudioLevel] = useState(0);
  const audioRafRef = useRef(null);
  useEffect(() => {
    if (!isReady || !streamRef.current) return undefined;
    let ac = null;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ac = new Ctx();
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      const source = ac.createMediaStreamSource(streamRef.current);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const vv = (buffer[i] - 128) / 128;
          sumSquares += vv * vv;
        }
        const rms = Math.sqrt(sumSquares / buffer.length);
        setAudioLevel(Math.min(1, rms * 3));
        audioRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* noop */
    }
    return () => {
      if (audioRafRef.current) cancelAnimationFrame(audioRafRef.current);
      if (ac && ac.close) try { ac.close(); } catch { /* noop */ }
    };
  }, [isReady, streamRef]);

  /* 전체화면: 브라우저 API 추적 · iOS 등은 CSS fixed 모드 폴백 */
  useEffect(() => {
    const handler = () => {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement;
      setIsFullscreen(Boolean(fsEl));
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const el = cameraBoxRef.current;
    if (!el) return;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isIOSFamily =
      /iPad|iPhone|iPod/.test(ua) ||
      (typeof navigator !== 'undefined' &&
        navigator.platform === 'MacIntel' &&
        navigator.maxTouchPoints > 1);
    const fsEl =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement;
    if (isIOSFamily || (!el.requestFullscreen && !el.webkitRequestFullscreen)) {
      setIsFullscreen((v) => !v);
      return;
    }
    try {
      if (fsEl) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  }, []);

  const showOrientToast = useCallback((msg) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setOrientToast(msg);
    toastTimerRef.current = window.setTimeout(() => setOrientToast(''), 4200);
  }, []);

  const cycleOrientationLock = useCallback(async () => {
    const so =
      typeof screen !== 'undefined' &&
      screen.orientation &&
      typeof screen.orientation.lock === 'function'
        ? screen.orientation
        : null;
    if (!so || typeof so.lock !== 'function') {
      showOrientToast('브라우저가 화면 방향 고정을 지원하지 않아요. 기기를 가로·세로로 돌려 주세요.');
      return;
    }
    const type = String(screen.orientation?.type || '');
    const wide = typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false;
    const wantLandscape = !(type.includes('landscape') || wide);
    const lockType = wantLandscape ? 'landscape-primary' : 'portrait-primary';
    const labelKo = wantLandscape ? '가로 방향 고정됨 (지원 브라우저)' : '세로 방향 고정됨 (지원 브라우저)';
    const tryUnlock = () => {
      try {
        if (typeof screen.orientation?.unlock === 'function') screen.orientation.unlock();
      } catch {
        /* noop */
      }
    };
    try {
      await so.lock(lockType);
      showOrientToast(labelKo);
    } catch {
      try {
        tryUnlock();
        await new Promise((r) => setTimeout(r, 100));
        await so.lock(lockType);
        showOrientToast(labelKo);
      } catch {
        showOrientToast('고정에 실패했어요. 기기를 회전하거나 전체 화면(⛶) 후 다시 눌러 보세요.');
      }
    }
  }, [showOrientToast]);

  useEffect(() => {
    const bump = () => setLayoutRev((x) => x + 1);
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('orientationchange', bump);
    window.addEventListener('resize', bump);
    return () => {
      window.removeEventListener('orientationchange', bump);
      window.removeEventListener('resize', bump);
    };
  }, []);

  const nextOrientLabel = useMemo(() => {
    if (typeof window === 'undefined') return '가로 고정 시도';
    const type = String(window.screen?.orientation?.type || '');
    if (type.includes('landscape')) return '세로 고정 시도';
    if (type.includes('portrait')) return '가로 고정 시도';
    return window.innerWidth > window.innerHeight ? '세로 고정 시도' : '가로 고정 시도';
  }, [layoutRev]);

  const fabRotateStyle = (
    _fullscreen,
    { top = null, right = null, bottom = null, left = null },
  ) => ({
    position: 'absolute',
    ...(top !== null ? { top } : {}),
    ...(left !== null ? { left } : {}),
    ...(right !== null ? { right } : {}),
    ...(bottom !== null ? { bottom } : {}),
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 26,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    WebkitTapHighlightColor: 'transparent',
  });

  return (
    <div
      className="audition-flow-root"
      style={{ minHeight: '100%', background: agency?.primaryColor || '#0A0A0A', padding: 'clamp(12px,3vw,20px)', color: '#FFF', boxSizing: 'border-box' }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={onBack} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: '#FFF', borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>← 중단</button>
          <div style={{ flex: '1', textAlign: 'center', padding: '4px 6px', minWidth: 0 }}>
            <div style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', border: `1px solid ${agency?.accentColor}`, display: 'inline-block' }}>
              PHASE {phase} · {PHASE_LABEL[phase] || ''}
            </div>
            {orientToast ? (
              <p style={{ margin: '6px 0 0', fontSize: 11, opacity: 0.85 }}>{orientToast}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={cycleOrientationLock}
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: `1px solid ${agency?.accentColor}`,
              color: '#FFF',
              borderRadius: 999,
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 11,
              whiteSpace: 'nowrap',
              maxWidth: 110,
              lineHeight: 1.2,
              WebkitTapHighlightColor: 'transparent',
            }}
            title="브라우저가 지원하면 가로 또는 세로로 화면을 고정해요."
          >
            ↻ 회전 고정<br />
            ({nextOrientLabel})
          </button>
        </div>

        {loading ? (
          <p style={{ opacity: 0.8 }}>오디션 질문 세트 생성 중…</p>
        ) : null}
        {error ? <p style={{ color: '#FF6B81' }}>{error}</p> : null}

        <div className="audition-stage-grid">
          <div
            ref={cameraBoxRef}
            className={`audition-camera-box ${isFullscreen ? 'audition-camera-fs' : ''}`}
            style={{
              background: '#000',
              border: isFullscreen ? 'none' : `1px solid ${agency?.accentColor}55`,
              borderRadius: isFullscreen ? 0 : 16,
              position: 'relative',
              overflow: 'hidden',
              minHeight: isFullscreen ? undefined : 'clamp(260px,min(62dvh,78vh),720px)',
              width: '100%',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {displaySurface === 'video' ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  overflow: 'hidden',
                  filter: buildCameraFilterCss(filter),
                  WebkitFilter: buildCameraFilterCss(filter),
                  transform: 'translateZ(0)',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  // eslint-disable-next-line react/no-unknown-property -- iOS Safari
                  webkit-playsinline="true"
                  disablePictureInPicture
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                    opacity: cameraState === 'live' ? 1 : 0,
                    background: '#000',
                  }}
                />
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  webkit-playsinline="true"
                  disablePictureInPicture
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    pointerEvents: 'none',
                    background: '#000',
                  }}
                />
                <canvas
                  ref={displayCanvasRef}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1) translateZ(0)',
                    filter: buildCameraFilterCss(filter),
                    WebkitFilter: buildCameraFilterCss(filter),
                    opacity: cameraState === 'live' ? 1 : 0,
                  }}
                />
              </>
            )}

            {cameraState !== 'live' ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <p>{cameraState === 'error' ? cameraError : '카메라 준비 중…'}</p>
                {cameraState === 'error' ? (
                  <button type="button" onClick={() => startCamera()} style={{ padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer' }}>다시 시도</button>
                ) : null}
              </div>
            ) : null}

            {cameraState === 'live' && playbackBlocked ? (
              <button type="button" onClick={handleTapCamera} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', color: '#FFF', border: 'none', zIndex: 30, cursor: 'pointer', fontWeight: 800 }}>
                탭해서 카메라 시작
              </button>
            ) : null}

            {(phase === 1 || phase === 2) && perfRunning ? (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
                  right: 'calc(env(safe-area-inset-right, 0px) + 10px)',
                  fontSize: 22,
                  fontWeight: 900,
                  color: agency?.accentColor,
                  textShadow: '0 2px 10px rgba(0,0,0,0.75)',
                  zIndex: 24,
                  pointerEvents: 'none',
                }}
              >
                {perfElapsed}s / {PHASE_PERF_MAX}s
              </div>
            ) : null}

            {cameraState === 'live' ? (
              <button
                type="button"
                onClick={cycleOrientationLock}
                aria-label={`화면 회전 고정 (${nextOrientLabel})`}
                style={fabRotateStyle(isFullscreen, isFullscreen ? {
                  top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
                  left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
                } : {
                  left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
                  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)',
                })}
                title={`${nextOrientLabel} · 화면 방향 API를 지원하는 브라우저(대부분의 갤럭시 크롬 등)`}
              >
                ↻
              </button>
            ) : null}

            {/* 명암 — 우측 상단 근처(심사 단계 타이머 아래)·safe-area 반영 */}
            {cameraState === 'live' ? (
              <button
                type="button"
                onClick={() => setShowFilterPanel((v) => !v)}
                aria-label="카메라 명암 조절"
                style={{
                  position: 'absolute',
                  right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
                  top: isFullscreen
                    ? 'calc(env(safe-area-inset-top, 0px) + 54px)'
                    : 'calc(env(safe-area-inset-top, 0px) + 50px)',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: showFilterPanel ? (agency?.accentColor || '#FF1F8E') : 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 25,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                ☀
              </button>
            ) : null}

            {cameraState === 'live' ? (
              <BrightnessControl
                filter={filter}
                onChange={(n) => setFilter(n)}
                onReset={resetFilter}
                visible={showFilterPanel}
                onClose={() => setShowFilterPanel(false)}
              />
            ) : null}

            {cameraState === 'live' ? (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
                style={{
                  position: 'absolute',
                  ...(isFullscreen
                    ? {
                        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                        left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
                      }
                    : {
                        right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
                        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
                      }),
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 26,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {isFullscreen ? '✕' : '⛶'}
              </button>
            ) : null}

            {isFullscreen ? (
              <div
                className="audition-fs-judge-overlay"
                style={{
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
                  maxHeight: '45vh',
                  zIndex: 22,
                  pointerEvents: 'auto',
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: 'rgba(0,0,0,0.58)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: `1px solid ${agency?.accentColor || '#FF1F8E'}55`,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}
              >
                <JudgeConversation
                  judges={judges}
                  messages={messages}
                  currentSpeaker={voice.speakingId}
                  awaitingResponse={awaitingResponse}
                  onUserResponse={handleUserResponse}
                  language={language}
                  agencyAccent={agency?.accentColor || '#FFF'}
                  voiceEnabled={voice.enabled}
                  onToggleVoice={() => voice.setVoiceEnabled(!voice.enabled)}
                  responsePrompt={judgeResponsePrompt}
                  compact
                />
              </div>
            ) : null}
          </div>

          {!isFullscreen ? (
            <div className="audition-stage-side" style={{ minHeight: 220 }}>
              <JudgeConversation
                judges={judges}
                messages={messages}
                currentSpeaker={voice.speakingId}
                awaitingResponse={awaitingResponse}
                onUserResponse={handleUserResponse}
                language={language}
                agencyAccent={agency?.accentColor || '#FFF'}
                voiceEnabled={voice.enabled}
                onToggleVoice={() => voice.setVoiceEnabled(!voice.enabled)}
                responsePrompt={judgeResponsePrompt}
                compact
              />
            </div>
          ) : null}
        </div>

        <LiveInteractionBar agencyAccent={agency?.accentColor} audioLevel={audioLevel} pitchAccuracy={Math.round(55 + audioLevel * 38)} rhythmScore={perfRunning ? Math.round(50 + audioLevel * 42) : 0} poseScore={perfRunning ? Math.round(55 + audioLevel * 30) : 0} />

        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {phase === 1 && !perfRunning && interventionDoneRef.current.p1 && perfElapsed < PHASE_PERF_MAX ? (
            <button type="button" key={`resume-p1-${interventionUi}`} onClick={() => setPerfRunning(true)} style={{ flex: '1 1 160px', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.12)', color: '#FFF', fontWeight: 700 }}>
              실기 이어가기
            </button>
          ) : null}
          {phase === 2 && !perfRunning && interventionDoneRef.current.p2 && perfElapsed < PHASE_PERF_MAX ? (
            <button type="button" key={`resume-p2-${interventionUi}`} onClick={() => setPerfRunning(true)} style={{ flex: '1 1 160px', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.12)', color: '#FFF', fontWeight: 700 }}>
              2차 실기 이어가기
            </button>
          ) : null}
          {phase === 1 && perfRunning ? (
            <button type="button" onClick={finishPrimary} style={{ flex: '1 1 140px', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: agency?.accentColor, color: '#FFF', fontWeight: 700 }}>1차 실기 종료 →</button>
          ) : null}
          {(phase === 1 && !perfRunning && interventionUi > 0 && interventionDoneRef.current.p1) ? (
            <button type="button" onClick={() => { setPhase1Redo((r) => r + 1); setLastRedoOk(false); setPerfRunning(true); setPerfElapsed(0); }} disabled={phase1Redo >= 3} style={{ padding: '10px 14px', borderRadius: 10, cursor: phase1Redo >= 3 ? 'not-allowed' : 'pointer' }}>
              재실기 ({phase1Redo}/3)
            </button>
          ) : null}
          {phase === 2 && perfRunning ? (
            <button type="button" onClick={finishSecondary} style={{ flex: '1 1 140px', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: agency?.accentColor, color: '#FFF', fontWeight: 700 }}>2차 실기 종료 →</button>
          ) : null}
          {(phase === 2 && !perfRunning && interventionUi > 0 && interventionDoneRef.current.p2) ? (
            <button type="button" onClick={() => { setPhase2Redo((r) => r + 1); setLastRedoOk(false); setPerfRunning(true); setPerfElapsed(0); }} disabled={phase2Redo >= 3} style={{ padding: '10px 14px', borderRadius: 10, cursor: phase2Redo >= 3 ? 'not-allowed' : 'pointer' }}>
              2차 재실기 ({phase2Redo}/3)
            </button>
          ) : null}
        </div>
      </div>

      <style>{`
        .audition-flow-root .audition-stage-grid { display: grid; gap: 12px; grid-template-columns: minmax(0,1fr) minmax(260px,360px); align-items: stretch; }
        @media (max-width: 860px) { .audition-flow-root .audition-stage-grid { grid-template-columns: 1fr; } }
        /* 가로로 기기를 둔 좁은 뷰포트에서도 2컬럼(카메라 좌측 대화 우측) — 아이폰·갤럭시 회전 후 가독성 */
        @media (orientation: landscape) {
          .audition-flow-root .audition-stage-grid {
            grid-template-columns: minmax(0, 1fr) minmax(200px, min(340px, 42vw));
            gap: 10px;
            align-items: stretch;
          }
          .audition-flow-root .audition-stage-side {
            min-height: 0;
            max-height: 92dvh;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }
          .audition-flow-root .audition-camera-box:not(.audition-camera-fs) {
            min-height: min(90dvh, 720px) !important;
          }
          .audition-flow-root .audition-fs-judge-overlay {
            max-height: min(48vh, 320px);
          }
        }
        .audition-camera-fs {
          position: fixed !important;
          inset: 0 !important;
          z-index: 9999 !important;
          width: 100vw !important;
          max-width: 100vw !important;
          min-height: 100vh !important;
          min-height: 100dvh !important;
          min-height: -webkit-fill-available !important;
          box-sizing: border-box !important;
        }
      `}</style>
    </div>
  );
}
