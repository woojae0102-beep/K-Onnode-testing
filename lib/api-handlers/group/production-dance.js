/**
 * Production Dance Asset — Firestore Source of Truth.
 * GET  (public): ready asset by groupId + songId
 * POST (admin): create/update asset
 */
const { getAdmin } = require('../../api-lib/firebaseAdmin.cjs');
const { requireAdmin } = require('../../api-lib/firebaseAuth.cjs');
const {
  createAuthorityTokenFields,
  signAuthorityTokenFields,
} = require('../../api-lib/productionAuthoritySigning.cjs');
const crypto = require('crypto');

const COLLECTION = 'production_dance_assets';
const AUTHORITY_COLLECTION = 'production_motion_authority';

function docId(groupId, songId) {
  return `${groupId}__${songId}`;
}

function getSigningPrivateKeyPem() {
  const pem = process.env.PRODUCTION_AUTHORITY_SIGNING_PRIVATE_KEY;
  if (!pem?.trim()) return null;
  return pem.replace(/\\n/g, '\n').trim();
}

function createAuthorityNonce() {
  return crypto.randomBytes(16).toString('hex');
}

function validateReadyAsset(asset) {
  const errors = [];
  if (!asset?.groupId || !asset?.songId) errors.push('group_song_required');
  if (!asset?.stage?.backgroundId) errors.push('stage_required');
  if (!Array.isArray(asset?.members) || asset.members.length === 0) {
    errors.push('MEMBER_TRACK_MAPPING_REQUIRED');
  }
  for (const m of asset?.members || []) {
    if (!m.memberId) errors.push('MEMBER_TRACK_MAPPING_REQUIRED');
    if (!m.motionAssetUrl) errors.push('MOTION_OUTPUT_INVALID');
    if (!m.avatarAssetUrl && !m.avatarAssetId) errors.push('AVATAR_ASSET_MISSING');
    if (!Array.isArray(m.formationTrack) || m.formationTrack.length === 0) {
      errors.push('formation_track_required');
    }
    if (!(m.motionDurationSec > 0)) errors.push('motion_duration_invalid');
  }
  return errors;
}

function computeStatus(asset, requestedStatus) {
  const errors = validateReadyAsset(asset);
  if (requestedStatus === 'ready') {
    return errors.length === 0 ? 'ready' : 'failed';
  }
  if (errors.length > 0 && requestedStatus !== 'draft' && requestedStatus !== 'processing') {
    return 'failed';
  }
  return requestedStatus || 'draft';
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const groupId = url.searchParams.get('groupId') || '';
  const songId = url.searchParams.get('songId') || '';
  const { admin, error } = getAdmin();

  if (req.method === 'GET') {
    if (!groupId || !songId) {
      return res.status(400).json({ error: 'groupId_and_songId_required' });
    }
    if (!admin) {
      return res.status(503).json({
        error: 'FIREBASE_ADMIN_UNAVAILABLE',
        hint: error,
      });
    }
    try {
      const snap = await admin.firestore().collection(COLLECTION).doc(docId(groupId, songId)).get();
      if (!snap.exists) {
        return res.status(404).json({
          error: 'PRODUCTION_NOT_READY',
          hint: '이 곡은 아직 Production Dance Data가 준비되지 않았습니다.',
        });
      }
      const asset = snap.data();
      if (asset.status !== 'ready') {
        return res.status(404).json({
          error: 'PRODUCTION_NOT_READY',
          status: asset.status,
          hint: 'Production Dance Data가 아직 ready 상태가 아닙니다.',
        });
      }
      if (asset.schemaVersion === 2 && asset.assetProvenance === 'real_production' && asset.productionAssetId) {
        try {
          const authSnap = await admin.firestore()
            .collection(AUTHORITY_COLLECTION)
            .doc(asset.productionAssetId)
            .get();
          if (authSnap.exists) {
            asset.productionAuthorityProof = authSnap.data();
          }
        } catch {
          /* authority record optional until real asset ingest */
        }
      }
      return res.status(200).json({ asset });
    } catch (err) {
      return res.status(500).json({
        error: 'PRODUCTION_ASSET_LOAD_FAILED',
        hint: err?.message || String(err),
      });
    }
  }

  if (req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status || 403).json({
        error: auth.code,
        hint: auth.detail || 'Admin 권한이 필요합니다.',
      });
    }
    if (!admin) {
      return res.status(503).json({ error: 'FIREBASE_ADMIN_UNAVAILABLE', hint: error });
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      return res.status(400).json({ error: 'invalid_json', hint: err?.message });
    }

    const asset = body?.asset;
    if (!asset?.groupId || !asset?.songId) {
      return res.status(400).json({ error: 'asset_groupId_songId_required' });
    }

    const now = new Date().toISOString();
    const validationErrors = validateReadyAsset(asset);
    const status = computeStatus(asset, body.status || asset.status);

    const payload = {
      ...asset,
      id: asset.id || `${asset.groupId}/${asset.songId}`,
      status,
      version: Number(asset.version) || asset.schemaVersion || 1,
      updatedAt: now,
      createdAt: asset.createdAt || now,
      savedBy: auth.uid,
      validationErrors: status === 'ready' ? [] : validationErrors,
    };

    if (asset.schemaVersion === 2 && asset.assetProvenance === 'real_production') {
      const productionAssetId = asset.productionAssetId || docId(asset.groupId, asset.songId);
      const authorityProof = {
        source: 'production_ingest',
        productionAssetId,
        authorityRecordId: productionAssetId,
        ingestJobId: body.ingestJobId || `admin-${auth.uid}-${Date.now()}`,
        ingestedAt: now,
        ingestedBy: auth.uid,
      };
      const memberIds = (asset.members || []).map((m) => m.memberId).filter(Boolean).sort();
      const privateKeyPem = getSigningPrivateKeyPem();
      if (!privateKeyPem) {
        return res.status(503).json({
          error: 'PRODUCTION_AUTHORITY_SIGNING_KEY_MISSING',
          hint: 'PRODUCTION_AUTHORITY_SIGNING_PRIVATE_KEY not configured',
        });
      }
      const authorityVersion = Number(asset.authorityVersion) || 1;
      const nonce = createAuthorityNonce();
      const tokenFields = createAuthorityTokenFields({
        productionAssetId,
        authorityRecordId: productionAssetId,
        groupId: asset.groupId,
        songId: asset.songId,
        memberIds,
        authorityVersion,
        nonce,
      });
      const authorityToken = signAuthorityTokenFields(tokenFields, privateKeyPem);
      payload.productionAssetId = productionAssetId;
      payload.productionAuthorityProof = authorityProof;
      payload.productionAuthorityToken = authorityToken;
      delete payload.trustedProvenance;
      try {
        await admin.firestore().collection(AUTHORITY_COLLECTION).doc(productionAssetId).set({
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
        }, { merge: true });
      } catch (err) {
        return res.status(500).json({
          error: 'PRODUCTION_AUTHORITY_RECORD_FAILED',
          hint: err?.message || String(err),
        });
      }
    } else if (asset.productionAuthorityProof || asset.trustedProvenance) {
      delete payload.productionAuthorityProof;
      delete payload.trustedProvenance;
    }

    try {
      await admin.firestore().collection(COLLECTION).doc(docId(asset.groupId, asset.songId)).set(payload, { merge: true });
      return res.status(200).json({ ok: true, asset: payload });
    } catch (err) {
      return res.status(500).json({
        error: 'PRODUCTION_ASSET_SAVE_FAILED',
        hint: err?.message || String(err),
      });
    }
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
