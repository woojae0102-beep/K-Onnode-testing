// @ts-nocheck
import React, { useState } from 'react';
import { useSubscription } from '../../hooks/useSubscription';
import { SUBSCRIPTION_PLANS, PlanId } from '../../data/subscriptionPlans';

export interface SubscriptionGateProps {
  /** 필요한 최소 플랜 (기본 'premium') */
  requiredPlan?: Exclude<PlanId, 'free'>;
  /** 기능 키 (예: 'agency_audition', 'monthly_eval') */
  featureKey: string;
  /** 잠금 오버레이에 표시할 사용자용 기능명 */
  featureName: string;
  /** 잠금 오버레이를 표시할지 여부 */
  showOverlay?: boolean;
  /** 잠긴 콘텐츠 자식 */
  children: React.ReactNode;
}

export default function SubscriptionGate({
  requiredPlan = 'premium',
  featureKey,
  featureName,
  showOverlay = true,
  children,
}: SubscriptionGateProps) {
  const { hasFeature } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const allowed = hasFeature(featureKey);
  if (allowed) return <>{children}</>;

  return (
    <>
      <div style={{ position: 'relative', height: '100%' }}>
        <div
          style={{
            opacity: 0.3,
            pointerEvents: 'none',
            userSelect: 'none',
            height: '100%',
          }}
        >
          {children}
        </div>
        {showOverlay && (
          <div
            onClick={() => setShowUpgrade(true)}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)',
              cursor: 'pointer',
              padding: 20,
              textAlign: 'center',
              gap: 4,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
              {featureName}
            </div>
            <div
              style={{
                color: '#FF1F8E',
                fontSize: 13,
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {SUBSCRIPTION_PLANS[requiredPlan].name} 플랜에서 사용 가능
            </div>
            <div
              style={{
                marginTop: 10,
                padding: '10px 18px',
                background: '#FF1F8E',
                color: '#fff',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              업그레이드 보기
            </div>
          </div>
        )}
      </div>

      {showUpgrade && (
        <UpgradeModal
          featureName={featureName}
          requiredPlan={requiredPlan}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </>
  );
}

interface UpgradeModalProps {
  featureName: string;
  requiredPlan: Exclude<PlanId, 'free'>;
  onClose: () => void;
}

function UpgradeModal({
  featureName,
  requiredPlan,
  onClose,
}: UpgradeModalProps) {
  const plan = SUBSCRIPTION_PLANS[requiredPlan];

  const featureCopy = [
    '기획사 오디션 시뮬레이션',
    'AI 월말 평가',
    '댄스 페르소나 코칭',
    '보컬 소울 코칭',
    '악기 트레이닝',
    '무제한 리포트 저장',
  ];

  return (
    <div
      onClick={onClose}
      className="bottom-sheet-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bottom-sheet"
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
            {plan.name} 기능
          </div>
          <div style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
            {featureName}는 {plan.name} 플랜에서 사용 가능해요
          </div>
        </div>

        <div
          style={{
            background: '#FF1F8E18',
            border: '1px solid #FF1F8E44',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              color: '#FF1F8E',
              fontSize: 12,
              fontWeight: 500,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            {plan.name} 플랜
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>
            ₩{plan.price.toLocaleString('ko-KR')}{' '}
            <span
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: '#888',
              }}
            >
              /월
            </span>
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {featureCopy.map((feature) => (
              <div
                key={feature}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#ccc',
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#1DB971' }}>✓</span>
                {feature}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            window.location.href = '/settings?tab=subscription';
          }}
          className="auth-btn-primary"
        >
          {plan.name} 시작하기
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 10,
            padding: '12px',
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: 14,
            cursor: 'pointer',
            minHeight: 44,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          나중에
        </button>
      </div>
    </div>
  );
}
