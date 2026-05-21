// Spotify Client Credentials Flow — server-only token issuance.
// Reads SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET from process.env.
// Caches the token in memory so we don't re-issue on every call.

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

let cached = { token: '', expiresAt: 0 };

async function fetchToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return { ok: false, reason: 'no_credentials' };
  }
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const data = await res.json();
    if (!data?.access_token) return { ok: false, reason: 'no_token_in_response' };
    return {
      ok: true,
      token: data.access_token,
      expiresIn: Number(data.expires_in) || 3600,
    };
  } catch (err) {
    return { ok: false, reason: 'fetch_error', error: String(err?.message || err) };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const now = Date.now();
  if (cached.token && cached.expiresAt > now + 30_000) {
    return res.status(200).json({ access_token: cached.token, cached: true });
  }
  const result = await fetchToken();
  if (!result.ok) {
    return res.status(200).json({ access_token: '', error: result.reason, error_detail: result.error });
  }
  cached = {
    token: result.token,
    expiresAt: now + result.expiresIn * 1000,
  };
  return res.status(200).json({ access_token: result.token, cached: false });
};
