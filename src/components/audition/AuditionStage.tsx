// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import JudgeReaction from './JudgeReaction';
import JudgeConversation from './JudgeConversation';
import LiveInteractionBar from './LiveInteractionBar';
import useRealTimeJudge from '../../hooks/useRealTimeJudge';
import BrightnessControl from '../camera/BrightnessControl';
import { DEFAULT_FILTER } from '../../hooks/useCameraWithFilter';

const ROUNDS = [
  { id: 'vocal', label: '🎤 보컬', desc: '자유곡 1절을 불러보세요', framing: 'portrait', phase: 'instruction_vocal' },
  { id: 'dance', label: '💃 댄스', desc: '30초 자유 안무', framing: 'wide', phase: 'instruction_dance' },
  { id: 'interview', label: '🗣️ 인터뷰', desc: '심사위원 질문에 답해주세요', framing: 'portrait', phase: 'interview' },
];

const REACTION_INTERVAL_MS = 15000;

const FALLBACK_BY_AGENCY = {
  hybe: ['성장이 보여요', '잠재력 있어', '더 자기답게', '음악성!', '괜찮아요'],
  yg: ['안 돼', '실력 부족', 'YG 감성 없어', '다시', '음...'],
  jyp: ['습관 조심!', '라이브!', '좋아요!', '인성도 봐요', '자연스럽게'],
  sm: ['아우라 부족', '개성!', 'SM 느낌 아냐', '시선 처리!', '완성도'],
  starship: ['기본기!', '좋아요', '팬들이 좋아할듯', '계속해요', '균형!'],
};

