const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
const { buildTrainerRagContext, buildTrainerSystemPrompt } = require('../../trainer-knowledge/engine');

const AGENCY_STYLES = {
  hybe: 'HYBE 코치 — 음악성과 표현력 중심, 감성적이고 격려하는 톤',
  jyp: 'JYP 코치 — 정확성과 라이브 능력 중심, 즉각적이고 기술적인 교정',
  sm: 'SM 코치 — 디테일과 아우라 중심, 완성도와 끝처리 강조',
  yg: 'YG 코치 — 카리스마와 스타성 중심, 강렬하고 에너지 넘치는 톤',
};

function personaForAgency(agency, mode) {
  if (agency === 'jyp') return 'jyp';
  if (agency === 'yg') return 'yg';
  if (agency === 'starship') return 'starship';
  return mode === 'vocal' ? 'kpopVocalMaster' : 'liaKim';
}

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

  const mode = sessionSummary?.mode || 'dance';
  const rag = await buildTrainerRagContext({
    query: isSessionReview
      ? `mode:${mode} score:${sessionSummary.overallScore || avgAccuracy} strengths:${(sessionSummary.strengths || []).join(',')} weaknesses:${(sessionSummary.weaknesses || []).join(',')}`
      : `mode:${mode} weak joint ${jointInfo} average accuracy ${avgAccuracy}`,
    domain: mode === 'vocal' ? 'vocal' : 'dance',
    personaId: personaForAgency(agency, mode),
    topK: isSessionReview ? 5 : 3,
  });

  const systemPrompt = buildTrainerSystemPrompt({
    persona: rag.persona,
    domain: rag.domain,
    contextText: rag.contextText,
  }) + `\n응답 언어: ${language === 'ko' ? '한국어' : '영어'}.\n${AGENCY_STYLES[agency] || AGENCY_STYLES.hybe}`;

  const userPrompt = isSessionReview
    ? `연습 종료 리포트입니다. 종합 점수: ${sessionSummary.overallScore || avgAccuracy}. 강점: ${(sessionSummary.strengths || []).join(', ') || '없음'}. 보완점: ${(sessionSummary.weaknesses || []).join(', ') || '없음'}. 모드: ${mode}. 3~4문장으로 왜 틀렸는지, 어떻게 고칠지, 오늘 연습 과제를 설명하세요.`
    : `실시간 분석입니다. 관절 분석: ${jointInfo}, 평균 정확도: ${avgAccuracy}%. 한 문장 안에 원인과 즉시 고칠 큐를 포함하세요.`;

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
      source: rag.results?.length ? 'trainer_knowledge_rag' : 'ai',
      knowledgeSource: rag.source,
    });
  } catch {
    return res.json({
      feedback: poolFallback(agency, avgAccuracy),
      accuracy: avgAccuracy,
      source: 'pool',
    });
  }
};
