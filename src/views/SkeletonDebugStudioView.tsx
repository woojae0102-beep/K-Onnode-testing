// @ts-nocheck
import React, { useRef, useState } from 'react';
import { getGroupData, GROUP_DATA } from '../data/groupPracticeData';
import { isDevEnvironment } from '../utils/isDevEnvironment';
import { downloadSkeletonDebugJson } from '../studio/skeletonDebug/skeletonDebugExport';
import { getFailureCategoryLabel } from '../studio/skeletonDebug/skeletonDebugFailureAnalyzer';
import { SkeletonDebugCanvas } from '../studio/skeletonDebug/render/SkeletonDebugCanvas';
import { SkeletonDebugDiagnosticsPanel } from '../studio/skeletonDebug/SkeletonDebugDiagnosticsPanel';
import { SkeletonDebugOverlayToggles } from '../studio/skeletonDebug/SkeletonDebugOverlayToggles';
import { SkeletonDebugPlayerControls } from '../studio/skeletonDebug/SkeletonDebugPlayerControls';
import { SkeletonDebugTrackHistory } from '../studio/skeletonDebug/SkeletonDebugTrackHistory';
import { useSkeletonDebugSession } from '../studio/skeletonDebug/useSkeletonDebugSession';
import { AnalysisStudioSidebar } from '../studio/skeletonDebug/panels/AnalysisStudioPanels';
import { LiveAnalysisBadge, LiveAnalysisStatusBar } from '../studio/skeletonDebug/live/LiveAnalysisUI';

const GROUP_OPTIONS = Object.keys(GROUP_DATA);

const EMPTY_TRACK_HISTORY: import('../studio/skeletonDebug/types').TrackHistoryEntry[] = [];

