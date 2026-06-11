// Consolidated group practice API
// URLs: /api/group/:action → rewritten to ?path=:action

const path = require('path');

const HANDLERS = {
  'extract-skeleton': () => require(path.join(__dirname, '../lib/api-handlers/group/extract-skeleton')),
  'group-feedback': () => require(path.join(__dirname, '../lib/api-handlers/group/group-feedback')),
  'youtube-search': () => require(path.join(__dirname, '../lib/api-handlers/group/youtube-search')),
  'video-metadata': () => require(path.join(__dirname, '../lib/api-handlers/group/video-metadata')),
  'proxy-video': () => require(path.join(__dirname, '../lib/api-handlers/group/proxy-video')),
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
  const fn = load();
  const delegate = typeof fn === 'function' ? fn : fn.default;
  return delegate(req, res);
};
