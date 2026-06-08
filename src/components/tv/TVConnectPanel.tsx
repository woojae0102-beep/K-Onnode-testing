// @ts-nocheck
import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import '../../styles/tv-display.css';

export default function TVConnectPanel({
  sessionCode = '',
  displayUrl = '',
  tvEnabled = false,
  webrtcStatus = 'idle',
  isConnected = false,
  onStart,
  onStop,
  variant = 'dark',
  compact = false,
}) {
  const [showGuide, setShowGuide] = useState(false);
  const isLight = variant === 'light';

  if (!tvEnabled && compact) {
    return (
      <button type="button" className={`tv-connect-start-btn ${isLight ? 'tv-connect-light' : ''}`} onClick={onStart}>
        📺 TV 연결
      </button>
    );
  }

  return (
    <div className={`tv-connect-panel ${isLight ? 'tv-connect-panel-light' : ''} ${compact ? 'tv-connect-compact' : ''}`}>
      <div className="tv-connect-head">
        <span className="tv-connect-title">📺 TV 대화면 연결</span>
        {!tvEnabled ? (
          <button type="button" className="tv-connect-action" onClick={onStart}>
            연결 시작
          </button>
        ) : (
          <button type="button" className="tv-connect-action tv-connect-stop" onClick={onStop}>
            연결 해제
          </button>
        )}
      </div>

      {tvEnabled ? (
        <div className="tv-connect-body">
          <div className="tv-connect-code-row">
            <span className="tv-connect-label">연결 코드</span>
            <strong className="tv-connect-code">{sessionCode}</strong>
          </div>
          {displayUrl ? (
            <div className="tv-connect-qr-wrap">
              <QRCodeSVG value={displayUrl} size={compact ? 120 : 148} level="M" bgColor="#ffffff" fgColor="#111111" />
            </div>
          ) : null}
          <p className="tv-connect-url">{displayUrl}</p>
          <div className={`tv-connect-status tv-connect-status-${webrtcStatus}`}>
            {isConnected ? '✓ TV 연결됨 — 큰 화면에서 연습 영상이 표시됩니다' : `연결 대기 중 (${webrtcStatus})`}
          </div>
          <p className="tv-connect-hint">
            TV 브라우저에서 위 QR을 스캔하거나 코드 URL을 입력하세요. 이 기기에서는 카메라/마이크를 켠 뒤 연습하세요.
          </p>
        </div>
      ) : (
        <p className="tv-connect-idle">
          스마트폰·노트북은 컨트롤러, TV는 큰 화면 미러로 사용합니다. (WebRTC 실시간 전송)
        </p>
      )}

      <button type="button" className="tv-connect-guide-toggle" onClick={() => setShowGuide((v) => !v)}>
        {showGuide ? '사용 방법 닫기' : 'TV 연결 사용 방법 보기'}
      </button>

      {showGuide ? (
        <ol className="tv-connect-guide">
          <li>이 기기(폰/노트북)에서 <strong>「연결 시작」</strong>을 누릅니다.</li>
          <li>TV에서 Chrome / Safari 브라우저를 열고 QR 코드를 스캔하거나 URL을 입력합니다.</li>
          <li>TV 화면에 「연결 대기」가 보이면, 이 기기에서 <strong>카메라(댄스) 또는 마이크(보컬)</strong>를 켭니다.</li>
          <li>연결되면 TV 왼쪽에 레퍼런스 영상, 오른쪽에 <strong>내 모습(또는 보컬 시각화)</strong>이 큰 화면으로 나옵니다.</li>
          <li>
            <strong>HDMI</strong>: 노트북을 TV에 연결한 뒤 브라우저 전체화면(F11)으로 사용해도 됩니다.
          </li>
          <li>
            <strong>AirPlay / 스마트뷰</strong>: TV에 URL을 직접 열 수 없으면, TV로 화면 미러링 후 이 앱의 트레이닝 화면을
            띄워도 됩니다.
          </li>
        </ol>
      ) : null}
    </div>
  );
}
