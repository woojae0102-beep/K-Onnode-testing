// @ts-nocheck
/**
 * Group Mode — Production Motion Asset V2 loader (fixture fallback 금지).
 */
import { loadProductionDanceAsset } from '../../../services/group/ProductionDanceAssetLoader';
import { fetchProductionDanceAssetFromServer } from '../../../services/group/ProductionDanceAssetApi';
import type { ProductionDanceAsset } from '../../../types/productionDanceAsset';
import { isDevEnvironment } from '../../../utils/isDevEnvironment';
import type {
  ProductionMotionAssetV2,
  ProductionMotionMemberV2,
} from '../types/ProductionMotionAssetV2';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { validateProvenanceTrustBoundary } from '../../../gx10/ingest/validateProvenanceTrustBoundary';
import {
  verifyProductionAuthority,
  type ProductionAuthorityVerification,
} from '../../../gx10/ingest/verifyProductionAuthority';
import type { ProductionAuthorityVerificationFailure } from '../../../gx10/ingest/productionAuthorityVerificationResult';

export type LoadProductionMotionAssetOptions = {
  groupId: string;
  songId: string;
};

export type LoadProductionMotionAssetResult = {
  asset: ProductionMotionAssetV2;
  source: 'server' | 'indexeddb_cache' | 'test_registry';
  loadStatus: 'ready' | 'authority_blocked';
  authorityVerification?: ProductionAuthorityVerification;
  authorityBlocked?: ProductionAuthorityVerificationFailure;
};

/** DEV explicit test registry — useGroupStudio 자동 fallback 금지 */
const testRegistry = new Map<string, ProductionMotionAssetV2>();

function registryKey(groupId: string, songId: string) {
  return `${groupId}:${songId}`;
}

export function registerTestProductionMotionAsset(asset: ProductionMotionAssetV2): void {
  if (!isDevEnvironment()) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
      'Test asset registration is DEV-only',
    );
  }
  if (asset.schemaVersion !== 2) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
      'schemaVersion must be 2',
    );
  }
  if (asset.assetProvenance === 'real_production') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'Test registry cannot register real_production assets',
    );
  }
  if (asset.productionAuthorityProof) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'Test registry cannot register productionAuthorityProof',
    );
  }
  if (asset.productionAssetId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'Test registry cannot register productionAssetId',
    );
  }
  if (asset.assetProvenance && asset.assetProvenance !== 'synthetic_test' && asset.assetProvenance !== 'dev_fixture') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      `Test registry only allows synthetic_test or dev_fixture, got ${asset.assetProvenance}`,
    );
  }
  testRegistry.set(registryKey(asset.groupId, asset.songId), asset);
}

export function clearTestProductionMotionAssets(): void {
  testRegistry.clear();
}

export function validateProductionMotionAssetV2(asset: ProductionMotionAssetV2): void {
  if (!asset || asset.schemaVersion !== 2) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
      'schemaVersion must be 2',
    );
  }
  if (!asset.groupId || !asset.songId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
      'groupId and songId required',
    );
  }
  if (!Number.isFinite(asset.durationSec) || asset.durationSec <= 0) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.MOTION_DURATION_INVALID,
      'durationSec must be > 0',
    );
  }
  if (!Array.isArray(asset.members) || !asset.members.length) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
      'members array required',
    );
  }

  if (asset.status === 'draft' || asset.status === 'processing') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_NOT_READY,
      `status=${asset.status}`,
    );
  }

  if (asset.status === 'error') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_NOT_READY,
      'status=error',
    );
  }

  for (const member of asset.members) {
    validateMember(member);
  }

  validateProductionMotionDistinctness(asset);
  validateProvenanceTrustBoundary(asset);
}

function validateProductionMotionDistinctness(asset: ProductionMotionAssetV2): void {
  const motionIds = asset.members.map((m) => m.motion.motionAssetId.trim());
  const motionUrls = asset.members.map((m) => m.motion.motionUrl.trim());

  const dupId = motionIds.find((id, i) => motionIds.indexOf(id) !== i);
  if (dupId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_ASSET_ID,
      `duplicate motionAssetId: ${dupId}`,
    );
  }

  const dupUrl = motionUrls.find((url, i) => motionUrls.indexOf(url) !== i);
  if (dupUrl) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_URL,
      `duplicate motionUrl: ${dupUrl}`,
    );
  }
}

function validateMember(member: ProductionMotionMemberV2): void {
  if (!member.memberId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
      'memberId required',
    );
  }
  if (!member.avatar?.glbUrl?.trim()) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.MEMBER_AVATAR_ASSET_MISSING,
      `member ${member.memberId}: avatar.glbUrl missing`,
    );
  }
  if (!member.avatar?.avatarAssetId?.trim()) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.MEMBER_AVATAR_ASSET_MISSING,
      `member ${member.memberId}: avatar.avatarAssetId missing`,
    );
  }
  if (!member.motion?.motionUrl?.trim()) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.MEMBER_MOTION_ASSET_MISSING,
      `member ${member.memberId}: motion.motionUrl missing`,
    );
  }
  if (!member.motion?.motionAssetId?.trim()) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.MEMBER_MOTION_ASSET_MISSING,
      `member ${member.memberId}: motion.motionAssetId missing`,
    );
  }
  if (member.motion.motionFormat !== 'gltf_animation') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.MOTION_FORMAT_UNSUPPORTED,
      `member ${member.memberId}: format=${member.motion.motionFormat}`,
    );
  }
  if (!Number.isFinite(member.motion.durationSec) || member.motion.durationSec <= 0) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.INVALID_MOTION_DURATION,
      `member ${member.memberId}: motion.durationSec invalid`,
    );
  }
}

