// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import JudgeReaction from './JudgeReaction';
import JudgeConversation from './JudgeConversation';
import LiveInteractionBar from './LiveInteractionBar';
import useRealTimeJudge from '../../hooks/useRealTimeJudge';

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
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioRafRef = useRef(null);

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
  useEffect(() => {
    let cancelled = false;
    async function startMedia() {
      setCameraState('requesting');
      setCameraError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('이 브라우저는 카메라 접근을 지원하지 않습니다.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 16 / 9 },
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // play() may need user gesture on some browsers; muted autoplay should work
          try { await videoRef.current.play(); } catch { /* ignored */ }
        }
        // Audio level meter via WebAudio (lightweight)
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          const ac = new Ctx();
          audioContextRef.current = ac;
          const source = ac.createMediaStreamSource(stream);
          const analyser = ac.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          const buffer = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteTimeDomainData(buffer);
            let sumSquares = 0;
            for (let i = 0; i < buffer.length; i += 1) {
              const v = (buffer[i] - 128) / 128;
              sumSquares += v * v;
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
        setCameraError(err?.message || '카메라/마이크 권한이 필요합니다.');
      }
    }
    startMedia();
    return () => {
      cancelled = true;
      if (audioRafRef.current) cancelAnimationFrame(audioRafRef.current);
      if (audioContextRef.current && typeof audioContextRef.current.close === 'function') {
        try { audioContextRef.current.close(); } catch { /* noop */ }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ── Countdown gate: when camera goes live OR round changes, run 3-2-1 ─────
  useEffect(() => {
    if (cameraState !== 'live') return undefined;
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
  }, [cameraState, roundIdx]);

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
          style={{
            background: '#000',
            border: `1px solid ${agency?.accentColor}55`,
            borderRadius: 20,
            position: 'relative',
            overflow: 'hidden',
            aspectRatio: '16 / 9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 30px 80px ${agency?.accentColor}22`,
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: currentRound.framing === 'wide' ? 'cover' : 'cover',
              transform: 'scaleX(-1)', // mirror like a phone selfie
              opacity: cameraState === 'live' ? 1 : 0.0,
              transition: 'opacity 0.3s ease',
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

          {/* Countdown overlay (3-2-1 GO) */}
          {cameraState === 'live' && countdown > 0 ? (
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
        </div>

        {/* Live judge conversation panel (right side on desktop, stacked on mobile) */}
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
        @media (max-width: 860px) {
          .audition-stage-grid {
            grid-template-columns: 1fr;
          }
          .audition-stage-side {
            min-height: 260px;
          }
        }
      `}</style>
    </div>
  );
}
