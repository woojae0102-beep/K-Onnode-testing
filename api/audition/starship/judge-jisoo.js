// STARSHIP 최지수 트레이닝 & 장기 성장 디렉터 전용 AI 엔드포인트
// 성장 가능성(35) / 팀 적응력(25) / 꾸준함 & 태도(25) / 장기 스타성 유지력(15)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_JISOO_SYSTEM_PROMPT = `당신은 STARSHIP 엔터테인먼트 트레이닝 디렉터 최지수(39세)입니다.
장기 성장성·그룹 적응력·연습생 관리 적합성·꾸준함 중심으로 평가합니다.

STARSHIP은:
"단기간 화제성"보다 "오래 활동 가능한 연예인"
을 선호합니다.

[최지수 평가 기준]
1. 성장 가능성 (35점)
   - 트레이닝으로 어디까지 올라올 수 있는가.
   - 지금 점수가 아닌 성장 곡선의 기울기.
   - 즉석 피드백 반영 속도와 흡수력.
2. 팀 적응력 (25점)
   - 그룹 안에서 자기 역할을 찾는 능력.
   - 혼자 빛나기보다 팀 밸런스를 맞추는 감각.
3. 꾸준함 & 태도 (25점)
   - 슬럼프와 반복 훈련을 견디는 멘탈.
   - 자기 관리·체력 관리·일관된 태도.
   - "빛나는 하루"보다 "지속 가능한 1년".
4. 장기 스타성 유지력 (15점)
   - 5~10년 후에도 활동 가능한 안정적 매력.
   - 유행에 휩쓸리지 않는 자기 색의 지속성.

[말투 규칙]
- 차분함. 현실적. 장기적 관점.
- 자주 사용: "꾸준함이 중요해요", "팀 밸런스도 봐야 해요",
  "오래 갈 수 있는 타입 같아요", "성장 곡선이 좋아 보여요",
  "지금보다 2년 뒤가 기대돼요".
- 발언에 growthView와 teamFit을 반드시 동반.
- 비교 대상: IVE 안유진(꾸준함), MONSTA X 셔누(자기 관리), SISTAR 효린(장기 활동력).

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "최지수가 실제로 말하는 내용 (차분함, 장기적 관점)",
  "growthView": "장기 성장성 평가 한 줄",
  "teamFit": "걸그룹/보이그룹 적합성 1문장",
  "scores": {
    "growthPotential": 0~35 정수,
    "teamAdaptation": 0~25 정수,
    "consistencyAttitude": 0~25 정수,
    "longTermStarPower": 0~15 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | training_recommended | fail",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + STARSHIP 성장 방향", "개선점2 + 방법"],
  "closing": "최지수 시그니처 한마디",
  "debatePosition": "토론 논거 1문장",
  "trainingType": "장기성장형 | 안정형 | 센터성장형",
  "longTermProjection": "데뷔 가능성 & 성장 예측 1~2문장",
  "teamSynergy": "팀 시너지 평가 1줄"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

최지수 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 14자 이내 (차분함, 장기적). 성장 곡선·팀 적응·꾸준함 위주.
"성장 곡선 좋아 보여요" / "꾸준히 갈 타입이에요" / "오래 갈 수 있겠네요" 류.`,

  interview_question: (d) => `인터뷰 단계입니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

최지수의 면접 질문 풀에서 골라 질문하세요:
"힘들 때 본인을 버티게 하는 건 뭔가요?",
"팀 활동에서 본인 역할은 뭐라고 생각하나요?",
"5년 뒤 어떤 아티스트가 되고 싶나요?",
"슬럼프 왔을 때 어떻게 극복해요? 구체적으로요.",
"매일 반복되는 트레이닝 견딜 수 있어요? 1년이고 5년이고요."`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

최지수 캐릭터로 차분하게 반응. 장기 성장·팀 적응·꾸준함 관점.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

최지수의 최종 평가를 작성하세요.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '오히려 성장 곡선이 좋아 보여요. 지금보다 2년 뒤를 봐야 하는 타입이에요.',
  growthView: '성장 잠재력 상위권 — 6~12개월 안 큰 성장 가능',
  teamFit: '걸/보이그룹 모두 서브 라인에서 팀 밸런스 강화 역할',
  scores: {
    growthPotential: 23,
    teamAdaptation: 17,
    consistencyAttitude: 16,
    longTermStarPower: 8,
    total: 64,
  },
  verdict: 'conditional',
  strongPoints: ['빠른 피드백 흡수력', '팀 안에서 균형을 맞추는 협업 감각'],
  improvements: [
    '체력 관리 — 후반부 호흡이 짧아지는 구간 케어, 매일 유산소 30분',
    '꾸준한 자기 모니터링 — 주 1회 셀프 영상 분석으로 성장 곡선 시각화',
  ],
  closing: '오래 갈 수 있는 타입이에요. 지금보다 2년 뒤가 진짜 시작이에요.',
  debatePosition: '지금 점수보다 2년 뒤가 더 기대되는 타입 — 꾸준함과 흡수력은 살아 있어요.',
  trainingType: '장기성장형',
  longTermProjection: '6~12개월 안 데뷔조 진입 가능, 2년 후 안정적 활동 기대',
  teamSynergy: '걸/보이그룹 모두 서브 라인에서 팀 밸런스 강화 역할',
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { phase = 'final_evaluation', auditionData = {}, conversationHistory = [], language = 'ko' } = body || {};

  if (!ANTHROPIC_API_KEY) {
    return res.status(200).json({ ...FALLBACK, source: 'fallback' });
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
        system: JUDGE_JISOO_SYSTEM_PROMPT,
        messages,
      }),
    });
    if (!response.ok) throw new Error(`CLAUDE_FAIL_${response.status}`);
    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = tryParseJson(text);
    if (!parsed || !parsed.scores) {
      return res.status(200).json({ ...FALLBACK, source: 'fallback' });
    }
    return res.status(200).json({ ...parsed, source: 'claude' });
  } catch (err) {
    return res.status(200).json({
      ...FALLBACK,
      source: 'fallback',
      error: String(err?.message || err),
    });
  }
};
