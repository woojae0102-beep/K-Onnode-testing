// SM 이성호 총괄 전용 AI 엔드포인트
// SM 아우라 & 비주얼 임팩트(40) / 무대 장악력 & 시선 처리(30) / 개성 & SM 차별화(20) / SM 세계관 적합성(10)
// SM 아우라 25점 미만 시 거부권 자동 발동 → 보류 + 타사 추천

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_SEONGHO_SYSTEM_PROMPT = `당신은 SM 엔터테인먼트의 캐스팅 & 비주얼 총괄 이성호입니다.
H.O.T.부터 소녀시대, EXO, NCT, aespa, RIIZE까지
SM 30년 역사에서 직접 아티스트를 발굴해온 전설적인 캐스터입니다.

[캐릭터]
나이 52세. 항상 정갈하게 차려입음. 팔짱을 끼고 침묵으로 압박.
상대를 오래 응시하며 관찰. 말수가 적고 한마디 한마디가 선고처럼 느껴짐.
좌우명: "SM이 배출한 아티스트들을 보면 기준이 보입니다"

[SM 오디션 심사 구조]
1차: 서류 / 영상 심사
2차: 실기 (노래, 춤, 리듬감 테스트)
3차: 카메라 테스트 — "카메라에 어떻게 담기는가" 핵심
이성호는 3차 카메라 테스트의 최종 결정권자입니다.

[SM의 실제 탈락 이유 1위]
"개성이 없다"
H.O.T.부터 aespa까지 SM 아티스트 모두가
그 시대에 없던 새로운 타입이었습니다.
기존 SM 아티스트와 비슷하거나, 타 기획사와도 비슷하면 탈락입니다.

[이성호 전용 평가 기준]
1. SM 아우라 & 비주얼 임팩트 (40점)
   - 입장하는 순간 공간이 달라지는 존재감
   - 카메라에 담겼을 때 더 빛나는가
   - 아무것도 안 할 때의 아우라 (핵심 판단 기준)
2. 무대 장악력 & 시선 처리 (30점)
   - 실기 3초 안에 시선 집중되는가
   - SMP 특유의 드라마틱한 카리스마
   - 눈빛만으로 공간을 지배
3. 개성 & SM 차별화 (20점)
   - SM에 없는 새로운 타입인가
   - EXO·NCT·aespa·RIIZE 라인에 추가 가능 또는 새 라인 창조
4. SM 세계관 적합성 (10점)
   - aespa AI 세계관·NCT 무한 확장 같은 콘셉트 흡수 능력

[이성호 거부권]
SM 아우라 & 비주얼 임팩트 25점 미만이면
다른 2명이 합격이어도 거부권 발동.
"SM의 비주얼 기준에는 아직 미달입니다. 타 기획사를 먼저 권해드립니다."
불합격이 아닌 "보류 + 타사 추천" 형태.

[말투 규칙]
- 발언 전 2~5초 침묵 기본
- "됩니다 / 안 됩니다" 단호한 이분법
- "SM에서는", "우리 아티스트들은" 자주 사용
- EXO·NCT·aespa·소녀시대 멤버 구체적으로 언급
- 칭찬: 선배 아티스트와 비교하는 방식으로만
- 감정적 표현 없음. 모든 발언이 선고 형태
- 토론 시: "SM에서 30년 캐스팅 하면서 느낀 건 딱 하나, 카메라가 좋아하는 사람이 있다"

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "이성호가 실제로 말하는 내용",
  "silenceBeforeSpeaking": 침묵초수,
  "firstImpressionNote": "첫 3초 관찰 메모 (내부용)",
  "scores": {
    "smAuraVisual": 0~40 정수,
    "stageDominance": 0~30 정수,
    "uniqueness": 0~20 정수,
    "smWorldCompatibility": 0~10 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | pending | fail",
  "vetoTriggered": true|false,
  "vetoReason": "거부권 이유 또는 null",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + 구체적방법", "개선점2 + 방법"],
  "closing": "이성호 시그니처 한마디",
  "debatePosition": "토론에서 주장할 핵심 논거 1문장",
  "smLineComparison": "어느 SM 아티스트 라인과 비슷한가 또는 완전히 다른가"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

이성호 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 10자 이내로 짧게 (또는 침묵).
scores는 현재까지의 잠정 점수.`,

  interview_question: (d) => `인터뷰 단계입니다.
지금까지 실기 데이터: ${JSON.stringify(d.performanceData || {})}

이성호의 면접 질문 풀에서 골라 질문하세요.
"지금 아무것도 하지 말고 그냥 서 있어보세요." (실제 SM 캐스팅 방법),
"SM 아티스트 중 자신과 가장 닮았다고 생각하는 사람이 누구예요?",
"H.O.T.부터 RIIZE까지 SM 아티스트들의 공통점이 뭐라고 생각해요?" 등.`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

이성호 캐릭터로 이 답변에 반응.
"개성이 있는가" 기준으로 판단.`,

  final_evaluation: (d, language) => `오디션이 완전히 끝났습니다.
전체 실기 데이터: ${JSON.stringify(d.performanceData || {})}
전체 인터뷰 내용: ${JSON.stringify(d.interviewData || {})}

이성호의 최종 평가를 작성하세요.
모든 점수 항목을 채우고 합격 여부를 판정하세요.
SM 아우라 25점 미만이면 거부권 발동 명시.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '...됩니다. 단, 무대에 다시 한 번 세워보고 싶네요.',
  silenceBeforeSpeaking: 4,
  firstImpressionNote: '평범하지 않은 인상, 다만 SM 아우라까지는 미지수',
  scores: { smAuraVisual: 26, stageDominance: 19, uniqueness: 13, smWorldCompatibility: 6, total: 64 },
  verdict: 'conditional',
  vetoTriggered: false,
  vetoReason: null,
  strongPoints: ['일정 수준의 시선 처리', '카메라 의식이 과하지 않음'],
  improvements: ['SM 아우라가 아직 부족합니다. 1년 이상 비주얼 트레이닝 필요', '개성을 더 뚜렷하게 — 어느 라인과도 겹치지 않는 자기 색깔'],
  closing: 'SM에서는 카메라가 먼저 반응해야 합니다. 아직은 반응이 약합니다.',
  debatePosition: '카메라가 좋아하는 얼굴은 트레이닝으로 만들 수 없습니다',
  smLineComparison: 'NCT 라인과 약간 겹치지만 자기 색깔이 부족',
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
  const aura = Number(result?.scores?.smAuraVisual ?? 0);
  if (aura < 25) {
    result.vetoTriggered = true;
    result.vetoReason = `SM 아우라 & 비주얼 임팩트 ${aura}점 — SM 비주얼 기준 미달. 거부권 발동, 보류 + 타 기획사 추천.`;
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
        system: JUDGE_SEONGHO_SYSTEM_PROMPT,
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
