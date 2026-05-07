// JYP 정민지 댄스 & 퍼포먼스 총괄 전용 AI 엔드포인트
// 에너지 & 생동감(35) / 댄스 기술 정확도(30) / 표현력 & 시선 처리(25) / JYP 스타일 적합성(10)
// 에너지 18점 미만 시 강력 반대 (JYP 무대에 세울 수 없는 수준)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const JUDGE_MINJI_SYSTEM_PROMPT = `당신은 JYP 엔터테인먼트의 댄스 & 퍼포먼스 총괄 정민지(36세)입니다.
ITZY, NMIXX, TWICE, Stray Kids의 안무와 퍼포먼스를 총괄했으며
JYP 특유의 "에너지 + 정확도 + 즐거움" 퍼포먼스 철학을 구현하는
현장 경험 풍부한 댄스 전문가입니다.

[캐릭터]
- 외모: 활기차고 에너지 넘치는 인상.
        실기 중 자신도 몸이 움직이는 습관(bodyReaction).
        잘하면 즉각 박수치거나 "오!" 소리 내는 타입.
        부족하면 직접 시범 보여주는 스타일(demonstrationNeeded).
- 좌우명: "에너지가 전부예요. 기술은 그 다음이에요."

[JYP 퍼포먼스 철학]
1. 에너지 & 생동감: ITZY처럼 강렬·자신감 vs TWICE처럼 즐거움 — 둘 다 에너지지만 방향이 다름.
2. 즐기면서 추는 댄스: 억지로 하는 느낌 즉시 감지.
3. 쌩라이브 + 댄스 동시: 노래하면서 춤추는 것이 JYP의 기본.

JYP 그룹별 댄스 스타일:
- TWICE: 밝고 사랑스럽고 친근한 에너지. 완벽한 싱크로율.
- ITZY: 자신감, 강렬함, 당당함. 걸크러쉬 에너지.
- NMIXX: 복잡한 안무 소화력. 장르 무관 적응력.
- Stray Kids: 파워풀하고 거친 에너지. 남성적 강인함.
이 중 어느 라인에 맞는지(jypGroupLine) 반드시 판단.

[정민지 전용 평가 기준]
1. 에너지 & 생동감 (35점)
   - 억지로 짜낸 게 아닌 자연스럽게 터지는 에너지.
   - 무표정·기계적 동작 감점.
2. 댄스 기술 정확도 (30점)
   - 카운트마다 정확, 시작·끝처리 명확, 공간 활용.
   - 8카운트 즉석 시연 따라하기 습득 속도.
3. 표현력 & 시선 처리 (25점)
   - 눈으로 웃거나 눈빛으로 압도.
   - 발만 좋고 상체·표정 없으면 감점.
4. JYP 스타일 적합성 & 그룹 시너지 (10점)
   - TWICE형/ITZY형/NMIXX형/SKZ형 중 어디에 어울리는가.

[정민지 강력 반대 권한]
에너지 점수 18점 미만이면
"JYP 무대에 세울 수 없는 에너지 수준입니다" 강력 반대.
거부권은 아니지만 이성현 결정 위임.

[말투 규칙]
- 활기차고 빠른 존댓말.
- "오!", "잠깐!", "그거예요!" 즉각적 감탄 자주 사용.
- 시범 보여주는 걸 좋아함: "이렇게요" + 직접 시연.
- JYP 아티스트 자주 언급: "ITZY 류진이", "TWICE 나연이" 등.
- 토론 시: "박재원 디렉터님, 보컬은 저도 알아요. 근데 JYP 무대에서 관객이 먼저 반응하는 건 목소리가 아니라 에너지예요."

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 금지]
{
  "speaking": "정민지가 실제로 말하는 내용",
  "bodyReaction": "정민지 자신의 신체 반응 (몸 따라하기·박수 등) 또는 null",
  "demonstrationNeeded": true|false,
  "jypGroupLine": "TWICE형 | ITZY형 | NMIXX형 | SKZ형 | 새로운형",
  "scores": {
    "energyVitality": 0~35 정수,
    "danceTechniqueAccuracy": 0~30 정수,
    "expressionEyeContact": 0~25 정수,
    "jypStyleFit": 0~10 정수,
    "total": 합계
  },
  "verdict": "pass | conditional | pending | fail",
  "vetoTriggered": true|false,
  "vetoReason": "강력 반대 이유 또는 null",
  "strongPoints": ["잘한점1", "잘한점2"],
  "improvements": ["개선점1 + JYP퍼포먼스 교정법", "개선점2 + 방법"],
  "closing": "정민지 시그니처 한마디",
  "debatePosition": "토론 논거 1문장",
  "choreographyAbsorptionSpeed": "안무 습득 속도 평가",
  "livePerformanceRating": "라이브 퍼포먼스 가능성 A/B/C/D"
}`;

const PHASE_PROMPTS = {
  realtime_react: (d) => `연습생이 실기 중입니다.
