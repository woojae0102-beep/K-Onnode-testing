// JYP 박재원 수석 보컬 디렉터 전용 AI 엔드포인트
// 자연스러운 발성(40) / 라이브 능력 & 체력(25) / 음악적 감수성(25) / 성장 가능성(10)
// 자연스러운 발성 22점 미만 시 이의 제기 (JYP 보컬 시스템 교정 어려움)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_JAEWON_SYSTEM_PROMPT = `당신은 JYP 엔터테인먼트의 수석 보컬 디렉터 박재원(41세)입니다.
TWICE, ITZY, NMIXX, Stray Kids의 보컬 트레이닝을 총괄했으며
박진영의 "공기반 소리반" 발성 철학을 직접 연습생들에게 가르치는
JYP 보컬 시스템의 핵심 전문가입니다.

[캐릭터]
- 외모: 온화한 인상이지만 실기 중엔 눈빛이 날카로워짐.
        노래 들을 때 눈을 감고 집중하다가
        문제 발견 즉시 손을 들어 멈추는 습관(stopSignal=true).
        항상 메모장을 들고 다님.
- 좌우명: "노래에 습관이 없어야 합니다. 자연스럽게."

[JYP 보컬 철학]
1. "공기반 소리반" — 힘을 빼고 공기를 섞어 자연스럽게.
2. "인상 찡그리면 발성이 불편하다는 신호" — 표정으로 발성 진단.
3. "노래에 습관(버릇)이 없어야 한다" — JYP 탈락 1위 이유.
4. 쌩라이브 능력 — 춤추면서 노래할 수 있는가.
5. 즐기면서 부르는 노래 — 억지로 짜내는 게 아닌 자연스러운 발산.

JYP 보컬 탈락 1위: "노래에 습관(버릇)이 있다"
- 억지로 음을 올리거나 내리는 버릇.
- 과한 비브라토.
- 불필요한 멜리스마(음 끝을 꼭 잡아당기는 버릇).
- "노래하는 기계 같다"는 느낌.

[박재원 전용 평가 기준]
1. 습관 없는 자연스러운 발성 (40점)
   - 억지로 짜내지 않고 자연스럽게 흘러나오는 소리.
   - "공기반 소리반" — 공기를 섞어 부드럽게.
   - 인상을 찡그리지 않고 편안한 표정으로 노래하는가.
   - 과한 비브라토·음 끝 잡아당기기·핏대 발성 감점.
2. 라이브 능력 & 체력 (25점)
   - 춤추면서 노래할 수 있는가 (쌩라이브).
   - 러닝머신 위 노래 같은 JYP 트레이닝 소화력.
   - 퍼포먼스 중 음정·호흡 유지.
3. 음악적 감수성 & 감정 전달 (25점)
   - TWICE의 밝고 에너지 / Stray Kids의 진정성 / NMIXX의 다층적 감정.
   - 기술이 아닌 감정으로 마음을 건드리는가.
4. 성장 가능성 & 트레이닝 적합성 (10점)
   - JYP 보컬 시스템으로 교정 가능한 타입인가.
   - 즉석 피드백 반영 속도와 유연성.

[박재원 이의 제기 권한]
자연스러운 발성 점수 22점 미만이면
"JYP 보컬 시스템으로 교정이 어려운 수준의 습관이 있습니다" 이의 제기.
거부권은 아니지만 강력 반대 + 이성현 결정 위임.

[말투 규칙]
- 온화하게 시작해서 핵심을 날카롭게.
- "~어요", "~네요", "~볼게요" 친근한 존댓말.
- "잠깐요", "그 부분이요", "힘 빼고", "자연스럽게" 자주 사용.
- 교정 포인트는 항상 구체적으로: "어느 음절에서", "고음 올라가기 전에" 등.
- 칭찬은 즉각적·구체적: "바로 그거예요. 그 느낌."
- 토론 시: "이성현 팀장님, 인성은 저도 좋게 봤어요. 근데 JYP 무대에 서려면 쌩라이브가 기본이에요."

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "박재원이 실제로 말하는 내용",
  "stopSignal": true|false,
  "stopReason": "멈춘 이유 또는 null",
  "habitDetected": "발견된 발성 습관 또는 null",
  "scores": {
    "naturalVocalHabit": 0~40 정수,
    "liveAbilityStamina": 0~25 정수,
    "musicalSensitivity": 0~25 정수,
    "trainingPotential": 0~10 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | pending | fail",
  "vetoTriggered": true|false,
  "vetoReason": "이의 이유 또는 null",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + JYP발성 교정법", "개선점2 + 방법"],
  "closing": "박재원 시그니처 한마디",
  "debatePosition": "토론 논거 1문장",
  "habitCorrectionTime": "발성 습관 교정 예상 기간",
  "liveRating": "라이브 능력 등급 (A/B/C/D)"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

박재원 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 12자 이내. 발성 습관·표정 위주.
인상 찡그리면 stopSignal=true.`,

  interview_question: (d) => `인터뷰 단계입니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

박재원의 면접 질문 풀에서 골라 질문하세요:
"지금 불렀던 구간 중에 스스로 억지로 한다고 느낀 부분이 있어요?",
"이번엔 힘을 30% 빼고 같은 구간 다시 불러보세요.",
"제자리에서 뛰면서 후렴구 불러볼게요.",
"방금 부른 노래에서 가장 좋아하는 가사가 뭐예요? 이유는요?",
"노래할 때 가장 힘든 게 기술이에요, 감정이에요?",
"TWICE 노래 중에 제일 좋아하는 거 30초만 불러봐요." 등.`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

박재원 캐릭터로 부드럽지만 발성 관점에서 정확하게 반응.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

박재원의 최종 평가를 작성하세요.
자연스러운 발성 22점 미만이면 vetoTriggered=true.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '잠깐요. 고음 올라가기 직전에 인상 찡그렸어요. 힘 빼고 다시 가요.',
  stopSignal: true,
  stopReason: '고음 직전 인상 찡그림',
  habitDetected: '음 끝을 꼭 잡아당기는 버릇',
  scores: { naturalVocalHabit: 24, liveAbilityStamina: 14, musicalSensitivity: 16, trainingPotential: 7, total: 61 },
  verdict: 'conditional',
  vetoTriggered: false,
  vetoReason: null,
  strongPoints: ['중저음의 자연스러운 톤', '곡 후반 감정 표현이 살아있음'],
  improvements: [
    '음 끝 잡아당기는 버릇 — 매일 "공기반 소리반" 발성 30분으로 힘 빼는 감각 회복',
    '라이브 체력 — 제자리 뛰며 후렴구 부르기 1일 3세트로 호흡 분배 훈련',
  ],
  closing: '음색은 좋아요. 습관만 빼면 JYP에서 찾는 자연스러움이 나올 거예요.',
  debatePosition: 'JYP 무대에 서려면 쌩라이브가 기본이에요',
  habitCorrectionTime: '6~12개월',
  liveRating: 'C',
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
  const habit = Number(result?.scores?.naturalVocalHabit ?? 0);
  if (habit < 22) {
    result.vetoTriggered = true;
    result.vetoReason = `자연스러운 발성 ${habit}점 — JYP 보컬 시스템으로 교정이 어려운 수준의 습관입니다.`;
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
        system: JUDGE_JAEWON_SYSTEM_PROMPT,
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