export default function SkeletonDebugStudioView({ onNavigate }) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [groupId, setGroupId] = useState('blackpink');
  const [userMemberId, setUserMemberId] = useState('jennie');
  const [analysisTab, setAnalysisTab] = useState('mediapipe_raw');

  const {
    videoRef,
    extractionVideoRef,
    session,
    extractionPreviewUrl,
    isExtracting,
    progress,
    step,
    error,
    currentFrameIndex,
    currentFrameStat,
    totalFrames,
    isPlaying,
    playbackSpeed,
    overlay,
    liveDiagnostics,
    renderMetrics,
    failureAnalysis,
    analysisPackage,
    currentFrameAnalysis,
    isAnalyzing,
    trackIds,
    isLive,
    liveState,
    timelineStore,
    playbackMode,
    hasPlaybackTimeline,
    playbackTimeSec,
    durationSec: sessionDurationSec,
    overlayRef,
    virtualVideoTimeRef,
    handleRenderFrameIndex,
    setOverlay,
    runExtraction,
    loadReplayJson,
    cancel,
    seekToFrame,
    goPrev,
    goNext,
    togglePlay,
    setPlaybackSpeed,
  } = useSkeletonDebugSession();

  const group = getGroupData(groupId);
  const hasSession = Boolean(session?.analysisResult?.frames?.length);
  const isReplay = session?.mode === 'replay';

  if (!isDevEnvironment()) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p>Skeleton Debug Studio는 개발 환경에서만 사용할 수 있습니다.</p>
        <button type="button" onClick={() => onNavigate?.('home')}>홈으로</button>
      </div>
    );
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) runExtraction(file, groupId, userMemberId);
    e.target.value = '';
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadReplayJson(file);
    e.target.value = '';
  };

  const handleExport = () => {
    if (!session?.exportDocument) return;
    const base = session.videoFileName.replace(/\.[^.]+$/, '') || 'skeleton';
    downloadSkeletonDebugJson(session.exportDocument, `${base}-skeleton-analysis.json`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d0d14',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        padding: 12,
        gap: 10,
      }}
    >
      {/* RVFC 추출 전용 — DOM에만 존재, 화면 미표시 */}
      <video
        ref={extractionVideoRef}
        muted
        playsInline
        aria-hidden
        style={{
          position: 'fixed',
          width: 2,
          height: 2,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#FF1F8E' }}>Skeleton Analysis Studio</div>
            <LiveAnalysisBadge active={isExtracting || isLive} />
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
            Motion Extraction RCA · Pipeline Inspector · Tracking Analyzer
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={groupId}
            onChange={(e) => {
              const gid = e.target.value;
              setGroupId(gid);
              const g = getGroupData(gid);
              if (g?.members?.[0]) setUserMemberId(g.members[0].id);
            }}
            style={selectStyle}
          >
            {GROUP_OPTIONS.map((id) => (
              <option key={id} value={id}>{GROUP_DATA[id].nameKr}</option>
            ))}
          </select>
          <select
            value={userMemberId}
            onChange={(e) => setUserMemberId(e.target.value)}
            style={selectStyle}
          >
            {(group?.members || []).map((m) => (
              <option key={m.id} value={m.id}>{m.nameKr} (카메라 대체)</option>
            ))}
          </select>
          <Btn onClick={() => videoInputRef.current?.click()} disabled={isExtracting}>
            영상 업로드
          </Btn>
          <Btn onClick={() => jsonInputRef.current?.click()}>JSON Replay</Btn>
          <Btn onClick={handleExport} disabled={!hasSession || isReplay}>JSON Export</Btn>
          {isExtracting ? <Btn onClick={cancel} highlight>취소</Btn> : null}
          <Btn onClick={() => onNavigate?.('home')}>닫기</Btn>
        </div>
        <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={handleVideoUpload} />
        <input ref={jsonInputRef} type="file" accept=".json,application/json" hidden onChange={handleJsonUpload} />
      </div>

      {/* Status bar */}
      <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.55)' }}>
        {isExtracting ? `[${progress}%] ${step}` : isAnalyzing ? step : step || '영상을 업로드하거나 JSON을 로드하세요.'}
        {session?.mode === 'replay' ? ' · REPLAY MODE' : ''}
        {currentFrameAnalysis ? ` · MQ ${currentFrameAnalysis.motionQuality.overall}` : ''}
      </div>

      {error ? (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(255,68,68,0.12)',
            border: '1px solid rgba(255,68,68,0.35)',
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Extraction Failed</div>
          <div style={{ marginBottom: 8 }}>{error}</div>
          {failureAnalysis ? (
            <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
              <div>Primary: {getFailureCategoryLabel(failureAnalysis.primaryCause)}</div>
              <div>
                Categories: {failureAnalysis.categories.map(getFailureCategoryLabel).join(' · ')}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <LiveAnalysisStatusBar state={liveState} />

      {/* Main grid: video | skeleton | analysis */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 300px',
          gridTemplateRows: 'minmax(300px, 1fr)',
          gap: 10,
          flex: 1,
          minHeight: 360,
        }}
      >
        {/* Source video */}
        <div style={panelStyle}>
          <div style={panelLabel}>원본 영상</div>
          <div style={{ position: 'relative', flex: 1, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
            <video
              ref={videoRef}
              src={session?.videoUrl ?? extractionPreviewUrl ?? undefined}
              muted
              playsInline
              preload="auto"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: isExtracting || session?.videoUrl || extractionPreviewUrl ? 'block' : 'none',
              }}
            />
            {!isExtracting && !session?.videoUrl && !extractionPreviewUrl ? (
              <div style={placeholderStyle}>
                {isReplay ? 'Replay 모드 — 원본 영상 없음' : '영상 업로드 대기'}
              </div>
            ) : null}
          </div>
        </div>

        {/* Skeleton overlay */}
        <div style={panelStyle}>
          <div style={panelLabel}>
            Skeleton Overlay
            {playbackMode === 'PLAYBACK' ? ' · PLAYBACK' : playbackMode === 'ANALYSIS_COMPLETE' ? ' · READY' : ''}
          </div>
          <SkeletonDebugCanvas
            videoRef={videoRef}
            timelineStore={timelineStore}
            overlayRef={overlayRef}
            trackHistory={session?.trackHistory ?? EMPTY_TRACK_HISTORY}
            playbackMode={playbackMode}
            isPlaying={isPlaying}
            showVideoBackground={Boolean(session?.videoUrl)}
            durationSec={sessionDurationSec}
            fallbackVideoTimeRef={virtualVideoTimeRef}
            videoFps={session?.analysisResult?.sourceVideoNativeFps ?? liveDiagnostics?.videoFps ?? 0}
            onRenderFrameIndex={handleRenderFrameIndex}
          />
        </div>

        {/* Analysis Studio sidebar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            padding: '10px 12px',
            background: 'rgba(3, 3, 8, 0.95)',
            border: '1px solid rgba(255, 31, 142, 0.25)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <AnalysisStudioSidebar
            activeTab={analysisTab}
            onTabChange={setAnalysisTab}
            frameAnalysis={currentFrameAnalysis}
            analysisPackage={analysisPackage}
            trackIds={trackIds}
            isLive={isLive || isExtracting}
            liveState={liveState}
          />
        </div>
      </div>

      {/* Live diagnostics strip */}
      <SkeletonDebugDiagnosticsPanel
        live={liveDiagnostics}
        frameStat={currentFrameStat}
        isExtracting={isExtracting}
        playbackMode={playbackMode}
        renderMetrics={renderMetrics}
      />

      {/* Overlay toggles */}
      <SkeletonDebugOverlayToggles overlay={overlay} onChange={setOverlay} />

      {/* Player + timeline */}
      <SkeletonDebugPlayerControls
        currentFrameIndex={currentFrameIndex}
        totalFrames={totalFrames}
        frameStat={currentFrameStat}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        playbackMode={playbackMode}
        playbackTimeSec={playbackTimeSec}
        durationSec={sessionDurationSec}
        onFrameChange={seekToFrame}
        onPlayPause={togglePlay}
        onSpeedChange={setPlaybackSpeed}
        onPrev={goPrev}
        onNext={goNext}
        disabled={!hasPlaybackTimeline}
      />

      {/* Track history */}
      <div style={{ ...panelStyle, maxHeight: 200, overflowY: 'auto' }}>
        <div style={panelLabel}>Track History</div>
        <SkeletonDebugTrackHistory
          history={session?.trackHistory ?? []}
          currentFrameIndex={currentFrameIndex}
          onSelectFrame={seekToFrame}
        />
      </div>

      {/* Frame stats table (compact) */}
      {hasSession && currentFrameStat ? (
        <div style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.5)' }}>
          Frame {currentFrameStat.frameIndex}: Detected={currentFrameStat.detected} Tracked={currentFrameStat.tracked}{' '}
          Confidence={currentFrameStat.confidence.toFixed(2)} Coverage={Math.round(currentFrameStat.coverage * 100)}%{' '}
          Processing={currentFrameStat.processingMs.toFixed(1)}ms
          {currentFrameAnalysis?.rcaIssues?.length
            ? ` · RCA: ${currentFrameAnalysis.rcaIssues[0].problem}`
            : ''}
        </div>
      ) : null}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minHeight: 0,
};

const panelLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.4)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const placeholderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'rgba(255,255,255,0.3)',
  fontSize: 12,
};

const selectStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '6px 8px',
  borderRadius: 6,
  background: '#1a1a24',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.15)',
};

function Btn({
  children,
  onClick,
  disabled,
  highlight,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 11,
        padding: '6px 12px',
        borderRadius: 6,
        border: highlight ? '1px solid #FF1F8E' : '1px solid rgba(255,255,255,0.15)',
        background: highlight ? 'rgba(255,31,142,0.2)' : 'rgba(255,255,255,0.06)',
        color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
