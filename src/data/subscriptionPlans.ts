// @ts-nocheck
// 구독 플랜 정의

export type PlanId = 'free' | 'premium' | 'pro';

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  price: number;
  currency: string;
  description: string;
  features: string[];
}

export const FREE_FEATURES = [
  'dance_basic',
  'vocal_basic',
  'korean_basic',
  'ai_coach_basic',
  'report_basic',
];

export const PREMIUM_FEATURES = [
  'dance_basic',
  'dance_persona',
  'dance_advanced',
  'vocal_basic',
  'vocal_soul',
  'vocal_advanced',
  'korean_basic',
  'korean_advanced',
  'ai_coach_basic',
  'ai_coach_advanced',
  'audition_mode',
  'agency_audition',
  'monthly_eval',
  'instrument_training',
  'report_basic',
  'report_advanced',
  'unlimited_storage',
];

export const PRO_FEATURES = [
  ...PREMIUM_FEATURES,
  'pro_coaching',
  'priority_review',
  'one_to_one_session',
];

export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: '무료',
    price: 0,
    currency: 'KRW',
    description: 'K-POP 트레이닝의 기본 기능을 체험해보세요.',
    features: FREE_FEATURES,
  },
  premium: {
    id: 'premium',
    name: '프리미엄',
    price: 9900,
    currency: 'KRW',
    description: '실제 오디션 시뮬레이션과 AI 월말 평가까지.',
    features: PREMIUM_FEATURES,
  },
  pro: {
    id: 'pro',
    name: '프로',
    price: 29900,
    currency: 'KRW',
    description: '전담 코칭과 1:1 세션까지 포함된 최상위 플랜.',
    features: PRO_FEATURES,
  },
};

// 기능별 필요 플랜
export const FEATURE_REQUIREMENTS: Record<string, PlanId> = {
  dance_basic: 'free',
  vocal_basic: 'free',
  korean_basic: 'free',
  ai_coach_basic: 'free',
  report_basic: 'free',
  dance_persona: 'premium',
  dance_advanced: 'premium',
  vocal_soul: 'premium',
  vocal_advanced: 'premium',
  korean_advanced: 'premium',
  ai_coach_advanced: 'premium',
  audition_mode: 'premium',
  agency_audition: 'premium',
  monthly_eval: 'premium',
  instrument_training: 'premium',
  report_advanced: 'premium',
  unlimited_storage: 'premium',
  pro_coaching: 'pro',
  priority_review: 'pro',
  one_to_one_session: 'pro',
};

export function getFeaturesByPlan(plan: PlanId): string[] {
  return SUBSCRIPTION_PLANS[plan]?.features || FREE_FEATURES;
}

export function hasFeature(plan: PlanId | undefined, featureKey: string): boolean {
  if (!plan) return FREE_FEATURES.includes(featureKey);
  return SUBSCRIPTION_PLANS[plan]?.features.includes(featureKey) ?? false;
}
