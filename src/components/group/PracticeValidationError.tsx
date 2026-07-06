// @ts-nocheck
import React from 'react';
import type { PracticeValidationResult } from '../../utils/practiceDataValidation';

declare const __ONNODE_BUILD__: string;

const FIELD_LABELS: Record<string, string> = {
  'skeletonData.frames': '스켈레톤 프레임',
  frameCount: '프레임 수',
  duration: '안무 길이',
  memberCount: '멤버 수',
  aiAvatarCount: 'AI 아바타 수',
  formationCount: '포메이션 수',
  timelineLength: '타임라인 길이',
  videoDuration: '영상 길이',
  fps: 'FPS',
  practiceDuration: '연습 길이',
  referenceVideo: '참조 영상',
};

export function PracticeValidationError({
  validation,
  onRetry,
  onHome,
}: {
  validation: PracticeValidationResult;
  onRetry: () => void;
  onHome?: () => void;
}) {
  const { issues, warnings = [], metrics } = validation;
  const buildId = typeof __ONNODE_BUILD__ !== 'undefined' ? __ONNODE_BUILD__ : 'dev';

  return (
    <div className="group-studio">
      <div className="group-studio-ambient" />
      <div className="group-studio-inner" style={{ maxWidth: 520 }}>
        <header className="group-studio-header" style={{ marginBottom: 20 }}>
          <h1 className="group-studio-title" style={{ fontSize: 22, color: '#FF6B6B' }}>
            연습 데이터 검증 실패
          </h1>
          <p className="group-studio-subtitle">
            안무 데이터에 문제가 있어 연습을 시작할 수 없습니다. 아래 항목을 확인한 뒤 안무를 다시 추출해 주세요.
          </p>
        </header>

        <div
          style={{
            padding: '16px 18px',
            background: 'rgba(255,80,80,0.08)',
            border: '1px solid rgba(255,80,80,0.35)',
            borderRadius: 14,
            marginBottom: 16,
          }}
        >
          <div style={{ color: '#FF8A8A', fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            검증 실패 항목 ({issues.length}개)
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.7 }}>
            {issues.map((issue) => (
              <li key={issue.field} style={{ marginBottom: 6 }}>
                <strong>{FIELD_LABELS[issue.field] || issue.field}</strong>
                {' — '}
                {issue.message}
                {issue.expected != null && (
                  <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {' '}
                    (기대: {issue.expected}
                    {issue.actual != null ? `, 실제: ${issue.actual}` : ''})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {warnings.length > 0 ? (
          <div
            style={{
              padding: '14px 16px',
              background: 'rgba(255,200,80,0.08)',
              border: '1px solid rgba(255,200,80,0.3)',
              borderRadius: 14,
              marginBottom: 16,
            }}
          >
            <div style={{ color: '#FFD080', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              경고 ({warnings.length}개) — 연습 차단 사유 아님
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 18px', color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.7 }}>
              {warnings.map((issue, index) => (
                <li key={`${issue.field}-${index}`} style={{ marginBottom: 6 }}>
                  <strong>{FIELD_LABELS[issue.field] || issue.field}</strong>
                  {' — '}
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          style={{
            padding: '14px 16px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            marginBottom: 20,
            fontSize: 12,
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.8,
          }}
        >
          <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>현재 데이터</div>
          <div>프레임: {metrics.frameCount}개 · 안무: {metrics.duration.toFixed(1)}초</div>
          <div>멤버: {metrics.memberCount}명 · AI: {metrics.aiAvatarCount}명 · 포메이션: {metrics.formationCount}개</div>
          <div>
            영상: {metrics.videoDuration.toFixed(1)}초 · 타임라인: {metrics.timelineLength.toFixed(1)}초 · FPS: {metrics.fps}
          </div>
          <div>
            연습 길이: {metrics.practiceDuration != null ? `${metrics.practiceDuration.toFixed(1)}초` : '없음'}
            {' · '}
            스냅샷: {metrics.snapshotOk ? '생성 가능' : '생성 불가'}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            빌드: {buildId}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #FF1F8E, #7C3AED)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            안무 다시 추출
          </button>
          {onHome ? (
            <button
              type="button"
              onClick={onHome}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              홈으로
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PracticeValidationError;
