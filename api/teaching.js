// Consolidated teaching API (≤12 Vercel functions on Hobby).
// URLs: /api/teaching/:action → rewritten to ?path=:action

const path = require('path');

const HANDLERS = {
  'dance-analyze': () => require(path.join(__dirname, '../lib/api-handlers/teaching/dance-analyze')),
  'vocal-clone': () => require(path.join(__dirname, '../lib/api-handlers/teaching/vocal-clone')),
  'vocal-cover': () => require(path.join(__dirname, '../lib/api-handlers/teaching/vocal-cover')),
  'vocal-analyze': () => require(path.join(__dirname, '../lib/api-handlers/teaching/vocal-analyze')),
  'korean-analyze': () => require(path.join(__dirname, '../lib/api-handlers/teaching/korean-analyze')),
  'korean-cover': () => require(path.join(__dirname, '../lib/api-handlers/teaching/korean-cover')),
  'korean-lyrics': () => require(path.join(__dirname, '../lib/api-handlers/teaching/korean-lyrics')),
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
    return res.status(404).json({ error: 'Unknown teaching action', path: parts.join('/') });
  }
  const fn = load();
  const delegate = typeof fn === 'function' ? fn : fn.default;
  return delegate(req, res);
};