function legacyV1ToV2(asset: ProductionDanceAsset): ProductionMotionAssetV2 {
  // assetProvenance intentionally omitted — legacy v1 assets are provenance_unknown
  return {
    schemaVersion: 2,
    groupId: asset.groupId,
    songId: asset.songId,
    durationSec: asset.durationSec,
    fps: asset.fps,
    status: asset.status === 'ready' ? 'ready' : asset.status === 'processing' ? 'processing' : asset.status === 'draft' ? 'draft' : 'error',
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    members: (asset.members || []).map((m) => {
      const motionFormat = m.motionFormat === 'glb' ? 'gltf_animation' as const : 'gltf_animation';
      if (m.motionFormat !== 'glb') {
        throw new ProductionMotionAssetError(
          PRODUCTION_MOTION_ERRORS.MOTION_FORMAT_UNSUPPORTED,
          `member ${m.memberId}: legacy format=${m.motionFormat}`,
        );
      }
      return {
        memberId: m.memberId,
        memberName: m.memberName,
        avatar: {
          avatarAssetId: m.avatarAssetId || m.memberId,
          glbUrl: m.avatarAssetUrl || '',
        },
        motion: {
          motionAssetId: `${asset.id}:${m.memberId}`,
          motionFormat,
          motionUrl: m.motionAssetUrl || '',
          durationSec: m.motionDurationSec || asset.durationSec,
        },
        formation: {
          keyframes: (m.formationTrack || []).map((kf) => ({
            timeSec: kf.timestamp,
            position: kf.position,
            rotation: kf.rotation,
          })),
        },
      };
    }),
  };
}

async function resolveRealProductionAuthority(
  asset: ProductionMotionAssetV2,
) {
  if (asset.assetProvenance !== 'real_production') return undefined;
  return verifyProductionAuthority(asset);
}

function isServerProductionMotionAssetV2(data: unknown): data is ProductionMotionAssetV2 {
  return (
    typeof data === 'object'
    && data !== null
    && (data as ProductionMotionAssetV2).schemaVersion === 2
    && Array.isArray((data as ProductionMotionAssetV2).members)
  );
}

async function fetchProductionAsset(
  groupId: string,
  songId: string,
): Promise<{ kind: 'v2'; asset: ProductionMotionAssetV2 } | { kind: 'legacy'; asset: ProductionDanceAsset } | null> {
  try {
    const fromServer = await fetchProductionDanceAssetFromServer(groupId, songId);
    if (fromServer && isServerProductionMotionAssetV2(fromServer)) {
      return { kind: 'v2', asset: fromServer as ProductionMotionAssetV2 };
    }
    if (fromServer) return { kind: 'legacy', asset: fromServer };
  } catch {
    /* fall through */
  }
  try {
    const loaded = await loadProductionDanceAsset({ groupId, songId });
    if (loaded.asset && isServerProductionMotionAssetV2(loaded.asset)) {
      return { kind: 'v2', asset: loaded.asset as ProductionMotionAssetV2 };
    }
    if (loaded.asset) return { kind: 'legacy', asset: loaded.asset };
  } catch {
    return null;
  }
  return null;
}

export async function loadProductionMotionAsset(
  opts: LoadProductionMotionAssetOptions,
): Promise<LoadProductionMotionAssetResult> {
  const { groupId, songId } = opts;
  const key = registryKey(groupId, songId);

  if (testRegistry.has(key)) {
    const asset = testRegistry.get(key)!;
    validateProductionMotionAssetV2(asset);
    return { asset, source: 'test_registry', loadStatus: 'ready' };
  }

  const fetched = await fetchProductionAsset(groupId, songId);
  if (!fetched) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_NOT_FOUND,
      `No production asset for ${groupId}/${songId}`,
    );
  }

  if (fetched.kind === 'v2') {
    const asset = fetched.asset;
    validateProductionMotionAssetV2(asset);
    const authorityResult = await resolveRealProductionAuthority(asset);
    if (authorityResult && !authorityResult.verified) {
      return {
        asset,
        source: 'server',
        loadStatus: 'authority_blocked',
        authorityBlocked: authorityResult,
      };
    }
    return {
      asset,
      source: 'server',
      loadStatus: 'ready',
      authorityVerification: authorityResult?.verified ? authorityResult : undefined,
    };
  }

  const v2 = legacyV1ToV2(fetched.asset);
  validateProductionMotionAssetV2(v2);

  return {
    asset: v2,
    source: 'server',
    loadStatus: 'ready',
  };
}

export default loadProductionMotionAsset;
