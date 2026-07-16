// @ts-nocheck
import React, { useMemo } from 'react';
import type { FrameAnalysisSnapshot, SkeletonAnalysisPackage } from '../analysis/analysisTypes';
import { LivePerformanceChart, LiveRcaLog } from '../live/LiveAnalysisUI';
import {
  MediaPipeRawInspectorPanel,
  PipelineFlowChartPanel,
  PipelineRemovalPanel,
  MediaPipeTimingPanel,
  PipelineLossReportPanel,
} from '../mediapipe/MediaPipeRawInspectorPanels';

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 10,
  lineHeight: 1.4,
  fontFamily: 'ui-monospace, monospace',
};

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={ROW}>
      <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span style={{ color: highlight ? '#FFD700' : 'rgba(255,255,255,0.9)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: '#FF1F8E', letterSpacing: '0.08em', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

export function PipelineInspectorPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  return (
    <div>
      <div style={{ fontSize: 11, marginBottom: 10, color: 'rgba(255,255,255,0.6)' }}>Frame {frame.frameIndex}</div>
      {frame.pipeline.map((stage) => (
        <Section key={stage.stage} title={stage.label}>
          <Row label="Time" value={`${stage.timeMs.toFixed(1)}ms`} />
          <Row label="In → Out" value={`${stage.inputCount} → ${stage.outputCount}`} />
          {stage.trackCount != null ? <Row label="Tracks" value={stage.trackCount} /> : null}
          {stage.confidence != null ? <Row label="Conf/Cov" value={typeof stage.confidence === 'number' && stage.confidence <= 1 ? stage.confidence.toFixed(2) : stage.confidence} /> : null}
          <Row label="Failed" value={stage.failed ? 'YES' : 'NO'} highlight={stage.failed} />
          {stage.detail ? <Row label="Detail" value={stage.detail} /> : null}
        </Section>
      ))}
    </div>
  );
}

export function FrameRcaPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  if (!frame.rcaIssues.length) {
    return <div style={{ fontSize: 11, color: '#6EE7B7' }}>Frame {frame.frameIndex} — 문제 없음</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {frame.rcaIssues.map((issue, i) => (
        <div
          key={i}
          style={{
            padding: 10,
            borderRadius: 8,
            border: `1px solid ${issue.severity === 'critical' ? 'rgba(255,68,68,0.4)' : 'rgba(255,200,0,0.3)'}`,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 11, color: '#fff', marginBottom: 4 }}>{issue.problem}</div>
          <Row label="Reason" value={issue.reason} highlight />
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>Evidence</div>
          {issue.evidence.map((e, j) => (
            <div key={j} style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', paddingLeft: 8 }}>• {e}</div>
          ))}
          <Row label="Suggested" value={issue.suggestedCause} />
        </div>
      ))}
    </div>
  );
}

export function MultiPersonInspectorPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {frame.persons.map((p) => (
        <div key={p.trackId} style={{ padding: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontWeight: 600, fontSize: 11 }}>{p.memberLabel} (T{p.trackId})</div>
          <Row label="Status" value={p.status} highlight={p.status === 'lost' || p.status === 'occluded'} />
          <Row label="Visible" value={`${p.visiblePercent}%`} />
          <Row label="Confidence" value={p.confidence.toFixed(2)} />
          <Row label="Tracking" value={p.trackingStability} />
          <Row label="Prediction" value={p.predictionMethod} />
          {p.reason ? <Row label="Reason" value={p.reason} /> : null}
        </div>
      ))}
    </div>
  );
}

