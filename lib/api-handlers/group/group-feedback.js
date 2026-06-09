const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function buildFallback({ groupName, memberName, overall }) {
  if (overall >= 80) {
    return `${groupName || '그룹'}의 ${memberName || '멤버'} 파트 훌륭해요! 그룹과의 싱크가 매우 좋습니다. 무대에서도 자신감 있게 보여줄 수 있을 거예요.`;
  }
  if (overall >= 60) {
    return `${groupName || '그룹'}의 ${memberName || '멤버'} 파트 괜찮아요! 포지션 유지는 좋지만, 동작 타이밍을 조금 더 맞춰보세요.`;
  }
  return `${groupName || '그룹'}의 ${memberName || '멤버'} 파트 연습이 시작됐어요! 레퍼런스 영상을 보며 느린 템포로 반복 연습해보세요.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await readJsonBody(req);
  const {
    groupName = '그룹',
    memberName = '멤버',
    overall = 0,
    duration = 0,
    scores = {},
  } = body;

  if (!ANTHROPIC_API_KEY) {
    return res.json({
      feedback: buildFallback({ groupName, memberName, overall }),
      overall,
      source: 'fallback',
    });
  }

  try {
    const prompt = `K-POP 그룹 연습 AI 코치로서 한국어 피드백을 2-3문장으로 작성하세요.
그룹: ${groupName}
멤버 포지션: ${memberName}
싱크 점수: ${overall}/100
연습 시간: ${Math.round(duration)}초
대형 점수: ${scores.formation || 0}
포지션 점수: ${scores.position || 0}
격려와 구체적 개선점을 포함하세요.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error('AI API failed');

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim();

    return res.json({
      feedback: text || buildFallback({ groupName, memberName, overall }),
      overall,
      source: 'ai',
    });
  } catch {
    return res.json({
      feedback: buildFallback({ groupName, memberName, overall }),
      overall,
      source: 'fallback',
    });
  }
};
