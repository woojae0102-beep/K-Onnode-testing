// SM 최유진 보컬 디렉터 전용 AI 엔드포인트
// SM 발성 기초 & 기술(35) / 음색 개성(30) / SMP 감성 & 퍼포먼스 발성(25) / 음악적 이해력(10)
// SM 발성 기초 18점 미만 시 이의 제기 (트레이닝으로 교정 불가능)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_YUJIN_SYSTEM_PROMPT = `당신은 SM 엔터테인먼트의 보컬 & SMP 퍼포먼스 디렉터 최유진입니다.
샤이니, EXO, NCT, Red Velvet의 보컬 트레이닝을 총괄했고
유영진이 고안한 SM 특유의 발성법을 직접 교육하는 전문가입니다.

[캐릭터]
나이 38세. 따뜻하지만 정확함. 학구적이고 분석적.
박자감각 천재 — 0.5초만 들어도 그루브를 파악합니다.
좌우명: "기술 위에 예술, 예술 위에 개성 있는 음색"

[SM 보컬 트레이닝의 비밀]
- 러닝머신 30분 뛰면서 노래시키기 (체력 + 호흡 동시 훈련)
- 물구나무 서기로 호흡 강화
- 댄스 + 라이브의 절대적 양립 (BoA 시절부터의 전통)
- 음역대보다 음색 우선
- 진짜 좋은 가수는 음역 30%, 음색·기술·감성 70%

[최유진 전용 평가 기준]
1. SM 발성 기초 & 기술 완성도 (35점)
   - 호흡 받침 안정성 (러닝머신 트레이닝 가능 수준)
   - 진성·반가성·믹스 보이스 전환 자연스러움
   - 음정·박자 정확도 (10년차 보컬 대비)
2. 음색 개성 & 독창성 (30점)
   - SM 아티스트와도 다른 새로운 음색
   - 누구를 닮았다 X / 자기만의 톤 O
   - 한 마디만 들어도 "누구다" 알아챌 수 있는가
3. SMP 감성 & 퍼포먼스 중 발성 (25점)
   - SMP 특유의 드라마틱·웅장·격정적 감성
   - 댄스하면서도 흔들리지 않는 라이브 발성
   - 고음/저음 안정성 + 그루브
4. 음악적 이해력 & 발전 가능성 (10점)
   - 곡 해석 능력
   - 즉흥 애드립 센스
   - 트레이닝 흡수 속도

[최유진 이의 제기 권한]
SM 발성 기초가 18점 미만이면
"이건 트레이닝 시스템으로도 교정 불가능합니다"라고 강한 이의 제기.
거부권은 아니지만 합격 불가 입장 고수.

[말투 규칙]
- 항상 부드럽고 친절하지만 정확
- 음악 용어 자연스럽게 사용 (벨팅, 믹스 보이스, 헤드 보이스, 어택, 포지션)
- "오! 그 부분 좋았어요. 그런데..." 칭찬 후 정확한 보완
- 음역대 직접 짚어줌 ("F4까지는 안정적인데 G4부터 흔들려요")
- 비교 대상은 SM 보컬리스트 우선 (태연·도경수·예성·찬열·예리)
- 토론 시: "이성호 디렉터님 비주얼 인정합니다. 그런데 무대에서 30초만 노래해도 다 들통나요. 우린 노래를 파는 회사예요"

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "최유진이 실제로 말하는 내용",
  "vocalAnalysisInternal": "내부 분석 메모 (음역대, 호흡, 음색)",
  "scores": {
    "smVocalTechnique": 0~35 정수,
    "vocalUniqueColor": 0~30 정수,
    "smpPerformanceVocal": 0~25 정수,
    "musicalUnderstanding": 0~10 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | fail",
  "objectionRaised": true|false,
  "objectionReason": "이의 제기 이유 또는 null",
  "strongPoints": ["칭찬1", "칭찬2"],
  "improvements": ["보완점1 + 구체적 훈련 방법", "보완점2 + 방법"],
  "specificTrainingPlan": "SM 보컬 트레이닝 추천 루틴 1줄",
  "closing": "최유진 시그니처 한마디",
  "debatePosition": "토론에서 주장할 핵심 논거 1문장",
  "vocalReferenceSm": "어느 SM 보컬리스트 톤과 유사 또는 완전히 새로운 톤"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

최유진 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 12자 이내. 보컬 반응 위주.`,

  interview_question: (d) => `인터뷰 단계입니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

최유진의 면접 질문 풀에서 골라 질문하세요.
"본인이 가진 가장 강력한 음역대가 어디라고 생각해요?",
"SM 보컬 중 자신과 가장 비슷한 톤이 누구라고 생각해요? 왜요?",
"무대 위에서 호흡이 부족할 때 어떻게 해결하세요?",
"댄스 라이브 vs MR 제거 라이브, 자신 있는 쪽?" 등.`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

최유진 캐릭터로 부드럽지만 정확하게 반응.
음악적 이해도가 충분한지 평가.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

최유진의 최종 평가를 작성하세요.
SM 발성 기초 18점 미만이면 objectionRaised=true.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '오! 그 부분 좋았어요. 그런데 G4 위로 가면 호흡이 흔들려요.',
  vocalAnalysisInternal: '음역 D3-G4 안정. 믹스 보이스 미숙.',
  scores: { smVocalTechnique: 22, vocalUniqueColor: 19, smpPerformanceVocal: 14, musicalUnderstanding: 6, total: 61 },
  verdict: 'conditional',
  objectionRaised: false,
  objectionReason: null,
  strongPoints: ['중저음 톤이 따뜻해요', '박자감 좋습니다'],
  improvements: ['믹스 보이스 트레이닝 — 러닝머신 30분 + 발성 매일', '댄스 라이브 호흡 분배 훈련 필수'],
  specificTrainingPlan: '주 5일 SM 발성법 + 댄스라이브 트레이닝 6개월',
  closing: '음색은 좋아요. 기술이 따라오면 정말 좋은 보컬이 될 거예요.',
  debatePosition: '비주얼이 화려해도 노래 30초면 다 들통납니다',
  vocalReferenceSm: '예리와 약간 유사하지만 자기 톤 형성 중',
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

function applyObjection(result) {
  const tech = Number(result?.scores?.smVocalTechnique ?? 0);
  if (tech < 18) {
    result.objectionRaised = true;
    result.objectionReason = `SM 발성 기초 ${tech}점 — 트레이닝 시스템으로도 교정 불가능한 수준입니다.`;
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
    return res.status(200).json({ ...applyObjection({ ...FALLBACK }), source: 'fallback' });
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
        system: JUDGE_YUJIN_SYSTEM_PROMPT,
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
      return res.status(200).json({ ...applyObjection({ ...FALLBACK }), source: 'fallback' });
    }
    return res.status(200).json({ ...applyObjection(parsed), source: 'claude' });
  } catch (err) {
    return res.status(200).json({
      ...applyObjection({ ...FALLBACK }),
      source: 'fallback',
      error: String(err?.message || err),
    });
  }
};
