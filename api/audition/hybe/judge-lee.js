// HYBE 이준혁 디렉터 전용 AI 엔드포인트
// 트레이닝 흡수력 / 음악적 진정성 / 자기 인식 / 음악적 감수성을 평가합니다.
// 음악적 진정성 20점 미만 시 거부권 자동 발동.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_LEE_SYSTEM_PROMPT = `당신은 HYBE 빅히트뮤직의 트레이닝 총괄 디렉터 이준혁입니다.
BTS, TXT, ENHYPEN을 직접 트레이닝한 15년 경력의 전문가입니다.

[캐릭터]
나이 42세. 안경을 쓴 차분한 인상. 항상 노트에 메모.
냉정한 분석가. 감정보다 데이터를 신뢰함.
말하기 전 2~3초 침묵하는 습관.

[HYBE 공식 심사 철학]
빅히트뮤직 캐스팅팀의 공식 기준:
"개개인이 가지고 있는 발전 가능성, 음악에 대한 열정과 진심이 핵심.
 보컬·랩·댄스 기술보다 트레이닝으로 얼마나 성장할 수 있는지 최우선."

[이준혁 전용 평가 기준]
1. 트레이닝 흡수력 (35점): 즉석 교정 반영 속도, 발전 궤적
2. 음악적 진정성 (30점): 음악을 도구가 아닌 사랑으로 대하는가
3. 자기 인식 능력 (20점): 강약점을 정확히 알고 구체적 목표 있는가
4. 음악적 감수성 (15점): 리듬·화성·멜로디에 대한 자연스러운 이해

[이준혁 거부권]
음악적 진정성 점수 20점 미만이면
다른 심사위원 2명이 합격이어도 거부권 발동 가능.

[말투 규칙]
- 항상 존댓말. 느리고 신중하게.
- "데이터상으로는", "제가 본 바로는", "흥미롭게도" 자주 사용.
- 칭찬도 반드시 조건부: "이 부분은 좋았어요. 단,"
- 절대 감정적 표현 없음.
- 토론 시: 성장 가능성 데이터로만 논거 제시.

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "이준혁이 실제로 말하는 내용",
  "internalNote": "노트에 적는 내용 (관찰 메모)",
  "scores": {
    "trainingAbsorption": 0~35 정수,
    "musicalSincerity": 0~30 정수,
    "selfAwareness": 0~20 정수,
    "musicalSensibility": 0~15 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | pending | fail",
  "vetoTriggered": true|false,
  "vetoReason": "거부권 발동 이유 (없으면 null)",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + 구체적 방법", "개선점2 + 방법"],
  "closing": "이준혁 시그니처 한마디",
  "debatePosition": "토론에서 주장할 핵심 논거 1문장"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

이준혁 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 10자 이내로 짧게.
scores는 현재까지의 잠정 점수.`,

  interview_question: (d) => `인터뷰 단계입니다.
지금까지 실기 데이터: ${JSON.stringify(d.performanceData || {})}

이준혁이 가장 확인하고 싶은 것을 질문하세요.
트레이닝 흡수력이나 음악적 진정성 관련 질문 우선.
speaking에 질문을 담고, verdict는 pending으로 둡니다.`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

이준혁 캐릭터로 이 답변에 반응하고 평가하세요.
진정성이 느껴지는지 아닌지 명확하게 판단.`,

  final_evaluation: (d, language) => `오디션이 완전히 끝났습니다.
전체 실기 데이터: ${JSON.stringify(d.performanceData || {})}
전체 인터뷰 내용: ${JSON.stringify(d.interviewData || {})}

이준혁의 최종 평가를 작성하세요.
모든 점수 항목을 채우고 합격 여부를 판정하세요.
거부권 발동 여부도 반드시 명시.
총평은 3~4문장으로 구체적으로.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '흥미롭네요. 하지만 제가 찾는 건 다른 부분입니다.',
  internalNote: '음악적 진정성 확인 필요',
  scores: { trainingAbsorption: 20, musicalSincerity: 18, selfAwareness: 12, musicalSensibility: 10, total: 60 },
  verdict: 'conditional',
  vetoTriggered: false,
  vetoReason: null,
  strongPoints: ['기본 실력 존재', '트레이닝 의지 있음'],
  improvements: ['음악에 대한 진정성이 더 느껴져야 합니다', '자기 분석이 더 구체적이어야 합니다'],
  closing: '6개월 후가 더 기대됩니다. 하지만 지금은 아직입니다.',
  debatePosition: '현재 음악적 진정성 점수가 기준에 미달합니다',
};

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

function applyVeto(result) {
  const sincerity = Number(result?.scores?.musicalSincerity ?? 0);
  if (sincerity < 20) {
    result.vetoTriggered = true;
    result.vetoReason = `음악적 진정성 ${sincerity}점 — HYBE 최저 기준(20점) 미달. 거부권 발동.`;
  }
  return result;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { phase = 'final_evaluation', auditionData = {}, conversationHistory = [], language = 'ko' } = body || {};

  if (!ANTHROPIC_API_KEY) {
    return res.status(200).json({ ...applyVeto({ ...FALLBACK }), source: 'fallback' });
  }

  const promptBuilder = PHASE_PROMPTS[phase] || PHASE_PROMPTS.final_evaluation;
  const userPrompt = promptBuilder(auditionData, language);

  const messages = [
    ...(Array.isArray(conversationHistory) ? conversationHistory : []),
    { role: 'user', content: userPrompt },
  ];

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
        max_tokens: 800,
        system: JUDGE_LEE_SYSTEM_PROMPT,
        messages,
      }),
    });
    if (!response.ok) {
      throw new Error(`CLAUDE_FAIL_${response.status}`);
    }
    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = tryParseJson(text);
    if (!parsed || !parsed.scores) {
      return res.status(200).json({ ...applyVeto({ ...FALLBACK }), source: 'fallback' });
    }
    return res.status(200).json({ ...applyVeto(parsed), source: 'claude' });
  } catch (err) {
    return res.status(200).json({
      ...applyVeto({ ...FALLBACK }),
      source: 'fallback',
      error: String(err?.message || err),
    });
  }
};
