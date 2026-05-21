// @ts-nocheck
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  FEATURE_REQUIREMENTS,
  PlanId,
  SUBSCRIPTION_PLANS,
  hasFeature as planHasFeature,
} from '../data/subscriptionPlans';

export interface UseSubscriptionResult {
  plan: PlanId;
  status: 'active' | 'inactive' | 'cancelled';
  expiresAt: Date | null;
  features: string[];
  isPremium: boolean;
  isPro: boolean;
  isActive: boolean;
  hasFeature: (featureKey: string) => boolean;
  requiresUpgrade: (featureKey: string) => boolean;
  requiredPlanFor: (featureKey: string) => PlanId | null;
  planMeta: (typeof SUBSCRIPTION_PLANS)[PlanId];
}

export function useSubscription(): UseSubscriptionResult {
  const { userProfile } = useAuth();

  return useMemo(() => {
    const plan: PlanId = userProfile?.subscription?.plan || 'free';
    const status = userProfile?.subscription?.status || 'inactive';
    const features =
      userProfile?.subscription?.features ?? SUBSCRIPTION_PLANS[plan].features;
    const expiresAt = userProfile?.subscription?.expiresAt ?? null;
    const isActive = status === 'active';

    const hasFeature = (featureKey: string) => {
      if (!isActive && plan !== 'free') {
        return planHasFeature('free', featureKey);
      }
      return (
        features.includes(featureKey) || planHasFeature(plan, featureKey)
      );
    };

    const requiredPlanFor = (featureKey: string): PlanId | null =>
      FEATURE_REQUIREMENTS[featureKey] ?? null;

    const requiresUpgrade = (featureKey: string) => !hasFeature(featureKey);

    return {
      plan,
      status,
      expiresAt,
      features,
      isPremium: plan === 'premium' || plan === 'pro',
      isPro: plan === 'pro',
      isActive,
      hasFeature,
      requiresUpgrade,
      requiredPlanFor,
      planMeta: SUBSCRIPTION_PLANS[plan],
    };
  }, [userProfile]);
}
