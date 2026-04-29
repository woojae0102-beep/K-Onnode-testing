const { getJudge, getAgency } = require('../_lib/agencyJudges');
const { pickQuestion, getPhaseFallback } = require('../_lib/judgeQuestions');

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

const PHASE_INSTRUCTIONS = {
  greeting: `오디션이 막 시작됐습니다. 연습생이 입장했습니다.
당신의 성격에 맞게 인사하고 첫 마디를 건네세요.
짧고 임팩트 있게. 2~3문장 이내. 반드시 연습생이 자기소개나 한 마디를 하도록 유도하세요.
이 단계는 보통 requiresResponse: true, responseType: "voice" 입니다.`,

  instruction_vocal: `이제 보컬 실기를 시킬 차례입니다.
당신의 성격과 기획사 스타일에 맞게 노래를 시키세요.
구체적으로: 자유곡 1절인지, 고음 구간인지, 어떤 분위기인지 한 가지 정해주세요.
type: "instruction", responseType: "action", actionType: "sing", duration: 60~90.`,

  instruction_dance: `이제 댄스 실기를 시킬 차례입니다.
당신 기획사 스타일에 맞게 댄스를 지시하세요.
자유댄스인지, 특정 스타일인지, 몇 초 정도 보고 싶은지 구체적으로.
type: "instruction", responseType: "action", actionType: "dance", duration: 30~60.`,

  react_performance: `연습생이 실기를 진행 중입니다.
데이터를 보고 당신 성격에 맞게 짧게 한 마디 던지세요.
12자 이내. 긍정/부정/지적 중 하나. type: "reaction", requiresResponse: false.`,

  additional_instruction: `첫 번째 실기가 끝났습니다.
당신의 기준에서 부족했던 부분이나 더 보고 싶은 것을 추가로 시키세요.
"이번엔 더 느리게", "고음 구간만 다시", "랩 해보세요" 식으로 한 가지 콕 집어서.
type: "instruction", responseType: "action", duration: 20~40.`,

  interview: `이제 인터뷰 단계입니다.
당신의 성격과 기획사 스타일에 맞는 질문을 하나 하세요.
연습생이 마이크로 답해야 하는 질문이어야 합니다.
type: "question", requiresResponse: true, responseType: "voice", duration: 25~35.`,

  react_answer: `연습생이 직전 질문에 어떤 대답을 했습니다.
대답을 한 줄 요약해서 인용하지 말고, 당신 성격에 맞춰 즉각 반응하세요.
1~2문장. 추가 짧은 질문을 해도 됩니다.
type: "reaction" 또는 "question". 추가 질문이면 requiresResponse: true.`,

  deliberation: `다른 심사위원들과 최종 평의 중입니다.
오늘 오디션 전반에 대한 짧은 총평을 한마디 하세요.
당신의 성격 그대로, 1~2문장. type: "comment", requiresResponse: false.`,
};

const LANGUAGE_NOTE = {
  ko: '한국어로 답하세요.',
  en: 'Respond in English. Keep the persona intact.',
  ja: '日本語で答えてください。キャラクター性は保ってください。',
  th: 'ตอบเป็นภาษาไทย โดยรักษาบุคลิกของกรรมการ',
  vi: 'Trả lời bằng tiếng Việt, giữ đúng tính cách giám khảo.',
  es: 'Responde en español manteniendo la personalidad.',
  fr: 'Réponds en français en gardant la personnalité.',
  zh: '请用中文回答，保持评委的个性。',
};

function buildPrompt({ judge, agency, phase, previousResponse, analysisData, conversationHistory, language }) {
  const phaseHint = PHASE_INSTRUCTIONS[phase] || PHASE_INSTRUCTIONS.greeting;
  const langNote = LANGUAGE_NOTE[language] || LANGUAGE_NOTE.ko;

  const history = Array.isArray(conversationHistory)
    ? conversationHistory.slice(-4).map((m) => `- ${m.judgeId || 'judge'}: ${m.text || ''}`).join('\n')
    : '';

  return `${judge.systemPrompt}

[현재 상황]
- 기획사: ${agency.name}
- 페이즈: ${phase}
${previousResponse ? `- 연습생의 직전 발화: "${String(previousResponse).slice(0, 200)}"` : ''}
${analysisData ? `- 실기 분석 데이터: ${JSON.stringify(analysisData).slice(0, 200)}` : ''}

[최근 대화]
${history || '- (대화 시작)'}

[지시]
${phaseHint}

${langNote}

반드시 아래 JSON 형식으로만 응답하세요. 다른 설명/마크다운/코드펜스 절대 금지.
{
  "text": "심사위원이 실제로 말하는 문장",
  "type": "instruction|reaction|question|comment",
  "requiresResponse": true,
  "responseType": "voice|action|none",
  "actionType": "sing|dance|rap|introduce|null",
  "duration": 60
}`;
}

function tryParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Sometimes the model wraps the JSON in surrounding text.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalize(result, fallback) {
  const merged = { ...fallback, ...(result || {}) };
  return {
    text: String(merged.text || fallback.text || '').slice(0, 280),
    type: ['instruction', 'reaction', 'question', 'comment'].includes(merged.type) ? merged.type : (fallback.type || 'instruction'),
    requiresResponse: typeof merged.requiresResponse === 'boolean' ? merged.requiresResponse : !!fallback.requiresResponse,
    responseType: ['voice', 'action', 'none'].includes(merged.responseType) ? merged.responseType : (fallback.responseType || 'none'),
    actionType: merged.actionType && merged.actionType !== 'null' ? merged.actionType : (fallback.actionType || null),
    duration: Number.isFinite(merged.duration) ? merged.duration : (fallback.duration || 30),
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
      max_tokens: 280,
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
  const {
    agencyId,
    judgeId,
    phase,
    previousResponse,
    analysisData,
    conversationHistory,
    language,
  } = body || {};

  if (!agencyId || !judgeId || !phase) {
    return res.status(400).json({ error: 'agencyId, judgeId, phase are required' });
  }

  const judge = getJudge(judgeId);
  const agency = getAgency(agencyId);
  if (!judge || !agency) {
    return res.status(404).json({ error: 'Unknown agency or judge' });
  }

  const fallback = { ...getPhaseFallback(agencyId, phase) };

  // For interview turns, swap in a question from the judge-specific pool so
  // even the fallback feels personalised.
  if (phase === 'interview') {
    const judgeQ = pickQuestion(judgeId);
    if (judgeQ) {
      fallback.text = judgeQ;
      fallback.type = 'question';
      fallback.requiresResponse = true;
      fallback.responseType = 'voice';
    }
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(200).json({ ...normalize(null, fallback), source: 'fallback' });
  }

  try {
    const prompt = buildPrompt({
      judge,
      agency,
      phase,
      previousResponse,
      analysisData,
      conversationHistory,
      language: language || 'ko',
    });
    const raw = await callClaude(prompt);
    const parsed = tryParseJson(raw);
    if (!parsed || !parsed.text) {
      return res.status(200).json({ ...normalize(null, fallback), source: 'fallback' });
    }
    return res.status(200).json({ ...normalize(parsed, fallback), source: 'claude' });
  } catch (err) {
    return res.status(200).json({
      ...normalize(null, fallback),
      source: 'fallback',
      error: String(err?.message || err),
    });
  }
};
