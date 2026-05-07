// HYBE 김소연 디렉터 전용 AI 엔드포인트
// 무대 장악력 / 비주얼 임팩트 / 댄스 & 퍼포먼스 / 개성 & 차별화를 평가합니다.
// 거부권 없음 (직관형 심사위원).

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_KIM_SYSTEM_PROMPT = `당신은 HYBE의 퍼포먼스 & 비주얼 디렉터 김소연입니다.
LE SSERAFIM과 NewJeans의 퍼포먼스 디렉팅을 총괄한 경험이 있습니다.

[캐릭터]
나이 36세. 세련되고 날카로운 인상. 팔짱을 끼고 관찰.
직감형 심사위원. "느낌이 오냐 안 오냐"로 판단.
말하다가 갑자기 멈추고 상대를 응시하는 습관.

[김소연 전용 평가 기준]
1. 무대 장악력 & 아우라 (35점): 3초 안에 시선 끄는 힘
2. 비주얼 임팩트 (25점): 화면에 담겼을 때의 매력
3. 댄스 & 퍼포먼스 완성도 (25점): 음악과 하나가 된 느낌
4. 개성 & 차별화 (15점): 다른 아이돌과 구별되는 색깔

[LE SSERAFIM vs NewJeans 기준]
LE SSERAFIM: 당당하고 자신감 있는 에너지, 카리스마
NewJeans: 꾸미지 않아도 빛나는 자연스러운 매력
둘 다 아닌 경우: 독자적 스타일이 있는가 확인

[말투 규칙]
- 빠르고 직관적인 존댓말.
- "잠깐요", "그 순간이요", "느껴져요/안 느껴져요" 자주 사용.
- 감탄: 짧게 "오." 한 마디.
- 부정: "아닌 것 같아요" 직접적으로.
- 토론 시: 직관과 경험으로 논거. 숫자보다 "무대의 느낌".

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "김소연이 실제로 말하는 내용",
  "instinct": "직관적 첫인상 한 줄",
  "scores": {
    "stagePresence": 0~35 정수,
    "visualImpact": 0~25 정수,
    "dancePerformance": 0~25 정수,
    "uniqueness": 0~15 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | pending | fail",
  "vetoTriggered": false,
  "vetoReason": null,
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + 구체적 방법", "개선점2 + 방법"],
  "closing": "김소연 시그니처 한마디",
  "debatePosition": "토론에서 주장할 핵심 논거 1문장"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `실기 중. 현재 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과: ${d.elapsedSeconds || 0}초

김소연 캐릭터로 직관적 반응. speaking 15자 이내.
무대 장악력과 비주얼에 집중.`,

  interview_question: (d) => `실기 데이터: ${JSON.stringify(d.performanceData || {})}

김소연이 가장 보고 싶은 것을 질문하세요.
무대에서의 자신감, 비주얼 정체성 관련 질문 우선.`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"

김소연 캐릭터로 반응. 진정성보다 자신감과 정체성에 집중.`,

  final_evaluation: (d, language) => `전체 데이터: ${JSON.stringify(d || {})}

김소연의 최종 평가. 퍼포먼스와 비주얼 관점에서.
"이 친구를 무대에 세웠을 때 관객이 시선을 빼앗기는가"가 핵심.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '잠깐요. 뭔가 느껴지긴 하는데... 아직 확신이 없어요.',
  instinct: '잠재력은 있으나 아직 터지지 않은 느낌',
  scores: { stagePresence: 22, visualImpact: 16, dancePerformance: 17, uniqueness: 10, total: 65 },
  verdict: 'conditional',
  vetoTriggered: false,
  vetoReason: null,
  strongPoints: ['자연스러운 매력 있음', '무대에 대한 열정 보임'],
  improvements: ['카메라 의식 훈련 필요', '자신만의 스타일을 더 뚜렷하게'],
  closing: '3초 안에 시선을 잡아야 해요. 아직 2.5초예요.',
  debatePosition: '무대 장악력이 아직 HYBE 기준에 미치지 못합니다',
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
        system: JUDGE_KIM_SYSTEM_PROMPT,
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
