// @ts-nocheck
/**
 * Runtime authority gate — blocks AnimationMixer when real_production authority fails (PHASE 15).
 */
import type { AssetProvenance } from '../../modes/group/types/AssetProvenance';
import type { ProductionMotionFinalStatus } from '../../modes/group/types/ProductionSkeletonContract';
import {
  authorityFailureToBlockedStatus,
  isAuthorityVerificationSuccess,
  type ProductionAuthorityVerificationFailure,
  type ProductionAuthorityVerificationResult,
} from '../../../gx10/ingest/productionAuthorityVerificationResult';

export type ProductionMotionRuntimeAuthorityGateInput = {
  assetProvenance?: AssetProvenance;
  authorityVerification?: ProductionAuthorityVerificationResult;
  authorityBlocked?: ProductionAuthorityVerificationFailure;
};

export type ProductionMotionRuntimeAuthorityGateResult = {
  blocked: boolean;
  blockedStatus?: ProductionMotionFinalStatus;
  failureCode?: string;
  message?: string;
};

export function evaluateProductionMotionRuntimeAuthorityGate(
  input: ProductionMotionRuntimeAuthorityGateInput,
): ProductionMotionRuntimeAuthorityGateResult {
  if (input.assetProvenance !== 'real_production') {
    return { blocked: false };
  }

  if (input.authorityBlocked) {
    return {
      blocked: true,
      blockedStatus: authorityFailureToBlockedStatus(input.authorityBlocked.failureCode),
      failureCode: input.authorityBlocked.failureCode,
      message: input.authorityBlocked.message,
    };
  }

  if (!input.authorityVerification || !isAuthorityVerificationSuccess(input.authorityVerification)) {
    return {
      blocked: true,
      blockedStatus: 'BLOCKED_AUTHORITY_VERIFICATION_FAILED',
      failureCode: 'PRODUCTION_AUTHORITY_VERIFICATION_FAILED',
      message: 'real_production requires verified authority',
    };
  }

  return { blocked: false };
}

export function shouldCreateProductionMotionMixer(input: ProductionMotionRuntimeAuthorityGateInput): {
  allowed: boolean;
  blockedStatus?: ProductionMotionFinalStatus;
  message?: string;
} {
  const gate = evaluateProductionMotionRuntimeAuthorityGate(input);
  if (gate.blocked) {
    return { allowed: false, blockedStatus: gate.blockedStatus, message: gate.message };
  }
  return { allowed: true };
}

export default evaluateProductionMotionRuntimeAuthorityGate;
