// Coaching API shared helpers (Spotify + Claude based persona coaching)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function tryParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function callClaude({ system, prompt, maxTokens = 600 }) {
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, reason: 'no_api_key' };
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system: system || undefined,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }
    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = tryParseJson(text);
    if (!parsed) return { ok: false, reason: 'parse_error', raw: text };
    return { ok: true, parsed, source: 'claude' };
  } catch (err) {
    return { ok: false, reason: 'fetch_error', error: String(err?.message || err) };
  }
}

function languageLabel(language) {
  if (language === 'ja') return '日本語';
  if (language === 'en') return 'English';
  if (language === 'zh') return '中文';
  if (language === 'es') return 'Español';
  if (language === 'fr') return 'Français';
  if (language === 'th') return 'ภาษาไทย';
  if (language === 'vi') return 'Tiếng Việt';
  return '한국어';
}

module.exports = {
  readJsonBody,
  tryParseJson,
  callClaude,
  languageLabel,
};
