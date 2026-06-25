// Consolidated group practice API
// URLs: /api/group/:action → rewritten to ?path=:action

const path = require('path');

const HANDLERS = {
  'extract-skeleton': () => require(path.join(__dirname, '../lib/api-handlers/group/extract-skeleton')),
  'group-feedback': () => require(path.join(__dirname, '../lib/api-handlers/group/group-feedback')),
  'youtube-search': () => require(path.join(__dirname, '../lib/api-handlers/group/youtube-search')),
  'video-metadata': () => require(path.join(__dirname, '../lib/api-handlers/group/video-metadata')),
  'proxy-video': () => require(path.join(__dirname, '../lib/api-handlers/group/proxy-video')),
  'analyze-formation': () => require(path.join(__dirname, '../lib/api-handlers/group/analyze-formation')),
  'shorts-upload': () => require(path.join(__dirname, '../lib/api-handlers/group/shorts-upload')),
};

function getRouteParts(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const raw = url.searchParams.get('path') || '';
  return raw.split('/').filter(Boolean);
}

module.exports = async function handler(req, res) {
  const parts = getRouteParts(req);
  const action = parts[0] || '';
  const load = HANDLERS[action];
  if (!load) {
    return res.status(404).json({ error: 'Unknown group action', path: parts.join('/') });
  }
  try {
    const fn = load();
    const delegate = typeof fn === 'function' ? fn : fn.default;
    return await delegate(req, res);
  } catch (err) {
    console.error('[group]', action, err?.message || err);
    if (!res.headersSent) {
      return res.status(502).json({
        error: err?.message || 'group_handler_failed',
        hint: '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 영상 파일을 직접 업로드해 주세요.',
      });
    }
    return undefined;
  }
};
