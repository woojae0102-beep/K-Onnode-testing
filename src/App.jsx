import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import {
  MessageSquare,
  Music,
  Mic,
  Send,
  Settings,
  BarChart3,
  Zap,
  RotateCcw,
  Smartphone,
  Monitor,
} from 'lucide-react';

const resolveFirebaseConfig = () => {
  // 수정됨 — 로컬(Vite .env) / Firebase 호스팅 전역(__firebase_config) 모두 지원
  const fromJson = import.meta.env.VITE_FIREBASE_CONFIG;
  if (fromJson && String(fromJson).trim()) {
    try {
      return JSON.parse(fromJson);
    } catch {
      return null;
    }
  }

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  if (apiKey && authDomain && projectId && storageBucket && messagingSenderId && appId) {
    return {
      apiKey: String(apiKey).trim(),
      authDomain: String(authDomain).trim(),
      projectId: String(projectId).trim(),
      storageBucket: String(storageBucket).trim(),
      messagingSenderId: String(messagingSenderId).trim(),
      appId: String(appId).trim(),
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
        ? String(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID).trim()
        : undefined,
    };
  }

  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    } catch {
      return null;
    }
  }
  return null;
};

const firebaseConfig = resolveFirebaseConfig();
if (!firebaseConfig) {
  throw new Error('Firebase 설정을 찾을 수 없습니다. .env 또는 __firebase_config를 확인하세요.');
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'onnode-integrated-v15';

export default function App() {
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState('hub');
  const [sessionId, setSessionId] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [trainingMode, setTrainingMode] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    void initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !sessionId) return undefined;

    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId);
    const unsubSession = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setSessionData(data);
      if (data.activeTraining) setTrainingMode(data.activeTraining);
    });

    const msgCol = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    const unsubMsgs = onSnapshot(msgCol, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).slice(-30));
    });

    return () => {
      unsubSession();
      unsubMsgs();
    };
  }, [user, sessionId]);

  const createSession = async () => {
    const newId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const initialData = {
      id: newId,
      status: 'waiting',
      activeTraining: null,
      theme: 'hybe-hall',
      metrics: { sync: 0, accuracy: 0, energy: 0 },
      lastUpdate: Date.now(),
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', newId), initialData);
    setSessionId(newId);
    setViewMode('app');
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !user) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
      text: newMessage,
      senderId: user.uid,
      senderName: `User_${user.uid.substring(0, 3)}`,
      timestamp: Date.now(),
      type: 'text',
    });
    setNewMessage('');
  };

  if (viewMode === 'hub') {
    return (
      <HubView
        onStartLaptop={createSession}
        onJoinMobile={(id) => {
          setSessionId((id || '').toUpperCase());
          setViewMode('mobile');
        }}
      />
    );
  }

  if (viewMode === 'mobile') {
    return (
      <MobileController
        sessionId={sessionId}
        sessionData={sessionData}
        db={db}
        onReset={() => setViewMode('hub')}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#0f172a] text-white font-sans overflow-hidden">
      <div className="w-20 bg-[#1e293b] flex flex-col items-center py-8 gap-10 border-r border-white/5">
        <div className="w-12 h-12 bg-[#FF1493] rounded-2xl flex items-center justify-center font-black italic shadow-lg shadow-pink-600/20">O</div>
        <div className="flex flex-col gap-8">
          <NavIcon icon={MessageSquare} active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
          <NavIcon icon={Music} active={activeTab === 'training'} onClick={() => setActiveTab('training')} />
          <NavIcon icon={BarChart3} active={activeTab === 'data'} onClick={() => setActiveTab('data')} />
        </div>
        <div className="mt-auto flex flex-col gap-4 items-center">
          <div className="text-[10px] font-bold text-pink-500 uppercase tracking-tighter">{sessionId}</div>
          <NavIcon icon={Settings} />
        </div>
      </div>

      <div className="flex-1 flex transition-all duration-700">
        <div className={`flex flex-col bg-slate-900 border-r border-white/5 transition-all duration-500 ${trainingMode ? 'w-[40%]' : 'w-full'}`}>
          <div className="h-20 px-8 flex items-center justify-between border-b border-white/5 bg-slate-900/50 backdrop-blur-xl">
            <h2 className="text-xl font-black tracking-tight uppercase">OnNode Global Lobby</h2>
            <div className="bg-pink-600/20 text-pink-500 px-3 py-1 rounded-lg text-[10px] font-bold border border-pink-500/20 uppercase">Cloud Linked</div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.senderId === user?.uid ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-tighter">{msg.senderName}</span>
                <div className={`max-w-[85%] px-5 py-3 rounded-3xl text-sm font-medium ${msg.senderId === user?.uid ? 'bg-[#FF1493] text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="p-6 bg-slate-900 border-t border-white/5 flex gap-4">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="flex-1 bg-slate-800/50 p-4 px-6 rounded-full border border-white/5 outline-none text-sm"
            />
            <button type="submit" className="w-14 h-14 bg-[#FF1493] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-lg shadow-pink-600/20">
              <Send size={20} />
            </button>
          </form>
        </div>

        {trainingMode && (
          <div className="flex-1 bg-[#020617] flex flex-col animate-in slide-in-from-right duration-700 overflow-hidden">
            <div className="p-10 flex-1 flex flex-col gap-8">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 text-pink-500 font-black text-xs tracking-widest uppercase mb-1">
                    <Zap size={16} fill="currentColor" />
                    <span>AI Spatial Practice Mode</span>
                  </div>
                  <h1 className="text-4xl font-black tracking-tighter uppercase font-['Poppins']">Training Room</h1>
                </div>
                <button
                  onClick={() => {
                    setTrainingMode(null);
                    void updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId), {
                      activeTraining: null,
                    });
                  }}
                  className="text-slate-500 hover:text-white"
                >
                  <RotateCcw size={24} />
                </button>
              </div>

              <div className="relative flex-1 rounded-[3.5rem] overflow-hidden neon-border bg-black">
                <SpatialSimulator theme={sessionData?.theme} isAnalyzing={sessionData?.status === 'analyzing'} />
                <div className="absolute top-8 left-8 flex gap-3">
                  <div className="glass px-4 py-2 rounded-xl flex items-center gap-2 border border-white/20">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_red]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Data Linked</span>
                  </div>
                  <div className="glass px-4 py-2 rounded-xl font-black text-[10px] text-pink-500 border border-pink-500/30 uppercase">ID: {sessionId}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <MetricCard label="동작 정확도" value={sessionData?.metrics?.sync || 0} color="#FF1493" />
                <MetricCard label="공간 일치율" value={sessionData?.metrics?.accuracy || 0} color="#9400D3" />
              </div>
            </div>
          </div>
        )}
      </div>

      {!trainingMode && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col gap-4 animate-in fade-in zoom-in duration-1000">
          <ToolBtn
            icon={Music}
            label="Dance"
            color="bg-pink-600"
            onClick={() =>
              updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId), {
                activeTraining: 'dance',
              })
            }
          />
          <ToolBtn
            icon={Mic}
            label="Vocal"
            color="bg-purple-600"
            onClick={() =>
              updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId), {
                activeTraining: 'vocal',
              })
            }
          />
        </div>
      )}
    </div>
  );
}

function SpatialSimulator({ theme, isAnalyzing }) {
  const canvasRef = useRef(null);
  const bgImageRef = useRef(new Image());
  const themes = {
    'hybe-hall': 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&q=80&w=1280',
    'sm-studio': 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=1280',
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
      if (!ctx) return;

      const time = Date.now() / 500;
      const moveX = Math.sin(time) * 40;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(bgImageRef.current, -20 - moveX * 0.4, -20, c.width + 40, c.height + 40);

      ctx.fillStyle = '#FF1493';
      const centerX = c.width / 2 + moveX;
      for (let i = 0; i < 60; i += 1) {
        const angle = (i / 60) * Math.PI * 2;
        const r = 180 + Math.sin(time + i) * 10;
        ctx.beginPath();
        ctx.arc(centerX + Math.cos(angle) * r * 0.7, 300 + Math.sin(angle) * r, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isAnalyzing) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.font = '900 30px Noto Sans KR';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('AI ANALYZING...', c.width / 2, c.height / 2);
      }
      frameId = requestAnimationFrame(draw);
    };

    bgImageRef.current.onload = () => {
      if (isMounted) draw();
    };

    return () => {
      isMounted = false;
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [theme, isAnalyzing]);

  return <canvas ref={canvasRef} width="1280" height="720" className="w-full h-full object-cover" />;
}

function MobileController({ sessionId, sessionData, db: firestoreDb, onReset }) {
  const videoRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => {});
  }, []);

  const updatePerformance = async () => {
    const sessionRef = doc(firestoreDb, 'artifacts', appId, 'public', 'data', 'sessions', sessionId);
    await updateDoc(sessionRef, { status: 'analyzing' });
    setTimeout(async () => {
      const r = () => Math.floor(Math.random() * 30) + 70;
      await updateDoc(sessionRef, { status: 'done', metrics: { sync: r(), accuracy: r(), energy: r() } });
    }, 2000);
  };

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-black animate-pulse text-pink-500 uppercase tracking-widest text-3xl">
        Handshaking...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col font-sans text-white overflow-hidden select-none">
      <div className="p-8 flex justify-between items-center border-b border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_red]" />
          <span className="text-sm font-black tracking-widest uppercase font-['Poppins']">LIVE: {sessionId}</span>
        </div>
        <button onClick={onReset} className="text-white/30">
          <RotateCcw size={24} />
        </button>
      </div>
      <div className="flex-1 relative bg-slate-950">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover opacity-60 scale-x-[-1]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-24 h-24 border-[8px] border-white/20 rounded-full flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-red-600 rounded-full animate-pulse" />
          </div>
          <p className="text-xs font-black text-white/60 uppercase tracking-[0.5em]">Camera Linked</p>
        </div>
      </div>
      <div className="bg-white rounded-t-[4rem] p-10 pb-16 space-y-10 shadow-[0_-30px_60px_rgba(0,0,0,0.5)] text-slate-900 text-center">
        <div className="flex gap-4">
          {['hybe-hall', 'sm-studio'].map((t) => (
            <button
              key={t}
              onClick={() =>
                updateDoc(doc(firestoreDb, 'artifacts', appId, 'public', 'data', 'sessions', sessionId), {
                  theme: t,
                })
              }
              className={`flex-1 py-6 rounded-3xl text-[10px] font-black uppercase transition-all ${sessionData.theme === t ? 'bg-black text-white shadow-xl' : 'bg-slate-100 text-slate-400'}`}
            >
              {t.replace('-', ' ')}
            </button>
          ))}
        </div>
        <button
          onClick={updatePerformance}
          disabled={sessionData.status === 'analyzing'}
          className="w-full bg-gradient-to-r from-pink-500 to-violet-600 text-white py-8 rounded-[3rem] font-[900] text-2xl shadow-2xl active:scale-95 transition-all disabled:opacity-50"
        >
          {sessionData.status === 'analyzing' ? '분석 중...' : '연습 완료 & 데이터 전송'}
        </button>
      </div>
    </div>
  );
}

function HubView({ onStartLaptop, onJoinMobile }) {
  const [inputCode, setInputCode] = useState('');
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
      <h1 className="text-7xl font-[900] italic mb-2 bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent tracking-tighter font-['Poppins']">ONNODE</h1>
      <p className="text-slate-400 uppercase tracking-[0.4em] text-xs font-black mb-16 italic">Integrated K-Culture Platform</p>
      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
        <button onClick={onStartLaptop} className="group bg-white/5 border-2 border-white/10 hover:border-pink-500 p-12 rounded-[3.5rem] transition-all text-center">
          <Monitor size={64} className="mx-auto mb-6 text-pink-500 group-hover:scale-110 transition-transform" />
          <h3 className="text-2xl font-black mb-2 tracking-tight uppercase">Laptop App</h3>
          <p className="text-slate-400 text-sm italic underline underline-offset-4">메인 메신저 & 분석 실행</p>
        </button>
        <div className="bg-white/5 border-2 border-white/10 p-12 rounded-[3.5rem] text-center">
          <Smartphone size={64} className="mx-auto mb-6 text-violet-500" />
          <h3 className="text-2xl font-black mb-6 tracking-tight uppercase font-['Poppins']">Mobile Controller</h3>
          <input
            type="text"
            placeholder="SESSION ID"
            className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-center text-2xl font-black focus:border-violet-500 outline-none uppercase mb-4 text-white font-['Poppins']"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
          />
          <button onClick={() => onJoinMobile(inputCode)} className="w-full bg-violet-600 hover:bg-violet-500 py-5 rounded-2xl font-black text-lg shadow-xl transition-all">연동 시작</button>
        </div>
      </div>
    </div>
  );
}

function NavIcon({ icon: Icon, active, onClick }) {
  return (
    <button onClick={onClick} className={`p-4 rounded-2xl transition-all ${active ? 'bg-[#FF1493] text-white shadow-lg shadow-pink-600/30 scale-110' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
      <Icon size={24} />
    </button>
  );
}

function ToolBtn({ icon: Icon, label, color, onClick }) {
  return (
    <button onClick={onClick} className={`${color} w-20 h-20 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-2xl hover:scale-110 transition-all border border-white/10`}>
      <Icon size={24} />
      <span className="text-[10px] font-black uppercase font-['Poppins']">{label}</span>
    </button>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-black tracking-tighter" style={{ color }}>{value}</span>
        <span className="text-sm font-bold text-slate-600 uppercase font-['Poppins']">%</span>
      </div>
      <div className="h-2 w-full bg-white/5 rounded-full mt-6 overflow-hidden">
        <div className="h-full transition-all duration-1200 ease-out" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
