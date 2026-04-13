// 수정됨 — K-POP 트레이닝: 안무(MediaPipe Holistic) · 보컬(Web Audio) · 한국어(텍스트 분석) + Firestore 동기화
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
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
import useWebRtcSession from './hooks/useWebRtcSession.js';

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
const MOBILE_FRAME_WIDTH = 720;
const MOBILE_FRAME_HEIGHT = 1280;
const MOBILE_FRAME_JPEG_QUALITY = 0.4;
const MOBILE_FRAME_INTERVAL_MS = 333;
const MOBILE_ANALYZE_INTERVAL_MS = 1000 / 24;
const HAND_FINGERTIP_INDICES = [4, 8, 12, 16, 20];

function sanitizeLandmarksForFirestore(landmarks) {
  if (!Array.isArray(landmarks)) return [];
  return landmarks.map((p) => ({
    x: Number(p?.x ?? 0),
    y: Number(p?.y ?? 0),
    z: Number(p?.z ?? 0),
    visibility: Number(p?.visibility ?? p?.v ?? 0),
  }));
}

function buildOptimizedPoseDocForFirestore(bodyTracking) {
  if (!bodyTracking?.pose?.length) return null;
  const pose = sanitizeLandmarksForFirestore(bodyTracking.pose);
  const leftHand21 = sanitizeLandmarksForFirestore(bodyTracking.leftHand21 || []);
  const rightHand21 = sanitizeLandmarksForFirestore(bodyTracking.rightHand21 || []);
  const leftF = HAND_FINGERTIP_INDICES.map((i) => leftHand21[i]).filter(Boolean);
  const rightF = HAND_FINGERTIP_INDICES.map((i) => rightHand21[i]).filter(Boolean);
  const lHip = pose[23];
  const rHip = pose[24];
  const hipCenter =
    lHip && rHip
      ? {
          x: Number((lHip.x + rHip.x) / 2),
          y: Number((lHip.y + rHip.y) / 2),
          z: Number((lHip.z + rHip.z) / 2),
          visibility: Number(Math.min(lHip.visibility ?? 1, rHip.visibility ?? 1)),
        }
      : null;
  return {
    landmarks: pose,
    leftHand21,
    rightHand21,
    handFingertips: { left: leftF, right: rightF },
    hipCenter,
    ts: Date.now(),
  };
}

function getNetworkUrl(sessionKey) {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const pathname = window.location.pathname || '/';
  const explicitPort = window.location.port;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLanIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const port = explicitPort || (isLocalHost || isLanIp ? '5173' : '');
  const hostWithPort = port ? `${hostname}:${port}` : hostname;
  return `${protocol}//${hostWithPort}${pathname}?session=${encodeURIComponent(sessionKey)}`;
}

function computeTeamSyncScore(participants) {
  const valid = participants
    .filter((p) => p?.cameraOn && p?.pose?.landmarks?.length)
    .map((p) => p.pose.landmarks);
  if (valid.length < 2) return 100;
  const toVec = (lm) => {
    const shL = lm[11];
    const shR = lm[12];
    const elL = lm[13];
    const elR = lm[14];
    const wrL = lm[15];
    const wrR = lm[16];
    const hpL = lm[23];
    const hpR = lm[24];
    const knL = lm[25];
    const knR = lm[26];
    const anL = lm[27];
    const anR = lm[28];
    if (!(shL && shR && elL && elR && wrL && wrR && hpL && hpR && knL && knR && anL && anR)) return null;
    const a = (a0, b0, c0) => angleDeg(a0.x, a0.y, b0.x, b0.y, c0.x, c0.y) ?? 0;
    const torsoTilt = Math.abs(Math.atan2(((shL.x + shR.x) / 2) - ((hpL.x + hpR.x) / 2), ((shL.y + shR.y) / 2) - ((hpL.y + hpR.y) / 2)));
    return [a(shL, elL, wrL), a(shR, elR, wrR), a(hpL, knL, anL), a(hpR, knR, anR), torsoTilt * (180 / Math.PI)];
  };
  const vectors = valid.map(toVec).filter(Boolean);
  if (vectors.length < 2) return 100;
  let diffSum = 0;
  let pairCount = 0;
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      const va = vectors[i];
      const vb = vectors[j];
      const d = va.reduce((acc, x, idx) => acc + Math.abs(x - vb[idx]), 0) / va.length;
      diffSum += d;
      pairCount += 1;
    }
  }
  if (!pairCount) return 100;
  return Math.max(0, Math.min(100, Math.round(100 - diffSum)));
}

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

