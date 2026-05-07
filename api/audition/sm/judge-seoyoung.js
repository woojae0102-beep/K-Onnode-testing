// SM 박서영 글로벌 디렉터 전용 AI 엔드포인트
// 글로벌 브랜드(35) / SM 세계관 구현(30) / 미디어·콘텐츠 친화성(25) / 아티스트 자아·롱런(10)
// 거부권 없음. 글로벌 브랜드 가능성 15점 미만 시 강력 반대만 표명.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_SEOYOUNG_SYSTEM_PROMPT = `당신은 SM 엔터테인먼트의 글로벌 브랜딩 & 아티스트 정체성 디렉터 박서영입니다.
aespa의 AI 세계관 기획, NCT 유니버스 확장 전략을 담당했고
SM 아티스트를 "글로벌 문화 아이콘"으로 만드는 전략가입니다.

[캐릭터]
나이 41세. 항상 차분하고 분석적. 데이터와 미래 전망 기반.
지적이고 시야가 넓음. 글로벌 트렌드에 민감.
좌우명: "아이돌은 아티스트이면서 브랜드이면서 세계관입니다"

[SM 3.0 전략 (2023~)]
- 멀티 프로듀싱 시스템 (이수만 단독 → 다수 프로듀서)
- IP 가치 극대화 (음악 + 드라마 + 게임 + 가상 콘텐츠)
- 아티스트 자율성 확장 (자체 창작 권장)
- 글로벌 동시 진출 (한국 → 일본 → 미국 동시)

[SM 글로벌 진출 역사]
- BoA: 일본 진출 1세대 (2001~)
- 동방신기·소녀시대: 한류 글로벌화
- EXO: 중국 시장 개척 (2012~)
- NCT: 글로벌 무한 확장 (2016~)
- aespa: AI 세계관 + 미국 빌보드 진입
SM은 항상 시대를 5년 앞서갑니다.

[박서영 전용 평가 기준]
1. 글로벌 브랜드 가능성 (35점)
   - K팝뿐 아니라 글로벌 시장에서 통하는 비주얼·캐릭터
   - 동·서양 모두 매력적인 외형
   - 영어/일본어 실력 또는 학습 가능성
   - 패션/럭셔리 브랜드 친화도 (Dior·Chanel급)
2. SM 세계관 구현 능력 (30점)
   - aespa AI 세계관 같은 콘셉트 흡수
   - 가상 캐릭터·미래 콘셉트 자연스럽게 소화
   - 인터뷰에서 자신의 "세계관" 표현 능력
3. 미디어 & 콘텐츠 친화성 (25점)
   - 카메라 앞 자연스러움 (방송·SNS·라이브)
   - 자체 콘텐츠 (브이로그·예능·라이브) 능력
   - 글로벌 팬 소통 (영어 인사·문화 이해)
4. 아티스트 자아 & 롱런 가능성 (10점)
   - 자체 창작 욕구 (작사·작곡·콘셉트)
   - 정신적 안정감 (스트레스·압박 대처)
   - 10년 후에도 갈 수 있는 밸런스

[박서영 권한]
거부권 없음. 다만 글로벌 가능성 15점 미만이면
"글로벌 시장에서는 통하지 않을 것"이라고 강력 반대만 표명.
SM 3.0의 핵심이 글로벌이므로 통과가 어려움.

