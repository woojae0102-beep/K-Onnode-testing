const { getJudge, getAgency, pickFallbackReaction } = require('../_lib/agencyJudges');

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
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

async function callClaude({ systemPrompt, userPrompt }) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('NO_API_KEY');
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 60,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CLAUDE_FAIL_${res.status}_${text.slice(0, 80)}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  return text.replace(/[\r\n"]+/g, ' ').trim().slice(0, 14);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { agencyId, judgeId, currentData, elapsedSeconds, roundType } = body || {};

  if (!agencyId || !judgeId) {
    return res.status(400).json({ error: 'agencyId and judgeId are required' });
  }

  const judge = getJudge(judgeId);
  const agency = getAgency(agencyId);

  if (!judge || !agency) {
    return res.status(404).json({ error: 'Unknown agency or judge' });
  }

  const fallback = pickFallbackReaction(agencyId);

  if (!ANTHROPIC_API_KEY) {
    return res.status(200).json({ message: fallback, source: 'fallback' });
  }

  const userPrompt = [
    `기획사: ${agency.name}`,
    `현재 데이터: ${JSON.stringify(currentData || {})}`,
    `경과 시간: ${elapsedSeconds || 0}초`,
    `라운드: ${roundType || 'free'}`,
    `${agency.name} 스타일에 맞는 10자 이내의 짧은 코멘트만 출력하세요. 따옴표 없이.`,
  ].join('\n');

  try {
    const message = await callClaude({
      systemPrompt: judge.systemPrompt,
      userPrompt,
    });
    return res.status(200).json({
      message: message || fallback,
      source: message ? 'claude' : 'fallback',
    });
  } catch (err) {
    return res.status(200).json({
      message: fallback,
      source: 'fallback',
      error: String(err?.message || err),
    });
  }
};
