/**
 * Avatar Asset metadata — Firestore + optional admin upload to Firebase Storage.
 * GET  ?groupId= — list assets (admin)
 * POST — register or upload avatar (admin)
 */
const { requireAdmin } = require('../../api-lib/firebaseAuth.cjs');
const { getAdmin } = require('../../api-lib/firebaseAdmin.cjs');
const { parseMultipart } = require('./mocapMultipart.cjs');

const COLLECTION = 'avatar_assets';

async function readRawBody(req) {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRawBody(req);
  if (!raw?.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return {};
  }
}

function assetIdFrom(groupId, memberId, suffix) {
  return `${groupId}__${memberId}__${suffix || Date.now()}`;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const groupId = url.searchParams.get('groupId') || '';
  const assetId = url.searchParams.get('assetId') || '';

  const { admin, error } = getAdmin();
  if (!admin) {
    return res.status(503).json({ error: 'FIREBASE_ADMIN_UNAVAILABLE', hint: error });
  }

  if (req.method === 'GET') {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status || 403).json({ error: auth.code, hint: 'Admin 권한이 필요합니다.' });
    }
    try {
      let query = admin.firestore().collection(COLLECTION);
      if (groupId) query = query.where('groupId', '==', groupId);
      if (assetId) {
        const snap = await admin.firestore().collection(COLLECTION).doc(assetId).get();
        if (!snap.exists) return res.status(404).json({ error: 'avatar_asset_not_found' });
        return res.status(200).json({ asset: snap.data() });
      }
      const snap = await query.limit(100).get();
      const assets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ assets });
    } catch (err) {
      return res.status(500).json({ error: 'avatar_list_failed', hint: err?.message });
    }
  }

  if (req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status || 403).json({ error: auth.code });
    }

    const contentType = req.headers['content-type'] || '';
    let meta = {};
    let fileBuffer = null;
    let filename = 'avatar.glb';

    if (contentType.includes('multipart/form-data')) {
      const raw = await readRawBody(req);
      const { fields, files } = parseMultipart(raw, contentType);
      meta = {
        groupId: fields.groupId,
        memberId: fields.memberId,
        memberName: fields.memberName,
        skeletonType: fields.skeletonType || 'humanoid-v1',
        format: fields.format || 'glb',
      };
      fileBuffer = files.avatar?.data || files.file?.data || null;
      filename = files.avatar?.filename || files.file?.filename || filename;
    } else {
      const body = await readJsonBody(req);
      meta = body?.asset || body || {};
    }

    if (!meta.groupId) {
      return res.status(400).json({ error: 'groupId_required' });
    }

    const id = meta.id || assetIdFrom(meta.groupId, meta.memberId || 'shared', meta.suffix);
    const now = new Date().toISOString();
    let downloadUrl = meta.url || '';

    if (fileBuffer?.length) {
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
      const bucket = admin.storage().bucket(bucketName);
      const storagePath = `production-avatars/${meta.groupId}/${id}.glb`;
      const file = bucket.file(storagePath);
      await file.save(fileBuffer, {
        metadata: { contentType: 'model/gltf-binary' },
        resumable: false,
      });
      try {
        await file.makePublic();
        downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      } catch {
        const [signed] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
        });
        downloadUrl = signed;
      }
    }

    if (!downloadUrl) {
      return res.status(400).json({ error: 'AVATAR_ASSET_MISSING', hint: 'url or file required' });
    }

    const record = {
      id,
      groupId: meta.groupId,
      memberId: meta.memberId || null,
      memberName: meta.memberName || null,
      url: downloadUrl,
      format: meta.format || 'glb',
      skeletonType: meta.skeletonType || 'humanoid-v1',
      version: Number(meta.version) || 1,
      status: 'ready',
      createdAt: meta.createdAt || now,
      updatedAt: now,
      uploadedBy: auth.uid,
    };

    try {
      await admin.firestore().collection(COLLECTION).doc(id).set(record, { merge: true });
      return res.status(200).json({ ok: true, asset: record });
    } catch (err) {
      return res.status(500).json({ error: 'avatar_save_failed', hint: err?.message });
    }
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
