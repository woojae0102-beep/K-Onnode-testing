// @ts-nocheck
import React from 'react';
import { isDevEnvironment } from '../utils/isDevEnvironment';
import { useGroupContentAdmin } from '../hooks/useGroupContentAdmin';
import { MemberAutoDetect } from '../components/group/MemberAutoDetect';
import { GROUP_DATA, GROUP_DATA as GROUP_OPTIONS } from '../data/groupPracticeData';

export default function GroupContentAdminView({ onNavigate }) {
  const {
    videoRef,
    phase,
    groupId,
    setGroupId,
    songId,
    setSongId,
    providerId,
    setProviderId,
    providers,
    songsForGroup,
    videoFile,
    setVideoFile,
    progress,
    step,
    error,
    analysisResult,
    creationResult,
    persistInfo,
    startExtraction,
    confirmMemberMapping,
    cancel,
    reset,
  } = useGroupContentAdmin();

  if (!isDevEnvironment()) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#fff' }}>
        <p>Group Content Admin은 개발 환경에서만 사용할 수 있습니다.</p>
        <button type="button" onClick={() => onNavigate?.('home')}>홈으로</button>
      </div>
    );
  }

  const referenceMemberId = GROUP_DATA[groupId]?.members?.[0]?.id || 'member_1';

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', color: '#fff', padding: 16 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 18, color: '#FF1F8E', margin: 0 }}>Group Content Admin</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              ADMIN — MoCap/추출 1회 · Member 분리 · Validation · Persistence
              <br />
              Group Mode 런타임과 분리됨 (사용자 선택 시 API 호출 없음)
            </p>
          </div>
          <button type="button" onClick={() => onNavigate?.('home')} style={btnStyle}>닫기</button>
        </div>

        {phase === 'setup' || phase === 'error' ? (
          <div style={panelStyle}>
            <Row label="그룹">
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={inputStyle}>
                {Object.keys(GROUP_OPTIONS).map((id) => (
                  <option key={id} value={id}>{GROUP_DATA[id]?.nameKr || id}</option>
                ))}
              </select>
            </Row>
            <Row label="곡">
              <select value={songId} onChange={(e) => setSongId(e.target.value)} style={inputStyle}>
                {songsForGroup.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </Row>
            <Row label="MoCap Provider">
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={inputStyle}>
                <option value="local_holistic">Local Holistic (Admin Dev)</option>
                <option value="http_mocap_api">MoCap API (Server)</option>
              </select>
            </Row>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
              사용 가능: {providers.map((p) => p.label).join(', ') || '확인 중...'}
            </div>
            <Row label="소스 영상">
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              />
            </Row>
            {error ? <div style={{ color: '#FF6B6B', fontSize: 12, marginBottom: 12 }}>{error}</div> : null}
            <button type="button" onClick={startExtraction} disabled={!videoFile} style={primaryBtn}>
              콘텐츠 제작 시작 (1회)
            </button>
          </div>
        ) : null}

        {phase === 'processing' ? (
          <div style={panelStyle}>
            <div style={{ fontSize: 13, color: '#FFD700' }}>[{progress}%] {step}</div>
            <button type="button" onClick={cancel} style={{ ...btnStyle, marginTop: 12 }}>취소</button>
          </div>
        ) : null}

        {phase === 'member_mapping' && analysisResult ? (
          <div style={panelStyle}>
            <MemberAutoDetect
              groupId={groupId}
              myMemberId={referenceMemberId}
              analysisResult={analysisResult}
              onConfirm={confirmMemberMapping}
              onRetry={reset}
            />
          </div>
        ) : null}

        {(phase === 'validating' || phase === 'persisting') ? (
          <div style={panelStyle}>
            <div style={{ fontSize: 13 }}>{step}</div>
          </div>
        ) : null}

        {phase === 'complete' && creationResult ? (
          <div style={panelStyle}>
            <div style={{ color: '#44FF88', fontWeight: 600, marginBottom: 12 }}>✓ Pre-built 콘텐츠 저장 완료</div>
            <ul style={{ fontSize: 12, lineHeight: 1.8, color: 'rgba(255,255,255,0.8)' }}>
              <li>Provider: {creationResult.providerLabel}</li>
              <li>Package: {persistInfo?.packageKey}</li>
              <li>Members: {creationResult.groupMotionContent.members.map((m) => m.memberId).join(', ')}</li>
              <li>Duration: {creationResult.groupMotionContent.durationSec.toFixed(1)}s</li>
              <li>JSON: {persistInfo?.exportedJsonFilename} (다운로드됨)</li>
            </ul>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              JSON을 `public/data/choreography/`에 배치하면 정적 배포도 가능합니다.
              IndexedDB에도 저장되어 같은 브라우저에서 Group Mode가 즉시 로드합니다.
            </p>
            <button type="button" onClick={reset} style={primaryBtn}>새 콘텐츠 제작</button>
          </div>
        ) : null}

        <video
          ref={videoRef}
          muted
          playsInline
          style={{ position: 'fixed', width: 2, height: 2, opacity: 0, pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <span style={{ width: 120, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      {children}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 10,
  border: '1px solid rgba(255,31,142,0.3)',
  background: 'rgba(3,3,8,0.95)',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.15)',
  background: '#1a1a24',
  color: '#fff',
  fontSize: 12,
};

const btnStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'transparent',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
};

const primaryBtn: React.CSSProperties = {
  ...btnStyle,
  background: 'rgba(255,31,142,0.25)',
  border: '1px solid #FF1F8E',
};