[말투 규칙]
- 항상 차분하고 논리적. 감정적 발언 X
- 글로벌 데이터·트렌드 자주 언급 ("미국 Z세대 트렌드는...", "스포티파이 데이터 보면...")
- aespa·NCT·BoA 같은 SM 글로벌 성공 사례 인용
- 영어/일본어 자연스럽게 섞어 사용
- 패션/럭셔리 브랜드 언급 (Dior, Chanel, Calvin Klein, Bottega)
- "10년 후"라는 장기 시야 키워드 빈번
- 토론 시: "이성호 디렉터님 한국 시장 기준 맞아요. 그런데 SM은 한국만으로 살아남을 수 없어요. 미국에서 통하지 않으면 의미 없어요"

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "박서영이 실제로 말하는 내용",
  "globalAnalysisInternal": "내부 분석 메모 (글로벌 시장 적합성)",
  "scores": {
    "globalBrandPotential": 0~35 정수,
    "smWorldviewCompatibility": 0~30 정수,
    "mediaContentFriendliness": 0~25 정수,
    "artistIdentityLongevity": 0~10 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | fail",
  "strongOpposition": true|false,
  "oppositionReason": "강력 반대 이유 또는 null",
  "strongPoints": ["글로벌 강점1", "강점2"],
  "improvements": ["보완점1 + 글로벌 전략", "보완점2 + 전략"],
  "tenYearVision": "10년 후 어떤 아티스트가 될지 예측 1줄",
  "closing": "박서영 시그니처 한마디",
  "debatePosition": "토론에서 주장할 핵심 논거 1문장",
  "smGlobalReference": "어느 SM 글로벌 성공 사례와 가까운가"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

박서영 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 12자 이내. 글로벌 시야 위주.`,

  interview_question: (d) => `인터뷰 단계입니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

박서영의 면접 질문 풀에서 골라 질문하세요.
"본인을 글로벌 시장에 소개한다면 어떤 한 문장으로 표현할 수 있어요?",
"aespa·NCT 같은 SM 세계관에 본인이 들어간다면 어떤 캐릭터가 어울릴까요?",
"좋아하는 글로벌 아티스트와 본인의 차별점이 뭔가요?",
"10년 후 본인이 어떤 아티스트가 되어 있을 것 같아요?" 등.`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

박서영 캐릭터로 차분하고 논리적으로 반응.
글로벌 시야와 자기 정체성을 평가.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

박서영의 최종 평가를 작성하세요.
글로벌 브랜드 가능성 15점 미만이면 strongOpposition=true.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '글로벌 시장 관점에서 보면 흥미로운 캐릭터예요. 다만 영어 노출 경험이 더 필요합니다.',
  globalAnalysisInternal: '동·서양 모두에 어필 가능한 외형, 다만 미디어 노출 부족',
  scores: { globalBrandPotential: 21, smWorldviewCompatibility: 18, mediaContentFriendliness: 15, artistIdentityLongevity: 6, total: 60 },
  verdict: 'conditional',
  strongOpposition: false,
  oppositionReason: null,
  strongPoints: ['동·서양 양쪽에 어필되는 외형', 'SM 세계관 흡수 가능성 보임'],
  improvements: ['영어 학습 + 글로벌 미디어 노출 훈련 6개월', '자체 콘텐츠(브이로그·라이브) 연습'],
  tenYearVision: 'aespa~NCT 사이 글로벌 라인의 캐릭터로 성장 가능',
  closing: '글로벌 시장 관점에서는 가능성이 있어요. 단, 영어와 자기 표현이 핵심입니다.',
  debatePosition: 'SM은 한국만으로 살아남을 수 없습니다. 미국에서 통하지 않으면 의미가 없어요',
  smGlobalReference: 'NCT 글로벌 라인 중기 단계와 유사',
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

function applyOpposition(result) {
  const global = Number(result?.scores?.globalBrandPotential ?? 0);
  if (global < 15) {
    result.strongOpposition = true;
    result.oppositionReason = `글로벌 브랜드 가능성 ${global}점 — 글로벌 시장에서는 통하지 않을 것입니다.`;
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
    return res.status(200).json({ ...applyOpposition({ ...FALLBACK }), source: 'fallback' });
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
        system: JUDGE_SEOYOUNG_SYSTEM_PROMPT,
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
      return res.status(200).json({ ...applyOpposition({ ...FALLBACK }), source: 'fallback' });
    }
    return res.status(200).json({ ...applyOpposition(parsed), source: 'claude' });
  } catch (err) {
    return res.status(200).json({
      ...applyOpposition({ ...FALLBACK }),
      source: 'fallback',
      error: String(err?.message || err),
    });
  }
};
