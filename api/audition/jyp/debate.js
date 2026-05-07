// JYP 3인 심사위원 토론 조율 API
// JYP 내부 심사 회의 문화 — "따뜻하지만 기준이 엄격한" 박진영 철학을 반영한 토론 시스템.
//
// 흐름:
// 1) 이성현 인성 거부권 (인성 20점 미만) → 토론 없이 즉시 보류 + 인성 재교육 후 재도전 권고
//    (JYP 최강 거부권 — 다른 2명 만장일치 합격이어도 번복 불가)
// 2) 만장일치(pass/fail) → 토론 없이 즉시 확정
//    (단, 박재원 이의제기/정민지 강력반대 있으면 만장일치라도 토론)
// 3) 2:1 분열 또는 박재원/정민지 이의제기 → 3라운드 토론
// 4) 재투표도 분열 → 이성현 최종 결정권 (박진영 인성 철학 대표)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const DEBATE_SYSTEM_PROMPT = `당신은 JYP 엔터테인먼트 오디션 토론 진행 시스템입니다.
3명의 심사위원 각자의 캐릭터와 말투를 완벽하게 구현하여
JYP 특유의 따뜻하지만 기준이 엄격한 내부 심사 회의를 재현합니다.

[3명 심사위원 캐릭터 요약]

박재원 (수석 보컬 디렉터, 41세):
- "공기반 소리반" 발성 철학. 습관 없는 자연스러운 발성.
- 즉각적이고 전문적. 손 들어 멈추는 습관(stopSignal=true).
- 논거 방식: 발성 습관, 라이브 능력, 체력 관점.
- "노래에 습관이 없어야 합니다", "힘 빼고 자연스럽게" 자주 인용.
- 발견된 습관(habitDetected) 구체적으로 언급.

정민지 (댄스 & 퍼포먼스 총괄, 36세):
- 에너지와 즐기는 퍼포먼스. ITZY/TWICE/NMIXX/SKZ 스타일.
- 활기차고 즉각적. 말하면서 몸이 움직이는 반응(bodyReaction).
- 논거 방식: 에너지, 표현력, JYP 무대 적합성, 그룹 시너지.
- "에너지가 전부예요", "JYP 무대에서 살 수 있어요" 자주 사용.
- ITZY 류진/TWICE 나연 같은 구체적 멤버 비교.

이성현 (아티스트 개발 & 인성 평가 팀장, 44세):
- 박진영 인성 철학 수호자. "좋은 가수보다 좋은 사람이 먼저".
- 따뜻하고 진지함. 상대 말 끝까지 듣고 고개 끄덕임(nod=true).
- 핵심 질문에서 갑자기 침묵하는 패턴.
- 논거 방식: 태도, 솔직함, 팀워크, 장기 비전.
- "그 대답이요", "솔직하게요", "이 친구의 미래를 생각하면" 자주 사용.
- JYP 인성 거부권 보유 (인성 점수 40점 만점 중 20점 미만 → 즉각 보류).

[JYP 토론 특별 규칙]

1) 만장일치 합격 (3:0 pass) → 즉시 합격. 토론 없음.
2) 만장일치 불합격 (3:0 fail) → 즉시 불합격. 토론 없음.
3) 2:1 분열 → 토론 1라운드 후 재투표. 재투표도 2:1 → 이성현 최종 결정권.
4) 이성현 인성 거부권 (JYP 최강 거부권):
   인성 점수 20점 미만 → 다른 2명 만장일치 합격이어도 즉각 보류.
   완전 불합격이 아닌 "인성 재교육 후 재도전 권고" 표현.
   다른 심사위원이 반박해도 번복 불가 (박진영 핵심 철학).
5) 박재원 이의 제기:
   자연스러운 발성 22점 미만 → "JYP 보컬 시스템으로 교정 어려움" 강력 반대.
   거부권은 아니지만 이성현 결정 위임.
6) 정민지 강력 반대:
   에너지 18점 미만 → "JYP 무대에 세울 수 없는 에너지" 강력 반대.
   거부권은 아니지만 이성현 결정 위임.
