// 수정됨 — K-POP 트레이닝: 안무(MediaPipe Holistic) · 보컬(Web Audio) · 한국어(텍스트 분석) + Firestore 동기화
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import { FilesetResolver, HolisticLandmarker } from '@mediapipe/tasks-vision';
import {
  detectPitchHzAutocorr,
  hzToMidiFloat,
  midiToNoteName,
  midiToKoSyllable,
  buildVocalPitchFeedback,
} from './training/trainingPitch.js';

const SESSIONS = 'sessions';
const POSE_EDGES = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

const SAMPLE_KO =
  '안녕하세요, 오늘도 열심히 연습해 볼게요. 발음을 또렷하게 하면서 천천히 읽어 주세요.';

function angleDeg(ax, ay, bx, by, cx, cy) {
  const v1x = ax - bx;
  const v1y = ay - by;
  const v2x = cx - bx;
  const v2y = cy - by;
  const d1 = Math.hypot(v1x, v1y);
  const d2 = Math.hypot(v2x, v2y);
  if (d1 < 1e-6 || d2 < 1e-6) return null;
  let cos = (v1x * v2x + v1y * v2y) / (d1 * d2);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

function drawPoseOnCanvas(ctx, landmarks, w, h) {
  if (!landmarks?.length) return;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
  ctx.lineWidth = 3;
  for (const [a, b] of POSE_EDGES) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb || (pa.v ?? pa.visibility ?? 1) < 0.3 || (pb.v ?? pb.visibility ?? 1) < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
  for (let i = 0; i < landmarks.length; i += 1) {
    const p = landmarks[i];
    if (!p || (p.v ?? p.visibility ?? 1) < 0.25) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function analyzeKorean(reference, userInput) {
  const ref = (reference || '').trim();
  const user = (userInput || '').trim();
  if (!ref.length) {
    return { accuracy: 0, lengthScore: 0, charMatch: 0, tips: ['기준 문장이 없습니다.'] };
  }
  if (!user.length) {
    return { accuracy: 0, lengthScore: 0, charMatch: 0, tips: ['읽은 문장을 입력해 주세요.'] };
  }
  const lenRatio = Math.min(user.length, ref.length) / Math.max(ref.length, 1);
  const lengthScore = Math.round(lenRatio * 100);
  let match = 0;
  const n = Math.min(ref.length, user.length);
  for (let i = 0; i < n; i += 1) {
    if (ref[i] === user[i]) match += 1;
  }
  const charMatch = Math.round((match / Math.max(ref.length, 1)) * 100);
  const accuracy = Math.round(lengthScore * 0.35 + charMatch * 0.65);
  const tips = [];
  if (user.length < ref.length * 0.7) tips.push('문장이 짧습니다. 끝까지 읽었는지 확인해 보세요.');
  if (user.length > ref.length * 1.4) tips.push('불필요한 글자가 많을 수 있습니다.');
  if (charMatch < 60) tips.push('철자·띄어쓰기를 기준 문장과 맞춰 보세요.');
  if (accuracy >= 85) tips.push('발음·리듬 연습을 이어 가면 좋습니다.');
  if (!tips.length) tips.push('전반적으로 양호합니다. 속도를 조금 올려 보세요.');
  return { accuracy, lengthScore, charMatch, tips };
}

function TrainingHub({ onStartLaptop, onJoinMobile, onBack }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">K-POP 트레이닝</h1>
          <p className="text-sm text-slate-400">안무 · 보컬 · 한국어 분석을 모바일과 노트북이 함께 사용합니다.</p>
        </div>
        <div className="grid gap-4">
          <button
            type="button"
            onClick={onStartLaptop}
            className="w-full rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-semibold py-4 px-4 shadow-lg shadow-sky-900/40 transition"
          >
            노트북에서 세션 열기
          </button>
          <button
            type="button"
            onClick={onJoinMobile}
            className="w-full rounded-2xl border border-slate-600 bg-slate-900/60 hover:bg-slate-800 text-slate-100 font-semibold py-4 px-4 transition"
          >
            모바일에서 연결
          </button>
        </div>
        {onBack && (
          <button type="button" onClick={onBack} className="w-full text-sm text-slate-500 hover:text-slate-300">
            ← 앱 모드 선택
          </button>
        )}
      </div>
    </div>
  );
}

function TrainingLaptopDashboard({ db, appId, sessionId, onBack }) {
  const canvasRef = useRef(null);
  const [data, setData] = useState(null);
  const joinUrl = useMemo(() => {
    const u = new URL(window.location.href);
    u.searchParams.set('session', sessionId);
    u.searchParams.set('train', '1');
    return u.toString();
  }, [sessionId]);

  useEffect(() => {
    const ref = doc(db, 'artifacts', appId, 'public', 'data', SESSIONS, sessionId);
    const unsub = onSnapshot(ref, (snap) => {
      setData(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [db, appId, sessionId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    const lm = data?.pose?.landmarks;
    if (lm?.length) drawPoseOnCanvas(ctx, lm, w, h);
    else {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px system-ui';
      ctx.fillText('모바일 안무 탭에서 카메라를 켜면 포즈가 표시됩니다.', 24, h / 2);
    }
  }, [data?.pose?.landmarks]);

  const track = data?.track || 'dance';
  const pitch = data?.pitch;
  const korean = data?.korean || {};
  const metrics = data?.metrics || {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">트레이닝 대시보드</h2>
            <p className="text-slate-400 text-sm font-mono">세션 {sessionId}</p>
          </div>
          <button type="button" onClick={onBack} className="text-sm text-slate-400 hover:text-white">
            ← 허브
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <h3 className="font-semibold text-sky-300">모바일 연결</h3>
            <div className="flex justify-center bg-white rounded-xl p-3">
              <QRCodeSVG value={joinUrl} size={180} level="M" />
            </div>
            <p className="text-xs text-slate-500 break-all">{joinUrl}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <h3 className="font-semibold text-emerald-300">현재 트랙</h3>
            <p className="text-lg">
              {track === 'dance' && '안무'}
              {track === 'vocal' && '보컬'}
              {track === 'korean' && '한국어'}
            </p>
            <p className="text-sm text-slate-400">모바일에서 탭을 바꾸면 여기에 반영됩니다.</p>
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="font-semibold text-cyan-300 mb-2">안무</h3>
            <canvas ref={canvasRef} width={640} height={360} className="w-full rounded-xl bg-slate-950 border border-slate-800" />
            <p className="text-sm text-slate-400 mt-2">
              활동 점수: <span className="text-white font-mono">{metrics.danceActivity ?? '—'}</span>
            </p>
            <p className="text-xs text-slate-500">왼팔 각도(참고): {metrics.leftElbowDeg != null ? `${Math.round(metrics.leftElbowDeg)}°` : '—'}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <h3 className="font-semibold text-fuchsia-300">보컬</h3>
            {pitch?.hz ? (
              <>
                <p className="text-2xl font-mono text-white">{pitch.hz.toFixed(1)} Hz</p>
                <p className="text-sm">
                  {pitch.noteName} · {pitch.koSyllable}
                </p>
                <p className="text-sm text-slate-300">{pitch.feedback}</p>
                <p className="text-xs text-slate-500">정확도(목표 대비): {pitch.accuracy ?? '—'}%</p>
              </>
            ) : (
              <p className="text-slate-500 text-sm">모바일 보컬 탭에서 마이크를 켜 주세요.</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <h3 className="font-semibold text-amber-300">한국어</h3>
            {korean.accuracy != null ? (
              <>
                <p className="text-2xl font-mono text-white">{korean.accuracy}%</p>
                <p className="text-xs text-slate-400">길이 {korean.lengthScore}% · 문자 일치 {korean.charMatch}%</p>
                <ul className="text-sm text-slate-300 list-disc pl-4 space-y-1">
                  {(korean.tips || []).map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-slate-500 text-sm">모바일 한국어 탭에서 문장을 입력하고 분석하세요.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainingMobile({ db, appId, sessionId, onBack }) {
  const [tab, setTab] = useState('dance');
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [koInput, setKoInput] = useState('');
  const [vocalTarget, setVocalTarget] = useState(60);
  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const lastPoseWrite = useRef(0);
  const wristHist = useRef([]);
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const pitchIntervalRef = useRef(null);

  const sessionRef = useMemo(
    () => doc(db, 'artifacts', appId, 'public', 'data', SESSIONS, sessionId),
    [db, appId, sessionId]
  );

  const syncTrack = useCallback(
    async (t) => {
      try {
        await updateDoc(sessionRef, { track: t, updatedAt: serverTimestamp() });
      } catch (e) {
        console.error(e);
      }
    },
    [sessionRef]
  );

  useEffect(() => {
    syncTrack(tab);
  }, [tab, syncTrack]);

  useEffect(() => {
    if (!camOn || tab !== 'dance') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
      return undefined;
    }

    let cancelled = false;
    const video = videoRef.current;
    if (!video) return undefined;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();

        const wasmPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        let holistic;
        try {
          holistic = await HolisticLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            minPoseDetectionConfidence: 0.3,
            minPosePresenceConfidence: 0.3,
          });
        } catch {
          holistic = await HolisticLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            minPoseDetectionConfidence: 0.3,
            minPosePresenceConfidence: 0.3,
          });
        }
        landmarkerRef.current = holistic;

        const loop = () => {
          if (cancelled || !landmarkerRef.current || !video.videoWidth) {
            rafRef.current = requestAnimationFrame(loop);
            return;
          }
          const r = landmarkerRef.current.detectForVideo(video, performance.now());
          const pl = r.poseLandmarks?.[0];
          const now = performance.now();
          if (pl?.length && now - lastPoseWrite.current > 120) {
            lastPoseWrite.current = now;
            const compact = pl.map((p) => ({
              x: p.x,
              y: p.y,
              z: p.z ?? 0,
              v: p.visibility ?? 1,
            }));
            let leftElbowDeg = null;
            if (pl[11] && pl[13] && pl[15]) {
              leftElbowDeg = angleDeg(pl[11].x, pl[11].y, pl[13].x, pl[13].y, pl[15].x, pl[15].y);
            }
            const lw = pl[15];
            if (lw) {
              const h = wristHist.current;
              h.push({ x: lw.x, y: lw.y, t: now });
              while (h.length && now - h[0].t > 2000) h.shift();
            }
            let danceActivity = 0;
            const h = wristHist.current;
            if (h.length > 3) {
              let sum = 0;
              for (let i = 1; i < h.length; i += 1) {
                sum += Math.hypot(h[i].x - h[i - 1].x, h[i].y - h[i - 1].y);
              }
              danceActivity = Math.min(100, Math.round(sum * 5000));
            }
            updateDoc(sessionRef, {
              pose: { landmarks: compact, ts: Date.now() },
              cameraActive: true,
              metrics: { leftElbowDeg, danceActivity },
              updatedAt: serverTimestamp(),
            }).catch((e) => console.error(e));
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const v = videoRef.current;
      if (v?.srcObject) {
        v.srcObject.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
      updateDoc(sessionRef, {
        pose: deleteField(),
        cameraActive: false,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    };
  }, [camOn, tab, sessionRef]);

  useEffect(() => {
    if (!micOn || tab !== 'vocal') {
      if (pitchIntervalRef.current) {
        clearInterval(pitchIntervalRef.current);
        pitchIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      updateDoc(sessionRef, { pitch: deleteField(), updatedAt: serverTimestamp() }).catch(() => {});
      return undefined;
    }

    let stopped = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 80;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1200;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 300;
        bp.Q.value = 0.7;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(hp);
        hp.connect(lp);
        lp.connect(bp);
        bp.connect(analyser);

        pitchIntervalRef.current = setInterval(() => {
          const hz = detectPitchHzAutocorr(analyser, ctx.sampleRate);
          if (!hz) {
            updateDoc(sessionRef, {
              pitch: { hz: null, noteName: '', koSyllable: '', feedback: '소리를 감지하지 못했습니다.', accuracy: 0 },
              updatedAt: serverTimestamp(),
            }).catch(() => {});
            return;
          }
          const midiF = hzToMidiFloat(hz);
          const midiR = midiF != null ? Math.round(midiF) : 60;
          const fb = buildVocalPitchFeedback(hz, vocalTarget);
          updateDoc(sessionRef, {
            pitch: {
              hz,
              midi: midiF,
              noteName: midiToNoteName(midiR),
              koSyllable: midiToKoSyllable(midiR),
              feedback: fb.feedback,
              accuracy: fb.accuracy,
              cents: fb.cents,
              targetMidi: vocalTarget,
            },
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }, 200);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      stopped = true;
      if (pitchIntervalRef.current) {
        clearInterval(pitchIntervalRef.current);
        pitchIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [micOn, tab, sessionRef, vocalTarget]);

  const runKoreanAnalysis = async () => {
    const result = analyzeKorean(SAMPLE_KO, koInput);
    try {
      await updateDoc(sessionRef, {
        korean: {
          ...result,
          sampleSnippet: SAMPLE_KO.slice(0, 80),
          userLength: koInput.length,
          at: Date.now(),
        },
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 p-4 flex items-center justify-between">
        <span className="font-mono text-sm text-slate-400">세션 {sessionId}</span>
        <button type="button" onClick={onBack} className="text-sm text-sky-400">
          나가기
        </button>
      </header>
      <div className="flex border-b border-slate-800">
        {[
          { id: 'dance', label: '안무' },
          { id: 'vocal', label: '보컬' },
          { id: 'korean', label: '한국어' },
        ].map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`flex-1 py-3 text-sm font-medium ${tab === x.id ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="flex-1 p-4 overflow-auto">
        {tab === 'dance' && (
          <div className="space-y-4">
            <video ref={videoRef} playsInline muted className="w-full max-w-md rounded-xl bg-black mx-auto block" />
            <button
              type="button"
              onClick={() => setCamOn((c) => !c)}
              className={`w-full py-3 rounded-xl font-semibold ${camOn ? 'bg-rose-600' : 'bg-sky-600'}`}
            >
              {camOn ? '카메라 끄기' : '카메라 켜기 (포즈 전송)'}
            </button>
            <p className="text-xs text-slate-500">MediaPipe Holistic으로 포즈를 추정해 노트북에 전송합니다.</p>
          </div>
        )}
        {tab === 'vocal' && (
          <div className="space-y-4 max-w-md mx-auto">
            <label className="block text-sm text-slate-400">
              목표 MIDI ({vocalTarget}) — {midiToNoteName(vocalTarget)}
              <input
                type="range"
                min="48"
                max="84"
                value={vocalTarget}
                onChange={(e) => setVocalTarget(Number(e.target.value))}
                className="w-full mt-2"
              />
            </label>
            <button
              type="button"
              onClick={() => setMicOn((m) => !m)}
              className={`w-full py-3 rounded-xl font-semibold ${micOn ? 'bg-rose-600' : 'bg-fuchsia-600'}`}
            >
              {micOn ? '마이크 끄기' : '마이크 켜기 (피치 전송)'}
            </button>
            <p className="text-xs text-slate-500">고역·저역 필터와 자기상관으로 피치를 추정합니다.</p>
          </div>
        )}
        {tab === 'korean' && (
          <div className="space-y-4 max-w-lg mx-auto">
            <p className="text-sm text-slate-400 leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-slate-800">{SAMPLE_KO}</p>
            <textarea
              value={koInput}
              onChange={(e) => setKoInput(e.target.value)}
              placeholder="위 문장을 보고 따라 읽은 내용을 입력하세요."
              className="w-full min-h-[120px] rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm"
            />
            <button type="button" onClick={runKoreanAnalysis} className="w-full py-3 rounded-xl bg-amber-600 font-semibold">
              분석 결과 전송
            </button>
            <p className="text-xs text-slate-500">문장 길이·문자 일치를 기반으로 연습 점수를 계산합니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrainingApp({ db, auth, appId, onBack }) {
  const [user, setUser] = useState(null);
  const [phase, setPhase] = useState('hub');
  const [sessionId, setSessionId] = useState('');
  const [joinInput, setJoinInput] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!user) {
      signInAnonymously(auth).catch((e) => console.error(e));
    }
  }, [user, auth]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = (p.get('session') || '').trim().toUpperCase();
    const train = p.get('train');
    if (s && train === '1') {
      setSessionId(s);
      setPhase('mobile');
    }
  }, []);

  const startLaptop = async () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const ref = doc(db, 'artifacts', appId, 'public', 'data', SESSIONS, id);
    try {
      await setDoc(ref, {
        createdAt: serverTimestamp(),
        ownerUid: user?.uid || null,
        track: 'dance',
        pose: null,
        pitch: null,
        korean: null,
        metrics: {},
        cameraActive: false,
        type: 'training',
      });
      setSessionId(id);
      setPhase('laptop');
    } catch (e) {
      console.error(e);
      alert('세션 생성에 실패했습니다.');
    }
  };

  const joinMobile = () => {
    const raw = (joinInput || '').trim().toUpperCase();
    if (!raw) {
      alert('세션 코드를 입력하세요.');
      return;
    }
    setSessionId(raw);
    setPhase('mobile');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-slate-400">연결 중…</p>
      </div>
    );
  }

  if (phase === 'hub') {
    return (
      <TrainingHub
        onStartLaptop={startLaptop}
        onJoinMobile={() => setPhase('join')}
        onBack={onBack}
      />
    );
  }

  if (phase === 'join') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-4">
          <h2 className="text-xl font-bold">세션 코드 입력</h2>
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="예: ABC123"
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 font-mono uppercase"
          />
          <button type="button" onClick={joinMobile} className="w-full py-3 rounded-xl bg-sky-600 font-semibold">
            연결
          </button>
          <button type="button" onClick={() => setPhase('hub')} className="w-full text-sm text-slate-500">
            취소
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'laptop') {
    return <TrainingLaptopDashboard db={db} appId={appId} sessionId={sessionId} onBack={() => setPhase('hub')} />;
  }

  if (phase === 'mobile') {
    return <TrainingMobile db={db} appId={appId} sessionId={sessionId} onBack={() => setPhase('hub')} />;
  }

  return null;
}
