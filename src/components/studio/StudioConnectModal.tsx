// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  buildStudioTvLandingUrl,
  buildTVDisplayUrl,
  isValidStudioCode,
} from '../../utils/tvConnect';
import { db, firebaseInitError } from '../../firebase';
import '../../styles/studio-mode.css';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

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
  const [joinCode, setJoinCode] = useState('');
  const [localError, setLocalError] = useState('');
  const [showGuide, setShowGuide] = useState(true);
  const [copied, setCopied] = useState('');
  const [preparing, setPreparing] = useState(false);
  const startedRef = useRef(false);

  const firebaseReady = !!db;
  const tvLandingUrl = buildStudioTvLandingUrl();
  const tvDirectUrl = sessionCode ? buildTVDisplayUrl(sessionCode) : '';
  const qrUrl = tvDirectUrl || tvLandingUrl;
  const mediaLabel = mode === 'dance' ? '카메라' : '마이크';

  const runStartStudio = useCallback(async () => {
    if (!firebaseReady) {
      setLocalError('Firebase 설정이 없어 TV 연결을 사용할 수 없습니다.');
      return;
    }
    setPreparing(true);
    setLocalError('');
    try {
      const result = await onStartStudio?.();
      if (result && result.ok === false) {
        setLocalError(result.error || '연결 코드를 만들지 못했습니다.');
      }
    } catch (e) {
      setLocalError(e?.message || 'TV 연결 준비 중 오류가 발생했습니다.');
    } finally {
      setPreparing(false);
    }
  }, [firebaseReady, onStartStudio]);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return;
    }
    setJoinCode('');
    setLocalError('');
    setCopied('');
    setShowGuide(true);

    if (!startedRef.current && !studioEnabled) {
      startedRef.current = true;
      void runStartStudio();
    }
  }, [open, studioEnabled, runStartStudio]);

  const handleCopy = async (label, text) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(label);
      window.setTimeout(() => setCopied(''), 2000);
    }
  };

  const handleJoin = async () => {
    if (!isValidStudioCode(joinCode)) {
      setLocalError('TV 화면에 표시된 6자리 숫자를 입력하세요.');
      return;
    }
    setPreparing(true);
    setLocalError('');
    const result = await onJoinStudio?.(joinCode);
    setPreparing(false);
    if (!result?.ok) setLocalError(result?.error || '코드 연결에 실패했습니다.');
  };

  const handleOpenTvPreview = () => {
    if (!tvDirectUrl) return;
    window.open(tvDirectUrl, '_blank', 'noopener,noreferrer');
  };

  if (!open) return null;

  const statusMessage = isConnected
    ? `TV 연결 완료! 모달을 닫고 「시작」으로 ${mediaLabel}를 켜 주세요.`
    : preparing
      ? '연결 코드를 만드는 중...'
      : sessionCode
        ? `TV에서 아래 주소를 연 다음, 이 폰에서 ${mediaLabel}를 켜 주세요.`
        : '연결 준비 중...';

  return (
    <div className="studio-modal-backdrop" onClick={onClose} role="presentation">
      <div className="studio-modal studio-modal-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="TV 연결">
        <header className="studio-modal-header">
          <div>
            <span className="studio-modal-kicker">TV 연결</span>
            <h2>TV 연습실에 연결하기</h2>
            <p>TV = 큰 화면 · 이 폰 = {mediaLabel}</p>
          </div>
          <button type="button" className="studio-modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="studio-modal-body">
          {!firebaseReady ? (
            <div className="studio-error-box">
              <p><strong>TV 연결을 사용할 수 없습니다</strong></p>
              <p>{firebaseInitError || 'Firebase 설정(.env)이 필요합니다.'}</p>
            </div>
          ) : (
            <>
              <div className="studio-status-banner">{statusMessage}</div>

              <div className="studio-connect-grid">
                <section className="studio-connect-panel">
                  <h3>① TV에서 열 주소</h3>
                  <p className="studio-panel-desc">
                    TV 리모컨 → <strong>인터넷(브라우저)</strong> 앱 → 주소창에 아래 주소 입력
                  </p>
                  <div className="studio-tv-url-box">
                    <code>{tvDirectUrl || tvLandingUrl}</code>
                  </div>
                  <div className="studio-btn-row">
                    <button type="button" className="studio-copy-btn" onClick={() => handleCopy('url', tvDirectUrl || tvLandingUrl)}>
                      {copied === 'url' ? '복사됨 ✓' : '주소 복사'}
                    </button>
                    {tvDirectUrl ? (
                      <button type="button" className="studio-copy-btn" onClick={handleOpenTvPreview}>
                        TV 화면 미리보기
                      </button>
                    ) : null}
                  </div>

                  <h3 style={{ marginTop: 16 }}>② QR 코드 (TV에서 스캔)</h3>
                  <div className="studio-qr-wrap">
                    <QRCodeSVG value={qrUrl} size={148} level="M" />
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
                </section>

                <section className="studio-connect-panel">
                  <h3>③ 이 폰에서 할 일</h3>
                  <ol className="studio-action-list">
                    <li>TV에 주소가 열리면 TV 화면에 <strong>「연결 대기」</strong> 또는 연습실 화면이 보입니다.</li>
                    <li>이 모달을 닫고 트레이닝 화면에서 <strong>「시작」</strong> 또는 <strong>{mediaLabel} 켜기</strong>를 누릅니다.</li>
                    <li>권한 창이 뜨면 <strong>허용</strong>을 선택합니다.</li>
                    <li>상단에 <strong>STUDIO LIVE</strong>가 보이면 TV 오른쪽에 내 모습이 나타납니다.</li>
                  </ol>

                  <div className={`studio-conn-status studio-conn-${isConnected ? 'connected' : webrtcStatus}`}>
                    {isConnected ? '✓ TV와 연결됨' : `연결 상태: ${preparing ? '준비 중' : webrtcStatus || '대기'}`}
                  </div>

                  <details className="studio-tv-code-join">
                    <summary>TV에 다른 코드가 보이면 여기에 입력</summary>
                    <div className="studio-join-row">
                      <input
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6자리 숫자"
                        maxLength={6}
                        className="studio-join-input"
                        inputMode="numeric"
                      />
                      <button type="button" className="studio-join-btn" onClick={handleJoin} disabled={preparing}>
                        연결
                      </button>
                    </div>
                  </details>

                  {isConnected ? (
                    <button type="button" className="studio-primary-btn studio-primary-btn-full" onClick={onClose}>
                      연습 시작
                    </button>
                  ) : null}
                </section>
              </div>

              {(localError || syncError || webrtcError) ? (
                <div className="studio-error-box">
                  <strong>연결 문제</strong>
                  <p>{localError || syncError || webrtcError}</p>
                  <button type="button" className="studio-copy-btn" onClick={() => void runStartStudio()}>
                    다시 시도
                  </button>
                </div>
              ) : null}

              <button type="button" className="studio-link-btn" onClick={() => setShowGuide((v) => !v)}>
                {showGuide ? '상세 설명서 접기 ▲' : '상세 설명서 펼치기 ▼'}
              </button>
              {showGuide ? <StudioConnectGuide mode={mode} tvLandingUrl={tvLandingUrl} mediaLabel={mediaLabel} /> : null}

              <button type="button" className="studio-stop-btn" onClick={onStopStudio}>
                TV 연결 취소
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StudioConnectGuide({ mode, tvLandingUrl, mediaLabel }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.com';
  return (
    <div className="studio-inline-guide studio-guide-detailed">
      <h4>📺 TV 브라우저 여는 방법 (제조사별)</h4>
      <table className="studio-guide-table">
        <thead>
          <tr><th>TV</th><th>방법</th></tr>
        </thead>
        <tbody>
          <tr><td>삼성 Smart TV</td><td>리모컨 <strong>홈</strong> → <strong>Internet</strong> 앱 → 주소창 탭</td></tr>
          <tr><td>LG webOS</td><td>리모컨 <strong>홈</strong> → <strong>웹브라우저</strong> → 주소 입력</td></tr>
          <tr><td>Google TV / Chromecast</td><td>앱 목록 → <strong>Chrome</strong> → 주소 입력</td></tr>
          <tr><td>Apple TV</td><td><strong>Safari</strong> 앱 → 주소창</td></tr>
          <tr><td>노트북 + HDMI</td><td>노트북을 TV에 연결 → 브라우저에서 <code>{origin}/tv</code> → F11 전체화면</td></tr>
        </tbody>
      </table>

      <h4>🔗 접속 주소</h4>
      <ul>
        <li>TV 먼저 켜기: <code>{tvLandingUrl}</code> → TV에 코드 표시 → 이 폰에서 코드 입력</li>
        <li>폰 먼저 연결: 이 화면의 QR/주소로 TV 접속 → 코드가 자동으로 맞춰짐</li>
      </ul>

      <h4>🕺 댄스 연습 시 TV 화면</h4>
      <ul>
        <li><strong>왼쪽</strong>: AI 코치 + 유튜브 안무 영상 (폰에서 영상 불러오기)</li>
        <li><strong>오른쪽</strong>: 내 {mediaLabel} 실시간 화면 + 동작 스켈레톤</li>
        <li><strong>아래</strong>: 「오른팔을 더 올리세요」 같은 실시간 피드백</li>
      </ul>

      {mode === 'vocal' ? (
        <>
          <h4>🎤 보컬 연습 시 TV 화면</h4>
          <ul>
            <li><strong>왼쪽</strong>: AI 코치 + 연습 곡 영상</li>
            <li><strong>오른쪽</strong>: 음정·볼륨 시각화</li>
            <li><strong>아래</strong>: 음정 피드백 문구</li>
          </ul>
        </>
      ) : null}

      <h4>❓ 연결이 안 될 때 체크리스트</h4>
      <ol>
        <li>폰과 TV가 <strong>같은 Wi-Fi</strong>에 연결되어 있는지 확인</li>
        <li>TV 주소에 <code>https://</code>까지 포함해 정확히 입력했는지 확인</li>
        <li>이 폰에서 {mediaLabel} <strong>권한을 허용</strong>했는지 확인 (브라우저 설정 → 사이트 권한)</li>
        <li>모달을 닫은 뒤 <strong>{mediaLabel} 켜기</strong>를 눌렀는지 확인 (켜야 TV에 영상 전송)</li>
        <li>여전히 안 되면 위 <strong>「다시 시도」</strong> 버튼 클릭</li>
      </ol>

      <h4>💡 TV 없이 연습</h4>
      <p>TV 연결은 선택입니다. 이 모달을 닫고 그대로 연습하면 폰/노트북 한 화면에서 영상+{mediaLabel}로 연습할 수 있습니다.</p>
    </div>
  );
}