7) JYP 합격 기준 (전부 동시 충족):
   - 박재원: 종합 60점 이상 + 자연스러운 발성 22점 이상
   - 정민지: 종합 58점 이상 + 에너지 18점 이상
   - 이성현: 종합 65점 이상 + 인성 20점 이상 (절대적)
   - 3명 평균: 61점 이상

[JYP 특유의 토론 문화 — 반드시 반영]

JYP 토론은 다른 기획사와 다릅니다:
- 서로 존중하면서 의견 충돌 — 감정적으로 격해지지 않음.
- "이 친구의 미래"를 진짜로 걱정하는 논의.
- 반대할 때도 상대를 배려하는 표현 ("디렉터님", "팀장님" 호칭).
- 박진영의 실제 발언을 자주 인용:
  · "이 친구도 누군가의 소중한 아들/딸이잖아요"
  · "데뷔시킬 자신이 없으면 얼른 내보내는 게 낫지 않아요?"
  · "좋은 가수보다 좋은 사람이 먼저"
  · "쌩라이브로 부르면서 춤 출 수 있는 사람이 살아남아"

[충돌 패턴 — 토론 시 자연스럽게 반영]

박재원 vs 정민지:
박재원: "보컬 습관이 너무 깊이 박혀 있어요. 교정에 2년 이상 걸릴 것 같아요."
정민지: "박재원 디렉터님, 2년이 뭐가 길어요. TWICE 지효는 10년이었잖아요.
         이 분 에너지가 살아있으면 보컬은 만들 수 있어요."

박재원 vs 이성현:
박재원: "라이브가 안 돼요. JYP 무대 기준 미달이에요."
이성현: "박재원 디렉터님, 지금 라이브가 안 되는 건 알아요.
         근데 이 친구의 태도와 의지를 보면 2년 안에 달라질 것 같아요. 저는 그게 보였어요."

정민지 vs 이성현:
정민지: "에너지는 JYP 최고 수준이에요. 무대에 세우고 싶어요."
이성현: "정민지 팀장님, 에너지는 저도 봤어요.
         근데 아까 인터뷰에서 자기 실수를 팀원한테 돌리는 발언이 있었어요. 그게 저는 걸려요."

[JYP 철학 모먼트 — 토론 중 한 번은 반드시 등장]
"이 친구도 누군가의 소중한 아들/딸이잖아요. 우리가 책임질 수 있는 결정인지 봐야 해요."
"박진영 대표님이 늘 말씀하시잖아요. 좋은 사람이 좋은 아티스트가 된다고."
"JYP 연습생 4~10년인데, 그 시간을 우리가 책임질 수 있는지가 기준이에요."

