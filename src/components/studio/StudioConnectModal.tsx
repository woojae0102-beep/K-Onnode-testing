// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useStudioDeviceScan } from '../../hooks/useStudioDeviceScan';
import { buildStudioTvLandingUrl, isValidStudioCode } from '../../utils/tvConnect';
import '../../styles/studio-mode.css';

export default function StudioConnectModal({
  open = false,
  onClose,
  sessionCode = '',
  displayUrl = '',
  studioEnabled = false,
  isConnected = false,
  webrtcStatus = 'idle',
  onStartStudio,
  onJoinStudio,
  onStopStudio,
}) {
  const scan = useStudioDeviceScan();
  const [step, setStep] = useState('scan');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep('scan');
    setJoinCode('');
    setJoinError('');
    scan.startScan();
  }, [open]);

  useEffect(() => {
    if (studioEnabled && isConnected) setStep('connected');
    else if (studioEnabled) setStep('qr');
  }, [studioEnabled, isConnected]);

  if (!open) return null;

  const handleDeviceConnect = async (device) => {
    scan.selectDevice(device);
    const casted = await scan.tryPresentationCast(displayUrl || buildStudioTvLandingUrl());
    if (!casted) {
      await onStartStudio?.();
      setStep('qr');
    }
  };

  const handleJoin = async () => {
    if (!isValidStudioCode(joinCode)) {
      setJoinError('6자리 숫자 코드를 입력하세요.');
      return;
    }
    const ok = await onJoinStudio?.(joinCode);
    if (!ok) setJoinError('코드 연결에 실패했습니다. TV 화면의 코드를 확인하세요.');
    else setJoinError('');
  };

  return (
    <div className="studio-modal-backdrop" onClick={onClose} role="presentation">
      <div className="studio-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ONNODE STUDIO MODE">
        <header className="studio-modal-header">
          <div>
            <span className="studio-modal-kicker">ONNODE STUDIO MODE</span>
            <h2>TV 연습실 연결</h2>
            <p>TV = 연습실 · Mobile = 카메라</p>
          </div>
          <button type="button" className="studio-modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        {step === 'scan' || step === 'devices' ? (
          <div className="studio-modal-body">
            {scan.phase === 'scanning' ? (
              <div className="studio-scanning">
                <div className="studio-scan-radar" />
                <p>주변 TV 검색 중...</p>
                <span>같은 Wi-Fi에 연결된 TV를 찾고 있습니다</span>
              </div>
            ) : (
              <>
                <p className="studio-step-label">① 연결 방법 선택 → ② 원클릭 연결</p>
                <div className="studio-device-grid">
                  {scan.devices.map((device) => (
                    <button
                      key={device.id}
                      type="button"
                      className={`studio-device-card studio-signal-${device.signal}`}
                      onClick={() => handleDeviceConnect(device)}
                    >
                      <span className="studio-device-icon">{device.icon}</span>
                      <strong>{device.label}</strong>
                      <span>{device.hint}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="studio-qr-fallback"
                  onClick={async () => {
                    await onStartStudio?.();
                    setStep('qr');
                  }}
                >
                  QR 코드로 연결 (가장 확실한 방법)
                </button>
              </>
            )}
          </div>
        ) : null}

        {step === 'qr' ? (
          <div className="studio-modal-body studio-qr-step">
            <p className="studio-step-label">② TV에서 브라우저 열기 → ③ 연결</p>
            <div className="studio-code-display">{sessionCode}</div>
            <p className="studio-code-hint">TV에서 <strong>onnode.ai/tv</strong> 또는 아래 QR 접속</p>
            {displayUrl ? (
              <div className="studio-qr-wrap">
                <QRCodeSVG value={displayUrl} size={160} level="M" />
              </div>
            ) : null}
            <p className="studio-url">{displayUrl}</p>
            <div className={`studio-conn-status studio-conn-${webrtcStatus}`}>
              {isConnected ? '✓ TV 연습실 연결됨' : `연결 대기 (${webrtcStatus}) — 카메라/마이크를 켜 주세요`}
            </div>

            <div className="studio-join-row">
              <span>TV에 코드가 보이면 입력:</span>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6자리 코드"
                maxLength={6}
                className="studio-join-input"
              />
              <button type="button" className="studio-join-btn" onClick={handleJoin}>
                연결
              </button>
            </div>
            {joinError ? <p className="studio-join-error">{joinError}</p> : null}

            <button type="button" className="studio-stop-btn" onClick={onStopStudio}>
              연결 취소
            </button>
          </div>
        ) : null}

        {step === 'connected' ? (
          <div className="studio-modal-body studio-connected-step">
            <div className="studio-connected-icon">📺✓</div>
            <h3>TV 연습실 연결 완료</h3>
            <p>이 기기는 카메라·컨트롤러, TV는 코치·피드백 화면입니다.</p>
            <button type="button" className="studio-primary-btn" onClick={onClose}>
              연습 시작
            </button>
            <button type="button" className="studio-stop-btn" onClick={onStopStudio}>
              연결 해제
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
