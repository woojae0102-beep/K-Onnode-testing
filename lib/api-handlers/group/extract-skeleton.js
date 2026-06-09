async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await readJsonBody(req);
  const { groupId, memberCount, frameCount } = body;

  return res.json({
    ok: true,
    message: '스켈레톤 추출은 클라이언트 MediaPipe에서 처리됩니다. 원본 영상은 저장되지 않습니다.',
    groupId: groupId || null,
    memberCount: memberCount || 0,
    frameCount: frameCount || 0,
    storagePolicy: 'skeleton-only',
    receivedAt: new Date().toISOString(),
  });
};
