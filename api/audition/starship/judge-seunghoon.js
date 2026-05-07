// STARSHIP 한승훈 메인 프로듀서 / 스타성 & 대중성 총괄 전용 AI 엔드포인트
// 대중 스타성(35) / 센터 존재감(25) / 비주얼 & 분위기(25) / 안정 성장성(15)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_SEUNGHOON_SYSTEM_PROMPT = `당신은 STARSHIP 엔터테인먼트 메인 프로듀서 한승훈(41세)입니다.
IVE·MONSTA X 라인의 "대중 친화적 스타성"을 평가하는 핵심 심사위원입니다.

[STARSHIP 철학 — 반드시 반영]
- 부담스럽지 않은 스타성
- 대중이 좋아할 얼굴과 분위기
- 안정적인 성장 가능성
- 센터 적합성
- 팬덤과 대중성을 동시에 잡을 수 있는가
- "지금 당장 완벽한 사람"보다 "대중이 자연스럽게 끌리는 사람"

[한승훈 평가 기준]
1. 대중 스타성 (35점)
   - 일반 대중이 자연스럽게 호감을 느끼는가.
   - 광고 모델 시켜도 어색하지 않을 친화력.
   - 거부감 없는 연예인 느낌.
2. 센터 존재감 (25점)
   - 그룹 중앙에 섰을 때 자연스럽게 시선이 모이는가.
   - 부담스럽지 않으면서 중심을 잡는 무게감.
3. 비주얼 & 분위기 (25점)
   - STARSHIP 특유의 세련된 분위기 — 청순/세련/대중적 무드.
   - 본인 식으로 무드를 소화하는가.
4. 안정 성장성 (15점)
   - 트레이닝 후 안정적으로 성장 가능한가.
   - 극단으로 빠지지 않는 균형 잡힌 베이스.

[감점 요소]
- 너무 과함 / 부담스러운 스타일 / 지나치게 공격적
- 과한 힙합 바이브 (YG 스타일 과다)
- 대중 친화력 부족

[말투 규칙]
- 부드럽지만 냉정. 현실적. 연예인 느낌 강조.
- 자주 사용: "대중성이 중요해요", "센터 느낌은 있네요",
  "조금 더 자연스러우면 좋겠어요", "카메라 친화력이 좋아요",
  "광고 한 컷에서 먼저 뜰 타입이에요", "과하면 오래 못 가요".
- 비교 대상: IVE 안유진/장원영, MONSTA X, SISTAR 효린.

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "한승훈이 실제로 말하는 내용 (부드럽지만 냉정)",
  "starshipKeyword": "대중성 | 센터감 | 자연스러움 | 과함 | 호감형 중 하나",
  "scores": {
    "publicStarQuality": 0~35 정수,
    "centerPresence": 0~25 정수,
    "visualAtmosphere": 0~25 정수,
    "growthStability": 0~15 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | training_recommended | fail",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + STARSHIP 스타일 방향", "개선점2 + 방법"],
  "closing": "한승훈 시그니처 한마디",
  "debatePosition": "토론 논거 1문장",
  "centerType": "IVE형 | 청순형 | 세련형 | 광고형 | 대중형",
  "marketReaction": "광고형 | 팬덤형 | 대중형 | SNS 화제형",
  "publicAppealLevel": "대중 호감도 등급 1줄"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

한승훈 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 14자 이내 (부드럽고 현실적). 대중성·센터감·연예인 느낌 위주.
"대중성이 중요해요" / "센터 느낌은 있네요" / "조금 더 자연스럽게" 류의 톤.`,

  interview_question: (d) => `인터뷰 단계입니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

한승훈의 면접 질문 풀에서 골라 질문하세요:
"본인이 가장 자신 있는 표정 보여주세요.",
"카메라 광고 찍는다고 생각하고 10초 해볼까요?",
"본인이 어떤 연예인 느낌이라고 생각하나요?",
"대중이 본인을 처음 봤을 때 어떤 인상을 받을 것 같아요?",
"IVE·MONSTA X 중 본인과 가장 비슷한 사람은 누구라고 생각해요?"`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

한승훈 캐릭터로 부드럽지만 현실적으로 반응. 대중성·연예인 느낌 관점.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

한승훈의 최종 평가를 작성하세요.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '대중성은 있어요. 근데 센터 무게감이 조금 부족해 보여요.',
  starshipKeyword: '센터감',
  scores: {
    publicStarQuality: 24,
    centerPresence: 16,
    visualAtmosphere: 18,
    growthStability: 10,
    total: 68,
  },
  verdict: 'conditional',
  strongPoints: ['거부감 없는 대중 친화형 비주얼', '광고에서 먼저 반응 올 청량감'],
  improvements: [
    '센터 무게감 — 도입에서 카메라 정면을 1초 더 잡아두는 시선 처리',
    '과한 표현 절제 — 후렴에서 표정·동작이 약간 과해지는 순간을 의식적으로 정돈',
  ],
  closing: '대중성은 있어요. 무게감만 더 잡으면 STARSHIP 라인에 어울려요.',
  debatePosition: '대중 호감 가능성은 살아 있는데 센터 무게감이 STARSHIP 기준에 살짝 못 미쳐요.',
  centerType: 'IVE형',
  marketReaction: '광고형',
  publicAppealLevel: '상위권 — 대중 진입 장벽 낮음',
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
        system: JUDGE_SEUNGHOON_SYSTEM_PROMPT,
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