function drawPoseOnCanvas(ctx, landmarks, w, h, clearFirst = true) {
  if (!landmarks?.length) return;
  if (clearFirst) ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
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

function toScoreFromAngle(angle, target = 155, tolerance = 35) {
  if (angle == null) return 0;
  const delta = Math.abs(angle - target);
  const ratio = Math.max(0, 1 - delta / tolerance);
  return Math.round(ratio * 100);
}

function buildDanceFeedback(metrics) {
  const tips = [];
  if ((metrics.poseConfidence ?? 0) < 45) tips.push('카메라에 전신이 들어오게 거리를 조절하세요.');
  if ((metrics.armAccuracy ?? 0) < 60) tips.push('팔 각도를 더 크게 펴서 동작을 또렷하게 만들어 보세요.');
  if ((metrics.symmetry ?? 0) < 55) tips.push('좌우 팔 높이를 맞추면 완성도가 올라갑니다.');
  if ((metrics.danceActivity ?? 0) < 45) tips.push('손목 이동량이 적습니다. 박자에 맞춰 크게 움직여 보세요.');
  if (!tips.length) tips.push('좋아요! 지금 동작을 유지하면서 박자 정확도를 높여 보세요.');
  return tips;
}

function TrainingHub({ selectedTrack, onSelectTrack, onStartLaptop, onJoinMobile, onBack }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">K-POP 트레이닝</h1>
          <p className="text-sm text-slate-400">안무 · 보컬 · 한국어 분석을 모바일과 노트북이 함께 사용합니다.</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-2">
          <p className="text-xs text-slate-400 mb-2 px-1">시작 트랙 선택</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'dance', label: '안무' },
              { id: 'vocal', label: '보컬' },
              { id: 'korean', label: '한국어' },
            ].map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => onSelectTrack(x.id)}
                className={`rounded-xl py-2 text-sm font-medium transition ${
                  selectedTrack === x.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
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
  const videoWrapperRef = useRef(null);
  const danceCanvasRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const latestPoseRef = useRef(null);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);
  const [data, setData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState('dance');
  const { remoteStream } = useWebRtcSession({
    db,
    appId,
    sessionId,
    role: 'laptop',
    localStream: null,
    enabled: true,
  });
  const joinUrl = useMemo(() => {
    return getNetworkUrl(sessionId);
  }, [sessionId]);

  useEffect(() => {
    const ref = doc(db, 'artifacts', appId, 'public', 'data', SESSIONS, sessionId);
    const unsub = onSnapshot(ref, (snap) => {
      setData(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [db, appId, sessionId]);

  useEffect(() => {
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', SESSIONS, sessionId, 'participants');
    const unsub = onSnapshot(colRef, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
      setParticipants(list);
    });
    return () => unsub();
  }, [db, appId, sessionId]);

  useEffect(() => {
    latestPoseRef.current = data?.pose?.landmarks || null;
  }, [data?.pose?.landmarks]);

  const track = data?.track || 'dance';
  const pitch = data?.pitch;
  const korean = data?.korean || {};
  const metrics = data?.metrics || {};
  const mirroredFrame = data?.mobileFrame?.dataUrl || '';
  const danceTips = Array.isArray(metrics.feedbackTips) ? metrics.feedbackTips : [];
  const teamSyncScore = useMemo(() => computeTeamSyncScore(participants), [participants]);

  const syncCanvasToVideo = useCallback(() => {
    const video = remoteVideoRef.current;
    const canvas = danceCanvasRef.current;
    const wrapper = videoWrapperRef.current;
    if (!canvas || !video) return;
    const vw = Number(video.videoWidth || 0);
    const vh = Number(video.videoHeight || 0);
    if (!vw || !vh) return;

    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }
    if (wrapper) {
      wrapper.style.minHeight = 'calc(100vh - 240px)';
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, vw, vh);
    const lm = latestPoseRef.current;
    if (lm?.length) drawPoseOnCanvas(ctx, lm, vw, vh, false);
  }, []);

  useEffect(() => {
    if (track) setSelectedTrack(track);
  }, [track]);

  useEffect(() => {
    const v = remoteVideoRef.current;
    if (!v) return;
    v.srcObject = remoteStream || null;
    setRemoteVideoReady(false);
    if (remoteStream) {
      const tryPlay = () => {
        v.play().catch(() => {});
      };
      const markReady = () => {
        if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
          setRemoteVideoReady(true);
          syncCanvasToVideo();
        }
      };
      v.onloadedmetadata = tryPlay;
      v.onloadeddata = markReady;
      v.onplaying = markReady;
      v.onresize = markReady;
      tryPlay();
      return () => {
        v.onloadedmetadata = null;
        v.onloadeddata = null;
        v.onplaying = null;
        v.onresize = null;
      };
    }
  }, [remoteStream, syncCanvasToVideo]);

  useEffect(() => {
    const video = remoteVideoRef.current;
    const wrapper = videoWrapperRef.current;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncCanvasToVideo) : null;
    if (ro) {
      if (wrapper) ro.observe(wrapper);
      if (video) ro.observe(video);
    }
    window.addEventListener('resize', syncCanvasToVideo);
    syncCanvasToVideo();
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncCanvasToVideo);
    };
  }, [data?.pose?.landmarks, remoteStream, syncCanvasToVideo]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="w-full max-w-none mx-auto space-y-6 px-0">
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'dance', label: '안무' },
              { id: 'vocal', label: '보컬' },
              { id: 'korean', label: '한국어' },
            ].map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setSelectedTrack(x.id)}
                className={`rounded-xl py-2 text-sm font-medium transition ${
                  selectedTrack === x.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-6">
          {selectedTrack === 'dance' && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h3 className="font-semibold text-cyan-300 mb-3">안무 대시보드</h3>
              <div
                ref={videoWrapperRef}
                className="video-wrapper relative mx-auto w-full overflow-hidden rounded-xl border border-slate-800 bg-transparent aspect-[9/16] flex items-center justify-center"
                style={{ minHeight: 'calc(100vh - 240px)', maxWidth: 'min(100%, 56.25vh)' }}
              >
                {mirroredFrame ? (
                  <img
                    src={mirroredFrame}
                    alt="mobile-frame-fallback"
                    className="absolute inset-0 h-full w-full object-contain bg-transparent"
                  />
                ) : null}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 h-full w-full object-contain bg-transparent scale-x-[-1] transition-opacity duration-200 ${
                    remoteStream && remoteVideoReady ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <canvas
                  ref={danceCanvasRef}
                  className="absolute inset-0 z-10 h-full w-full pointer-events-none bg-transparent transform-gpu [will-change:transform] object-contain scale-x-[-1]"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                <div className="rounded-lg bg-slate-900/80 p-2">활동성 <span className="font-mono text-white">{metrics.danceActivity ?? '—'}</span></div>
                <div className="rounded-lg bg-slate-900/80 p-2">팔 정확도 <span className="font-mono text-white">{metrics.armAccuracy ?? '—'}</span></div>
                <div className="rounded-lg bg-slate-900/80 p-2">좌우 대칭 <span className="font-mono text-white">{metrics.symmetry ?? '—'}</span></div>
                <div className="rounded-lg bg-slate-900/80 p-2">포즈 신뢰도 <span className="font-mono text-white">{metrics.poseConfidence ?? '—'}</span></div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                참여자 {participants.length}명 · 팀 싱크 <span className="font-mono text-white">{teamSyncScore}</span>
              </p>
              <p className="text-sm text-slate-300 mt-2">
                실시간 종합 점수: <span className="font-mono text-white">{metrics.totalScore ?? '—'}</span>
              </p>
              <p className="text-xs text-slate-500 mt-2">
                팔 각도: 좌 {metrics.leftElbowDeg != null ? `${Math.round(metrics.leftElbowDeg)}°` : '—'} / 우 {metrics.rightElbowDeg != null ? `${Math.round(metrics.rightElbowDeg)}°` : '—'}
              </p>
              <ul className="text-xs text-slate-300 list-disc pl-4 mt-2 space-y-1">
                {danceTips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {selectedTrack === 'vocal' && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
              <h3 className="font-semibold text-fuchsia-300">보컬 대시보드</h3>
              {pitch?.hz ? (
                <>
                  <p className="text-3xl font-mono text-white">{pitch.hz.toFixed(1)} Hz</p>
                  <p className="text-base">
                    {pitch.noteName} · {pitch.koSyllable}
                  </p>
                  <p className="text-sm text-slate-300">{pitch.feedback}</p>
                  <p className="text-xs text-slate-500">정확도(목표 대비): {pitch.accuracy ?? '—'}%</p>
                </>
              ) : (
                <p className="text-slate-500 text-sm">모바일 보컬 탭에서 마이크를 켜 주세요.</p>
              )}
            </div>
          )}
          {selectedTrack === 'korean' && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
              <h3 className="font-semibold text-amber-300">한국어 대시보드</h3>
              {korean.accuracy != null ? (
                <>
                  <p className="text-3xl font-mono text-white">{korean.accuracy}%</p>
                  <p className="text-sm text-slate-400">길이 {korean.lengthScore}% · 문자 일치 {korean.charMatch}%</p>
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
          )}
        </div>
      </div>
    </div>
  );
}

function TrainingMobile({ db, appId, sessionId, userId, onBack, onComplete }) {
  const [tab, setTab] = useState('dance');
  const [camOn, setCamOn] = useState(false);
  const [camStream, setCamStream] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [koInput, setKoInput] = useState('');
  const [vocalTarget, setVocalTarget] = useState(60);
  const [danceRealtime, setDanceRealtime] = useState(null);
  const [joinError, setJoinError] = useState('');
  const videoRef = useRef(null);
  const mobileOverlayRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const lastPoseWrite = useRef(0);
  const lastFrameWrite = useRef(0);
  const lastAnalyzeAtRef = useRef(0);
  const latestPoseLandmarksRef = useRef(null);
  const latestBodyTrackingRef = useRef(null);
  const debouncedUpdateFrameRef = useRef(null);
  const poseUploadIntervalRef = useRef(null);
  const mirrorCanvasRef = useRef(null);
  const webrtcStatusRef = useRef('idle');
  const wristHist = useRef([]);
  const rightWristHist = useRef([]);
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const pitchIntervalRef = useRef(null);

  const sessionRef = useMemo(
    () => doc(db, 'artifacts', appId, 'public', 'data', SESSIONS, sessionId),
    [db, appId, sessionId]
  );
  const participantRef = useMemo(() => {
    if (!userId) return null;
    return doc(db, 'artifacts', appId, 'public', 'data', SESSIONS, sessionId, 'participants', userId);
  }, [db, appId, sessionId, userId]);
  const { status: webrtcStatus, error: webrtcError } = useWebRtcSession({
    db,
    appId,
    sessionId,
    role: 'mobile',
    localStream: camStream,
    enabled: camOn && tab === 'dance' && Boolean(camStream),
  });

  useEffect(() => {
    webrtcStatusRef.current = webrtcStatus;
  }, [webrtcStatus]);

  useEffect(() => {
    if (!participantRef || !userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', SESSIONS, sessionId, 'participants');
        const snap = await getDocs(colRef);
        const existsMe = snap.docs.some((d) => d.id === userId);
        if (!existsMe && snap.size >= 4) {
          setJoinError('동시 접속은 최대 4명까지입니다.');
          return;
        }
        setJoinError('');
        await setDoc(
          participantRef,
          {
            uid: userId,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
            cameraOn: false,
            track: tab,
          },
          { merge: true }
        );
      } catch (e) {
        if (!cancelled) setJoinError(e?.message || '참가자 등록에 실패했습니다.');
      }
    })();
    return () => {
      cancelled = true;
      deleteDoc(participantRef).catch(() => {});
    };
  }, [db, appId, sessionId, participantRef, userId, tab]);

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
      if (debouncedUpdateFrameRef.current) {
        clearTimeout(debouncedUpdateFrameRef.current);
        debouncedUpdateFrameRef.current = null;
      }
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
        setCamStream(stream);
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
          const now = performance.now();
          if (now - lastAnalyzeAtRef.current >= MOBILE_ANALYZE_INTERVAL_MS) {
            lastAnalyzeAtRef.current = now;
            const r = landmarkerRef.current.detectForVideo(video, now);
            latestPoseLandmarksRef.current = r.poseLandmarks?.[0] || null;
            latestBodyTrackingRef.current = {
              pose: r.poseLandmarks?.[0] || null,
              leftHand21: r.leftHandLandmarks?.[0] || null,
              rightHand21: r.rightHandLandmarks?.[0] || null,
            };
          }
          const pl = latestPoseLandmarksRef.current;
          if (
            webrtcStatusRef.current !== 'connected' &&
            video.videoWidth &&
            now - lastFrameWrite.current > MOBILE_FRAME_INTERVAL_MS
          ) {
            lastFrameWrite.current = now;
            const c = mirrorCanvasRef.current || document.createElement('canvas');
            mirrorCanvasRef.current = c;
            c.width = MOBILE_FRAME_WIDTH;
            c.height = MOBILE_FRAME_HEIGHT;
            const cctx = c.getContext('2d');
            if (cctx) {
              // 모바일 미리보기와 동일하게 좌우 반전된 화면을 저장합니다.
              cctx.save();
              cctx.scale(-1, 1);
              cctx.drawImage(video, -c.width, 0, c.width, c.height);
              cctx.restore();
              const dataUrl = c.toDataURL('image/jpeg', MOBILE_FRAME_JPEG_QUALITY);
              if (debouncedUpdateFrameRef.current) clearTimeout(debouncedUpdateFrameRef.current);
              debouncedUpdateFrameRef.current = setTimeout(() => {
                debouncedUpdateFrameRef.current = null;
                updateDoc(sessionRef, {
                  mobileFrame: { dataUrl, ts: Date.now() },
                  updatedAt: serverTimestamp(),
                }).catch(() => {});
              }, 100);
            }
          }
          const overlay = mobileOverlayRef.current;
          if (overlay && video.videoWidth && video.videoHeight) {
            if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
              overlay.width = video.videoWidth;
              overlay.height = video.videoHeight;
            }
            const octx = overlay.getContext('2d');
            if (octx) {
              if (pl?.length) drawPoseOnCanvas(octx, pl, overlay.width, overlay.height);
              else octx.clearRect(0, 0, overlay.width, overlay.height);
            }
          }
          if (pl?.length && now - lastPoseWrite.current > 120) {
            lastPoseWrite.current = now;
            const compact = pl.map((p) => ({
              x: p.x,
              y: p.y,
              z: p.z ?? 0,
              v: p.visibility ?? 1,
            }));
            let leftElbowDeg = null;
            let rightElbowDeg = null;
            if (pl[11] && pl[13] && pl[15]) {
              leftElbowDeg = angleDeg(pl[11].x, pl[11].y, pl[13].x, pl[13].y, pl[15].x, pl[15].y);
            }
            if (pl[12] && pl[14] && pl[16]) {
              rightElbowDeg = angleDeg(pl[12].x, pl[12].y, pl[14].x, pl[14].y, pl[16].x, pl[16].y);
            }
            const lw = pl[15];
            const rw = pl[16];
            if (lw) {
              const h = wristHist.current;
              h.push({ x: lw.x, y: lw.y, t: now });
              while (h.length && now - h[0].t > 2000) h.shift();
            }
            if (rw) {
              const h = rightWristHist.current;
              h.push({ x: rw.x, y: rw.y, t: now });
              while (h.length && now - h[0].t > 2000) h.shift();
            }
            let danceActivity = 0;
            const hl = wristHist.current;
            const hr = rightWristHist.current;
            const activityFromHist = (h) => {
              if (h.length < 4) return 0;
              let sum = 0;
              for (let i = 1; i < h.length; i += 1) {
                sum += Math.hypot(h[i].x - h[i - 1].x, h[i].y - h[i - 1].y);
              }
              return Math.min(100, Math.round(sum * 4500));
            };
            danceActivity = Math.round((activityFromHist(hl) + activityFromHist(hr)) / 2);

            const leftAcc = toScoreFromAngle(leftElbowDeg);
            const rightAcc = toScoreFromAngle(rightElbowDeg);
            const armAccuracy = Math.round((leftAcc + rightAcc) / 2);
            const symmetry =
              leftElbowDeg != null && rightElbowDeg != null
                ? Math.max(0, 100 - Math.round(Math.abs(leftElbowDeg - rightElbowDeg)))
                : 0;
            const visTargets = [11, 12, 13, 14, 15, 16]
              .map((idx) => pl[idx]?.visibility ?? pl[idx]?.v ?? 0)
              .filter((v) => Number.isFinite(v));
            const poseConfidence = visTargets.length
              ? Math.round((visTargets.reduce((a, b) => a + b, 0) / visTargets.length) * 100)
              : 0;
            const totalScore = Math.round(
              danceActivity * 0.35 + armAccuracy * 0.35 + symmetry * 0.2 + poseConfidence * 0.1
            );
            const feedbackTips = buildDanceFeedback({
              danceActivity,
              armAccuracy,
              symmetry,
              poseConfidence,
            });
            setDanceRealtime({
              leftElbowDeg,
              rightElbowDeg,
              danceActivity,
              armAccuracy,
              symmetry,
              poseConfidence,
              totalScore,
              feedbackTips,
            });
            updateDoc(sessionRef, {
              metrics: {
                leftElbowDeg,
                rightElbowDeg,
                danceActivity,
                armAccuracy,
                symmetry,
                poseConfidence,
                totalScore,
                feedbackTips,
              },
              updatedAt: serverTimestamp(),
            }).catch((e) => console.error(e));
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        if (poseUploadIntervalRef.current) clearInterval(poseUploadIntervalRef.current);
        poseUploadIntervalRef.current = setInterval(() => {
          const poseDoc = buildOptimizedPoseDocForFirestore(latestBodyTrackingRef.current);
          if (!poseDoc) return;
          updateDoc(sessionRef, {
            pose: poseDoc,
            cameraActive: true,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          if (participantRef) {
            setDoc(
              participantRef,
              {
                pose: poseDoc,
                cameraOn: true,
                lastSeen: Date.now(),
                track: tab,
              },
              { merge: true }
            ).catch(() => {});
          }
        }, 250);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (debouncedUpdateFrameRef.current) {
        clearTimeout(debouncedUpdateFrameRef.current);
        debouncedUpdateFrameRef.current = null;
      }
      if (poseUploadIntervalRef.current) {
        clearInterval(poseUploadIntervalRef.current);
        poseUploadIntervalRef.current = null;
      }
      const v = videoRef.current;
      if (v?.srcObject) {
        v.srcObject.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
      const overlay = mobileOverlayRef.current;
      if (overlay) {
        const octx = overlay.getContext('2d');
        if (octx) octx.clearRect(0, 0, overlay.width, overlay.height);
      }
      setCamStream(null);
      setDanceRealtime(null);
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
      latestPoseLandmarksRef.current = null;
      latestBodyTrackingRef.current = null;
      lastAnalyzeAtRef.current = 0;
      wristHist.current = [];
      rightWristHist.current = [];
      updateDoc(sessionRef, {
        pose: deleteField(),
        mobileFrame: deleteField(),
        cameraActive: false,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      if (participantRef) {
        setDoc(
          participantRef,
          { pose: deleteField(), cameraOn: false, lastSeen: Date.now(), track: tab },
          { merge: true }
        ).catch(() => {});
      }
    };
  }, [camOn, tab, sessionRef, participantRef]);

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

  const sendDataFromMobile = async () => {
    try {
      await updateDoc(sessionRef, { status: 'analyzing', updatedAt: serverTimestamp() });
      setTimeout(async () => {
        const snap = await getDoc(sessionRef);
        const cur = snap.exists() ? snap.data() : {};
        const prev = cur?.metrics || {};
        await updateDoc(sessionRef, {
          status: 'completed',
          runCount: Number(cur?.runCount || 0) + 1,
          metrics: {
            skill: Math.min(98, Math.max(0, Number(prev.skill ?? 42) + 3)),
            metricA: Math.min(95, Math.max(0, Number(prev.metricA ?? 55) + 2)),
            metricB: Math.min(95, Math.max(0, Number(prev.metricB ?? 48) + 2)),
            metricC: Math.min(95, Math.max(0, Number(prev.metricC ?? 60) + 2)),
          },
          updatedAt: serverTimestamp(),
        });
        onComplete?.();
      }, 1500);
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
        {!!joinError && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-950/50 p-3 text-sm text-rose-200">{joinError}</div>
        )}
        {tab === 'dance' && (
          <div className="space-y-4">
            <div className="relative w-full max-w-md mx-auto">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full rounded-xl bg-black block scale-x-[-1]"
              />
              <canvas
                ref={mobileOverlayRef}
                className="absolute inset-0 w-full h-full rounded-xl pointer-events-none scale-x-[-1]"
              />
            </div>
            <button
              type="button"
              onClick={() => setCamOn((c) => !c)}
              className={`w-full py-3 rounded-xl font-semibold ${camOn ? 'bg-rose-600' : 'bg-sky-600'}`}
            >
              {camOn ? '카메라 끄기' : '카메라 켜기 (포즈 + 미러링 전송)'}
            </button>
            <p className="text-xs text-slate-500">
              MediaPipe 포즈 + WebRTC 영상 전송 상태: <span className="font-mono">{webrtcStatus}</span>
              {webrtcError ? ` · 오류: ${webrtcError}` : ''}
            </p>
            {danceRealtime && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1 text-xs">
                <p>
                  실시간 점수: <span className="font-mono text-white">{danceRealtime.totalScore}</span>
                </p>
                <p className="text-slate-400">
                  좌/우 팔각도: {Math.round(danceRealtime.leftElbowDeg ?? 0)}° / {Math.round(danceRealtime.rightElbowDeg ?? 0)}°
                </p>
                <p className="text-slate-400">
                  활동 {danceRealtime.danceActivity} · 정확도 {danceRealtime.armAccuracy} · 대칭 {danceRealtime.symmetry}
                </p>
                <p className="text-slate-300">{danceRealtime.feedbackTips?.[0]}</p>
              </div>
            )}
            <button type="button" onClick={sendDataFromMobile} className="w-full py-3 rounded-xl bg-emerald-600 font-semibold">
              참여 완료 & 분석 전송
            </button>
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

function TrainingResults({ db, appId, sessionId, onBack }) {
  const [sessionData, setSessionData] = useState(null);
  const [participants, setParticipants] = useState([]);
  useEffect(() => {
    const ref = doc(db, 'artifacts', appId, 'public', 'data', SESSIONS, sessionId);
    const unsub = onSnapshot(ref, (snap) => setSessionData(snap.exists() ? snap.data() : null));
    return () => unsub();
  }, [db, appId, sessionId]);
  useEffect(() => {
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', SESSIONS, sessionId, 'participants');
    const unsub = onSnapshot(colRef, (snap) => setParticipants(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [db, appId, sessionId]);

  const metrics = sessionData?.metrics || {};
  const list = [Number(metrics.skill || 0), Number(metrics.metricA || 0), Number(metrics.metricB || 0), Number(metrics.metricC || 0)];
  const total = list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0;
  const weakestIdx = list.reduce((m, v, i, arr) => (v < arr[m] ? i : m), 0);
  const weakestKey = ['skill', 'metricA', 'metricB', 'metricC'][weakestIdx] || 'skill';
  const stage = total >= 85 ? 'IDOL' : total >= 70 ? 'DEBUT' : 'TRAINEE';
  const teamSyncScore = computeTeamSyncScore(participants);
  const vocalScore = Number(sessionData?.pitch?.accuracy || 0);
  const tips = [
    `약점 보강: ${weakestKey} 지표를 우선 보완하세요.`,
    `보컬 피드백: ${sessionData?.pitch?.feedback || '보컬 데이터를 더 수집해 보세요.'}`,
    `팀 싱크 점수: ${teamSyncScore}점`,
    sessionData?.track === 'korean' ? '한국어 트랙은 발음 정확도와 리듬을 함께 점검하세요.' : '안무/보컬 균형 훈련을 유지하세요.',
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">훈련 결과 요약</h2>
          <button type="button" onClick={onBack} className="text-sm text-sky-400">
            ← 허브
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">종합 점수 <span className="font-mono text-white">{total}</span></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">성장 단계 <span className="font-mono text-white">{stage}</span></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">보컬 정확도 <span className="font-mono text-white">{vocalScore}</span></div>
        </div>
        <ul className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 list-disc pl-5 text-sm text-slate-300 space-y-1">
          {tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function TrainingApp({ db, auth, appId, onBack }) {
  const [user, setUser] = useState(null);
  const [phase, setPhase] = useState('hub');
  const [sessionId, setSessionId] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [homeTrainingTab, setHomeTrainingTab] = useState('dance');

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
    if (s) {
      setSessionId(s);
      setPhase('mobile');
    }
  }, []);

  const startLaptop = async () => {
    const id = Math.random().toString(36).substring(2, 7).toUpperCase();
    const ref = doc(db, 'artifacts', appId, 'public', 'data', SESSIONS, id);
    try {
      await setDoc(ref, {
        id,
        status: 'waiting',
        runCount: 0,
        track: homeTrainingTab,
        lastUpdate: Date.now(),
        vocalTargetMidi: 60,
        vocalTargetNote: 'C4',
        metrics: { skill: 42, metricA: 55, metricB: 48, metricC: 60 },
        createdAt: serverTimestamp(),
        ownerUid: user?.uid || null,
        pose: null,
        pitch: null,
        korean: null,
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
        selectedTrack={homeTrainingTab}
        onSelectTrack={setHomeTrainingTab}
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
    return (
      <TrainingMobile
        db={db}
        appId={appId}
        sessionId={sessionId}
        userId={user?.uid || ''}
        onBack={() => setPhase('hub')}
        onComplete={() => setPhase('results')}
      />
    );
  }

  if (phase === 'results') {
    return <TrainingResults db={db} appId={appId} sessionId={sessionId} onBack={() => setPhase('hub')} />;
  }

  return null;
}
