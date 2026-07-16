// @ts-nocheck
import React from 'react';
import type { FrameAnalysisSnapshot } from '../analysis/analysisTypes';
import type { MediaPipeRawFrameSnapshot } from './mediaPipeRawTypes';

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

function Empty({ msg }: { msg: string }) {
  return <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{msg}</div>;
}

function rawFromFrame(frame: FrameAnalysisSnapshot | null): MediaPipeRawFrameSnapshot | null {
  return frame?.mediaPipeRaw ?? null;
}

export function MediaPipeRawInspectorPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  const raw = rawFromFrame(frame);
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  if (!raw) return <Empty msg="MediaPipe Raw 데이터 없음 — 추출 시 Live Bus 활성화 필요" />;

  return (
    <div>
      <div style={{ fontSize: 11, marginBottom: 10, color: 'rgba(255,255,255,0.6)' }}>Frame {frame.frameIndex}</div>
      <Section title="Summary">
        <Row label="Raw Detection Count" value={raw.rawDetectionCount} />
        <Row label="Raw Landmark Count" value={raw.rawLandmarkCount} />
        <Row label="Detected Persons (valid)" value={raw.detectedPersons} highlight={raw.detectedPersons === 0} />
      </Section>

      {raw.persons.map((person) => (
        <Section key={person.detectionIndex} title={`Detection #${person.detectionIndex}`}>
          <Row label="Pose Confidence" value={person.poseConfidence.toFixed(3)} highlight={person.poseConfidence < 0.35} />
          <Row label="Visibility Average" value={person.visibilityAverage.toFixed(3)} />
          <Row label="World Landmark Count" value={person.worldLandmarkCount} />
          <Row label="33 Joint Complete" value={person.jointComplete33 ? 'YES' : 'NO'} highlight={!person.jointComplete33} />
          <Row label="Missing Joint Count" value={person.missingJointCount} highlight={person.missingJointCount > 10} />
          <Row
            label="Bounding Box"
            value={person.bbox
              ? `${person.bbox.minX.toFixed(2)},${person.bbox.minY.toFixed(2)} → ${person.bbox.maxX.toFixed(2)},${person.bbox.maxY.toFixed(2)}`
              : '—'}
          />
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>Joint Visibility / Confidence</div>
          {person.joints.slice(0, 33).map((j) => (
            <Row
              key={j.name}
              label={j.name}
              value={`${j.confidence.toFixed(2)} / ${j.action}`}
              highlight={j.action === 'discard' || j.action === 'missing'}
            />
          ))}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>Joint Drop Heatmap</div>
          {Object.keys(person.jointDropHeatmap).length ? (
            Object.entries(person.jointDropHeatmap).map(([name, heat]) => (
              <Row key={name} label={name} value={heat.toFixed(2)} highlight={heat > 0.6} />
            ))
          ) : (
            <div style={{ fontSize: 9, color: '#6EE7B7' }}>No dropped joints</div>
          )}
        </Section>
      ))}

      {raw.jointStability?.length ? (
        <Section title="Joint Stability / Flicker">
          {raw.jointStability.filter((j) => j.flicker || j.lostReason).slice(0, 20).map((j) => (
            <Row
              key={j.jointName}
              label={j.jointName}
              value={j.lostReason || `Δ${j.deltaPx.toFixed(3)}`}
              highlight={Boolean(j.flicker)}
            />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

export function PipelineFlowChartPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  const raw = rawFromFrame(frame);
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  if (!raw?.pipelineFlow?.length) return <Empty msg="Pipeline Flow 데이터 없음" />;

  return (
    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
      <div style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 12 }}>Frame {frame.frameIndex}</div>
      {raw.pipelineFlow.map((stage, i) => (
        <div key={stage.label}>
          <div style={{ color: '#FF8FC8', fontWeight: 600 }}>{stage.label}</div>
          <div style={{ fontSize: 18, color: '#fff', margin: '4px 0 8px' }}>{stage.count}</div>
          {i < raw.pipelineFlow.length - 1 ? (
            <div style={{ color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>↓</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PipelineRemovalPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  const raw = rawFromFrame(frame);
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  if (!raw?.removals?.length) return <Empty msg="이 프레임에서 제거된 Detection 없음" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {raw.removals.map((r, i) => (
        <div
          key={`${r.trackOrDetectionId}-${i}`}
          style={{
            padding: 8,
            borderRadius: 6,
            border: '1px solid rgba(255,100,100,0.3)',
            background: 'rgba(255,255,255,0.03)',
            fontSize: 10,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          <div style={{ color: '#FF8FC8', fontWeight: 600 }}>{r.trackOrDetectionId} removed</div>
          <div style={{ color: 'rgba(255,255,255,0.45)' }}>stage: {r.stage}</div>
          <div style={{ color: '#FFD700' }}>reason: {r.reason}</div>
        </div>
      ))}
    </div>
  );
}

export function MediaPipeTimingPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  const t = frame.mediaPipeRaw?.timing;
  const p = frame.performance;
  if (!t && !p.poseDetectionMs) return <Empty msg="Timing breakdown 없음" />;

  const rows = t
    ? [
        ['Image Decode', t.imageDecodeMs],
        ['Pose Detection', t.poseDetectionMs],
        ['Landmark', t.landmarkMs],
        ['PostProcess', t.postProcessMs],
        ['Total', t.totalMs],
      ]
    : [
        ['Pose Detection (est.)', p.poseDetectionMs ?? p.mediaPipeMs],
        ['Total', p.totalMs],
      ];

  const max = Math.max(...rows.map(([, ms]) => ms as number), 1);

  return (
    <div>
      <div style={{ fontSize: 11, marginBottom: 10, color: 'rgba(255,255,255,0.6)' }}>Frame {frame.frameIndex}</div>
      {rows.map(([label, ms]) => (
        <div key={label as string} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
            <span style={{ color: (ms as number) > 100 ? '#FFD700' : '#fff' }}>{(ms as number).toFixed(1)}ms</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, ((ms as number) / max) * 100)}%`,
                background: label === 'Total' ? '#FF1F8E' : '#FF6B9D',
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PipelineLossReportPanel({ frame }: { frame: FrameAnalysisSnapshot | null }) {
  const raw = rawFromFrame(frame);
  if (!frame) return <Empty msg="프레임을 선택하세요" />;
  if (!raw?.lossReport) return <Empty msg="Pipeline Loss Report 없음" />;

  const report = raw.lossReport;
  return (
    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>
      <Section title={`Pipeline Loss Report — Frame ${report.frameIndex}`}>
        <Row label="Primary Loss Stage" value={report.primaryLossStage ?? '—'} highlight={Boolean(report.primaryLossStage)} />
        <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{report.summary}</div>
      </Section>
      <Section title="Stage Flow">
        {report.flow.map((s) => (
          <Row key={s.label} label={s.label} value={s.count} />
        ))}
      </Section>
      {report.removals.length ? (
        <Section title="Removals">
          {report.removals.map((r, i) => (
            <div key={i} style={{ marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ color: '#FF8FC8' }}>{r.trackOrDetectionId}</span>
              {' @ '}
              {r.stage}
              {' — '}
              <span style={{ color: '#FFD700' }}>{r.reason}</span>
            </div>
          ))}
        </Section>
      ) : (
        <div style={{ color: '#6EE7B7' }}>No removals this frame</div>
      )}
    </div>
  );
}
