const { getJudge, getAgency } = require('../_lib/agencyJudges');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const FALLBACK_FEEDBACKS = {
  hybe: [
    {
      summary: '음악적 진심이 보였습니다. 트레이닝 후 6개월 정도면 분명 성장 가능합니다.',
      strengths: '자기만의 색깔, 음악적 감수성',
      improvements: '음정 안정성, 호흡 컨트롤',
      signature: '지금 실력이 아니라 6개월 후가 보입니다',
    },
    {
      summary: '진정성은 느껴졌어요. 무대 위 아우라가 더 필요합니다.',
      strengths: '꾸미지 않은 자연스러움',
      improvements: '무대 장악력, 표정 디테일',
      signature: '진짜를 찾고 있어요',
    },
    {
      summary: 'Globally speaking, vision이 더 분명했으면 좋겠습니다.',
      strengths: '잠재력 있음',
      improvements: '글로벌 어필, 스타성',
      signature: 'HYBE is global. Can you be global too?',
    },
  ],
  yg: [
    {
      summary: '솔직히 지금 실력으로는 YG 무대에 설 수 없습니다. 처음 3초 임팩트가 부족했습니다.',
      strengths: '의지는 보임',
      improvements: '실력, 임팩트, YG 감성',
      signature: '여기서 타협은 없어요',
    },
    {
      summary: 'BLACKPINK 기준으로 보면 디테일이 부족합니다. 카운트마다 흐트러짐이 보였습니다.',
      strengths: '체력은 좋음',
      improvements: '동작 정확도, 표정 처리',
      signature: '춤은 기술이 아니라 태도입니다',
    },
    {
      summary: 'Real talk — 진정성은 느껴졌는데 기술이 따라가지 못했습니다. Keep practicing.',
      strengths: '진정성 OK',
      improvements: '플로우, 딜리버리',
      signature: 'Keep it real. YG는 가짜를 싫어해',
    },
  ],
  jyp: [
    {
      summary: '노래에서 살짝 습관이 느껴졌어요. 힘을 더 빼면 훨씬 좋아질 거예요.',
      strengths: '음색이 매력적',
      improvements: '비브라토, 공기 반 소리 반',
      signature: '노래에 습관이 없어야 합니다. 자연스럽게',
    },
    {
      summary: '에너지는 정말 좋았어요! 후반부에 표정이 굳어졌어요.',
      strengths: '밝은 에너지, 즐기는 모습',
      improvements: '체력, 안무 정확도',
      signature: '에너지 + 정확도 = JYP 댄서',
    },
    {
      summary: '인터뷰 답변에서 진정성이 느껴졌어요. JYP가 추구하는 좋은 사람의 모습이 보였습니다.',
      strengths: '겸손함, 솔직함',
      improvements: '구체적 목표 표현',
      signature: '좋은 사람이 좋은 아티스트가 됩니다',
    },
  ],
  sm: [
    {
      summary: 'SM 아우라는 보였습니다. 비주얼 임팩트가 첫 3초에 부족했습니다.',
      strengths: '무대 매너, 음색의 특별함',
      improvements: '스타일링 방향, 시선 처리',
      signature: 'SM의 기준은 K-POP의 기준입니다',
    },
    {
      summary: '보컬 기본기는 좋습니다. SMP 특유의 드라마틱 표현이 부족했어요.',
      strengths: '발성, 호흡 안정',
      improvements: '감정 디테일, 시선 처리',
      signature: '기술 위에 예술, 예술 위에 아우라',
    },
    {
      summary: '미디어 어필 가능성은 보입니다. 카메라 앞에서 더 빛나는 연습이 필요해요.',
      strengths: '비주얼 베이스',
      improvements: '브랜드 정체성, 자기 표현',
      signature: '아이돌은 예술가이면서 브랜드입니다',
    },
  ],
  starship: [
    {
      summary: 'IVE처럼 균형 잡힌 매력이 보입니다. 실력과 대중성의 밸런스가 좋아요.',
      strengths: '대중성, 친근한 매력',
      improvements: '팀 시너지 연습',
      signature: '실력과 매력, 둘 다 있어야 합니다',
    },
    {
      summary: '기본기는 안정적입니다. 현장에서 바로 쓸 수 있는 실력에 가까워요.',
      strengths: '음정/리듬 안정',
      improvements: '체력 보강, 다양한 장르',
      signature: '기본이 없으면 아무것도 없어요',
    },
    {
      summary: '팬들이 사랑할 수 있는 친근한 매력이 보입니다.',
      strengths: '진정성, 긍정 에너지',
      improvements: 'SNS 자기 표현',
      signature: '팬의 마음을 움직일 수 있어야 합니다',
    },
  ],
};

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

function computeOverallScore(rounds = {}) {
  const vals = Object.values(rounds).filter((v) => typeof v === 'number');
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

async function callClaudeJudge({ judge, agency, rounds, language }) {
  const userPrompt = [
    `심사 대상: 신인 K-POP 연습생`,
    `라운드 점수: ${JSON.stringify(rounds)}`,
    `기획사: ${agency.name}`,
    `기획사 철학: ${agency.philosophy}`,
    `특별 피드백 포인트: ${agency.feedbackFocus}`,
    `당신의 직책: ${judge.title}`,
    `언어: ${language || 'ko'}`,
    '',
    '아래 형식의 JSON으로만 답하세요. 다른 텍스트는 출력하지 마세요.',
    '{',
    '  "score": <0~100 점수>,',
    '  "summary": "<2~3 문장 총평>",',
    '  "strengths": "<잘한 점, 한 줄>",',
    '  "improvements": "<개선할 점, 한 줄>",',
    '  "signature": "<당신 캐릭터의 시그니처 한마디>"',
    '}',
  ].join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: judge.systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CLAUDE_FAIL_${res.status}_${text.slice(0, 80)}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('NO_JSON_IN_RESPONSE');
  return JSON.parse(match[0]);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { agencyId, rounds = {}, overallScore, language = 'ko' } = body || {};

  const agency = getAgency(agencyId);
  if (!agency) {
    return res.status(404).json({ error: 'Unknown agency' });
  }

  const computedOverall = typeof overallScore === 'number' ? overallScore : computeOverallScore(rounds);
  const judgeIds = agency.judges;

  const fallbackList = (FALLBACK_FEEDBACKS[agencyId] || []).map((f, idx) => ({
    judgeId: judgeIds[idx],
    score: 60 + Math.floor(Math.random() * 30),
    ...f,
  }));

  if (!ANTHROPIC_API_KEY) {
    return res.status(200).json({
      feedbacks: fallbackList,
      overallScore: computedOverall,
      passingScore: agency.passingScore,
      passed: computedOverall >= agency.passingScore,
      source: 'fallback',
    });
  }

  try {
    const results = await Promise.all(
      judgeIds.map(async (jid, idx) => {
        const judge = getJudge(jid);
        if (!judge) return fallbackList[idx];
        try {
          const parsed = await callClaudeJudge({ judge, agency, rounds, language });
          return { judgeId: jid, ...parsed };
        } catch {
          return fallbackList[idx];
        }
      })
    );

    return res.status(200).json({
      feedbacks: results,
      overallScore: computedOverall,
      passingScore: agency.passingScore,
      passed: computedOverall >= agency.passingScore,
      source: 'claude',
    });
  } catch (err) {
    return res.status(200).json({
      feedbacks: fallbackList,
      overallScore: computedOverall,
      passingScore: agency.passingScore,
      passed: computedOverall >= agency.passingScore,
      source: 'fallback',
      error: String(err?.message || err),
    });
  }
};
