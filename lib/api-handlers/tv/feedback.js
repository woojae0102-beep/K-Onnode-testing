const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const AGENCY_STYLES = {
  hybe: 'HYBE 코치 — 음악성과 표현력 중심, 감성적이고 격려하는 톤',
  jyp: 'JYP 코치 — 정확성과 라이브 능력 중심, 즉각적이고 기술적인 교정',
  sm: 'SM 코치 — 디테일과 아우라 중심, 완성도와 끝처리 강조',
  yg: 'YG 코치 — 카리스마와 스타성 중심, 강렬하고 에너지 넘치는 톤',
};

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function poolFallback(agency, accuracy) {
  const pools = {
    hybe: accuracy > 70
      ? ['표현력이 살아있어요. 그 느낌 유지하세요.', '음악성이 좋아지고 있어요.']
      : ['감정을 더 실어서 표현해보세요.', '자기만의 스타일을 찾아보세요.'],
    jyp: accuracy > 70
      ? ['정확해요! 박자도 잘 맞고 있어요.', '라이브 능력이 보여요. 계속!']
      : ['박자에 더 집중해보세요.', '동작 타이밍을 정확하게 맞춰요.'],
    sm: accuracy > 70
      ? ['디테일이 살아있어요. SM 느낌이 나요.', '아우라가 좋아지고 있어요.']
      : ['끝동작 디테일을 신경써보세요.', '각도를 더 선명하게 만들어보세요.'],
    yg: accuracy > 70
      ? ['카리스마가 보여요! 에너지 유지!', '스타성이 느껴져요. 더 강하게!']
      : ['더 강한 에너지로 던져보세요.', '무대를 장악하는 느낌을 내보세요.'],
  };
  const list = pools[agency] || pools.hybe;
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await readJsonBody(req);
  const { poseData, agency = 'hybe', language = 'ko', sessionSummary } = body;

  const accuracies = poseData?.jointAccuracies || {};
  const values = Object.values(accuracies);
  const avgAccuracy = values.length
    ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
    : sessionSummary?.overallScore || 50;

  const isSessionReview = Boolean(sessionSummary);

  if (!ANTHROPIC_API_KEY) {
    const fallback = isSessionReview
      ? `${sessionSummary.weaknesses?.[0] || '기본 동작'}을 보완하면 좋아요. ${poolFallback(agency, avgAccuracy)}`
      : poolFallback(agency, avgAccuracy);
    return res.json({
      feedback: fallback,
      accuracy: avgAccuracy,
      source: 'pool',
    });
  }

  const worstJoint = Object.entries(accuracies).sort(([, a], [, b]) => a - b)[0];
  const jointInfo = worstJoint ? `${worstJoint[0]}: ${Math.round(worstJoint[1])}%` : '전체';

  const systemPrompt = isSessionReview
    ? `${AGENCY_STYLES[agency] || AGENCY_STYLES.hybe}. 연습 세션 종료 후 연습생에게 3~4문장으로 부족한 점과 다음 연습 방향을 ${language === 'ko' ? '한국어' : '영어'}로 따뜻하게 말하세요.`
    : `${AGENCY_STYLES[agency] || AGENCY_STYLES.hybe}. 한 문장으로 짧고 명확한 실시간 코칭 피드백을 ${language === 'ko' ? '한국어' : '영어'}로 제공하세요.`;

  const userPrompt = isSessionReview
    ? `종합 점수: ${sessionSummary.overallScore || avgAccuracy}. 강점: ${(sessionSummary.strengths || []).join(', ') || '없음'}. 보완점: ${(sessionSummary.weaknesses || []).join(', ') || '없음'}. 모드: ${sessionSummary.mode || 'dance'}.`
    : `관절 분석: ${jointInfo}, 평균 정확도: ${avgAccuracy}%. 지금 이 순간 연습생에게 줄 코칭 한 문장.`;

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
        max_tokens: isSessionReview ? 400 : 200,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt,
        }],
      }),
    });

    if (!response.ok) {
      return res.json({
        feedback: poolFallback(agency, avgAccuracy),
        accuracy: avgAccuracy,
        source: 'pool',
      });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text?.trim() || poolFallback(agency, avgAccuracy);

    return res.json({
      feedback: text,
      accuracy: avgAccuracy,
      source: 'ai',
    });
  } catch {
    return res.json({
      feedback: poolFallback(agency, avgAccuracy),
      accuracy: avgAccuracy,
      source: 'pool',
    });
  }
};