export function HungarianInspectorPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  if (!frame.hungarian.length) return <Empty msg="Hungarian 데이터 없음 (첫 프레임 또는 감지 없음)" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {frame.hungarian.map((h, i) => (
        <div key={i} style={{ padding: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 6, fontSize: 10 }}>
          <div>Track {h.previousTrackId} → Det #{h.currentDetectionIndex >= 0 ? h.currentDetectionIndex : '—'}</div>
          <Row label="Cost" value={h.cost.toFixed(3)} />
          <Row label="Threshold" value={h.threshold.toFixed(3)} />
          <Row label="Matched" value={h.matched ? 'YES' : 'REJECTED'} highlight={!h.matched} />
          {h.reason ? <div style={{ color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{h.reason}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function KalmanInspectorPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  if (!frame.kalman.length) return <Empty msg="Kalman prediction 없음" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {frame.kalman.map((k, i) => (
        <div key={i} style={{ padding: 8, background: 'rgba(136,204,255,0.08)', borderRadius: 6, fontSize: 10 }}>
          <div>Track {k.trackId} · {k.jointName}</div>
          <Row label="Pred" value={`(${k.predictionX.toFixed(3)}, ${k.predictionY.toFixed(3)})`} />
          <Row label="Actual" value={`(${k.actualX.toFixed(3)}, ${k.actualY.toFixed(3)})`} />
          <Row label="Error" value={k.distanceError.toFixed(4)} highlight={k.distanceError > 0.05} />
          <Row label="Pred Conf" value={k.predictionConfidence.toFixed(2)} />
          <Row label="Age" value={`${k.predictionAgeFrames} frames`} />
        </div>
      ))}
    </div>
  );
}

export function MotionQualityPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  const q = frame.motionQuality;
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 700, color: q.overall >= 80 ? '#6EE7B7' : q.overall >= 60 ? '#FFD700' : '#FF6B6B' }}>
        {q.overall}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>Motion Quality Score</div>
      <Row label="Tracking" value={q.tracking} />
      <Row label="Pose" value={q.pose} />
      <Row label="Coverage" value={q.coverage} />
      <Row label="Pose Stability" value={q.poseStability} />
      <Row label="Joint Complete" value={q.jointCompleteness} />
      <Row label="Prediction %" value={`${q.predictionRatio}%`} />
    </div>
  );
}