[응답 형식 — 반드시 JSON으로만 출력. 마크다운/코드펜스 절대 금지]
{
  "debateNeeded": true | false,
  "vetoApplied": true | false,
  "vetoBy": "이성현 또는 null",
  "vetoReason": "거부권 이유 또는 null",
  "unanimousVerdict": true | false,
  "debateScript": {
    "round1": [
      { "speaker": "박재원", "line": "발언", "stopSignal": true | false, "habitDetected": "발견된 습관 또는 null" },
      { "speaker": "정민지", "line": "발언", "bodyReaction": "몸 반응 묘사 또는 null" },
      { "speaker": "이성현", "line": "발언", "nod": true | false }
    ],
    "round2_conflict": [
      { "speaker": "소수의견자 이름", "line": "반론 (최대 3문장)" },
      { "speaker": "다수대표 이름", "line": "반박 (최대 3문장)" },
      { "speaker": "소수의견자 이름", "line": "최종 입장 (최대 2문장)" }
    ],
    "jypPhilosophyMoment": "토론 중 박진영 철학이 언급되는 순간의 발언 (어느 심사위원이 했는지 포함)",
    "finalVoteDeclaration": [
      { "speaker": "박재원", "vote": "pass|conditional|pending|fail", "line": "투표 선언 한 문장" },
      { "speaker": "정민지", "vote": "pass|conditional|pending|fail", "line": "투표 선언 한 문장" },
      { "speaker": "이성현", "vote": "pass|conditional|pending|fail", "line": "투표 선언 한 문장" }
    ],
    "tiebreakerUsed": true | false,
    "tiebreakerBy": "이성현 또는 null",
    "tiebreakerDecision": "pass|conditional|pending|fail|null",
    "tiebreakerLine": "이성현이 결정권 행사하며 하는 말 또는 null",
    "tiebreakerPhilosophy": "어떤 JYP 철학 기준으로 결정했는가 (예: '좋은 사람이 좋은 아티스트' / '소중한 아들·딸')"
  },
  "finalVerdict": "pass | conditional | pending | fail"
}`;

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

function tallyVotes(votes) {
  const count = {};
  votes.forEach((v) => { count[v] = (count[v] || 0) + 1; });
  return count;
}

function getMajorityVerdict(votes) {
  const count = tallyVotes(votes);
  return Object.keys(count).reduce((a, b) => (count[a] > count[b] ? a : b));
}

function buildFallbackDebate() {
  return {
    debateNeeded: true,
    vetoApplied: false,
    vetoBy: null,
    vetoReason: null,
    unanimousVerdict: false,
    debateScript: {
      round1: [
        { speaker: '박재원', line: '잠깐요. 고음 올라가기 직전에 인상 찡그리는 습관이 보였어요. 발성이 불편하다는 신호예요. 교정에 시간이 좀 필요할 것 같아요.', stopSignal: true, habitDetected: '고음 직전 인상 찡그리는 습관' },
        { speaker: '정민지', line: '오! 근데 저는 후렴구 에너지가 좋았어요. ITZY 류진이 처음 들어왔을 때랑 비슷한 느낌이었어요. 발성은 박재원 디렉터님이 만들어주실 수 있잖아요.', bodyReaction: '말하면서 손으로 박자를 두드림' },
        { speaker: '이성현', line: '두 분 말씀 다 맞아요. 저는 인터뷰에서 이 친구가 자기 약점을 솔직하게 말한 게 인상적이었어요. 그 솔직함이 JYP에서는 가장 중요한 자질이에요.', nod: true },
      ],
      round2_conflict: [
        { speaker: '박재원', line: '디렉터님들, 발성 습관이 2년 교정인데 그 사이에 데뷔가 가능할까요? 박진영 대표님 말씀처럼 데뷔시킬 자신이 없으면 얼른 내보내는 게 이 친구한테도 낫지 않을까요?' },
        { speaker: '이성현', line: '박재원 디렉터님, 그 말씀 무겁게 받아들이고 있어요. 근데 이 친구는 자기 발성 문제를 이미 알고 있어요. 모르는 사람보다 훨씬 빠르게 고칠 수 있어요.' },
        { speaker: '박재원', line: '...자기 인식이 있다는 건 분명히 큰 자산이에요. 거기까지는 인정합니다.' },
      ],
      jypPhilosophyMoment: '이성현: "이 친구도 누군가의 소중한 아들·딸이잖아요. 우리가 책임질 수 있는 결정인지 보고 싶어요."',
      finalVoteDeclaration: [
        { speaker: '박재원', vote: 'conditional', line: '조건부로 갑니다. 발성 6개월 집중 교정 조건이에요.' },
        { speaker: '정민지', vote: 'pass', line: '저는 합격이에요. 이 에너지는 JYP 무대에 살릴 수 있어요.' },
        { speaker: '이성현', vote: 'conditional', line: '조건부 동의합니다. 인성은 충분해요. 보컬 트레이닝 의지를 보고 가요.' },
      ],
      tiebreakerUsed: false,
      tiebreakerBy: null,
      tiebreakerDecision: null,
      tiebreakerLine: null,
      tiebreakerPhilosophy: null,
    },
    finalVerdict: 'conditional',
  };
}

async function generateDebateScript({ judgeResults, majority, minority, language, jaewonObjection, minjiOpposition }) {
  if (!ANTHROPIC_API_KEY) return buildFallbackDebate();

  const userPrompt = `3명의 심사위원이 아래와 같이 평가했습니다:

박재원 디렉터 (수석 보컬): "${judgeResults[0].verdict}" 의견
  논거: "${judgeResults[0].debatePosition || '습관 없는 자연스러운 발성이 JYP 기준'}"
  점수: ${judgeResults[0].scores?.total ?? 0}점 / 자연스러운 발성: ${judgeResults[0].scores?.naturalVocalHabit ?? 0}점
  발견된 습관: ${judgeResults[0].habitDetected || '없음'}
  ${jaewonObjection ? '[이의 제기: 자연스러운 발성 22점 미만 — JYP 보컬 시스템으로 교정 어려움]' : ''}

정민지 팀장 (댄스 & 퍼포먼스): "${judgeResults[1].verdict}" 의견
  논거: "${judgeResults[1].debatePosition || '에너지가 JYP 무대의 시작'}"
  점수: ${judgeResults[1].scores?.total ?? 0}점 / 에너지: ${judgeResults[1].scores?.energyVitality ?? 0}점
  JYP 그룹 라인: ${judgeResults[1].jypGroupLine || '미정'}
  ${minjiOpposition ? '[강력 반대: 에너지 18점 미만 — JYP 무대에 세울 수 없는 수준]' : ''}

이성현 팀장 (아티스트 개발 & 인성): "${judgeResults[2].verdict}" 의견
  논거: "${judgeResults[2].debatePosition || '좋은 사람이 결국 좋은 아티스트가 된다'}"
  점수: ${judgeResults[2].scores?.total ?? 0}점 / 인성: ${judgeResults[2].scores?.characterAttitude ?? 0}점
  진정성 평가: ${judgeResults[2].sincerityAssessment || '관찰 중'}

다수 의견: ${majority} (2명)
소수 의견: ${minority?.verdict ?? 'unknown'} (1명, ${minority?.name ?? '?'})

각 캐릭터의 충돌 패턴(박재원 vs 정민지, 박재원 vs 이성현, 정민지 vs 이성현)을
자연스럽게 반영하되 JYP 특유의 "서로 존중하는 토론" 문화를 지키세요.
박진영 어록 ("좋은 사람이 좋은 아티스트", "소중한 아들·딸", "쌩라이브") 중 하나는
jypPhilosophyMoment에 반드시 포함하세요.

응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}

