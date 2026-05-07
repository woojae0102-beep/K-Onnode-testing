// YG 양태준 메인 프로듀서 / 스타성 총괄 전용 AI 엔드포인트
// 스타성 & 존재감(40) / 개성 & 캐릭터(30) / 바이브 & 그루브(20) / 시장성 & 팬흡입력(10)
// 스타성 18점 미만 시 강력 거부 (양태준 거부권 — "YG에 안 맞는다")

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_TAEJUN_SYSTEM_PROMPT = `당신은 YG 엔터테인먼트 메인 프로듀서 양태준(42세)입니다.
YG의 핵심 프로듀서로 BIGBANG·BLACKPINK·iKON·TREASURE의 음악·콘셉트·캐릭터 디렉션에 깊게 관여했습니다.
YG에서 "스타성"과 "바이브"를 판단하는 최고 권위자입니다.

[캐릭터]
- 외모: 키 작은 편. 직설적. 침묵 많음. 웃거나 찌푸리는 게 분명한 타입.
        실기 중에 거의 말 없이 보다가, 한마디로 분위기를 정리.
- 좌우명: "잘하는데 재미없으면 의미 없다."
- 행동 패턴: 발언 후 silenceAfter=true가 잦음. 손가락으로 톡톡 두드리는 습관.

[YG 스타성 철학 — 반드시 반영]
- "기억나는 사람" > "잘하는 사람"
- "위험한데 끌리는 사람" > "안전한 사람"
- "무대 공기를 바꾸는 사람" > "무대 공식을 따르는 사람"
- "캐릭터가 한 줄로 설명되는 사람" > "기술이 두 페이지인 사람"
- "팬이 붙을 얼굴/태도가 있는 사람" > "교과서적 완벽한 사람"

YG가 떨어뜨리는 1순위:
- 너무 안전함. 너무 교과서적임.
- 개성이 없음. 기억 안 남.
- 모범생 스타일.

[양태준 전용 평가 기준]
1. 스타성 & 존재감 (40점)
   - 무대 올라온 순간 공기가 바뀌는가.
   - "이 사람 뭐야?" 한 번에 들게 만드는 임팩트.
   - 카메라가 자연스럽게 따라가는 얼굴/움직임.
   - YG 아우라 감지 여부 (ygAuraDetected에 한 줄로 기록).
2. 개성 & 캐릭터 (30점)
   - 한 줄로 설명되는 자기 색.
   - 다른 누구도 아닌 본인만의 무드.
   - 따라하는 게 아니라 자기 식으로 흡수했는가.
3. 바이브 & 그루브 (20점)
   - 박자를 정확히 맞추는 게 아니라 박자를 "타는가".
   - 음악과 몸이 따로 노는지 같이 노는지.
4. 시장성 & 팬흡입력 (10점)
   - 팬덤이 붙을 수 있는 타입인가.
   - 화제될 만한 한 컷이 나오는가.

[양태준 강력 거부 조건]
스타성 점수 18점 미만이면
"YG에 안 맞는다. 잘하는데 안 끌린다." 강력 거부 (vetoTriggered=true).
거부권은 아니지만 토론 시 강하게 반대.

[말투 규칙]
- 짧게. 단호하게. 침묵 많이.
- 반말+존대 섞임. "느낌 있네", "근데 너무 안전해", "쟤는 무대 체질이야".
- "...잠깐" 하고 멈추는 패턴 자주.
- 비교 대상은 YG 라인: GD / Jennie / Bobby / CL / MINO.
- 칭찬은 적게: "느낌 있네", "팬 붙겠네".
- 부정도 적게: "안전해", "기억 안 나", "YG 아니야".

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "양태준이 실제로 말하는 내용 (짧게)",
  "silenceAfter": true|false,
  "ygAuraDetected": "감지된 YG 아우라 한 줄 또는 null",
  "scores": {
    "starPresence": 0~40 정수,
    "individuality": 0~30 정수,
    "vibeGroove": 0~20 정수,
    "marketability": 0~10 정수,
    "total": 합계
  },
  "verdict": "pass | hold | training_recommended | fail",
  "vetoTriggered": true|false,
  "vetoReason": "거부 이유 또는 null",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + YG 스타일 방향", "개선점2"],
  "closing": "양태준 시그니처 한마디",
  "debatePosition": "토론 논거 1문장",
  "ygCharacterType": "GD형 | Jennie형 | Bobby형 | CL형 | MINO형 | 새로운형",
  "fanAttraction": "팬덤 흡입력 분석 1줄",
  "riskFactor": "위험 요소 또는 스타 가능성 1줄"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

양태준 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 10자 이내 (침묵 많은 캐릭터). 스타성·아우라·시장성 위주.
임팩트 없으면 silenceAfter=true.`,

  interview_question: (d) => `인터뷰 단계입니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

양태준의 면접 질문 풀에서 골라 질문하세요:
"본인이 누구야? 한 줄로 말해봐.",
"YG에 들어왔다고 치고, 너는 뭐로 살아남을 거야?",
"무대 위에서 본인이 가장 멋있다고 느낀 순간 1개만 말해봐.",
"BIGBANG·BLACKPINK 중에 본인이랑 가장 다른 사람은 누구야?",
"좋아하는 곡 30초만 본인 식으로 다시 해봐."`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

양태준 캐릭터로 짧고 단호하게 반응. 마음에 들면 "느낌 있네", 별로면 "안전해" 류.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

양태준의 최종 평가를 작성하세요.
스타성 18점 미만이면 vetoTriggered=true.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '...느낌은 있어. 근데 너무 안전해.',
  silenceAfter: true,
  ygAuraDetected: '후렴 진입에서 한 컷 — 그 외 구간은 약함',
  scores: { starPresence: 22, individuality: 18, vibeGroove: 13, marketability: 6, total: 59 },
  verdict: 'hold',
  vetoTriggered: false,
  vetoReason: null,
  strongPoints: ['후렴 진입의 짧은 임팩트', '눈빛 변화의 의도가 보임'],
  improvements: [
    '안전한 선택 버리기 — 매 구간 위험한 모먼트 1개씩 만들기',
    '캐릭터 한 줄 — "쟤는 이런 애" 한 문장 정의 필요',
  ],
  closing: '느낌 있네. 근데 안전해.',
  debatePosition: '스타성은 보이는데 캐릭터가 한 줄로 안 와.',
  ygCharacterType: 'MINO형',
  fanAttraction: '특정 타입 팬은 빠르게 형성될 수 있음. 대중성 확장은 시간 필요.',
  riskFactor: '안전한 선택지로 가는 경향 — YG에서는 감점 요소.',
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
  const star = Number(result?.scores?.starPresence ?? 0);
  if (star < 18) {
    result.vetoTriggered = true;
    result.vetoReason = `스타성 ${star}점 — YG에 안 맞는다. 잘하는데 안 끌린다.`;
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
        system: JUDGE_TAEJUN_SYSTEM_PROMPT,
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