export function PerformanceInspectorPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  if (frame.mediaPipeRaw?.timing) {
    return <MediaPipeTimingPanel frame={frame} />;
  }
  const p = frame.performance;
  const max = Math.max(p.mediaPipeMs, p.trackingMs, p.hungarianMs, p.kalmanMs, p.workerMs, 1);
  const bars = [
    ['MediaPipe', p.mediaPipeMs],
    ['Tracking', p.trackingMs],
    ['Hungarian', p.hungarianMs],
    ['Kalman', p.kalmanMs],
    ['Orientation', p.orientationMs],
    ['Rotation', p.rotationMs],
    ['Worker', p.workerMs],
    ['Total', p.totalMs],
  ];
  return (
    <div>
      {bars.map(([label, ms]) => (
        <div key={label as string} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
            <span>{(ms as number).toFixed(1)}ms</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, ((ms as number) / max) * 100)}%`,
                background: label === 'Total' ? '#FF1F8E' : '#6EE7B7',
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CoverageAnalyzerPanel({
  pkg,
  liveCoverageRing,
}: {
  pkg: SkeletonAnalysisPackage | null;
  liveCoverageRing?: Array<{ frameIndex: number; timestamp?: number; coverage: number }>;
}) {
  if (!pkg && !liveCoverageRing?.length) return <Empty msg="분석 데이터 없음" />;
  const points = liveCoverageRing?.length
    ? liveCoverageRing
    : (pkg?.coverageTimeline ?? []);
  const w = 220;
  const h = 60;
  const path = useMemo(() => {
    if (!points.length) return '';
    const maxC = 1;
    return points
      .filter((_, i) => i % Math.max(1, Math.floor(points.length / 80)) === 0)
      .map((p, i, arr) => {
        const x = (i / Math.max(1, arr.length - 1)) * w;
        const y = h - (p.coverage / maxC) * h;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  }, [points]);

  return (
    <div>
      <svg width={w} height={h} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, marginBottom: 10 }}>
        <path d={path} fill="none" stroke="#FF1F8E" strokeWidth={1.5} />
      </svg>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>Coverage Drops</div>
      {(pkg?.coverageDropEvents ?? []).slice(0, 8).map((ev, i) => (
        <div key={i} style={{ fontSize: 9, marginBottom: 6, padding: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
          <div>F{ev.fromFrame}→F{ev.toFrame}: {Math.round(ev.fromCoverage * 100)}% → {Math.round(ev.toCoverage * 100)}%</div>
          <div style={{ color: '#FFD700' }}>{ev.reason}</div>
        </div>
      ))}
    </div>
  );
}

export function ConfidenceTimelinePanel({
  pkg,
  trackIds,
  liveConfidenceByTrack,
}: {
  pkg: SkeletonAnalysisPackage | null;
  trackIds: number[];
  liveConfidenceByTrack?: Map<number, Array<{ frameIndex: number; confidence: number; isDrop: boolean }>>;
}) {
  if (!pkg && !liveConfidenceByTrack?.size) return <Empty msg="분석 데이터 없음" />;
  const w = 200;
  const h = 40;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {trackIds.slice(0, 8).map((tid) => {
        const series = liveConfidenceByTrack?.get(tid) ?? pkg?.confidenceByTrack.get(tid) ?? [];
        const sampled = series.filter((_, i) => i % Math.max(1, Math.floor(series.length / 60)) === 0);
        const path = sampled.map((p, i, arr) => {
          const x = (i / Math.max(1, arr.length - 1)) * w;
          const y = h - p.confidence * h;
          return `${i === 0 ? 'M' : 'L'}${x},${y}`;
        }).join(' ');
        const drops = series.filter((p) => p.isDrop).length;
        return (
          <div key={tid}>
            <div style={{ fontSize: 9, marginBottom: 2 }}>Track {tid} {drops ? `· ${drops} drops` : ''}</div>
            <svg width={w} height={h} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 4 }}>
              <path d={path} fill="none" stroke={drops ? '#FF6B6B' : '#A78BFA'} strokeWidth={1.2} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

export function ExtractionRcaReportPanel({ pkg }: { pkg: SkeletonAnalysisPackage | null }) {
  if (!pkg) return <Empty msg="추출 완료 후 보고서 생성" />;
  const r = pkg.extractionReport;
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: r.passed ? '#6EE7B7' : '#FF6B6B', marginBottom: 10 }}>
        {r.passed ? 'Extraction Passed' : 'Extraction Failed'}
      </div>
      <Row label="Coverage" value={`${Math.round(r.coverage * 100)}%`} />
      <Row label="Peak Track" value={r.peakTrack} />
      <Row label="Avg Confidence" value={r.averageConfidence.toFixed(2)} />
      <Row label="Tracking Stability" value={`${r.trackingStabilityPercent}%`} />
      <Row label="Motion Quality" value={r.motionQualityAverage} />
      {r.failureReason ? <Row label="Failure" value={r.failureReason} highlight /> : null}
      <Section title="Root Cause %">
        <Row label="Detector" value={`${r.rootCauseContributions.detectorPct}%`} />
        <Row label="Tracking" value={`${r.rootCauseContributions.trackingPct}%`} />
        <Row label="Hungarian" value={`${r.rootCauseContributions.hungarianPct}%`} />
        <Row label="Confidence" value={`${r.rootCauseContributions.confidencePct}%`} />
        <Row label="Queue" value={`${r.rootCauseContributions.queuePct}%`} />
      </Section>
      <Section title="Problems">
        {r.problems.slice(0, 12).map((p, i) => (
          <div key={i} style={{ fontSize: 9, marginBottom: 4 }}>
            F{p.frameIndex}: {p.problem} — {p.reason}
          </div>
        ))}
      </Section>
    </div>
  );
}

export function TrackLifecyclePanel({ pkg }: { pkg: SkeletonAnalysisPackage | null }) {
  if (!pkg) return <Empty msg="Track lifecycle 없음" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pkg.trackLifecycles.map((t) => (
        <div key={t.trackId} style={{ padding: 8, borderLeft: `3px solid ${t.color}`, background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ fontWeight: 600, fontSize: 11 }}>Track {t.trackId}</div>
          <Row label="Created" value={`Frame ${t.createdFrame}`} />
          <Row label="Avg Confidence" value={t.averageConfidence.toFixed(2)} />
          <Row label="Max Velocity" value={t.maxVelocity.toFixed(2)} />
          <Row label="Occlusion" value={t.occlusionCount} />
          <Row label="Recovered" value={t.recoveryCount} />
          <Row label="Hungarian Reassign" value={t.hungarianReassignmentCount} />
          <Row label="Prediction Frames" value={t.predictionFrameCount} />
          {t.destroyedFrame != null ? (
            <>
              <Row label="Destroyed" value={`Frame ${t.destroyedFrame}`} />
              <Row label="Reason" value={t.destroyReason ?? '—'} highlight />
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const TABS = [
  { id: 'mediapipe_raw', label: 'MP Raw' },
  { id: 'mp_flow', label: 'MP Flow' },
  { id: 'mp_loss', label: 'Loss' },
  { id: 'mp_removals', label: 'Removals' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'rca', label: 'Frame RCA' },
  { id: 'persons', label: 'Persons' },
  { id: 'hungarian', label: 'Hungarian' },
  { id: 'kalman', label: 'Kalman' },
  { id: 'quality', label: 'Quality' },
  { id: 'perf', label: 'Performance' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'confidence', label: 'Confidence' },
  { id: 'tracks', label: 'Track Life' },
  { id: 'report', label: 'Auto RCA' },
];

export function AnalysisStudioSidebar({
  activeTab,
  onTabChange,
  frameAnalysis,
  analysisPackage,
  trackIds,
  isLive,
  liveState,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  frameAnalysis: FrameAnalysisSnapshot | null;
  analysisPackage: SkeletonAnalysisPackage | null;
  trackIds: number[];
  isLive?: boolean;
  liveState?: import('../live/debugEventTypes').LiveDebugState | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#FF1F8E', marginBottom: 8, letterSpacing: '0.06em' }}>
        ANALYSIS STUDIO
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            style={{
              fontSize: 8,
              padding: '3px 6px',
              borderRadius: 4,
              border: activeTab === t.id ? '1px solid #FF1F8E' : '1px solid rgba(255,255,255,0.12)',
              background: activeTab === t.id ? 'rgba(255,31,142,0.2)' : 'transparent',
              color: activeTab === t.id ? '#FF8FC8' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {activeTab === 'mediapipe_raw' && <MediaPipeRawInspectorPanel frame={frameAnalysis} />}
        {activeTab === 'mp_flow' && <PipelineFlowChartPanel frame={frameAnalysis} />}
        {activeTab === 'mp_loss' && <PipelineLossReportPanel frame={frameAnalysis} />}
        {activeTab === 'pipeline' && <PipelineInspectorPanel frame={frameAnalysis} />}
        {activeTab === 'rca' && <FrameRcaPanel frame={frameAnalysis} />}
        {activeTab === 'mp_removals' && <PipelineRemovalPanel frame={frameAnalysis} />}
        {activeTab === 'persons' && <MultiPersonInspectorPanel frame={frameAnalysis} />}
        {activeTab === 'hungarian' && <HungarianInspectorPanel frame={frameAnalysis} />}
        {activeTab === 'kalman' && <KalmanInspectorPanel frame={frameAnalysis} />}
        {activeTab === 'quality' && <MotionQualityPanel frame={frameAnalysis} />}
        {activeTab === 'perf' && (
          isLive && liveState?.performanceRing?.length
            ? <LivePerformanceChart ring={liveState.performanceRing} />
            : <PerformanceInspectorPanel frame={frameAnalysis} />
        )}
        {activeTab === 'coverage' && (
          <CoverageAnalyzerPanel
            pkg={analysisPackage}
            liveCoverageRing={isLive ? liveState?.coverageRing : undefined}
          />
        )}
        {activeTab === 'confidence' && (
          <ConfidenceTimelinePanel
            pkg={analysisPackage}
            trackIds={trackIds}
            liveConfidenceByTrack={isLive ? liveState?.confidenceByTrack : undefined}
          />
        )}
        {activeTab === 'tracks' && <TrackLifecyclePanel pkg={analysisPackage} />}
        {activeTab === 'report' && <ExtractionRcaReportPanel pkg={analysisPackage} />}
        {isLive && liveState ? (
          <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
            <div style={{ fontSize: 9, color: '#FF1F8E', marginBottom: 8 }}>LIVE RCA LOG</div>
            <LiveRcaLog entries={liveState.rcaLog} />
            <div style={{ fontSize: 9, color: '#FF1F8E', margin: '12px 0 8px' }}>LIVE PERFORMANCE (120f)</div>
            <LivePerformanceChart ring={liveState.performanceRing} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{msg}</div>;
}