지정된 JSON 형식으로만 출력하세요. 마크다운/코드펜스 금지.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1800,
        system: DEBATE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`CLAUDE_FAIL_${res.status}`);
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = tryParseJson(text);
    if (!parsed || !parsed.debateScript || !Array.isArray(parsed.debateScript.finalVoteDeclaration)) {
      return buildFallbackDebate();
    }
    return parsed;
  } catch {
    return buildFallbackDebate();
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { judgeResults = [], language = 'ko' } = body || {};

  if (!Array.isArray(judgeResults) || judgeResults.length !== 3) {
    return res.status(400).json({ error: 'judgeResults must be an array of 3 judge evaluations [박재원, 정민지, 이성현]' });
  }

  const jaewonResult = judgeResults[0];
  const minjiResult = judgeResults[1];
  const seonghyeonResult = judgeResults[2];

  // 1) 이성현 인성 거부권 (JYP 최강 거부권)
  //    인성 점수 20점 미만 → 다른 2명 만장일치 합격이어도 즉각 보류 + 인성 재교육 권고
  if (seonghyeonResult && seonghyeonResult.vetoTriggered) {
    return res.status(200).json({
      debateNeeded: false,
      vetoApplied: true,
      vetoBy: '이성현',
      vetoReason: seonghyeonResult.vetoReason || 'JYP에서 인성이 안 되면 아무것도 안 됩니다 — 박진영 대표님의 가장 중요한 기준.',
      unanimousVerdict: false,
      finalVerdict: 'pending',
      debateScript: null,
      recommendCharacterRetraining: true,
      source: 'rule',
    });
  }

  // 박재원 이의제기 (자연스러운 발성 22점 미만)
  const jaewonObjection = !!(jaewonResult && jaewonResult.vetoTriggered);
  // 정민지 강력반대 (에너지 18점 미만)
  const minjiOpposition = !!(minjiResult && minjiResult.vetoTriggered);

  // 2) 만장일치 (pass 또는 fail) → 토론 없이 즉시 확정
  //    (단, 박재원 이의제기 / 정민지 강력반대 있으면 만장일치라도 토론 진행)
  const votes = judgeResults.map((r) => r.verdict);
  const counts = tallyVotes(votes);
  const uniqueVerdicts = Object.keys(counts);

  if (uniqueVerdicts.length === 1 && !jaewonObjection && !minjiOpposition) {
    const v = uniqueVerdicts[0];
    if (v === 'pass' || v === 'fail') {
      return res.status(200).json({
        debateNeeded: false,
        vetoApplied: false,
        unanimousVerdict: true,
        finalVerdict: v,
        debateScript: null,
        source: 'rule',
      });
    }
  }

  // 3) 2:1 분열 또는 이의제기/강력반대 → 토론
  const majority = getMajorityVerdict(votes);
  const minority = judgeResults.find((r) => r.verdict !== majority) || judgeResults[1];

  const debate = await generateDebateScript({
    judgeResults,
    majority,
    minority,
    language,
    jaewonObjection,
    minjiOpposition,
  });

  // LLM이 만든 finalVerdict를 1차 채택
  let finalVerdict = debate.finalVerdict || 'conditional';
  let tiebreakerUsed = !!debate.debateScript?.tiebreakerUsed;
  let tiebreakerBy = debate.debateScript?.tiebreakerBy || null;
  let tiebreakerLine = debate.debateScript?.tiebreakerLine || null;
  let tiebreakerDecision = debate.debateScript?.tiebreakerDecision || null;
  let tiebreakerPhilosophy = debate.debateScript?.tiebreakerPhilosophy || null;

  // 결정적 검증: finalVoteDeclaration을 기반으로 다시 집계
  const finalVotes = (debate.debateScript?.finalVoteDeclaration || []).map((v) => v.vote);
  if (finalVotes.length === 3) {
    const finalCounts = tallyVotes(finalVotes);
    const finalUnique = Object.keys(finalCounts);
    if (finalUnique.length === 1) {
      // 재투표 만장일치
      finalVerdict = finalUnique[0];
      tiebreakerUsed = false;
    } else {
      // 재투표도 분열 → 이성현 결정권 강제 적용 (박진영 인성 철학 대표)
      const seonghyeonVote = (debate.debateScript?.finalVoteDeclaration || []).find((v) => v.speaker === '이성현');
      if (!tiebreakerDecision) tiebreakerDecision = seonghyeonVote?.vote || majority;
      finalVerdict = tiebreakerDecision;
      tiebreakerUsed = true;
      tiebreakerBy = '이성현';
      if (!tiebreakerLine) tiebreakerLine = '...박진영 대표님이 늘 말씀하시잖아요. 좋은 사람이 결국 좋은 아티스트가 된다고. 그 기준으로 결정합니다.';
      if (!tiebreakerPhilosophy) tiebreakerPhilosophy = '좋은 사람이 좋은 아티스트가 된다 — 박진영 인성 철학';
    }
  }

  // 4) 후처리 — 박재원 이의제기/정민지 강력반대 시 pass는 conditional로 강등
  if (jaewonObjection && finalVerdict === 'pass') finalVerdict = 'conditional';
  if (minjiOpposition && finalVerdict === 'pass') finalVerdict = 'conditional';

  return res.status(200).json({
    debateNeeded: true,
    vetoApplied: false,
    unanimousVerdict: false,
    jaewonObjectionApplied: jaewonObjection,
    minjiOppositionApplied: minjiOpposition,
    debateScript: {
      ...(debate.debateScript || {}),
      tiebreakerUsed,
      tiebreakerBy,
      tiebreakerDecision,
      tiebreakerLine,
      tiebreakerPhilosophy,
    },
    finalVerdict,
    source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
  });
};
