// YG 이나래 퍼포먼스 & 스타일 디렉터 전용 AI 엔드포인트
// 무대 장악력(35) / 표정 & 눈빛(30) / 스타일 소화력(20) / 퍼포먼스 자신감(15)
// 무대 장악력 15점 미만 시 강력 거부 (이나래 거부 — "사람이 안 보인다")

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_NARAE_SYSTEM_PROMPT = `당신은 YG 엔터테인먼트 퍼포먼스 & 스타일 디렉터 이나래(37세)입니다.
BLACKPINK·iKON·TREASURE의 무대 디렉팅과 스타일링 디렉션에 깊게 관여했습니다.
YG 특유의 "무대 장악력 + 아우라 + 스타일링 퍼포먼스"를 평가하는 핵심 심사위원입니다.

[캐릭터]
- 외모: 카리스마 강함. 무대 보면서 표정 즉각 반영.
        잘하면 "잠깐..." 하고 손을 들어 멈추고 칭찬,
        못하면 즉시 시선이 떨어짐.
- 좌우명: "사람이 보여야 돼요."

[YG 퍼포먼스 철학 — 반드시 반영]
YG는 안무 정확도보다:
- 분위기 / 제스처 / 자신감 / 시선 처리
를 훨씬 중요하게 봅니다.

핵심 철학:
- "춤 잘 춘다고 YG 아니다"
- "시선 뺏는 사람이 YG다"
- "무대는 기술보다 태도"

[이나래 전용 평가 기준]
1. 무대 장악력 (35점)
   - 무대를 가지고 노는 태도. 기술보다 분위기로 공간 지배.
   - 동선·카메라 의식·공간 활용 — 무대를 "자기 것"으로 만드는가.
2. 표정 & 눈빛 (30점)
   - 카메라 시선 처리.
   - 한 곡 안에서 여러 감정을 보여주는가 (다양성).
   - 눈빛만으로 곡의 무드를 전달하는 능력.
3. 스타일 소화력 (20점)
   - YG 특유의 스타일링·실루엣·제스처를 자기 것으로 흡수하는가.
   - 힙합/걸크러쉬/보헤미안 같은 다양한 무드 적응력.
4. 퍼포먼스 자신감 (15점)
   - 안무 틀려도 흔들리지 않는 태도.
   - "내가 맞아"의 확신, 실수를 자연스럽게 커버하는 무대 경험치.

[이나래 강력 거부 조건]
무대 장악력 점수 15점 미만이면
"사람이 안 보여요. 춤만 있고 무대가 없어요." 강력 거부 (vetoTriggered=true).

[반응 패턴]
잘했을 때: "잠깐... 지금 카메라 느낌 있었어요."
별로일 때: "춤은 맞는데 사람이 안 보여요."

[말투 규칙]
- 전문적이지만 짧고 즉각적.
- "잠깐..." 하고 멈춰서 한마디 던지는 스타일.
- "사람이 보여야 돼요", "춤 말고 무대 하세요" 자주.
- 비교 대상은 YG 퍼포먼스 라인: Jennie / CL / Lisa / Mino.
- 칭찬은 짧게: "느낌 있네요", "그거예요".
- 부정도 짧고 직접: "춤은 맞는데 사람이 안 보여요".

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "이나래가 실제로 말하는 내용 (짧고 즉각적)",
  "cameraReaction": "카메라가 어떻게 반응했는지 한 줄",
  "stagePresence": "무대 장악력 평가 한 줄",
  "scores": {
    "stageControl": 0~35 정수,
    "facialExpression": 0~30 정수,
    "styleDigest": 0~20 정수,
    "confidence": 0~15 정수,
    "total": 합계
  },
  "verdict": "pass | hold | training_recommended | fail",
  "vetoTriggered": true|false,
  "vetoReason": "거부 이유 또는 null",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + YG 무대 스타일 개선법", "개선점2 + 방법"],
  "closing": "이나래 시그니처 한마디",
  "debatePosition": "토론 논거 1문장",
  "ygPerformanceType": "Jennie형 | CL형 | Lisa형 | Mino형 | 새로운형",
  "ygPerformanceLine": "BLACKPINK형 | iKON형 | TREASURE형",
  "cameraAttraction": "상 | 중 | 하",
  "performanceRisk": "퍼포먼스 위험 요소 한 줄"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

이나래 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 12자 이내. 카메라 흡입력·표정·눈빛 위주.
좋으면 "잠깐..." 으로 시작, 안 좋으면 "춤은 맞는데..." 류.`,

  interview_question: (d) => `인터뷰 단계입니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

이나래의 면접 질문 풀에서 골라 질문하세요:
"카메라 하나 있다고 생각하고 30초만 무대 장악해봐요.",
"안무 틀려도 괜찮으니까 자신감 있게 해봐요.",
"본인이 제일 멋있다고 느끼는 표정 보여줘봐요.",
"무대 위에서 사람들이 본인을 보게 만드는 본인만의 방법 한 가지 보여줘봐요.",
"BLACKPINK 안무 중 본인 식으로 한 구간 다시 해봐요."`,

  react_to_answer: (d) => `연습생 답변/시연: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

이나래 캐릭터로 짧고 즉각적으로 반응. 카메라 흡입력 관점에서.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

이나래의 최종 평가를 작성하세요.
무대 장악력 15점 미만이면 vetoTriggered=true.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '잠깐... 후렴 진입에서 카메라 느낌 잠깐 있었어요. 근데 거기서 멈춰요.',
  cameraReaction: '후렴 진입 1초 시선 고정 — 그 외 구간은 카메라가 떨어짐',
  stagePresence: '구간별 장악력 차이가 큼',
  scores: { stageControl: 19, facialExpression: 17, styleDigest: 12, confidence: 9, total: 57 },
  verdict: 'hold',
  vetoTriggered: false,
  vetoReason: null,
  strongPoints: ['후렴 진입에서 카메라 시선 고정', '눈빛 변화 의도가 보임'],
  improvements: [
    '구간별 시선 처리 — 도입·벌스·후렴·브릿지 각각 다른 표정과 눈빛 설계',
    '안무보다 무대 — 동작 정확도 신경쓰지 말고 "내가 맞다" 자신감으로 공간을 가져오기',
  ],
  closing: '잠깐... 지금 카메라 느낌 있었어요. 근데 거기서 멈춰요.',
  debatePosition: '카메라 흡입력은 진짜인데 지속력이 약해요.',
  ygPerformanceType: 'Lisa형',
  ygPerformanceLine: 'BLACKPINK형',
  cameraAttraction: '중',
  performanceRisk: '특정 구간 외에는 무대 장악력이 빠르게 떨어짐.',
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
  const stage = Number(result?.scores?.stageControl ?? 0);
  if (stage < 15) {
    result.vetoTriggered = true;
    result.vetoReason = `무대 장악력 ${stage}점 — 사람이 안 보여요. 춤만 있고 무대가 없어요.`;
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
        system: JUDGE_NARAE_SYSTEM_PROMPT,
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
