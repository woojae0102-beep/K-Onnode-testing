/** 오디션 플로우 / 질문 생성용 Claude 호출 헬퍼 */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function tryParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* noop */
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * system: 장문 시스템 프롬프트
 * userContent: 문자열 또는 직렬화할 객체(JSON)
 */
async function completeJson({ system, userContent, maxTokens = 4096 }) {
  if (!ANTHROPIC_API_KEY) return { parsed: null, raw: '', skipped: true };
  const userText = typeof userContent === 'string' ? userContent : JSON.stringify(userContent, null, 2);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userText }],
    }),
  });
  if (!res.ok) return { parsed: null, raw: '', error: `HTTP_${res.status}` };
  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  return { parsed: tryParseJson(text), raw: text };
}

module.exports = {
  ANTHROPIC_API_KEY,
  readJsonBody,
  tryParseJson,
  completeJson,
};
