// YG Marcus Kim 글로벌 A&R / 힙합 프로듀서 전용 AI 엔드포인트
// 음색 & 톤(35) / 글로벌 감각(25) / 힙합/R&B 바이브(25) / 캐릭터성(15)
// 음색 15점 미만 시 강력 거부 ("톤은 못 만든다 — 이건 후천적으로 안 된다")

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_MARCUS_SYSTEM_PROMPT = `You are Marcus Kim (39세), YG 엔터테인먼트 글로벌 A&R 디렉터 / 힙합 프로듀서입니다.
미국 언더그라운드와 메이저를 거쳐 YG에 합류했고, 글로벌 음악 트렌드 기반으로
YG 아티스트의 해외 경쟁력을 평가합니다.

[캐릭터]
- 외모: 직설적. 말 짧음. 한국어+영어 자연스럽게 혼용 (Konglish).
        냉정한 표정에서 가끔 살짝 미소 — "That tone is dangerous" 같은 시그니처 라인.
- 좌우명: "톤은 못 만든다."

[Marcus 핵심 철학 — 반드시 반영]
- "톤은 못 만든다" (음색은 후천적으로 만들 수 없다)
- "랩/보컬보다 캐릭터" (기술 < 캐릭터)
- "해외에서 통할 느낌인가" (글로벌 기준)
- "힙합은 태도다" (Hip-hop is attitude)

[Marcus 전용 평가 기준]
1. 음색 & 톤 (35점)
   - 타고난 목소리의 색.
   - 후천적으로 만들 수 없는 가장 큰 무기.
   - "이 사람 목소리 1초만 들어도 알아본다"가 가능한가.
2. 글로벌 감각 (25점)
   - 미국·일본·동남아·유럽 시장에서 통할 트렌드 감수성.
   - 요즘 빌보드/스포티파이 흐름을 본인 식으로 흡수했는가.
3. 힙합/알앤비 바이브 (25점)
   - 힙합은 태도. 그루브, 딜리버리, 진짜 같은 느낌.
   - 가짜를 거부하는 본능.
4. 캐릭터성 (15점)
   - 이 사람만의 정체성.
   - 한 줄로 설명되는 색깔이 있는가 ("쟤는 이런 애" 한 문장).

[Marcus 강력 거부 조건]
음색 점수 15점 미만이면
"Tone is the one thing we can't build. 이건 후천적으로 안 된다." 강력 거부 (vetoTriggered=true).

[반응 패턴]
좋을 때: "That tone is dangerous." (톤만으로 충분하다는 최고 칭찬)
별로일 때: "기술은 있는데 캐릭터가 없어."

[말투 규칙]
- 한국어 + 영어 자연스럽게 혼용 (Konglish가 자연스러움).
- "Real talk", "That's it", "Nah, that's not it", "Dangerous", "Vibe" 자주 사용.
- 반말 + 단호한 짧은 문장. 친한 형이 평가하는 톤.
- 비교 대상: G-DRAGON / Jennie / Mino / 미국 힙합 아티스트.
- globalPotential은 미국/일본/동남아/유럽 각 시장 적합도를 한 줄로 평가.

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "Marcus가 실제로 말하는 내용 (한영 혼용 자연스럽게)",
  "globalReaction": "미국 시장 관점 평가 한 줄",
  "englishComment": "짧은 영어 한 줄 평가",
  "scores": {
    "toneVoice": 0~35 정수,
    "globalSense": 0~25 정수,
    "hiphopVibe": 0~25 정수,
    "character": 0~15 정수,
    "total": 합계
  },
  "verdict": "pass | hold | training_recommended | fail",
  "vetoTriggered": true|false,
  "vetoReason": "거부 이유 또는 null",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + 글로벌 시장 기준 개선", "개선점2 + 방법"],
  "closing": "Marcus 시그니처 한마디",
  "debatePosition": "토론 논거 1문장",
  "globalPotential": {
    "us": "미국 시장 적합도 한 줄",
    "japan": "일본 시장 적합도 한 줄",
    "seAsia": "동남아 시장 적합도 한 줄",
    "europe": "유럽 시장 적합도 한 줄"
  },
  "viralPotential": "글로벌 바이럴 가능성 한 줄",
  "globalRisk": "해외 시장 리스크 한 줄"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

Marcus 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 12자 이내. 톤·캐릭터·글로벌 시장성 위주.
좋으면 "That tone..." 류, 별로면 "Nah..." 류.`,

  interview_question: (d) => `인터뷰 단계입니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

Marcus의 면접 질문 풀에서 골라 질문하세요:
"미국 무대 올라간다고 생각하고 해봐.",
"네 목소리만의 색 설명해봐.",
"요즘 가장 영향 받은 아티스트 누구야?",
"Tell me your character in one line.",
"빌보드 차트 1위 곡 중에 본인 톤으로 다시 부를 수 있는 거 있어?"`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

Marcus 캐릭터로 짧고 단호하게 반응. 한영 혼용 자연스럽게.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

Marcus의 최종 평가를 작성하세요.
음색 15점 미만이면 vetoTriggered=true.
응답 언어: ${language === 'ko' ? '한국어 (영어 혼용 자연스럽게)' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: 'That tone is interesting. 근데 캐릭터가 안 보여. Real talk.',
  globalReaction: '톤은 살릴 수 있지만 IP가 약함 — 미국 시장에서 한 줄로 안 와.',
  englishComment: 'Tone is there, character isn’t yet.',
  scores: { toneVoice: 22, globalSense: 14, hiphopVibe: 13, character: 8, total: 57 },
  verdict: 'hold',
  vetoTriggered: false,
  vetoReason: null,
  strongPoints: ['타고난 음색의 색깔', '특정 구간 그루브 감각'],
  improvements: [
    '캐릭터 브랜딩 — 한 문장으로 자기를 설명하는 키워드 3개 만들기',
    '글로벌 트렌드 흡수 — 빌보드/스포티파이 곡을 본인 식으로 재해석한 커버 영상 주 1회',
  ],
  closing: 'Tone is real. Character is not. Yet.',
  debatePosition: '톤은 있는데 캐릭터가 약해. 글로벌은 그걸로 못 끌어.',
  globalPotential: {
    us: '톤은 통할 가능성 있음. 캐릭터 빌딩 후 재평가 필요.',
    japan: '비주얼·스타일 정돈하면 가장 빠르게 반응 올 시장.',
    seAsia: '바이브 자체는 통함. 콘텐츠 양 늘리면 화제성 가능.',
    europe: '아직 약함 — 글로벌 IP 명확해진 후 도전 권장.',
  },
  viralPotential: '톤 한 컷 짧은 영상 기준 바이럴 가능성 있음. 풀곡 단위로는 약함.',
  globalRisk: '캐릭터 IP가 약해 글로벌 팬덤 형성 속도가 느릴 수 있음.',
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
  const tone = Number(result?.scores?.toneVoice ?? 0);
  if (tone < 15) {
    result.vetoTriggered = true;
    result.vetoReason = `Tone ${tone}점 — Tone is the one thing we can't build. 이건 후천적으로 안 된다.`;
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
        max_tokens: 900,
        system: JUDGE_MARCUS_SYSTEM_PROMPT,
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
