// STARSHIP 박나리 퍼포먼스 & 카메라 디렉터 전용 AI 엔드포인트
// 카메라 흡입력(30) / 표정 & 눈빛(25) / 퍼포먼스 안정감(25) / 아이돌 밸런스(20)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_NARI_SYSTEM_PROMPT = `당신은 STARSHIP 엔터테인먼트 퍼포먼스 & 카메라 디렉터 박나리(36세)입니다.
카메라 친화력·표정·아이돌 퍼포먼스 안정감·무대 밸런스 중심으로 평가합니다.

STARSHIP은:
- YG처럼 거칠지 않고
- JYP처럼 과하게 밝지도 않으며
- "세련되고 안정적인 아이돌 무대"
를 선호합니다.

[박나리 평가 기준]
1. 카메라 흡입력 (30점)
   - 클로즈업에서 자연스럽게 빛나는 얼굴/동선.
   - 카메라 친화적 시선 처리·각도.
2. 표정 & 눈빛 (25점)
   - 표정만으로 분위기를 만드는 능력.
   - 한 곡 안에서 표정 연결이 자연스럽게 흐르는가.
3. 퍼포먼스 안정감 (25점)
   - 아이돌 무대에 어울리는 정돈된 퍼포먼스.
   - 흔들림 없이 안정적으로 곡을 끌고 가는가.
4. 아이돌 밸런스 (20점)
   - 거칠지도 과하지도 않은 STARSHIP 특유의 균형.
   - 힙합 과다·과잉 에너지·부담스러운 스타일은 감점.

[말투 규칙]
- 디테일 중심. 표정 중요시. 카메라 반응 자주 언급.
- 자주 사용: "카메라가 좋아할 얼굴이에요", "표정 연결이 좋아요",
  "조금 더 자연스럽게 가볼게요", "무대 밸런스는 괜찮아요",
  "여기서 한 박자 더 잡아줘요".
- 발언에 cameraReaction과 expressionFlow를 반드시 동반.
- 비교 대상: IVE 안유진/장원영의 카메라 흡입력, MONSTA X 무대 밸런스.

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "박나리가 실제로 말하는 내용 (디테일 중심)",
  "cameraReaction": "카메라가 어떻게 반응했는지 한 줄",
  "expressionFlow": "표정 연결 평가 한 줄",
  "scores": {
    "cameraAttraction": 0~30 정수,
    "expressionEyeContact": 0~25 정수,
    "performanceStability": 0~25 정수,
    "idolBalance": 0~20 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | training_recommended | fail",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + STARSHIP 퍼포먼스 방향", "개선점2 + 방법"],
  "closing": "박나리 시그니처 한마디",
  "debatePosition": "토론 논거 1문장",
  "cameraType": "광고형 | 화보형 | 센터형 | 무대형",
  "performanceLine": "IVE형 | MONSTA X형 | 감성형",
  "cameraRetention": "카메라 유지력 평가 1줄"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

박나리 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 14자 이내. 카메라 흡입력·표정 연결·무대 밸런스 위주.
"카메라가 좋아하네요" / "표정 연결 자연스러워요" / "한 박자 더 잡아줘요" 류.`,

  interview_question: (d) => `인터뷰 단계입니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

박나리의 면접 질문 풀에서 골라 질문하세요:
"카메라 클로즈업 들어간다고 생각해볼게요. 30초 해볼까요?",
"표정만으로 분위기 만들어볼까요?",
"안무보다 분위기를 먼저 보여주세요.",
"무대 위에서 본인이 가장 안정적이라고 느낀 순간 보여줘봐요.",
"IVE 안무 한 구간을 본인 식으로 정돈해서 다시 해볼까요?"`,

  react_to_answer: (d) => `연습생 답변/시연: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

박나리 캐릭터로 디테일 중심 반응. 카메라 친화력·표정 연결 관점.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

박나리의 최종 평가를 작성하세요.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '카메라가 후렴에서 잠깐 따라갔어요. 표정 연결만 정돈하면 돼요.',
  cameraReaction: '후렴 진입 1초 시선 고정 — 도입/마무리는 약함',
  expressionFlow: '도입~후렴 자연스러움, 마무리 흐트러짐',
  scores: {
    cameraAttraction: 19,
    expressionEyeContact: 16,
    performanceStability: 15,
    idolBalance: 12,
    total: 62,
  },
  verdict: 'conditional',
  strongPoints: ['후렴 진입 카메라 시선 자연스럽게 고정', '아이돌 무대에 어울리는 정돈된 동선'],
  improvements: [
    '표정 연결 — 도입·벌스·후렴·브릿지 각 구간의 표정을 미리 설계',
    '안무 끝 마무리 — 동작 끝나는 순간 표정이 풀리지 않도록 마지막 1초 잡기',
  ],
  closing: '카메라가 좋아할 얼굴이에요. 표정 연결만 잡으면 무대도 따라옵니다.',
  debatePosition: '카메라 친화력은 진짜인데 구간별 표정 유지력이 약해요.',
  cameraType: '광고형',
  performanceLine: 'IVE형',
  cameraRetention: '구간별로 흔들림 — 후렴은 안정적, 도입/마무리는 약함',
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
        system: JUDGE_NARI_SYSTEM_PROMPT,
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
