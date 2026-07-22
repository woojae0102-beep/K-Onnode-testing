/**
 * Production Motion Authority Verification (PHASE 13 / 13.5).
 * GET: Firestore lookup + identity binding + cryptographic signature verify.
 *
 * Query: productionAssetId, authorityRecordId, groupId, songId, memberIds (comma-separated)
 */
const { getAdmin } = require('../../api-lib/firebaseAdmin.cjs');
const {
  verifyAuthorityTokenSignature,
  isTokenExpired,
} = require('../../api-lib/productionAuthoritySigning.cjs');

const AUTHORITY_COLLECTION = 'production_motion_authority';

function parseMemberIds(raw) {
  if (!raw?.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean).sort();
}

function memberSetsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getVerifyPublicKeyPem() {
  const pem = process.env.PRODUCTION_AUTHORITY_SIGNING_PUBLIC_KEY
    || process.env.VITE_PRODUCTION_AUTHORITY_PUBLIC_KEY;
  if (!pem?.trim()) return null;
  return pem.replace(/\\n/g, '\n').trim();
}

function assertTokenMatchesRecord(record, token) {
  if (token.productionAssetId !== record.productionAssetId) {
    return 'token productionAssetId mismatch';
  }
  if (token.authorityRecordId !== record.authorityRecordId) {
    return 'token authorityRecordId mismatch';
  }
  if (token.groupId !== record.groupId) {
    return 'token groupId mismatch';
  }
  if (token.songId !== record.songId) {
    return 'token songId mismatch';
  }
  if (record.authorityVersion != null && token.authorityVersion !== record.authorityVersion) {
    return 'token authorityVersion mismatch';
  }
  if (record.nonce && token.nonce !== record.nonce) {
    return 'token nonce mismatch';
  }
  if (record.assetHash && token.assetHash !== record.assetHash) {
    return 'token assetHash mismatch';
  }
  const recordMemberIds = Array.isArray(record.memberIds)
    ? [...record.memberIds].sort()
    : [];
  const tokenMemberIds = Array.isArray(token.memberIds)
    ? [...token.memberIds].sort()
    : [];
  if (recordMemberIds.length && tokenMemberIds.length
    && !memberSetsEqual(recordMemberIds, tokenMemberIds)) {
    return 'token memberIds mismatch';
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const productionAssetId = url.searchParams.get('productionAssetId') || '';
  const authorityRecordId = url.searchParams.get('authorityRecordId') || '';
  const groupId = url.searchParams.get('groupId') || '';
  const songId = url.searchParams.get('songId') || '';
  const memberIds = parseMemberIds(url.searchParams.get('memberIds') || '');

  if (!productionAssetId || !authorityRecordId || !groupId || !songId) {
    return res.status(400).json({
      error: 'PRODUCTION_AUTHORITY_VERIFICATION_FAILED',
      hint: 'productionAssetId, authorityRecordId, groupId, songId required',
    });
  }

  const { admin, error } = getAdmin();
  if (!admin) {
    return res.status(503).json({
      error: 'PRODUCTION_AUTHORITY_VERIFICATION_FAILED',
      hint: error || 'FIREBASE_ADMIN_UNAVAILABLE',
    });
  }

  try {
    const snap = await admin.firestore()
      .collection(AUTHORITY_COLLECTION)
      .doc(authorityRecordId)
      .get();

    if (!snap.exists) {
      return res.status(404).json({
        error: 'PRODUCTION_AUTHORITY_NOT_FOUND',
        verified: false,
      });
    }

    const record = snap.data();

    if (record.status === 'revoked') {
      return res.status(403).json({
        error: 'PRODUCTION_AUTHORITY_REVOKED',
        verified: false,
      });
    }

    if (record.productionAssetId !== productionAssetId) {
      return res.status(409).json({
        error: 'PRODUCTION_AUTHORITY_MISMATCH',
        hint: 'productionAssetId mismatch',
        verified: false,
      });
    }

    if (record.authorityRecordId && record.authorityRecordId !== authorityRecordId) {
      return res.status(409).json({
        error: 'PRODUCTION_AUTHORITY_MISMATCH',
        hint: 'authorityRecordId mismatch',
        verified: false,
      });
    }

    if (record.groupId !== groupId) {
      return res.status(409).json({
        error: 'PRODUCTION_AUTHORITY_MISMATCH',
        hint: 'groupId mismatch',
        verified: false,
      });
    }

    if (record.songId !== songId) {
      return res.status(409).json({
        error: 'PRODUCTION_AUTHORITY_MISMATCH',
        hint: 'songId mismatch',
        verified: false,
      });
    }

    const recordMemberIds = Array.isArray(record.memberIds)
      ? [...record.memberIds].sort()
      : [];

    if (memberIds.length && recordMemberIds.length && !memberSetsEqual(memberIds, recordMemberIds)) {
      return res.status(409).json({
        error: 'PRODUCTION_AUTHORITY_MISMATCH',
        hint: 'memberIds mismatch',
        verified: false,
      });
    }

    const token = record.authorityToken;
    if (!token?.signature) {
      return res.status(403).json({
        error: 'PRODUCTION_AUTHORITY_SIGNATURE_INVALID',
        hint: 'authority token missing',
        verified: false,
      });
    }

    const publicKeyPem = getVerifyPublicKeyPem();
    if (!publicKeyPem) {
      return res.status(503).json({
        error: 'PRODUCTION_AUTHORITY_VERIFICATION_FAILED',
        hint: 'PRODUCTION_AUTHORITY_SIGNING_PUBLIC_KEY not configured',
        verified: false,
      });
    }

    if (isTokenExpired(token)) {
      return res.status(403).json({
        error: 'PRODUCTION_AUTHORITY_EXPIRED',
        verified: false,
      });
    }

    if (!verifyAuthorityTokenSignature(token, publicKeyPem)) {
      return res.status(403).json({
        error: 'PRODUCTION_AUTHORITY_SIGNATURE_INVALID',
        hint: 'signature verification failed',
        verified: false,
      });
    }

    const tokenBindingError = assertTokenMatchesRecord(record, token);
    if (tokenBindingError) {
      return res.status(409).json({
        error: 'PRODUCTION_AUTHORITY_MISMATCH',
        hint: tokenBindingError,
        verified: false,
      });
    }

    const verifiedAt = new Date().toISOString();
    return res.status(200).json({
      verified: true,
      verification: {
        verified: true,
        signatureVerified: true,
        productionAssetId: record.productionAssetId,
        authorityRecordId,
        groupId: record.groupId,
        songId: record.songId,
        memberIds: recordMemberIds.length ? recordMemberIds : memberIds,
        verifiedAt,
        status: record.status || 'active',
        authorityVersion: token.authorityVersion,
        authorityToken: token,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: 'PRODUCTION_AUTHORITY_VERIFICATION_FAILED',
      hint: err?.message || String(err),
      verified: false,
    });
  }
};
