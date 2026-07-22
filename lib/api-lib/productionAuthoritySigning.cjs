/**
 * Production Authority Token — canonical payload + identity hash (PHASE 13.5).
 * Shared between server signing and client verification.
 */
const AUTHORITY_TOKEN_VERSION = 1;
const AUTHORITY_ISSUER = 'k-onnode-production-authority';
const AUTHORITY_ALGORITHM = 'RSASSA-PKCS1-v1_5-SHA256';

function sortedMemberIds(memberIds) {
  return [...memberIds].map((id) => String(id).trim()).filter(Boolean).sort();
}

function buildCanonicalTokenPayload(fields) {
  return JSON.stringify({
    version: fields.version,
    issuer: fields.issuer,
    issuedAt: fields.issuedAt,
    expiresAt: fields.expiresAt,
    productionAssetId: fields.productionAssetId,
    authorityRecordId: fields.authorityRecordId,
    groupId: fields.groupId,
    songId: fields.songId,
    memberIds: sortedMemberIds(fields.memberIds),
    authorityVersion: fields.authorityVersion,
    nonce: fields.nonce,
    assetHash: fields.assetHash,
    algorithm: fields.algorithm,
  });
}

function computeAssetIdentityHash({ productionAssetId, groupId, songId, memberIds }) {
  const canonical = JSON.stringify({
    productionAssetId: String(productionAssetId).trim(),
    groupId: String(groupId).trim(),
    songId: String(songId).trim(),
    memberIds: sortedMemberIds(memberIds),
  });
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function createAuthorityTokenFields(input) {
  const memberIds = sortedMemberIds(input.memberIds);
  const assetHash = computeAssetIdentityHash({
    productionAssetId: input.productionAssetId,
    groupId: input.groupId,
    songId: input.songId,
    memberIds,
  });
  const issuedAt = input.issuedAt || new Date().toISOString();
  const expiresAt = input.expiresAt || new Date(Date.now() + (input.ttlSec || 365 * 24 * 60 * 60) * 1000).toISOString();
  return {
    version: AUTHORITY_TOKEN_VERSION,
    issuer: AUTHORITY_ISSUER,
    issuedAt,
    expiresAt,
    productionAssetId: String(input.productionAssetId).trim(),
    authorityRecordId: String(input.authorityRecordId).trim(),
    groupId: String(input.groupId).trim(),
    songId: String(input.songId).trim(),
    memberIds,
    authorityVersion: Number(input.authorityVersion) || 1,
    nonce: String(input.nonce).trim(),
    assetHash,
    algorithm: AUTHORITY_ALGORITHM,
  };
}

function signAuthorityTokenFields(fields, privateKeyPem) {
  const crypto = require('crypto');
  const canonical = buildCanonicalTokenPayload(fields);
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(canonical);
  sign.end();
  const signature = sign.sign(privateKeyPem, 'base64');
  return { ...fields, signature };
}

function verifyAuthorityTokenSignature(token, publicKeyPem) {
  if (!token?.signature) return false;
  const crypto = require('crypto');
  const { signature, ...fields } = token;
  const canonical = buildCanonicalTokenPayload(fields);
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(canonical);
  verify.end();
  return verify.verify(publicKeyPem, signature, 'base64');
}

function isTokenExpired(token, nowMs = Date.now()) {
  const expiresMs = Date.parse(token.expiresAt);
  return !Number.isFinite(expiresMs) || expiresMs <= nowMs;
}

module.exports = {
  AUTHORITY_TOKEN_VERSION,
  AUTHORITY_ISSUER,
  AUTHORITY_ALGORITHM,
  buildCanonicalTokenPayload,
  computeAssetIdentityHash,
  createAuthorityTokenFields,
  signAuthorityTokenFields,
  verifyAuthorityTokenSignature,
  isTokenExpired,
  sortedMemberIds,
};
