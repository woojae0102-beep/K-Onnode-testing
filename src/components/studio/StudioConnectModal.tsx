// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  buildStudioTvLandingUrl,
  buildTVDisplayUrl,
  isValidStudioCode,
} from '../../utils/tvConnect';
import { db } from '../../firebase';
import '../../styles/studio-mode.css';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const STEPS_DANCE = [
  { n: '1', title: 'TV에서 주소 열기', desc: 'TV 브라우저에 onnode.ai/tv 입력 (또는 QR 스캔)' },
  { n: '2', title: '이 폰에서 카메라 켜기', desc: '「시작」 버튼 → 전신이 보이게 서기' },
  { n: '3', title: 'TV 큰 화면으로 연습', desc: 'TV 왼쪽=안무·코치 / 오른쪽=내 모습' },
];

const STEPS_VOCAL = [
  { n: '1', title: 'TV에서 주소 열기', desc: 'TV 브라우저에 onnode.ai/tv 입력 (또는 QR 스캔)' },
  { n: '2', title: '이 폰에서 마이크 켜기', desc: '「시작」 버튼 → 마이크 권한 허용' },
  { n: '3', title: 'TV 큰 화면으로 연습', desc: 'TV에서 음정·피드백을 크게 확인' },
];

export default function StudioConnectModal({
  open = false,
  onClose,
  mode = 'dance',
  sessionCode = '',
  displayUrl = '',
  studioEnabled = false,
  isConnected = false,
  webrtcStatus = 'idle',
  syncError = '',
  webrtcError = '',
  onStartStudio,
  onJoinStudio,
  onStopStudio,
}) {
  const [step, setStep] = useState('intro');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [showFullGuide, setShowFullGuide] = useState(false);
  const [copied, setCopied] = useState('');
  const [starting, setStarting] = useState(false);

  const steps = mode === 'vocal' ? STEPS_VOCAL : STEPS_DANCE;
  const tvLandingUrl = buildStudioTvLandingUrl();
  const qrUrl = displayUrl || (sessionCode ? buildTVDisplayUrl(sessionCode) : tvLandingUrl);
  const firebaseReady = !!db;

  useEffect(() => {
    if (!open) return;
    setStep('intro');
    setJoinCode('');
    setJoinError('');
    setCopied('');
    setShowFullGuide(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (studioEnabled && isConnected) setStep('connected');
    else if (studioEnabled) setStep('connect');
  }, [open, studioEnabled, isConnected]);

  const handleStart = async () => {
    if (!firebaseReady) return;
    setStarting(true);
    try {
      await onStartStudio?.();
      setStep('connect');
    } finally {
      setStarting(false);
    }
  };

  const handleCopy = async (label, text) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(label);
      window.setTimeout(() => setCopied(''), 2000);
    }
  };

  const handleJoin = async () => {
    if (!isValidStudioCode(joinCode)) {
      setJoinError('TV 화면에 보이는 6자리 숫자를 입력하세요.');
      return;
    }
    setStarting(true);
    const ok = await onJoinStudio?.(joinCode);
    setStarting(false);
    if (!ok) setJoinError('코드가 맞지 않습니다. TV 화면의 숫자를 다시 확인하세요.');
    else {
      setJoinError('');
      setStep('connect');
    }
  };

  if (!open) return null;

  return (
    <div className="studio-modal-backdrop" onClick={onClose} role="presentation">
      <div className="studio-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="TV 연결">
        <header className="studio-modal-header">
          <div>
            <span className="studio-modal-kicker">TV 연결</span>
            <h2>TV 연습실 연결하기</h2>
            <p>TV는 큰 화면 · 이 폰은 카메라</p>
          </div>
          <button type="button" className="studio-modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        {!firebaseReady ? (
          <div className="studio-modal-body studio-error-box">
            <p><strong>연결 준비가 필요합니다</strong></p>
            <p>Firebase 설정이 없어 TV 연결을 사용할 수 없습니다. 관리자에게 문의하거나 .env 설정을 확인하세요.</p>
          </div>
        ) : null}

        {firebaseReady && step === 'intro' ? (
          <div className="studio-modal-body">
            <div className="studio-simple-steps">
              {steps.map((s) => (
                <div key={s.n} className="studio-simple-step">
                  <span className="studio-simple-step-n">{s.n}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="studio-tip-box">
              💡 TV 없이도 이 폰·노트북만으로 연습할 수 있습니다. TV 연결은 선택 사항입니다.
            </p>
            <button type="button" className="studio-primary-btn studio-primary-btn-full" onClick={handleStart} disabled={starting}>
              {starting ? '준비 중...' : 'TV 연결 시작'}
            </button>
            <button type="button" className="studio-link-btn" onClick={() => setShowFullGuide((v) => !v)}>
              {showFullGuide ? '설명 접기' : '📖 TV 연결 설명서 보기'}
            </button>
            {showFullGuide ? <StudioInlineGuide mode={mode} tvLandingUrl={tvLandingUrl} /> : null}
          </div>
        ) : null}

        {firebaseReady && step === 'connect' ? (
          <div className="studio-modal-body studio-qr-step">
            <p className="studio-step-label">TV에서 아래 주소를 열어 주세요</p>

            <div className="studio-tv-url-box">
              <code>{tvLandingUrl}</code>
              <button type="button" className="studio-copy-btn" onClick={() => handleCopy('url', tvLandingUrl)}>
                {copied === 'url' ? '복사됨 ✓' : '주소 복사'}
              </button>
            </div>

            <p className="studio-code-hint">또는 QR 코드를 TV에서 스캔하세요</p>
            <div className="studio-qr-wrap">
              <QRCodeSVG value={qrUrl} size={156} level="M" />
            </div>

            {sessionCode ? (
              <div className="studio-code-row-box">
                <span>연결 코드</span>
                <strong className="studio-code-display-inline">{sessionCode}</strong>
                <button type="button" className="studio-copy-btn" onClick={() => handleCopy('code', sessionCode)}>
                  {copied === 'code' ? '복사됨 ✓' : '코드 복사'}
                </button>
              </div>
            ) : null}

            <div className={`studio-conn-status studio-conn-${isConnected ? 'connected' : webrtcStatus}`}>
              {isConnected
                ? '✓ TV 연결 완료! 아래 「시작」으로 카메라를 켜 주세요.'
                : webrtcStatus === 'connecting'
                  ? 'TV와 연결 중... TV에서 주소를 열었는지 확인하세요.'
                  : `다음: TV에서 주소 연 뒤 → 이 폰에서 ${mode === 'dance' ? '카메라' : '마이크'} 켜기`}
            </div>

            {(syncError || webrtcError) ? (
              <p className="studio-join-error">{syncError || webrtcError}</p>
            ) : null}

            <details className="studio-tv-code-join">
              <summary>TV에 코드가 보이면 여기에 입력</summary>
              <div className="studio-join-row">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6자리 숫자"
                  maxLength={6}
                  className="studio-join-input"
                  inputMode="numeric"
                />
                <button type="button" className="studio-join-btn" onClick={handleJoin} disabled={starting}>
                  연결
                </button>
              </div>
              {joinError ? <p className="studio-join-error">{joinError}</p> : null}
            </details>

            <button type="button" className="studio-link-btn" onClick={() => setShowFullGuide((v) => !v)}>
              {showFullGuide ? '설명 접기' : '문제가 있나요? 설명서 보기'}
            </button>
            {showFullGuide ? <StudioInlineGuide mode={mode} tvLandingUrl={tvLandingUrl} /> : null}

            <button type="button" className="studio-stop-btn" onClick={onStopStudio}>
              연결 취소
            </button>
          </div>
        ) : null}

        {firebaseReady && step === 'connected' ? (
          <div className="studio-modal-body studio-connected-step">
            <div className="studio-connected-icon">📺✓</div>
            <h3>TV 연결 성공!</h3>
            <p>
              TV에서 {mode === 'dance' ? '안무와 내 모습' : '보컬 피드백'}을 크게 볼 수 있습니다.
              <br />
              이 폰에서는 <strong>{mode === 'dance' ? '카메라' : '마이크'}</strong>만 켜면 됩니다.
            </p>
            <button type="button" className="studio-primary-btn studio-primary-btn-full" onClick={onClose}>
              연습 시작
            </button>
            <button type="button" className="studio-stop-btn" onClick={onStopStudio}>
              TV 연결 해제
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StudioInlineGuide({ mode, tvLandingUrl }) {
  return (
    <div className="studio-inline-guide">
      <h4>빠른 연결 (3단계)</h4>
      <ol>
        <li>TV 리모컨 → <strong>인터넷(브라우저)</strong> 앱 실행 (삼성: Internet, LG: 웹브라우저)</li>
        <li>주소창에 <strong>{tvLandingUrl}</strong> 입력 후 접속</li>
        <li>이 폰에서 <strong>{mode === 'dance' ? '카메라 켜기' : '마이크 켜기'}</strong> → TV에 실시간 화면 표시</li>
      </ol>
      <h4>TV 화면에 뭐가 나오나요?</h4>
      <ul>
        <li><strong>왼쪽</strong>: AI 코치 + 연습 영상(유튜브 불러오기)</li>
        <li><strong>오른쪽</strong>: 내 {mode === 'dance' ? '카메라 모습' : '보컬 분석'}</li>
        <li><strong>아래</strong>: 실시간 코치 피드백</li>
      </ul>
      <h4>안 될 때</h4>
      <ul>
        <li>폰과 TV가 <strong>같은 Wi-Fi</strong>인지 확인</li>
        <li>TV 브라우저에서 주소를 <strong>정확히</strong> 입력했는지 확인</li>
        <li>이 폰에서 카메라/마이크 <strong>권한 허용</strong></li>
        <li>자세한 내용: 프로젝트 <code>docs/tv-connection-guide.md</code></li>
      </ul>
    </div>
  );
}