export default function AuditionStage({ agency, onComplete, onBack }) {
  const { i18n } = useTranslation();
  const [roundIdx, setRoundIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [reactions, setReactions] = useState([]);
  const [isRecording, setIsRecording] = useState(false); // gated until camera ready + countdown
  const [scores, setScores] = useState({});
  const [cameraState, setCameraState] = useState('idle'); // idle | requesting | live | error
  const [cameraError, setCameraError] = useState('');
  const [countdown, setCountdown] = useState(0); // 3-2-1 GO before round starts
  const [audioLevel, setAudioLevel] = useState(0); // 0..1
  const reactionTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const reactionIdRef = useRef(0);
  const videoRef = useRef(null);
  const displayCanvasRef = useRef(null);
  const cameraBoxRef = useRef(null);
  const filterRafRef = useRef(0);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioRafRef = useRef(null);
  const [cameraFilter, setCameraFilter] = useState(DEFAULT_FILTER);
  const cameraFilterRef = useRef(DEFAULT_FILTER);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsTapToStart, setNeedsTapToStart] = useState(false);

  const currentRound = ROUNDS[roundIdx];
  const ROUND_DURATION = 30;

  // ── Real-time judge interaction (TTS + STT + dialogue) ───────────────────
  const judges = agency?.judges || [];
  const language = (i18n?.language || 'ko').slice(0, 2);
  const realTime = useRealTimeJudge({
    agencyId: agency?.id,
    judges,
    language,
    voiceEnabled: true,
  });
  const lastInterviewQuestionRef = useRef(null);
  const initialIntroDoneRef = useRef(false);
  const roundIntroDoneRef = useRef({}); // { [roundIdx]: true }
  const finalDeliberationStartedRef = useRef(false);

  // ── Camera + microphone setup ──────────────────────────────────────────────
  // iOS Safari 호환을 위해 <video>를 직접 화면에 표시하고
  // CSS filter/transform 으로 미러·명암을 적용합니다.
  // (opacity:0 + canvas drawImage 방식은 iOS WebKit이 숨겨진 video의 프레임 디코딩을
  //  스킵하는 알려진 버그가 있어 검은 화면이 나오는 원인이 됩니다.)
  useEffect(() => {
    let cancelled = false;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '');
    async function startMedia() {
      setCameraState('requesting');
      setCameraError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('이 브라우저는 카메라 접근을 지원하지 않습니다.');
        }
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
          if (!isLocalhost) {
            throw new Error('카메라는 HTTPS 또는 localhost에서만 동작합니다. (https:// 주소로 접속해 주세요)');
          }
        }
        // iOS는 세로 해상도가 안정적, Android/PC는 가로 해상도가 적합
        const ideal = isIOS
          ? { width: 720, height: 1280 }
          : { width: 1280, height: 720 };
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: ideal.width },
            height: { ideal: ideal.height },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          // iOS Safari 자동재생 / 인라인 재생 호환 속성
          v.muted = true;
          v.setAttribute('muted', 'true');
          v.setAttribute('playsinline', 'true');
          v.setAttribute('webkit-playsinline', 'true');
          v.setAttribute('autoplay', 'true');
          v.disablePictureInPicture = true;
          const tryPlay = async () => {
            try {
              await v.play();
              setNeedsTapToStart(false);
              return true;
            } catch (e) {
              // 자동재생 정책에 막힘 → 사용자 탭으로 재시도 가능하게 표시
              setNeedsTapToStart(true);
              return false;
            }
          };
          // metadata/canplay 시점마다 재시도 (모바일 브라우저별 타이밍 차이 대응)
          v.onloadedmetadata = () => { tryPlay(); };
          v.oncanplay = () => { tryPlay(); };
          await tryPlay();
        }
        // Audio level meter via WebAudio (lightweight)
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          const ac = new Ctx();
          audioContextRef.current = ac;
          // iOS는 사용자 제스처 없이 만든 AudioContext가 'suspended' 상태일 수 있음
          if (ac.state === 'suspended' && typeof ac.resume === 'function') {
            ac.resume().catch(() => { /* noop */ });
          }
          const source = ac.createMediaStreamSource(stream);
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
          // analyser is best-effort
        }
        setCameraState('live');
      } catch (err) {
        if (cancelled) return;
        setCameraState('error');
        const name = err?.name || '';
        const msg = err?.message || '';
        if (name === 'NotAllowedError' || msg.includes('Permission')) {
          setCameraError('카메라/마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 다시 허용해주세요.');
        } else if (name === 'NotFoundError') {
          setCameraError('사용 가능한 카메라/마이크를 찾지 못했습니다.');
        } else if (name === 'NotReadableError') {
          setCameraError('다른 앱이 카메라를 사용 중입니다. 카메라를 사용하는 다른 앱을 종료해주세요.');
        } else {
          setCameraError(msg || '카메라/마이크 권한이 필요합니다.');
        }
      }
    }
    startMedia();
    return () => {
      cancelled = true;
      if (audioRafRef.current) cancelAnimationFrame(audioRafRef.current);
      if (filterRafRef.current) {
        cancelAnimationFrame(filterRafRef.current);
        filterRafRef.current = 0;
      }
      if (audioContextRef.current && typeof audioContextRef.current.close === 'function') {
        try { audioContextRef.current.close(); } catch { /* noop */ }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        try { videoRef.current.srcObject = null; } catch { /* noop */ }
      }
    };
  }, []);

  // 자동재생 정책에 막혔을 때 사용자가 한 번 탭하면 재생 시작
  const handleTapToStart = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.play();
      setNeedsTapToStart(false);
      // iOS AudioContext도 사용자 제스처에서 resume
      const ac = audioContextRef.current;
      if (ac && ac.state === 'suspended' && typeof ac.resume === 'function') {
        ac.resume().catch(() => { /* noop */ });
      }
    } catch {
      // 사용자에게 권한 재확인 안내
      setNeedsTapToStart(true);
    }
  }, []);

  const buildFilterString = (f) => {
    if (f.brightness === 1 && f.contrast === 1 && f.saturation === 1) return 'none';
    return `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation})`;
  };

  const updateCameraFilter = (next) => {
    cameraFilterRef.current = next;
    setCameraFilter(next);
  };

  const resetCameraFilter = () => updateCameraFilter(DEFAULT_FILTER);

  // Fullscreen 상태 추적
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

  // 전체화면(CSS-only fallback) 시 body 스크롤 잠금
  useEffect(() => {
    if (!isFullscreen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  const toggleFullscreen = async () => {
    const el = cameraBoxRef.current;
    if (!el) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const fsEl =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement;
    if (isIOS || (!el.requestFullscreen && !el.webkitRequestFullscreen)) {
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
  };

  function startFilterRenderLoop() {
    if (filterRafRef.current) cancelAnimationFrame(filterRafRef.current);
    const loop = () => {
      const v = videoRef.current;
      const c = displayCanvasRef.current;
      if (!v || !c) {
        filterRafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
        filterRafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
      }
      const ctx = c.getContext('2d');
      if (ctx) {
        // 시각 필터는 캔버스 element의 CSS filter로 처리 (iOS 호환)
        ctx.drawImage(v, 0, 0, c.width, c.height);
      }
      filterRafRef.current = requestAnimationFrame(loop);
    };
    filterRafRef.current = requestAnimationFrame(loop);
  }

  // ── Countdown gate: when camera goes live OR round changes, run 3-2-1 ─────
  useEffect(() => {
    if (cameraState !== 'live') return undefined;
    if (needsTapToStart) return undefined; // 사용자 탭 후 카운트다운 시작
    setIsRecording(false);
    setCountdown(3);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setIsRecording(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cameraState, roundIdx, needsTapToStart]);

  useEffect(() => {
    if (!isRecording) return undefined;
    setElapsed(0);
    elapsedTimerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(elapsedTimerRef.current);
  }, [roundIdx, isRecording]);

  // (Legacy floating reaction loop has been replaced by useRealTimeJudge's
  // performance reaction interval below.)

  // ── Realtime: greeting at audition start ─────────────────────────────────
  useEffect(() => {
    if (cameraState !== 'live') return;
    if (initialIntroDoneRef.current) return;
    if (judges.length === 0) return;
    initialIntroDoneRef.current = true;
    // Short delay so the camera/countdown beat-flow lands first.
    const t = setTimeout(() => {
      realTime.startAudition().catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [cameraState, judges.length, realTime]);

  // ── Realtime: per-round instruction (vocal/dance/interview) ──────────────
  useEffect(() => {
    if (!isRecording) return;
    if (judges.length === 0) return;
    if (roundIntroDoneRef.current[roundIdx]) return;
    roundIntroDoneRef.current[roundIdx] = true;

    const target = judges[(roundIdx + 1) % judges.length];
    const phase = currentRound.phase;

    if (phase === 'interview') {
      realTime.askInterview(target.id).then((msg) => {
        if (msg && msg.text) lastInterviewQuestionRef.current = msg.text;
      }).catch(() => {});
    } else {
      realTime.judgeSpeak(target.id, { phase, triggerType: 'auto' }).catch(() => {});
    }
  }, [isRecording, roundIdx, judges, currentRound, realTime]);

  // ── Realtime: live performance reactions every 15s during action rounds ──
  useEffect(() => {
    if (!isRecording) return;
    if (currentRound.id === 'interview') return;
    if (judges.length === 0) return;

    const id = setInterval(() => {
      realTime.reactToPerformance({
        round: currentRound.id,
        elapsedSeconds: elapsed,
        audioLevel: Math.round(audioLevel * 100),
        agencyId: agency?.id,
      }).catch(() => {});
    }, REACTION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isRecording, currentRound, judges, realTime, agency, elapsed, audioLevel]);

  // Stop any TTS speech when leaving the screen.
  useEffect(() => {
    return () => {
      try {
        realTime.voice?.stopSpeaking?.();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler invoked when the trainee submits a voice/text answer.
  const handleUserResponse = async (text) => {
    if (!text) return;
    const lastQuestionMessage = [...realTime.messages].reverse().find((m) => m.requiresResponse);
    const questionJudgeId = lastQuestionMessage?.judgeId;
    const questionText = lastQuestionMessage?.text || lastInterviewQuestionRef.current || '';

    // For interview turns, run analysis through judge-interview for a richer reaction.
    if (currentRound.id === 'interview' && questionJudgeId) {
      realTime.setAwaitingResponse(false);
      await realTime.submitInterviewAnswer(questionJudgeId, questionText, text).catch(() => {});
    } else {
      await realTime.handleResponse(text).catch(() => {});
    }
  };

  const handleToggleVoice = () => {
    realTime.voice.setVoiceEnabled(!realTime.voice.enabled);
  };

  useEffect(() => {
    if (elapsed >= ROUND_DURATION) {
      const score = 60 + Math.floor(Math.random() * 35);
      setScores((s) => ({ ...s, [currentRound.id]: score }));
      if (roundIdx < ROUNDS.length - 1) {
        setRoundIdx((i) => i + 1);
        setReactions([]);
      } else if (!finalDeliberationStartedRef.current) {
        finalDeliberationStartedRef.current = true;
        setIsRecording(false);
        clearInterval(reactionTimerRef.current);
        clearInterval(elapsedTimerRef.current);
        // Run a short deliberation round before handing off to the result screen.
        const finalScores = { ...scores, [currentRound.id]: score };
        realTime.closeAudition().finally(() => {
          onComplete?.({ rounds: finalScores });
        });
      }
    }
  }, [elapsed]);

  async function fetchReaction(payload) {
    try {
      const res = await fetch('/api/audition/agency-react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('reaction fetch failed');
      const data = await res.json();
      return (data?.message || '').slice(0, 12) || pickFallback(payload.agencyId);
    } catch {
      return pickFallback(payload.agencyId);
    }
  }

  function pickFallback(agencyId) {
    const list = FALLBACK_BY_AGENCY[agencyId] || ['좋아요'];
    return list[Math.floor(Math.random() * list.length)];
  }

  const progress = Math.min(100, (elapsed / ROUND_DURATION) * 100);

  return (
    <div
      style={{
        minHeight: '100%',
        background: agency?.primaryColor || '#0A0A0A',
        padding: 'clamp(16px, 4vw, 24px)',
        boxSizing: 'border-box',
        color: '#FFFFFF',
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#FFF',
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ← 중단
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.5)',
              border: `1px solid ${agency?.accentColor}`,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: agency?.accentColor,
                boxShadow: `0 0 8px ${agency?.accentColor}`,
                animation: 'pulse 1s infinite',
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em' }}>
              REC · {currentRound.label}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 700,
            }}
          >
            ROUND {roundIdx + 1} / {ROUNDS.length}
          </p>
          <h2
            style={{
              margin: '8px 0 4px',
              fontSize: 'clamp(22px, 6vw, 32px)',
              fontWeight: 800,
            }}
          >
            {currentRound.label}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            {currentRound.desc}
          </p>
        </div>

        <div className="audition-stage-grid">
        <div
          ref={cameraBoxRef}
          className={`audition-camera-box ${isFullscreen ? 'audition-camera-fs' : ''}`}
          style={{
            background: '#000',
            border: isFullscreen ? 'none' : `1px solid ${agency?.accentColor}55`,
            borderRadius: isFullscreen ? 0 : 20,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isFullscreen
              ? 'none'
              : `0 0 0 1px rgba(255,255,255,0.04), 0 30px 80px ${agency?.accentColor}22`,
          }}
        >
          {/* 메인 디스플레이용 video — iOS Safari 호환을 위해 직접 화면에 표시.
              CSS transform: scaleX(-1)로 셀카 미러, CSS filter로 명암 조절. */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            // @ts-ignore — older iOS WebKit 호환
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
              transition: 'opacity 0.3s ease',
              filter: buildFilterString(cameraFilter),
              background: '#000',
            }}
          />
          {/* 백업/녹화 용 canvas — 화면에는 보이지 않음 (필터 적용된 스냅샷·녹화 캡처용 hook과 호환) */}
          <canvas
            ref={displayCanvasRef}
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              pointerEvents: 'none',
            }}
          />

          {/* Letterbox overlay (cinematic feel) */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, height: 28,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0, height: 36,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
              pointerEvents: 'none',
            }}
          />

          {/* REC + agency badge (top-left) */}
          {cameraState === 'live' ? (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(0,0,0,0.55)',
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.15em',
                color: '#FFF',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#FF3B3B',
                  animation: 'pulse 1s infinite',
                }}
              />
              REC · {agency?.name?.toUpperCase?.() || 'AUDITION'}
            </div>
          ) : null}

          {/* Round timer (top-right) */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              fontSize: 28,
              fontWeight: 900,
              fontFamily: "'Poppins', system-ui",
              color: agency?.accentColor,
              textShadow: '0 2px 12px rgba(0,0,0,0.7)',
            }}
          >
            {Math.max(0, ROUND_DURATION - elapsed)}s
          </div>

          {/* 카메라 명암 조절 버튼 (타이머 아래, iPhone 노치 자동 회피) */}
          {cameraState === 'live' ? (
            <button
              type="button"
              onClick={() => setShowFilterPanel((v) => !v)}
              aria-label="카메라 명암 조절"
              style={{
                position: 'absolute',
                top: isFullscreen
                  ? 'calc(env(safe-area-inset-top, 0px) + 64px)'
                  : 'calc(env(safe-area-inset-top, 0px) + 60px)',
                right: 12,
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
              }}
            >
              ☀
            </button>
          ) : null}

          {/* 카메라 명암 조절 패널 — 전체화면에서도 그대로 동작 (카메라 박스 내부에 absolute로 배치됨) */}
          {cameraState === 'live' ? (
            <BrightnessControl
              filter={cameraFilter}
              onChange={updateCameraFilter}
              onReset={resetCameraFilter}
              visible={showFilterPanel}
              onClose={() => setShowFilterPanel(false)}
            />
          ) : null}

          {/* 전체화면 토글 버튼 — 일반 모드는 우측하단, 전체화면에선 우측상단으로 이동 (하단은 judge overlay) */}
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
                      left: 12,
                    }
                  : {
                      right: 12,
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
              }}
            >
              {isFullscreen ? '✕' : '⛶'}
            </button>
          ) : null}

          {/* Audio level meter (bottom-left) */}
          {cameraState === 'live' ? (
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(0,0,0,0.55)',
                padding: '4px 8px',
                borderRadius: 999,
              }}
            >
              <span style={{ fontSize: 11 }}>🎙</span>
              <div style={{ width: 70, height: 6, background: 'rgba(255,255,255,0.18)', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.round(audioLevel * 100)}%`,
                    height: '100%',
                    background: audioLevel > 0.6 ? '#FF3B3B' : agency?.accentColor || '#FF1F8E',
                    transition: 'width 80ms linear',
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* Camera-state overlays */}
          {cameraState !== 'live' ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: '#FFF',
                textAlign: 'center',
                padding: 24,
              }}
            >
              {cameraState === 'requesting' ? (
                <>
                  <div style={{ fontSize: 48, opacity: 0.7 }}>📷</div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>카메라/마이크 권한을 허용해주세요</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    브라우저 상단의 권한 알림에서 "허용"을 눌러주세요
                  </p>
                </>
              ) : null}
              {cameraState === 'error' ? (
                <>
                  <div style={{ fontSize: 48, opacity: 0.7 }}>🚫</div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>카메라를 켤 수 없습니다</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    style={{
                      marginTop: 6,
                      background: agency?.accentColor || '#FF1F8E',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: 999,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    다시 시도
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {/* iOS/모바일 자동재생 차단 시 — 사용자 탭으로 카메라 시작 */}
          {cameraState === 'live' && needsTapToStart ? (
            <button
              type="button"
              onClick={handleTapToStart}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                color: '#FFF',
                border: 'none',
                cursor: 'pointer',
                zIndex: 30,
              }}
            >
              <div style={{ fontSize: 56 }}>📷</div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>탭해서 카메라 시작</p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)', maxWidth: 280, textAlign: 'center', lineHeight: 1.5 }}>
                모바일 자동재생 정책으로 인해 한 번 탭이 필요해요
              </p>
            </button>
          ) : null}

          {/* Countdown overlay (3-2-1 GO) */}
          {cameraState === 'live' && countdown > 0 && !needsTapToStart ? (
            <div
              key={countdown}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)',
                animation: 'fadeIn 250ms ease',
              }}
            >
              <span
                style={{
                  fontSize: 'clamp(80px, 22vw, 160px)',
                  fontWeight: 900,
                  color: agency?.accentColor || '#FF1F8E',
                  fontFamily: "'Poppins', system-ui",
                  textShadow: '0 8px 40px rgba(0,0,0,0.6)',
                }}
              >
                {countdown}
              </span>
            </div>
          ) : null}

          {/* 전체화면 모드 — 심사위원 대화/인터뷰 오버레이 (카메라 위에 떠있음) */}
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
                messages={realTime.messages}
                currentSpeaker={realTime.currentSpeaker}
                awaitingResponse={realTime.awaitingResponse}
                onUserResponse={handleUserResponse}
                language={language}
                agencyAccent={agency?.accentColor || '#FF1F8E'}
                voiceEnabled={realTime.voice.enabled}
                onToggleVoice={handleToggleVoice}
                responsePrompt={
                  currentRound.id === 'interview'
                    ? '심사위원 질문에 답해주세요'
                    : '심사위원에게 한 마디 해보세요'
                }
                compact
              />
            </div>
          ) : null}
        </div>

        {/* Live judge conversation panel (right side on desktop, stacked on mobile).
            전체화면 모드일 때는 카메라 박스 안 오버레이로 표시되므로 여기는 숨김. */}
        {!isFullscreen ? (
          <div className="audition-stage-side">
            <JudgeConversation
              judges={judges}
              messages={realTime.messages}
              currentSpeaker={realTime.currentSpeaker}
              awaitingResponse={realTime.awaitingResponse}
              onUserResponse={handleUserResponse}
              language={language}
              agencyAccent={agency?.accentColor || '#FF1F8E'}
              voiceEnabled={realTime.voice.enabled}
              onToggleVoice={handleToggleVoice}
              responsePrompt={
                currentRound.id === 'interview'
                  ? '심사위원 질문에 답해주세요'
                  : '심사위원에게 한 마디 해보세요'
              }
              compact
            />
          </div>
        ) : null}
        </div> {/* /audition-stage-grid */}

        <div style={{ marginTop: 14 }}>
          <LiveInteractionBar
            agencyAccent={agency?.accentColor || '#FF1F8E'}
            audioLevel={audioLevel}
            pitchAccuracy={Math.round(60 + audioLevel * 35)}
            rhythmScore={isRecording ? Math.round(55 + audioLevel * 40) : 0}
            poseScore={isRecording ? Math.round(65 + audioLevel * 30) : 0}
          />
        </div>

        <div
          style={{
            marginTop: 12,
            height: 8,
            background: 'rgba(0,0,0,0.4)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: agency?.accentColor,
              transition: 'width 1s linear',
            }}
          />
        </div>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reactions.map((r) => (
            <JudgeReaction key={r.id} judge={r.judge} message={r.message} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
        .audition-stage-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
          gap: 14px;
          align-items: stretch;
        }
        .audition-stage-side {
          display: flex;
          flex-direction: column;
          min-height: 0;
          height: 100%;
        }
        /* 카메라 박스 — desktop은 16:9 가로형, mobile은 9:16 세로형으로 큰 영역 확보 */
        .audition-camera-box {
          width: 100%;
          aspect-ratio: 16 / 9;
          min-height: 260px;
        }
        @media (max-width: 860px) {
          .audition-stage-grid {
            grid-template-columns: 1fr;
          }
          .audition-stage-side {
            min-height: 260px;
          }
          .audition-camera-box {
            aspect-ratio: 9 / 16;
            min-height: 60vh;
            max-height: 78vh;
          }
        }
        /* 전체화면 모드 — viewport 가득 채움 (iOS / Android Chrome 모두 안정) */
        .audition-camera-fs {
          position: fixed !important;
          inset: 0 !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          height: 100dvh !important;
          max-width: none !important;
          max-height: none !important;
          min-height: 0 !important;
          aspect-ratio: auto !important;
          border-radius: 0 !important;
          z-index: 9999 !important;
          background: #000 !important;
        }
      `}</style>
    </div>
  );
}
