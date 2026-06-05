// Consolidated TV mode API (≤12 Vercel functions on Hobby).
// URLs: /api/tv/:action → rewritten to ?path=:action

const path = require('path');

const HANDLERS = {
  feedback: () => require(path.join(__dirname, '../lib/api-handlers/tv/feedback')),
  'training-result': () => require(path.join(__dirname, '../lib/api-handlers/tv/training-result')),
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
    return res.status(404).json({ error: 'Unknown TV action', path: parts.join('/') });
  }
  const fn = load();
  const delegate = typeof fn === 'function' ? fn : fn.default;
  return delegate(req, res);
};
