const { getJudge, getAgency } = require('../_lib/agencyJudges');

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

const LANGUAGE_NOTE = {
  ko: '반응(reaction)과 followUpQuestion은 한국어로 작성하세요.',
  en: 'Write reaction and followUpQuestion in English.',
  ja: 'reaction と followUpQuestion は日本語で書いてください。',
  th: 'เขียน reaction และ followUpQuestion เป็นภาษาไทย',
  vi: 'Viết reaction và followUpQuestion bằng tiếng Việt.',
  es: 'Escribe reaction y followUpQuestion en español.',
  fr: 'Écris reaction et followUpQuestion en français.',
  zh: 'reaction 和 followUpQuestion 请用中文写。',
};

function fallbackEvaluation(judge, answer) {
  const length = String(answer || '').trim().length;
  const baseScore = length === 0 ? 35 : Math.min(85, 50 + Math.min(35, Math.round(length / 4)));
  return {
    reaction: length === 0
      ? '대답이 잘 안 들렸어요. 한 번 더 부탁드릴게요.'
      : `${judge?.name || '심사위원'}이(가) 고개를 끄덕입니다. 잘 들었어요.`,
    score: baseScore,
    followUpQuestion: null,
    evaluation: {
      sincerity: baseScore,
      clarity: Math.max(40, baseScore - 5),
      motivation: Math.max(40, baseScore - 10),
    },
  };
}

function tryParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalize(result, fb) {
  if (!result) return fb;
  const score = Number(result.score);
  const evaluation = result.evaluation && typeof result.evaluation === 'object' ? result.evaluation : fb.evaluation;
  return {
    reaction: String(result.reaction || fb.reaction).slice(0, 240),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : fb.score,
    followUpQuestion: result.followUpQuestion && result.followUpQuestion !== 'null'
      ? String(result.followUpQuestion).slice(0, 200)
      : null,
    evaluation: {
      sincerity: Number(evaluation.sincerity) || fb.evaluation.sincerity,
      clarity: Number(evaluation.clarity) || fb.evaluation.clarity,
      motivation: Number(evaluation.motivation) || fb.evaluation.motivation,
    },
  };
}

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 320,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CLAUDE_FAIL_${res.status}_${text.slice(0, 80)}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { agencyId, judgeId, question, answer, language } = body || {};
  if (!agencyId || !judgeId) {
    return res.status(400).json({ error: 'agencyId and judgeId are required' });
  }

  const judge = getJudge(judgeId);
  const agency = getAgency(agencyId);
  if (!judge || !agency) {
    return res.status(404).json({ error: 'Unknown agency or judge' });
  }

  const fb = fallbackEvaluation(judge, answer);

  if (!ANTHROPIC_API_KEY) {
    return res.status(200).json({ ...fb, source: 'fallback' });
  }

  const langNote = LANGUAGE_NOTE[language] || LANGUAGE_NOTE.ko;
  const prompt = `${judge.systemPrompt}

당신은 ${agency.name}의 인터뷰 심사위원입니다.

연습생이 다음 질문에 이렇게 대답했습니다.

질문: "${String(question || '').slice(0, 240)}"
대답: "${String(answer || '').slice(0, 600)}"

평가 기준:
1. 진정성 (sincerity)
2. 답변의 명확성 (clarity)
3. 동기/열정 (motivation)

${langNote}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트/코드펜스 금지.
{
  "reaction": "심사위원의 즉각 반응 (1~2문장)",
  "score": 75,
  "followUpQuestion": "추가 질문 또는 null",
  "evaluation": {
    "sincerity": 80,
    "clarity": 70,
    "motivation": 85
  }
}`;

  try {
    const raw = await callClaude(prompt);
    const parsed = tryParseJson(raw);
    return res.status(200).json({ ...normalize(parsed, fb), source: parsed ? 'claude' : 'fallback' });
  } catch (err) {
    return res.status(200).json({ ...fb, source: 'fallback', error: String(err?.message || err) });
  }
};
