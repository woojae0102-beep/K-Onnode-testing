import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import {
  Music,
  Mic,
  Languages,
  Send,
  Settings,
  Zap,
  RotateCcw,
  Smartphone,
  Monitor,
  User,
  Globe,
  Bell,
  X,
} from 'lucide-react';

function readFirebaseConfig() {
  const fromGlobal =
    typeof __firebase_config !== 'undefined'
      ? __firebase_config
      : typeof window !== 'undefined' && window.__firebase_config
        ? window.__firebase_config
        : null;
  const fromEnv = import.meta.env.VITE_FIREBASE_CONFIG || null;
  const raw = fromGlobal || fromEnv;
  if (raw) {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      const isPlaceholder = trimmed === '__firebase_config' || trimmed === 'undefined' || trimmed === 'null';
      if (!isPlaceholder && trimmed.startsWith('{')) {
        try {
          return JSON.parse(trimmed);
        } catch {
          // JSON 파싱 실패 시 개별 키 방식으로 폴백합니다.
        }
      }
    } else if (typeof raw === 'object') {
      return raw;
    }
  }

  const byKeys = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim(),
  };

  if (byKeys.apiKey && byKeys.authDomain && byKeys.projectId && byKeys.appId) {
    return byKeys;
  }
  return null;
}

let app = null;
let auth = null;
let db = null;
let firebaseInitError = '';

try {
  const firebaseConfig = readFirebaseConfig();
  if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
    throw new Error('Firebase 설정값이 비어 있습니다. (__firebase_config 또는 VITE_FIREBASE_CONFIG 필요)');
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  firebaseInitError = err instanceof Error ? err.message : 'Firebase 초기화에 실패했습니다.';
}

const appId =
  typeof __app_id !== 'undefined'
    ? __app_id
    : typeof window !== 'undefined' && window.__app_id
      ? window.__app_id
      : import.meta.env.VITE_APP_ID || 'onnode-desktop-v17';
const DEFAULT_KOREAN_SAMPLE = '안녕하세요 온노드입니다. 오늘도 정확한 발음과 리듬으로 연습해요.';
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash';

