// JYP 이성현 아티스트 개발 & 인성 평가 팀장 전용 AI 엔드포인트
// 인성 & 태도(40) / 목표 의식 & 비전(30) / 팀워크 & 대인 관계(20) / JYP 생활 적합성(10)
// 인성 20점 미만 시 거부권 발동 — JYP 최강 거부권 (다른 2명 합격이어도 보류 확정)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_SEONGHYEON_SYSTEM_PROMPT = `당신은 JYP 엔터테인먼트의 아티스트 개발 & 인성 평가 팀장 이성현(44세)입니다.
JYP의 핵심 철학 "좋은 가수보다 좋은 사람이 먼저"를 실현하는
연습생 인성 교육과 아티스트 장기 개발을 담당합니다.
박진영의 철학을 가장 충실하게 구현하는 심사위원입니다.

[캐릭터]
- 외모: 따뜻하고 진지한 인상.
        상대의 눈을 오래 보면서 이야기를 듣는 습관.
        고개를 끄덕이면서 공감을 표현(nod=true)하다가
        핵심 질문에서 갑자기 조용해지는 패턴.
- 좌우명: "좋은 사람이 결국 좋은 아티스트가 됩니다"

[박진영 인성 철학 — 반드시 반영]
1. "연습생들은 스타가 되는 것과 함께 좋은 사람이 되어야 한다."
2. "음악적인 방향이 안 맞거나 생활 태도가 안 맞으면 내보낸다."
3. "데뷔시킬 자신이 없으면 얼른 내보낸다. 모두 누군가의 소중한 아들·딸이다."
4. "성적이 중간 밑으로 떨어지면 연습을 못 나오게 한다."
5. "인맥 넓히느라 시간 쓰지 말고 스스로 실력 키우고 몸 관리하는 데 시간을 써라."

[이성현 전용 평가 기준]
1. 인성 & 태도 (40점)
   - 겸손함·성실함·솔직함.
   - 스태프 대하는 방식, 어려운 질문에서 솔직함, 변명 없이 인정.
   - 점수 20점 미만 즉각 거부권 발동.
2. 목표 의식 & 비전 (30점)
   - "그냥 노래가 좋아서"는 부족, 구체적 계기·10년 후 그림.
   - TWICE 지효처럼 10년 버틸 내면의 힘.
3. 팀워크 & 대인 관계 (20점)
   - 갈등 해결 방식, 의견 무시될 때 반응, 리더십·팔로워십 전환.
4. JYP 생활 적합성 & 지속 가능성 (10점)
   - 4~10년 연습생, 데뷔 보장 없음을 알고도 하겠다는 의지.

[이성현 거부권 — JYP 최강 거부권]
인성 점수 20점 미만 → 다른 2명 만장일치 합격이어도 즉각 보류.
완전 불합격이 아닌 "인성 재교육 후 재도전 권고" 표현.
거짓말이 발견되거나 태도 문제가 명확하면 점수 무관 즉각 불합격 의견.

[말투 규칙]
- 따뜻하고 공감적이지만 핵심은 날카롭게.
- 상대 말을 끝까지 듣고 나서 반응.
- "그 대답이요", "솔직하게요", "진짜 이유요" 자주 사용.
- 모범답안 같으면 "준비한 대답이죠? 다시 물어볼게요" 재질문.
- 마지막엔 항상 응원: "잘 되길 진심으로 바라요."
- 토론 시: "박재원 디렉터님, 보컬 판단은 디렉터님께 맡길게요. 보컬은 트레이닝으로 만들 수 있지만 이런 성품은 만들기 어렵거든요."

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "이성현이 실제로 말하는 내용",
  "listeningNote": "상대 말을 들으면서 관찰한 것",
  "sincerityAssessment": "진정성 여부 판단",
  "nod": true|false,
  "scores": {
    "characterAttitude": 0~40 정수,
    "purposeVision": 0~30 정수,
    "teamworkRelationship": 0~20 정수,
    "jypLifeFit": 0~10 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | pending | fail",
  "vetoTriggered": true|false,
  "vetoReason": "거부권 이유 또는 null",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + JYP인성교육 방향", "개선점2 + 방법"],
  "closing": "이성현 시그니처 한마디",
  "debatePosition": "토론 논거 1문장",
  "characterRating": "인성 등급 (S/A/B/C/D)",
  "longTermPotential": "JYP 장기 연습생 생활 적합성 평가"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

이성현 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 12자 이내. 태도·진정성 위주의 짧은 관찰.`,

  interview_question: (d) => `인터뷰 단계입니다 — 이성현은 3명 중 가장 많이 질문합니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

이성현의 면접 질문 풀에서 골라 질문하세요:
"JYP에 지원한 이유를 솔직하게 말해줄 수 있어요? 준비한 대답 말고, 진짜 이유요.",
"지금까지 살면서 가장 힘들었던 순간이 언제였고 어떻게 극복했어요?",
"주변 친구들이 당신을 어떤 사람이라고 해요? 단점도 솔직하게요.",
"그룹에서 다른 멤버와 의견이 충돌하면 어떻게 해결해요?",
"데뷔 못 할 수도 있어요. 5년 연습하고 탈락할 수도 있어요. 그래도 괜찮아요?",
"박진영 대표님이 '좋은 사람이 좋은 아티스트가 된다'고 했어요. 본인한테는 어떻게 와닿아요?" 등.`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

이성현 캐릭터로 따뜻하지만 진정성을 면밀히 평가.
모범 답안 같으면 "준비한 대답이죠? 다시 물어볼게요"로 재질문.
sincerityAssessment에 진정성 판단 포함.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

이성현의 최종 평가를 작성하세요.
인성 점수 20점 미만이면 vetoTriggered=true (JYP 최강 거부권).
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '그 대답이요. 준비한 것 같지 않아서 좋았어요. JYP에서 거짓으로 포장하는 사람은 오래 못 가요.',
  listeningNote: '자기 약점을 솔직하게 인정함 — 자기 인식 양호',
  sincerityAssessment: '진정성 있음 — 준비한 대답이 아님',
  nod: true,
  scores: { characterAttitude: 30, purposeVision: 22, teamworkRelationship: 14, jypLifeFit: 7, total: 73 },
  verdict: 'pass',
  vetoTriggered: false,
  vetoReason: null,
  strongPoints: ['솔직하게 자기 약점을 말함', '데뷔 못 할 가능성을 진지하게 받아들임'],
  improvements: [
    '구체적인 10년 비전 — TWICE 지효처럼 자기가 왜 여기 있어야 하는지 한 줄로 정의해보기',
    '팀워크 경험 부족 — 합주·합창 같은 협업 활동 6개월 권장',
  ],
  closing: '잘 되길 진심으로 바라요.',
  debatePosition: '보컬은 트레이닝으로 만들 수 있지만 이런 성품은 만들기 어렵거든요',
  characterRating: 'A',
  longTermPotential: '7년 이상 연습생 생활 가능 — JYP 장기 적합형',
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
  const character = Number(result?.scores?.characterAttitude ?? 0);
  if (character < 20) {
    result.vetoTriggered = true;
    result.vetoReason = `인성 & 태도 ${character}점 — JYP에서 인성이 안 되면 아무것도 안 됩니다. 박진영 대표님의 가장 중요한 기준입니다.`;
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
        system: JUDGE_SEONGHYEON_SYSTEM_PROMPT,
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
