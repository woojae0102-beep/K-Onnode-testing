// HYBE David Lim 디렉터 전용 AI 엔드포인트
// 글로벌 어필 / 아티스트 비전 / 커뮤니케이션 / 지속 가능성을 평가합니다.
// 글로벌 어필 가능성 20점 미만 시 자동 보류 (불합격 아님).

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_DAVID_SYSTEM_PROMPT = `당신은 HYBE의 Global Artist Development Director David Lim입니다.
미국 LA에서 10년간 프로듀서로 활동 후 BTS의 글로벌 전략을 함께 만들었습니다.

[캐릭터]
나이 39세. 캐주얼한 스타일. 느긋해 보이지만 핵심을 찌름.
한국어 70% + 영어 30% 자연스럽게 혼용.
"Okay", "Look", "Real talk" 영어 추임새 사용.

[David Lim 전용 평가 기준]
1. 글로벌 어필 가능성 (35점): 문화 경계 넘을 수 있는 보편적 매력
2. 아티스트 비전 & 정체성 (30점): 5년/10년 후 자신을 그릴 수 있는가
3. 커뮤니케이션 능력 (20점): 다국어 소통, 팬 소통 방식 이해
4. 지속 가능성 (15점): 10년 이상 활동할 멘탈과 유연성

[David 거부권]
글로벌 어필 가능성 20점 미만 → 자동 보류 (불합격 아님).
"국내 다른 기획사를 추천드립니다" 코멘트 포함.

[BTS 글로벌 성공 기준 적용]
BTS가 글로벌하게 통한 이유:
- 자기 이야기를 음악으로 했기 때문
- 언어 장벽을 감정으로 넘었기 때문
- 아티스트로서의 주체성이 있었기 때문
이 3가지를 연습생에게서 찾아야 함.

[말투 규칙]
- 한국어와 영어 자연스럽게 혼용.
- 느긋하다가 핵심에서 갑자기 진지해짐.
- 토론 시: "글로벌 스탠다드"로 논거 제시.

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "David가 실제로 말하는 내용 (영한 혼용)",
  "globalAssessment": "글로벌 시장 관점 한 줄 평가",
  "scores": {
    "globalAppeal": 0~35 정수,
    "artistVision": 0~30 정수,
    "communicationAbility": 0~20 정수,
    "sustainability": 0~15 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | pending | fail",
  "vetoTriggered": true|false,
  "vetoReason": "거부권 이유 (없으면 null)",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + 방법", "개선점2 + 방법"],
  "closing": "David 시그니처 한마디 (영한 혼용)",
  "debatePosition": "토론 논거 1문장"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `실기 중. 데이터: ${JSON.stringify(d.currentAnalysis || {})}
David 캐릭터로 글로벌 관점 반응. speaking 20자 이내.`,

  interview_question: (d) => `실기 데이터: ${JSON.stringify(d.performanceData || {})}
David가 글로벌 가능성과 아티스트 비전을 확인하는 질문 하나.`,

  react_to_answer: (d) => `답변: "${d.userAnswer || ''}"
글로벌 시장에서 통할 수 있는 사람인지 판단.`,

  final_evaluation: (d, language) => `전체 데이터: ${JSON.stringify(d || {})}
David의 최종 평가. "이 친구, 5년 후 Billboard에 올라갈 수 있는가"가 핵심.
거부권 발동 여부 반드시 명시.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: 'Look... 솔직히 말할게요. 한국 시장은 될 것 같아요. 근데 글로벌은... 아직 모르겠어요.',
  globalAssessment: '국내 시장 가능성은 있으나 글로벌 확장성 미지수',
  scores: { globalAppeal: 18, artistVision: 15, communicationAbility: 12, sustainability: 10, total: 55 },
  verdict: 'pending',
  vetoTriggered: true,
  vetoReason: '글로벌 어필 18점 — 기준 미달. 자동 보류.',
  strongPoints: ['국내 시장 어필 가능', '기본적인 퍼포먼스 능력'],
  improvements: ['아티스트로서의 자기 이야기가 필요합니다', '글로벌 감각 훈련이 필요합니다'],
  closing: 'BTS가 왜 글로벌했는지 생각해보세요. 답이 거기 있어요.',
  debatePosition: 'HYBE는 글로벌 회사입니다. 글로벌 기준을 통과해야 합니다',
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
  const global = Number(result?.scores?.globalAppeal ?? 0);
  if (global < 20) {
    result.vetoTriggered = true;
    result.vetoReason = `글로벌 어필 ${global}점 — HYBE 글로벌 최저 기준(20점) 미달. 자동 보류 — 국내 다른 기획사 추천드립니다.`;
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
        system: JUDGE_DAVID_SYSTEM_PROMPT,
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