function hzToNoteName(hz) {
  if (!hz || hz <= 0) return '-';
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${name}${octave}`;
}

function analyzeKoreanText(reference, input) {
  const ref = (reference || '').trim();
  const user = (input || '').trim();
  if (!user) {
    return {
      accuracy: 0,
      charMatch: 0,
      lengthScore: 0,
      tips: ['입력된 문장이 없습니다. 문장을 읽고 작성해 주세요.'],
    };
  }
  const maxLen = Math.max(ref.length, 1);
  const minLen = Math.min(ref.length, user.length);
  let same = 0;
  for (let i = 0; i < minLen; i += 1) {
    if (ref[i] === user[i]) same += 1;
  }
  const charMatch = Math.round((same / maxLen) * 100);
  const lengthScore = Math.round((Math.min(user.length, ref.length) / maxLen) * 100);
  const accuracy = Math.round(charMatch * 0.7 + lengthScore * 0.3);
  const tips = [];
  if (charMatch < 65) tips.push('자음·모음과 띄어쓰기를 기준 문장과 맞춰 보세요.');
  if (lengthScore < 70) tips.push('문장이 짧습니다. 끝까지 또박또박 읽어 보세요.');
  if (accuracy >= 85) tips.push('아주 좋습니다. 속도를 조금 더 올려 보세요.');
  if (!tips.length) tips.push('좋은 흐름입니다. 억양과 리듬을 조금 더 살려보세요.');
  return { accuracy, charMatch, lengthScore, tips };
}

function mergeSessionData(base = {}, patch = {}) {
  return {
    ...base,
    ...patch,
    metrics: { ...(base.metrics || {}), ...(patch.metrics || {}) },
    vocal: { ...(base.vocal || {}), ...(patch.vocal || {}) },
    korean: { ...(base.korean || {}), ...(patch.korean || {}) },
  };
}

function buildAiCoachReply(input, sessionData) {
  const text = input.toLowerCase();
  const track = sessionData?.activeTraining;
  const metrics = sessionData?.metrics || {};
  const vocal = sessionData?.vocal || {};
  const korean = sessionData?.korean || {};

  if (text.includes('댄스') || track === 'dance') {
    return `댄스 코칭입니다. 현재 모션 정확도 ${metrics.sync ?? 0}점, 공간 싱크 ${metrics.accuracy ?? 0}점입니다. 팔 동작을 조금 더 크게 쓰고, 박자 시작점을 반 박자 빠르게 잡아보세요.`;
  }
  if (text.includes('보컬') || text.includes('음정') || track === 'vocal') {
    return `보컬 코칭입니다. 현재 음정 ${vocal.note || '-'} (${vocal.hz ? `${Number(vocal.hz).toFixed(1)}Hz` : '미측정'})이고 정확도는 ${vocal.accuracy ?? 0}%입니다. 호흡을 짧게 끊지 말고 2마디 이상 롱톤으로 유지해 보세요.`;
  }
  if (text.includes('한국어') || text.includes('발음') || track === 'korean') {
    return `한국어 코칭입니다. 현재 정확도 ${korean.accuracy ?? 0}%, 문자 일치 ${korean.charMatch ?? 0}%입니다. 받침과 띄어쓰기를 또렷하게 읽고, 문장 끝 억양을 살짝 내려 마무리해 보세요.`;
  }
  return '원하는 트랙(댄스/보컬/한국어)을 말해주시면 지금 세션 데이터 기준으로 바로 코칭해드릴게요.';
}

async function buildGeminiCoachReply({ input, sessionData, history }) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API 키가 없습니다. .env에 VITE_GEMINI_API_KEY를 추가해 주세요.');
  }
  const metrics = sessionData?.metrics || {};
  const vocal = sessionData?.vocal || {};
  const korean = sessionData?.korean || {};
  const context = {
    activeTraining: sessionData?.activeTraining || 'none',
    status: sessionData?.status || 'idle',
    dance: {
      sync: metrics.sync ?? 0,
      accuracy: metrics.accuracy ?? 0,
      energy: metrics.energy ?? 0,
    },
    vocal: {
      hz: vocal.hz ?? 0,
      note: vocal.note || '-',
      accuracy: vocal.accuracy ?? 0,
      feedback: vocal.feedback || '',
    },
    korean: {
      accuracy: korean.accuracy ?? 0,
      charMatch: korean.charMatch ?? 0,
      lengthScore: korean.lengthScore ?? 0,
      firstTip: korean?.tips?.[0] || '',
    },
  };
  const recentHistory = history.slice(-6).map((m) => `${m.role === 'assistant' ? 'AI' : 'USER'}: ${m.text}`).join('\n');
  const prompt = [
    '당신은 ONNODE의 단일 AI 코치입니다.',
    '역할: K-POP 트레이닝 코치(댄스/보컬/한국어).',
    '규칙: 한국어로 짧고 명확하게 답변하고, 가능하면 2~4개의 실행 가능한 코칭 팁을 제시하세요.',
    '톤: 전문적이고 친절한 코치 톤.',
    `실시간 세션 데이터(JSON): ${JSON.stringify(context)}`,
    recentHistory ? `최근 대화:\n${recentHistory}` : '',
    `사용자 질문: ${input}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 400,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const reason = data?.error?.message || `Gemini API 호출 실패 (${res.status})`;
    throw new Error(reason);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('').trim();
  if (!text) throw new Error('Gemini 응답 텍스트가 비어 있습니다.');
  return text;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState('hub');
  const [sessionId, setSessionId] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [activeMenu, setActiveMenu] = useState('ai');
  const [sessionDraft, setSessionDraft] = useState({});
  const [aiMessages, setAiMessages] = useState([
    {
      id: `ai-welcome-${Date.now()}`,
      role: 'assistant',
      text: '안녕하세요. ONNODE AI 코치입니다. 댄스/보컬/한국어 중 원하는 트랙을 선택하면 맞춤 가이드를 드릴게요.',
      timestamp: Date.now(),
    },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const mergedSessionData = mergeSessionData(sessionData || {}, sessionDraft || {});

  if (firebaseInitError) {
    return <FirebaseSetupError message={firebaseInitError} />;
  }

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth Fail', err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      const params = new URLSearchParams(window.location.search);
      const sId = params.get('session');
      if (sId) {
        setSessionId(sId.toUpperCase());
        if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) setViewMode('mobile');
        else setViewMode('desktop');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db) return;
    if (!user || !sessionId) return;

    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId);
    const unsubSession = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        setSessionData(snap.data());
        setSessionDraft({});
      }
    });
    return () => {
      unsubSession();
    };
  }, [user, sessionId]);

  const createSession = async () => {
    if (!db || !user) return;
    const newId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const initialSession = {
      id: newId,
      status: 'waiting',
      activeTraining: null,
      theme: 'hybe-hall',
      metrics: { sync: 0, accuracy: 0, energy: 0 },
      vocal: { hz: 0, note: '-', accuracy: 0, feedback: '모바일에서 보컬 측정을 시작하세요.' },
      korean: { sample: DEFAULT_KOREAN_SAMPLE, input: '', accuracy: 0, charMatch: 0, lengthScore: 0, tips: [] },
      createdAt: Date.now(),
      creator: user.uid,
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', newId), initialSession);
    setSessionData(initialSession);
    setSessionDraft({});
    setSessionId(newId);
    setViewMode('desktop');
  };

  const applySessionPatch = async (patch) => {
    setSessionDraft((prev) => mergeSessionData(prev, patch));
    if (!db || !sessionId) return;
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId);
      await updateDoc(sessionRef, { ...patch, lastUpdate: Date.now() });
    } catch (err) {
      console.error('Session patch update failed', err);
    }
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    const content = newMessage.trim();
    if (!content || aiLoading) return;
    const userMsg = { id: `user-${Date.now()}`, role: 'user', text: content, timestamp: Date.now() };
    const historyForPrompt = [...aiMessages, userMsg];
    setAiMessages(historyForPrompt);
    setNewMessage('');
    setAiLoading(true);
    try {
      const reply = await buildGeminiCoachReply({
        input: content,
        sessionData: mergedSessionData,
        history: historyForPrompt,
      });
      setAiMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: reply,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      const fallback = buildAiCoachReply(content, mergedSessionData);
      const reason = err instanceof Error ? err.message : 'Gemini 호출 실패';
      setAiMessages((prev) => [
        ...prev,
        {
          id: `ai-fallback-${Date.now()}`,
          role: 'assistant',
          text: `${fallback}\n\n(참고: Gemini 연결 오류 - ${reason})`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const runModule = async (mode) => {
    setActiveMenu(mode || 'ai');
    await applySessionPatch({ activeTraining: mode || null });
  };

  if (viewMode === 'hub') {
    return (
      <HubView
        onStart={createSession}
        onJoin={(id) => {
          if (!id.trim()) return;
          setSessionId(id.toUpperCase());
          setViewMode(/Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop');
        }}
      />
    );
  }

  if (viewMode === 'mobile') {
    return <MobileController sessionId={sessionId} sessionData={mergedSessionData} db={db} onReset={() => setViewMode('hub')} />;
  }

  return (
    <div className="flex h-screen bg-[#f3f4f6] text-slate-900 font-sans overflow-hidden border-t-4 border-[#FF1493]">
      <div className="w-[72px] bg-[#ebebed] flex flex-col items-center py-6 gap-6 border-r border-slate-200 shrink-0">
        <div className="w-10 h-10 bg-[#FF1493] rounded-xl flex items-center justify-center font-black italic shadow-lg text-white mb-2 cursor-pointer hover:rotate-12 transition">
          O
        </div>
        <GNBIcon icon={User} active={activeMenu === 'profile'} onClick={() => setActiveMenu('profile')} />
        <GNBIcon icon={Globe} active={activeMenu === 'ai'} onClick={() => setActiveMenu('ai')} dot />
        <GNBIcon icon={Globe} active={activeMenu === 'explore'} onClick={() => setActiveMenu('explore')} />
        <div className="h-px w-8 bg-slate-300 mx-auto" />
        <GNBIcon icon={Music} active={activeMenu === 'dance'} onClick={() => runModule('dance')} />
        <GNBIcon icon={Mic} active={activeMenu === 'vocal'} onClick={() => runModule('vocal')} />
        <GNBIcon icon={Languages} active={activeMenu === 'korean'} onClick={() => runModule('korean')} />
        <div className="mt-auto flex flex-col gap-6">
          <GNBIcon icon={Bell} />
          <GNBIcon icon={Settings} onClick={() => setActiveMenu('settings')} />
        </div>
      </div>

      <div className="flex-1 flex bg-white relative transition-all duration-500">
        <div className={`flex flex-col h-full border-r border-slate-100 transition-all duration-500 ${mergedSessionData?.activeTraining ? 'w-[45%]' : 'flex-1'}`}>
          <div className="h-16 px-8 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <span className="font-bold">ONNODE AI COACH</span>
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase font-black tracking-tighter">ID: {sessionId}</span>
            </div>
            <p className="text-xs text-slate-500 font-semibold">단일 AI 코치 모드</p>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#f9fafb] scrollbar-hide">
            {aiMessages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-10 h-10 bg-slate-200 rounded-2xl flex-shrink-0 shadow-sm overflow-hidden border border-white">
                  <User size={20} className="m-2.5 text-slate-400" />
                </div>
                <div className={`max-w-[75%] space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] font-bold text-slate-600 uppercase">{msg.role === 'user' ? 'YOU' : 'ONNODE AI'}</span>
                    <span className="text-[9px] text-slate-400">
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div
                    className={`px-5 py-3 rounded-[1.2rem] text-sm font-medium shadow-sm transition-all ${
                      msg.role === 'user' ? 'bg-[#FF1493] text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-2xl flex-shrink-0 shadow-sm overflow-hidden border border-white">
                  <User size={20} className="m-2.5 text-slate-400" />
                </div>
                <div className="max-w-[75%]">
                  <div className="px-5 py-3 rounded-[1.2rem] text-sm font-medium bg-white text-slate-500 rounded-tl-none border border-slate-100">
                    Gemini 코치가 답변을 생성 중입니다...
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={sendMessage} className="p-6 bg-white border-t border-slate-100">
            <div className="bg-slate-50 p-2 pl-6 rounded-2xl border border-slate-200 flex items-center gap-3 focus-within:border-pink-500/30 transition-all shadow-inner">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="AI 코치에게 질문하기..."
                className="flex-1 bg-transparent outline-none text-sm font-medium py-2 px-1"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="w-10 h-10 bg-[#FF1493] rounded-xl flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>

        <div
          className={`bg-[#020617] h-full transition-all duration-700 ease-in-out relative flex flex-col ${
            mergedSessionData?.activeTraining ? 'flex-1 translate-x-0' : 'w-0 translate-x-full absolute right-0'
          }`}
        >
          {mergedSessionData?.activeTraining && (
            <div className="h-full flex flex-col p-10 animate-in fade-in slide-in-from-right duration-700">
              <div className="flex justify-between items-start mb-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-pink-500 font-black text-xs tracking-widest uppercase mb-1">
                    <Zap size={16} fill="currentColor" /> <span>ONNODE IN-APP ACADEMY</span>
                  </div>
                  <h2 className="text-5xl font-black uppercase tracking-tighter font-['Poppins'] text-white">{mergedSessionData.activeTraining} CLASS</h2>
                </div>
                <button
                  type="button"
                  onClick={() => runModule(null)}
                  className="p-4 bg-white/5 rounded-3xl hover:bg-white/10 transition border border-white/5 text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 relative rounded-[4rem] overflow-hidden neon-border bg-black shadow-2xl border-4 border-white/5 group">
                <SpatialSimulator theme={mergedSessionData?.theme} isAnalyzing={mergedSessionData?.status === 'analyzing'} status={mergedSessionData?.status} />
                <div className="absolute top-10 left-10 flex gap-3">
                  <div className="glass px-6 py-3 rounded-2xl flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_red]" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-white">Live AI Rendering</span>
                  </div>
                </div>
                <DesktopModuleControls sessionData={mergedSessionData} onApplyPatch={applySessionPatch} />
                <AcademyInsightCard sessionData={mergedSessionData} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FirebaseSetupError({ message }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full rounded-3xl border border-rose-400/40 bg-rose-950/30 p-8 space-y-5">
        <h1 className="text-2xl font-black">Firebase 설정 오류</h1>
        <p className="text-rose-100 break-words">{message}</p>
        <div className="text-sm text-slate-200 space-y-2">
          <p>아래 둘 중 하나를 설정해 주세요.</p>
          <p>1) 전역 변수: <code>window.__firebase_config</code> (JSON 문자열)</p>
          <p>2) 환경변수: <code>VITE_FIREBASE_CONFIG</code> (JSON 문자열)</p>
          <p>그리고 Firestore/익명 인증을 활성화해야 합니다.</p>
        </div>
      </div>
    </div>
  );
}

function GNBIcon({ icon: Icon, active, onClick, dot }) {
  return (
    <div className="relative group cursor-pointer flex justify-center w-full" onClick={onClick}>
      <div className={`p-4 rounded-2xl transition-all duration-300 ${active ? 'bg-white text-[#FF1493] shadow-md' : 'text-slate-400 hover:text-slate-900'}`}>
        <Icon size={26} />
      </div>
      {dot && !active && <div className="absolute top-3 right-4 w-2 h-2 bg-[#FF1493] rounded-full border-2 border-[#ebebed]" />}
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#FF1493] rounded-r-full" />}
    </div>
  );
}

function MiniBar({ label, value, color }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{label}</span>
        <span className="text-sm font-black text-white">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden shadow-inner">
        <div className={`h-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SpatialSimulator({ theme, isAnalyzing, status }) {
  const canvasRef = useRef(null);
  const bgImageRef = useRef(new Image());
  const themes = {
    'hybe-hall': 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&q=80&w=1280',
    'sm-studio': 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=1280',
    korean: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1280',
  };

  useEffect(() => {
    let isMounted = true;
    let frameId;
    bgImageRef.current.crossOrigin = 'anonymous';
    bgImageRef.current.src = themes[theme] || themes['hybe-hall'];

    const draw = () => {
      if (!isMounted || !canvasRef.current) return;
      const c = canvasRef.current;
      const ctx = c.getContext('2d');
      const time = Date.now() / 600;
      const moveX = Math.sin(time) * 35;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(bgImageRef.current, -30 - moveX * 0.4, -30, c.width + 60, c.height + 60);

      ctx.fillStyle = '#FF1493';
      const centerX = c.width / 2 + moveX;
      for (let i = 0; i < 60; i += 1) {
        const angle = (i / 60) * Math.PI * 2;
        const r = 220 + Math.sin(time + i) * 10;
        ctx.beginPath();
        ctx.arc(centerX + Math.cos(angle) * r * 0.7, 350 + Math.sin(angle) * r, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (status === 'done') {
        ctx.textAlign = 'center';
        ctx.font = '900 130px Poppins';
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 40;
        ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';
        ctx.fillText('PERFECT', c.width / 2, 350);
        ctx.shadowBlur = 0;
      }

      if (isAnalyzing) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.font = '900 40px Noto Sans KR';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('AI DATA PROCESSING...', c.width / 2, c.height / 2);
      }
      frameId = requestAnimationFrame(draw);
    };

    bgImageRef.current.onload = () => {
      if (isMounted) draw();
    };
    return () => {
      isMounted = false;
      cancelAnimationFrame(frameId);
    };
  }, [theme, isAnalyzing, status]);

  return <canvas ref={canvasRef} width="1280" height="720" className="w-full h-full object-cover" />;
}

function DesktopModuleControls({ sessionData, onApplyPatch }) {
  const mode = sessionData?.activeTraining;
  const [vocalTargetHz, setVocalTargetHz] = useState(440);
  const [koreanInput, setKoreanInput] = useState('');

  if (!mode) return null;

  if (mode === 'dance') {
    return (
      <div className="absolute top-10 right-10 w-[360px] glass rounded-[2rem] p-6 border border-white/10 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-widest text-pink-400 mb-4">Desktop Dance Action</p>
        <button
          type="button"
          onClick={async () => {
            await onApplyPatch({ status: 'analyzing', activeTraining: 'dance' });
            setTimeout(() => {
              const r = () => Math.floor(Math.random() * 20) + 80;
              onApplyPatch({
                status: 'done',
                metrics: { sync: r(), accuracy: r(), energy: r() },
              });
            }, 1300);
          }}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-black tracking-wide"
        >
          데스크톱 댄스 분석 실행
        </button>
      </div>
    );
  }

  if (mode === 'vocal') {
    return (
      <div className="absolute top-10 right-10 w-[360px] glass rounded-[2rem] p-6 border border-white/10 shadow-2xl space-y-4">
        <p className="text-xs font-black uppercase tracking-widest text-pink-400">Desktop Vocal Action</p>
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-[11px] uppercase tracking-widest text-slate-300 mb-2">Target Pitch</p>
          <input type="range" min="120" max="520" value={vocalTargetHz} onChange={(e) => setVocalTargetHz(Number(e.target.value))} className="w-full" />
          <p className="text-sm font-black text-white mt-2">{vocalTargetHz} Hz</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const actualHz = Math.max(100, vocalTargetHz + Math.floor((Math.random() - 0.5) * 60));
            const accuracy = Math.max(0, 100 - Math.min(100, Math.round(Math.abs(actualHz - vocalTargetHz) * 1.6)));
            onApplyPatch({
              status: 'done',
              activeTraining: 'vocal',
              vocal: {
                targetHz: vocalTargetHz,
                hz: actualHz,
                note: hzToNoteName(actualHz),
                accuracy,
                feedback: accuracy >= 85 ? '정확합니다! 음정이 매우 안정적입니다.' : '목표 음정에 조금 더 맞춰보세요.',
              },
            });
          }}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-indigo-600 text-white font-black tracking-wide"
        >
          데스크톱 보컬 측정 전송
        </button>
      </div>
    );
  }

  if (mode === 'korean') {
    return (
      <div className="absolute top-10 right-10 w-[420px] glass rounded-[2rem] p-6 border border-white/10 shadow-2xl space-y-4">
        <p className="text-xs font-black uppercase tracking-widest text-pink-400">Desktop Korean Action</p>
        <p className="text-xs text-slate-300 bg-white/10 rounded-xl p-3">{sessionData?.korean?.sample || DEFAULT_KOREAN_SAMPLE}</p>
        <textarea
          value={koreanInput}
          onChange={(e) => setKoreanInput(e.target.value)}
          placeholder="여기에 읽은 문장을 입력하세요."
          className="w-full min-h-[110px] rounded-2xl bg-white/10 border border-white/20 text-white px-4 py-3 outline-none"
        />
        <button
          type="button"
          onClick={() => {
            const sample = sessionData?.korean?.sample || DEFAULT_KOREAN_SAMPLE;
            const result = analyzeKoreanText(sample, koreanInput);
            onApplyPatch({
              status: 'done',
              activeTraining: 'korean',
              korean: { sample, input: koreanInput, ...result },
            });
          }}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black tracking-wide"
        >
          데스크톱 한국어 분석 전송
        </button>
      </div>
    );
  }

  return null;
}

function AcademyInsightCard({ sessionData }) {
  const mode = sessionData?.activeTraining;
  const metrics = sessionData?.metrics || {};
  const vocal = sessionData?.vocal || {};
  const korean = sessionData?.korean || {};

  if (mode === 'vocal') {
    return (
      <div className="absolute bottom-10 left-10 p-8 glass border-pink-500/20 rounded-[3rem] w-[380px] shadow-2xl backdrop-blur-3xl">
        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-4">Vocal Analytics</p>
        <p className="text-4xl font-black text-white">{vocal.hz ? `${Number(vocal.hz).toFixed(1)} Hz` : '- Hz'}</p>
        <p className="text-sm text-slate-300 mt-1">
          {vocal.note || '-'} · 정확도 {vocal.accuracy ?? 0}%
        </p>
        <p className="text-xs text-slate-400 mt-3">{vocal.feedback || '모바일 보컬 탭에서 측정 버튼을 눌러주세요.'}</p>
      </div>
    );
  }

  if (mode === 'korean') {
    return (
      <div className="absolute bottom-10 left-10 p-8 glass border-pink-500/20 rounded-[3rem] w-[420px] shadow-2xl backdrop-blur-3xl">
        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-4">Korean Pronunciation</p>
        <div className="space-y-4">
          <MiniBar label="Accuracy" value={korean.accuracy || 0} color="bg-pink-500" />
          <MiniBar label="Character Match" value={korean.charMatch || 0} color="bg-violet-500" />
          <MiniBar label="Length Score" value={korean.lengthScore || 0} color="bg-sky-500" />
        </div>
        <p className="text-xs text-slate-400 mt-4">{korean.tips?.[0] || '모바일 한국어 탭에서 문장을 분석해 주세요.'}</p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-10 left-10 p-8 glass border-pink-500/20 rounded-[3rem] w-[340px] shadow-2xl backdrop-blur-3xl">
      <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-6">Real-time Analytics Engine</p>
      <div className="space-y-6">
        <MiniBar label="Motion Accuracy" value={metrics.sync || 0} color="bg-pink-500" />
        <MiniBar label="Spatial Sync" value={metrics.accuracy || 0} color="bg-violet-600" />
        <MiniBar label="Energy" value={metrics.energy || 0} color="bg-sky-500" />
      </div>
    </div>
  );
}

function MobileController({ sessionId, sessionData, db, onReset }) {
  const videoRef = useRef(null);
  const [tab, setTab] = useState('dance');
  const [vocalTargetHz, setVocalTargetHz] = useState(440);
  const [koreanInput, setKoreanInput] = useState('');

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (sessionData?.activeTraining) {
      setTab(sessionData.activeTraining);
    }
  }, [sessionData?.activeTraining]);

  const update = async (payload) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId), { ...payload, lastUpdate: Date.now() });
  };

  const selectTab = async (nextTab) => {
    setTab(nextTab);
    await update({ activeTraining: nextTab });
  };

  if (!sessionData) {
    return <div className="min-h-screen bg-black flex items-center justify-center font-black animate-pulse text-pink-500">Connecting...</div>;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col font-sans text-white overflow-hidden select-none">
      <div className="p-8 flex justify-between items-center bg-slate-900 border-b border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_red]" />
          <span className="text-sm font-black tracking-widest uppercase">LIVE ID: {sessionId}</span>
        </div>
        <button type="button" onClick={onReset} className="text-white/30 p-2 hover:bg-white/5 rounded-full">
          <RotateCcw size={24} />
        </button>
      </div>
      <div className="flex-1 relative bg-slate-950 flex flex-col items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover opacity-60 scale-x-[-1]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-10 text-center">
          <div className="w-20 h-20 border-[6px] border-white/20 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-pink-600/30">
            <div className="w-12 h-12 bg-red-600 rounded-full animate-pulse" />
          </div>
          <div className="bg-black/60 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <p className="text-[10px] font-bold text-pink-500 uppercase mb-2 tracking-widest leading-none">Active Academy Class</p>
            <p className="text-2xl font-black uppercase tracking-tight">{sessionData.activeTraining || 'Standby'}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-t-[4rem] p-10 pb-16 space-y-10 text-slate-900 text-center relative z-10 shadow-[0_-30px_60px_rgba(0,0,0,0.5)]">
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'dance', label: '댄스' },
            { id: 'vocal', label: '보컬' },
            { id: 'korean', label: '한국어' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              className={`py-4 rounded-2xl font-black text-xs tracking-widest uppercase transition ${
                tab === item.id ? 'bg-black text-white shadow-lg' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          {['hybe-hall', 'sm-studio', 'korean'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update({ theme: t })}
              className={`flex-1 py-6 rounded-3xl text-[10px] font-black uppercase transition-all shadow-md ${
                sessionData.theme === t ? 'bg-black text-white shadow-xl scale-105' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {t.replace('-', ' ')}
            </button>
          ))}
        </div>

        {tab === 'dance' && (
          <button
            type="button"
            onClick={async () => {
              await update({ status: 'analyzing', activeTraining: 'dance' });
              setTimeout(async () => {
                const r = () => Math.floor(Math.random() * 20) + 80;
                await update({ status: 'done', metrics: { sync: r(), accuracy: r(), energy: r() } });
              }, 1500);
            }}
            disabled={sessionData.status === 'analyzing'}
            className="w-full bg-gradient-to-r from-pink-500 to-violet-600 text-white py-8 rounded-[3rem] font-[900] text-3xl shadow-xl active:scale-95 transition-all disabled:opacity-30 uppercase tracking-tighter"
          >
            댄스 분석 전송
          </button>
        )}

        {tab === 'vocal' && (
          <div className="space-y-5">
            <div className="rounded-3xl bg-slate-100 p-5 text-left">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Target Pitch</p>
              <input type="range" min="120" max="520" value={vocalTargetHz} onChange={(e) => setVocalTargetHz(Number(e.target.value))} className="w-full" />
              <p className="mt-2 text-sm font-black text-slate-700">{vocalTargetHz} Hz</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const actualHz = Math.max(100, vocalTargetHz + Math.floor((Math.random() - 0.5) * 60));
                const accuracy = Math.max(0, 100 - Math.min(100, Math.round(Math.abs(actualHz - vocalTargetHz) * 1.6)));
                const feedback = accuracy >= 85 ? '정확합니다! 음정이 매우 안정적입니다.' : '목표 음정에 조금 더 맞춰보세요.';
                await update({
                  status: 'done',
                  activeTraining: 'vocal',
                  vocal: {
                    targetHz: vocalTargetHz,
                    hz: actualHz,
                    note: hzToNoteName(actualHz),
                    accuracy,
                    feedback,
                  },
                });
              }}
              className="w-full bg-gradient-to-r from-fuchsia-500 to-indigo-600 text-white py-6 rounded-[2rem] font-[900] text-2xl shadow-xl active:scale-95 transition-all uppercase tracking-tighter"
            >
              보컬 측정 전송
            </button>
          </div>
        )}

        {tab === 'korean' && (
          <div className="space-y-5">
            <div className="rounded-3xl bg-slate-100 p-5 text-left space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">샘플 문장</p>
              <p className="text-sm font-semibold text-slate-700">{sessionData?.korean?.sample || DEFAULT_KOREAN_SAMPLE}</p>
              <textarea
                value={koreanInput}
                onChange={(e) => setKoreanInput(e.target.value)}
                placeholder="읽은 문장을 입력하세요."
                className="w-full min-h-[110px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-pink-500"
              />
            </div>
            <button
              type="button"
              onClick={async () => {
                const sample = sessionData?.korean?.sample || DEFAULT_KOREAN_SAMPLE;
                const result = analyzeKoreanText(sample, koreanInput);
                await update({
                  status: 'done',
                  activeTraining: 'korean',
                  korean: { sample, input: koreanInput, ...result },
                });
              }}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-6 rounded-[2rem] font-[900] text-2xl shadow-xl active:scale-95 transition-all uppercase tracking-tighter"
            >
              한국어 분석 전송
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HubView({ onStart, onJoin }) {
  const [inputCode, setInputCode] = useState('');
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans overflow-hidden border-t-8 border-pink-600">
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-pink-600/10 blur-[150px] rounded-full animate-pulse -z-10" />
      <h1 className="text-[120px] font-[900] italic mb-2 bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent tracking-tighter font-['Poppins'] uppercase leading-none">
        ONNODE
      </h1>
      <p className="text-slate-500 uppercase tracking-[1em] text-xs font-black mb-24 italic">Next-Gen K-Culture Platform</p>

      <div className="grid md:grid-cols-2 gap-12 w-full max-w-6xl px-10">
        <button
          type="button"
          onClick={onStart}
          className="group bg-white/5 border-2 border-white/10 hover:border-pink-500 p-16 rounded-[4rem] transition-all text-center relative overflow-hidden shadow-2xl"
        >
          <Monitor size={80} className="mx-auto mb-10 text-pink-500 group-hover:scale-110 transition-transform" />
          <h3 className="text-4xl font-[900] mb-4 uppercase tracking-tighter italic">Desktop App</h3>
          <p className="text-slate-500 text-lg italic font-medium leading-relaxed underline underline-offset-8">통합 메신저 및 분석 리포트 실행</p>
        </button>
        <div className="bg-white/5 border-2 border-white/10 p-16 rounded-[4rem] text-center shadow-2xl">
          <Smartphone size={80} className="mx-auto mb-10 text-violet-500" />
          <input
            type="text"
            placeholder="SESSION ID"
            className="w-full bg-slate-900 border-2 border-slate-800 rounded-3xl px-6 py-6 text-center text-5xl font-black focus:border-violet-500 outline-none uppercase mb-8 text-white font-['Poppins'] tracking-widest shadow-inner"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
          />
          <button
            type="button"
            onClick={() => onJoin(inputCode)}
            className="w-full bg-violet-600 hover:bg-violet-500 py-8 rounded-3xl font-[900] text-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest"
          >
            Mobile Sync
          </button>
        </div>
      </div>
    </div>
  );
}
