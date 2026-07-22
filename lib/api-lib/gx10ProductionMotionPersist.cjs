/**
 * GX10 Production Motion — Firestore persist + authority signing (PHASE 15).
 */
const crypto = require('crypto');
const { validateGX10JobOutputContract } = require('./gx10ProcessorOutputValidation.cjs');
const { computeGX10MemberOutputChecksumSync } = require('./gx10MemberOutputChecksum.cjs');
const {
  createAuthorityTokenFields,
  signAuthorityTokenFields,
} = require('./productionAuthoritySigning.cjs');
const { GX10_OUTPUT_CONTRACT_VERSION } = require('./gx10RestApiContract.cjs');

const PRODUCTION_COLLECTION = 'production_dance_assets';
const AUTHORITY_COLLECTION = 'production_motion_authority';

function docId(groupId, songId) {
  return `${groupId}__${songId}`;
}

function getSigningPrivateKeyPem() {
  const pem = process.env.PRODUCTION_AUTHORITY_SIGNING_PRIVATE_KEY;
  if (!pem?.trim()) return null;
  return pem.replace(/\\n/g, '\n').trim();
}

function mapJobOutputToProductionMotionAssetV2(jobOutput) {
  const durationSec = Math.max(...jobOutput.members.map((m) => m.duration));
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    groupId: jobOutput.groupId,
    songId: jobOutput.songId,
    durationSec,
    fps: jobOutput.fps,
    status: 'ready',
    assetProvenance: 'real_production',
    productionAssetId: jobOutput.productionAssetId,
    createdAt: jobOutput.generatedAt || now,
    updatedAt: now,
    members: jobOutput.members.map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName,
      avatar: {
        avatarAssetId: m.avatarAssetId,
        glbUrl: m.avatarGlbUrl,
        avatarSkeletonProfile: m.avatarSkeletonProfile,
        avatarSkeletonVersion: m.avatarSkeletonVersion,
      },
      motion: {
        motionAssetId: m.motionAssetId,
        motionFormat: 'gltf_animation',
        motionUrl: m.motionUrl,
        durationSec: m.duration,
        animationClipName: m.animationClipName,
        sourceSkeletonProfile: m.sourceSkeletonProfile,
        sourceSkeletonVersion: m.sourceSkeletonVersion,
      },
    })),
  };
}

async function uploadMotionGlbToStorage(admin, { groupId, songId, memberId, jobId, buffer }) {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
  const bucket = admin.storage().bucket(bucketName);
  const storagePath = `production-motion/${groupId}/${songId}/${jobId}/${memberId}.glb`;
  const file = bucket.file(storagePath);
  await file.save(buffer, {
    metadata: { contentType: 'model/gltf-binary' },
    resumable: false,
  });
  try {
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  } catch {
    const [signed] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
    });
    return signed;
  }
}

async function hydrateJobOutputWithStoredMotionUrls(admin, client, jobOutput) {
  const members = [];
  for (const member of jobOutput.members) {
    const buffer = await client.downloadMemberMotionGlb(jobOutput.jobId, member.memberId);
    const motionUrl = await uploadMotionGlbToStorage(admin, {
      groupId: jobOutput.groupId,
      songId: jobOutput.songId,
      memberId: member.memberId,
      jobId: jobOutput.jobId,
      buffer,
    });
    const updated = {
      ...member,
      motionUrl,
    };
    updated.checksum = computeGX10MemberOutputChecksumSync(updated);
    members.push(updated);
  }
  return {
    ...jobOutput,
    contractVersion: jobOutput.contractVersion || GX10_OUTPUT_CONTRACT_VERSION,
    members,
  };
}

function buildAuthorityRecords(asset, jobOutput, ingestedBy) {
  const now = new Date().toISOString();
  const memberIds = asset.members.map((m) => m.memberId).sort();
  const privateKeyPem = getSigningPrivateKeyPem();
  if (!privateKeyPem) {
    const err = new Error('PRODUCTION_AUTHORITY_SIGNING_KEY_MISSING');
    err.code = 'PRODUCTION_AUTHORITY_SIGNING_KEY_MISSING';
    throw err;
  }

  const authorityProof = {
    source: 'production_ingest',
    productionAssetId: asset.productionAssetId,
    authorityRecordId: asset.productionAssetId,
    ingestJobId: jobOutput.jobId,
    ingestedAt: now,
    ingestedBy: ingestedBy || undefined,
  };

  const authorityVersion = 1;
  const nonce = crypto.randomBytes(16).toString('hex');
  const tokenFields = createAuthorityTokenFields({
    productionAssetId: asset.productionAssetId,
    authorityRecordId: asset.productionAssetId,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds,
    authorityVersion,
    nonce,
  });
  const authorityToken = signAuthorityTokenFields(tokenFields, privateKeyPem);

  asset.productionAuthorityProof = authorityProof;
  asset.productionAuthorityToken = authorityToken;

  const authorityRecord = {
    ...authorityProof,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds,
    status: 'active',
    authorityVersion,
    nonce,
    assetHash: authorityToken.assetHash,
    authorityToken,
    updatedAt: now,
  };

  return { asset, authorityRecord };
}

async function persistProductionMotionAsset(admin, { jobOutput, ingestedBy }) {
  validateGX10JobOutputContract(jobOutput, 'real_production');
  const asset = mapJobOutputToProductionMotionAssetV2(jobOutput);
  const { asset: signedAsset, authorityRecord } = buildAuthorityRecords(asset, jobOutput, ingestedBy);

  const payload = {
    ...signedAsset,
    id: `${signedAsset.groupId}/${signedAsset.songId}`,
    version: 2,
    savedBy: ingestedBy,
    ingestSource: 'gx10_api',
    gx10JobId: jobOutput.jobId,
    gx10Provider: jobOutput.provider,
    gx10ProcessorVersion: jobOutput.processorVersion,
  };

  await admin.firestore().collection(AUTHORITY_COLLECTION).doc(signedAsset.productionAssetId).set(authorityRecord, { merge: true });
  await admin.firestore().collection(PRODUCTION_COLLECTION).doc(docId(signedAsset.groupId, signedAsset.songId)).set(payload, { merge: true });

  return {
    asset: payload,
    authorityRecord,
    productionAssetId: signedAsset.productionAssetId,
  };
}

async function writeProductionMotionFirestoreRecords(admin, signedAsset, authorityRecord, ingestedBy, jobOutput) {
  const payload = {
    ...signedAsset,
    id: `${signedAsset.groupId}/${signedAsset.songId}`,
    version: 2,
    savedBy: ingestedBy,
    ingestSource: 'gx10_api',
    gx10JobId: jobOutput.jobId,
    gx10Provider: jobOutput.provider,
    gx10ProcessorVersion: jobOutput.processorVersion,
  };

  await admin.firestore().collection(AUTHORITY_COLLECTION).doc(signedAsset.productionAssetId).set(authorityRecord, { merge: true });
  await admin.firestore().collection(PRODUCTION_COLLECTION).doc(docId(signedAsset.groupId, signedAsset.songId)).set(payload, { merge: true });

  return payload;
}

module.exports = {
  PRODUCTION_COLLECTION,
  AUTHORITY_COLLECTION,
  docId,
  mapJobOutputToProductionMotionAssetV2,
  hydrateJobOutputWithStoredMotionUrls,
  persistProductionMotionAsset,
  uploadMotionGlbToStorage,
  buildAuthorityRecords,
  writeProductionMotionFirestoreRecords,
};