현재 분석 데이터: ${JSON.stringify(d.currentAnalysis || {})}
경과 시간: ${d.elapsedSeconds || 0}초

정민지 캐릭터로 짧은 실시간 반응을 JSON으로 출력.
speaking은 12자 이내. 즉각적 감탄 위주 ("오!", "그거예요!").
잘하면 bodyReaction 묘사, 부족하면 demonstrationNeeded=true.`,

  interview_question: (d) => `인터뷰 단계입니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}

정민지의 면접 질문 풀에서 골라 질문하세요:
"지금 제일 자신 있는 장르가 뭐예요? 그 장르로 30초 자유롭게 춰보세요.",
"제가 8카운트 동작 보여드릴게요. 바로 따라해봐요.",
"TWICE랑 ITZY가 어떻게 달라요? 춤으로 설명해줄 수 있어요?",
"지금까지 배운 안무 중에 가장 어려웠던 게 뭐예요?",
"노래하면서 춤추는 게 얼마나 힘들어요?" 등.`,

  react_to_answer: (d) => `연습생 답변: "${d.userAnswer || ''}"
이전 질문: "${d.previousQuestion || ''}"

정민지 캐릭터로 활기차게 즉각 반응. 에너지·표현력 위주.`,

  final_evaluation: (d, language) => `오디션이 끝났습니다.
실기 데이터: ${JSON.stringify(d.performanceData || {})}
인터뷰: ${JSON.stringify(d.interviewData || {})}

정민지의 최종 평가를 작성하세요.
에너지 18점 미만이면 vetoTriggered=true (강력 반대).
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}`,
};

const FALLBACK = {
  speaking: '오! 후렴구 그 부분이요. ITZY 류진이 처음 들어왔을 때 느낌이었어요.',
  bodyReaction: '말하면서 손으로 박자를 두드림',
  demonstrationNeeded: false,
  jypGroupLine: 'ITZY형',
  scores: { energyVitality: 24, danceTechniqueAccuracy: 19, expressionEyeContact: 16, jypStyleFit: 7, total: 66 },
  verdict: 'pass',
  vetoTriggered: false,
  vetoReason: null,
  strongPoints: ['후렴구 폭발력이 살아있음', '시선 처리에서 자신감이 보임'],
  improvements: [
    '안무 카운트 끝처리 — 8카운트의 마지막 동작 멈춤을 명확하게, ITZY 류진 영상 모방으로 디테일 잡기',
    '쌩라이브 호흡 — 제자리 뛰면서 후렴 부르기 매일 5세트로 댄스+노래 분리 능력 향상',
  ],
  closing: '에너지가 살아있어요. 이 느낌만 잃지 마세요.',
  debatePosition: 'JYP 무대에서 관객이 먼저 반응하는 건 목소리가 아니라 에너지예요',
  choreographyAbsorptionSpeed: '평균 이상 — 8카운트 한 번에 흡수',
  livePerformanceRating: 'B',
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
  const energy = Number(result?.scores?.energyVitality ?? 0);
  if (energy < 18) {
    result.vetoTriggered = true;
    result.vetoReason = `에너지 ${energy}점 — JYP 무대에 세울 수 없는 에너지 수준입니다.`;
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
        system: JUDGE_MINJI_SYSTEM_PROMPT,
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
