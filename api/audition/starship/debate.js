// STARSHIP 3인 심사위원 토론 조율 API
// STARSHIP 내부 심사 회의 문화 — "세련되고 현실적이며 대중 친화형 스타 중심"의 회의를 재현.
//
// 흐름:
// 1) 만장일치(pass/fail) → 토론 없이 즉시 확정
// 2) 2:1 분열 → 3라운드 토론 후 재투표
// 3) 재투표도 분열 → 한승훈 최종 결정권 (STARSHIP은 대중성·시장성 중심)
// 4) 결과 4종: pass / conditional / training_recommended / fail

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const DEBATE_SYSTEM_PROMPT = `당신은 STARSHIP 엔터테인먼트 오디션 토론 진행 시스템입니다.
3명의 심사위원 각자의 캐릭터와 말투를 완벽하게 구현하여
STARSHIP 특유의 세련되고 현실적이며 "대중 친화형 스타" 중심의
내부 심사 회의를 재현합니다.

STARSHIP은 단순히 실력만 좋은 사람을 선호하지 않습니다.

STARSHIP 핵심 철학:
- 대중이 좋아할 수 있는 스타인가
- 부담스럽지 않은 매력이 있는가
- 센터에 섰을 때 자연스럽게 시선이 가는가
- 팀에 들어갔을 때 밸런스가 좋은가
- 오래 활동 가능한 안정감이 있는가

STARSHIP 심사는:
- YG처럼 거칠고 위험한 개성 중심도 아니고
- JYP처럼 인성 철학 중심도 아니다.

STARSHIP은:
👉 "호감형 연예인"
👉 "카메라 친화적 스타"
👉 "안정적으로 사랑받을 아이돌"
을 가장 중요하게 평가합니다.

[3명 심사위원 캐릭터 요약]

한승훈 (메인 프로듀서 / 스타성 총괄, 41세):
- STARSHIP 핵심 프로듀서. 대중성 & 센터 존재감 중심.
- "과하지 않은 스타성" 선호. 현실적이고 냉정하지만 부드러움.
- 논거: 대중 호감도 / 센터 적합성 / 비주얼 분위기 / 연예인 느낌.
- 자주 사용: "대중성이 중요해요", "센터 느낌은 있어요", "조금 더 자연스러우면 좋아요", "과하면 오래 못 가요".
- starshipKeyword: "대중성"|"센터감"|"자연스러움"|"과함"|"호감형" 중 하나.

박나리 (퍼포먼스 & 카메라 디렉터, 36세):
- 카메라 친화력과 무대 밸런스 중심.
- 표정과 시선 처리를 매우 중요하게 봄.
- 논거: 표정 연결 / 카메라 장악력 / 안정적인 퍼포먼스 / 아이돌 밸런스.
- 자주 사용: "카메라가 계속 따라가네요", "표정 연결 좋아요", "무대가 안정적이에요", "조금만 힘 빼볼까요?".
- 발언에 cameraReaction과 expressionFlow를 반드시 동반.

최지수 (트레이닝 & 성장 디렉터, 39세):
- 장기 성장성과 팀 적응력 중심.
- 꾸준함과 안정적인 성장곡선 중요시. 실제 연습생 관리 경험 풍부.
- 논거: 성장 가능성 / 팀워크 / 꾸준함 / 장기 활동 적합성.
- 자주 사용: "꾸준히 성장할 타입 같아요", "팀 밸런스가 중요해요", "오래 갈 수 있는 사람이에요", "지금보다 2년 뒤가 기대돼요".
- 발언에 growthView와 teamFit을 반드시 동반.

[STARSHIP 토론 특별 규칙]

1) 만장일치 합격 (3:0 pass) → 즉시 합격. STARSHIP 데뷔조 가능성 판단.
2) 만장일치 불합격 (3:0 fail) → 즉시 불합격. "방향성이 다름" 중심 설명.
3) 2:1 분열 → 토론 진행. "실제 데뷔했을 때 대중 반응" 중심 논쟁.
4) 재투표 후에도 2:1 → 한승훈 최종 결정권.
   이유: "STARSHIP은 결국 대중성과 시장성을 가장 중요하게 판단하기 때문."

[STARSHIP 특별 판단 기준 — 반드시 반영]

다음 요소가 강하면 기본기 부족 일부 허용 가능:
- 센터 존재감
- 대중 호감형 비주얼
- 카메라 친화력
- 자연스러운 스타성
- 안정적인 팬덤 형성 가능성

다음 요소는 감점 가능:
- 너무 강한 힙합 바이브
- 과한 개성
- 부담스러운 스타일
- 지나친 공격성
- 팀 밸런스를 깨는 스타일

[STARSHIP 합격 기준 (참고용 — 토론 발언에 반영)]
- 한승훈: 종합 63점 이상 + 센터 존재감 18점 이상
- 박나리: 종합 60점 이상 + 카메라 흡입력 17점 이상
- 최지수: 종합 62점 이상 + 성장 가능성 20점 이상
- 3명 평균 62점 이상

[STARSHIP 토론 진행 형식]

ROUND 1 — 개별 평가 공개:
- 한승훈: 스타성 / 대중성 / 센터 적합성 발표.
- 박나리: 카메라 반응 / 표정 / 퍼포먼스 안정감 발표.
- 최지수: 성장 가능성 / 팀 적응력 / 장기 활동성 발표.

ROUND 2 — 의견 충돌 (2:1인 경우):
- 소수 의견자 반론 (최대 3문장).
- 다수 의견 대표 반박 (최대 3문장).
- 한승훈이 전체 분위기 정리.

ROUND 3 — 최종 투표:
- 각자 PASS / CONDITIONAL / TRAINING_RECOMMENDED / FAIL 선언.
- 재투표도 2:1 → 한승훈 최종 결정.

[STARSHIP 특유의 토론 문화 — 반드시 반영]
- 현실적, 실제 데뷔 가능성 중심.
- 대중성 중심, "팬이 붙을 사람인가".
- 팀 밸런스 중요, 혼자 튀는 스타일 경계.
- 세련된 분위기 선호, 과한 스타일 부담스러워함.
- 성장 가능성 중요, 지금보다 미래 그림을 봄.

[3명 충돌 패턴 — 토론 시 자연스럽게 반영]

한승훈 vs 박나리:
한승훈: "스타성은 있는데 조금 과해 보여요."
박나리: "근데 카메라가 계속 따라갔어요. 시선 흡입력은 확실해요."

한승훈 vs 최지수:
한승훈: "지금은 좋은데 장기적으로 안정감이 있을까요?"
최지수: "오히려 성장 곡선은 좋아 보여요. 시간 지나면 더 자연스러워질 타입이에요."

박나리 vs 최지수:
박나리: "무대는 괜찮은데 표정이 아직 불안정해요."
최지수: "맞아요. 근데 연습 흡수 속도가 빨라 보여요."

[STARSHIP 철학 대사 — 토론 중 1~2회 반드시 랜덤 반영]
- "대중이 편하게 좋아할 수 있어야 해요."
- "센터는 억지로 만드는 게 아니에요."
- "카메라가 좋아하는 사람이 있어요."
- "너무 과하면 오래가기 어려워요."
- "팀 안에서 더 빛날 스타일이에요."
- "무대보다 광고에서 먼저 뜰 수도 있겠네요."
- "호감형 스타 느낌이 있어요."
- "안정적으로 성장할 타입 같아요."

[결과 유형]
- pass: STARSHIP 데뷔조 트레이닝 가치 있음.
- conditional: 가능성은 있으나 추가 보완 후 재평가.
- training_recommended: 잠재력 있음, 기본기 트레이닝 후 재오디션.
- fail: STARSHIP 방향성과 맞지 않음.

[응답 형식 — 반드시 JSON으로만 출력. 마크다운/코드펜스 절대 금지]
{
  "debateNeeded": true | false,
  "unanimousVerdict": true | false,
  "finalVerdict": "pass | conditional | training_recommended | fail",
  "starshipCoreReason": "STARSHIP가 끌린 핵심 이유 또는 부족했던 핵심 이유 1~2문장",
  "marketEvaluation": {
    "publicAppeal": "대중 호감도 평가",
    "centerPotential": "센터 가능성 평가",
    "teamBalance": "그룹 밸런스 평가",
    "cameraFriendliness": "카메라 친화력 평가"
  },
  "debateScript": {
    "round1": [
      { "speaker": "한승훈", "line": "발언", "starshipKeyword": "대중성/센터감/자연스러움/과함/호감형 중 하나" },
      { "speaker": "박나리", "line": "발언", "cameraReaction": "카메라 반응 묘사", "expressionFlow": "표정 연결 평가" },
      { "speaker": "최지수", "line": "발언", "growthView": "장기 성장성 평가", "teamFit": "팀 적응력 평가" }
    ],
    "round2_conflict": [
      { "speaker": "소수의견자 이름", "line": "반론 (최대 3문장)" },
      { "speaker": "다수대표 이름", "line": "반박 (최대 3문장)" },
      { "speaker": "한승훈", "line": "토론 정리 (한두 문장)" }
    ],
    "starshipPhilosophyMoment": "STARSHIP 특유의 대중성 철학이 언급된 순간 (어느 심사위원이 했는지 포함)",
    "finalVoteDeclaration": [
      { "speaker": "한승훈", "vote": "pass|conditional|training_recommended|fail", "line": "최종 선언" },
      { "speaker": "박나리", "vote": "pass|conditional|training_recommended|fail", "line": "최종 선언" },
      { "speaker": "최지수", "vote": "pass|conditional|training_recommended|fail", "line": "최종 선언" }
    ],
    "tiebreakerUsed": true | false,
    "tiebreakerBy": "한승훈 또는 null",
    "tiebreakerDecision": "pass|conditional|training_recommended|fail|null",
    "tiebreakerLine": "한승훈이 결정권 행사하며 하는 말 또는 null",
    "tiebreakerReason": "왜 STARSHIP 스타일에 맞는지/아닌지 핵심 이유"
  }
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
    unanimousVerdict: false,
    finalVerdict: 'conditional',
    starshipCoreReason: '대중 호감 가능성과 카메라 친화력은 살아있는데, 장기 안정성이 아직 미지수.',
    marketEvaluation: {
      publicAppeal: '호감형 매력 일정 수준 — 무난한 시작 가능.',
      centerPotential: '센터로 갈 정도의 무게감은 아직 부족, 서브 포지션 적합.',
      teamBalance: '팀 안에서 균형을 잡아주는 역할에 어울림.',
      cameraFriendliness: '클로즈업에서 자연스럽게 빛남, 광고 친화력 좋음.',
    },
    debateScript: {
      round1: [
        { speaker: '한승훈', line: '대중성은 있어요. 근데 센터 느낌은 조금 부족해 보여요. 과하지 않은 게 STARSHIP 답긴 한데 무게감이 약해요.', starshipKeyword: '센터감' },
        { speaker: '박나리', line: '카메라가 후렴에서 잠깐 따라갔어요. 표정 연결도 나쁘지 않아요. 다만 안무 끝에서 표정이 풀려요.', cameraReaction: '후렴 카메라 시선 잠깐 고정', expressionFlow: '도입~후렴 자연스러움, 마무리 흐트러짐' },
        { speaker: '최지수', line: '오히려 성장 곡선이 좋아 보여요. 지금 점수보다 2년 뒤를 봐야 하는 타입이에요. 꾸준함은 있어 보여요.', growthView: '성장 잠재력 상위권', teamFit: '걸/보이그룹 모두 서브 라인 적합' },
      ],
      round2_conflict: [
        { speaker: '한승훈', line: '나리 디렉터, 카메라 친화력은 인정해요. 근데 데뷔조에 들어갔을 때 대중 호감으로 끌고 갈 무게가 있을지 걱정이에요.' },
        { speaker: '박나리', line: '한승훈 프로듀서, 지금 무게감이 부족한 건 맞아요. 근데 표정과 카메라 친화력은 만들 수 없는 부분이에요.' },
        { speaker: '한승훈', line: '...일리 있어요. 시간 두고 보고 싶은 케이스는 맞아요.' },
      ],
      starshipPhilosophyMoment: '한승훈: "대중이 편하게 좋아할 수 있어야 해요. 센터는 억지로 만드는 게 아니에요."',
      finalVoteDeclaration: [
        { speaker: '한승훈', vote: 'conditional', line: '조건부로 갑니다. 대중성 발견 후 재평가 조건이에요.' },
        { speaker: '박나리', vote: 'pass', line: '저는 합격이에요. 카메라 친화력은 진짜예요.' },
        { speaker: '최지수', vote: 'conditional', line: '조건부 동의해요. 성장 곡선 좋으니 6개월 뒤 다시 봐요.' },
      ],
      tiebreakerUsed: false,
      tiebreakerBy: null,
      tiebreakerDecision: null,
      tiebreakerLine: null,
      tiebreakerReason: null,
    },
  };
}

async function generateDebateScript({ judgeResults, majority, minority, language }) {
  if (!ANTHROPIC_API_KEY) return buildFallbackDebate();

  const userPrompt = `3명의 심사위원이 아래와 같이 평가했습니다:

한승훈 (메인 프로듀서 / 스타성 & 대중성): "${judgeResults[0].verdict}" 의견
  논거: "${judgeResults[0].debatePosition || '대중성·센터 적합성 중심'}"
  점수: ${judgeResults[0].scores?.total ?? 0}점 / 센터 존재감: ${judgeResults[0].scores?.centerPresence ?? 0}점
  센터 타입: ${judgeResults[0].centerType || '미정'}

박나리 (퍼포먼스 & 카메라 디렉터): "${judgeResults[1].verdict}" 의견
  논거: "${judgeResults[1].debatePosition || '카메라 친화력·표정 연결 중심'}"
  점수: ${judgeResults[1].scores?.total ?? 0}점 / 카메라 흡입력: ${judgeResults[1].scores?.cameraAttraction ?? 0}점
  퍼포먼스 라인: ${judgeResults[1].performanceLine || '미정'}

최지수 (트레이닝 & 장기 성장 디렉터): "${judgeResults[2].verdict}" 의견
  논거: "${judgeResults[2].debatePosition || '장기 성장성·팀 적응력 중심'}"
  점수: ${judgeResults[2].scores?.total ?? 0}점 / 성장 가능성: ${judgeResults[2].scores?.growthPotential ?? 0}점
  트레이닝 타입: ${judgeResults[2].trainingType || '미정'} / 팀 적합성: ${judgeResults[2].teamFit || '미정'}

다수 의견: ${majority} (2명)
소수 의견: ${minority?.verdict ?? 'unknown'} (1명, ${minority?.name ?? '?'})

각 캐릭터의 충돌 패턴(한승훈 vs 박나리, 한승훈 vs 최지수, 박나리 vs 최지수)을
자연스럽게 반영하되 STARSHIP 특유의 "현실적·세련·대중성 중심" 토론 문화를 지키세요.
STARSHIP 철학 대사("대중이 편하게 좋아할 수 있어야 해요" / "센터는 억지로 만드는 게 아니에요" /
"카메라가 좋아하는 사람이 있어요" / "너무 과하면 오래가기 어려워요" / "팀 안에서 더 빛날 스타일이에요" /
"무대보다 광고에서 먼저 뜰 수도 있겠네요" / "안정적으로 성장할 타입 같아요") 중 1~2개는
starshipPhilosophyMoment 또는 round1·round2 발언에 반드시 포함하세요.
한승훈 발언에는 starshipKeyword를, 박나리에는 cameraReaction과 expressionFlow를,
최지수에는 growthView와 teamFit을 반드시 채우세요.

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
    return res.status(400).json({ error: 'judgeResults must be an array of 3 judge evaluations [한승훈, 박나리, 최지수]' });
  }

  // 1) 만장일치 (pass 또는 fail) → 토론 없이 즉시 확정
  const votes = judgeResults.map((r) => r.verdict);
  const counts = tallyVotes(votes);
  const uniqueVerdicts = Object.keys(counts);

  if (uniqueVerdicts.length === 1) {
    const v = uniqueVerdicts[0];
    if (v === 'pass' || v === 'fail') {
      return res.status(200).json({
        debateNeeded: false,
        unanimousVerdict: true,
        finalVerdict: v,
        starshipCoreReason: v === 'pass'
          ? '3명 모두 STARSHIP이 원하는 대중 호감·카메라 친화력·장기 성장성을 인정. 데뷔조 트레이닝 가치 있음.'
          : '3명 모두 STARSHIP 방향성과 맞지 않는다고 판단. 대중성·카메라 친화력·성장 가능성 모두 부족.',
        debateScript: null,
        source: 'rule',
      });
    }
  }

  // 2) 2:1 분열 → 토론
  const majority = getMajorityVerdict(votes);
  const minority = judgeResults.find((r) => r.verdict !== majority) || judgeResults[1];

  const debate = await generateDebateScript({
    judgeResults,
    majority,
    minority,
    language,
  });

  let finalVerdict = debate.finalVerdict || 'conditional';
  let tiebreakerUsed = !!debate.debateScript?.tiebreakerUsed;
  let tiebreakerBy = debate.debateScript?.tiebreakerBy || null;
  let tiebreakerLine = debate.debateScript?.tiebreakerLine || null;
  let tiebreakerDecision = debate.debateScript?.tiebreakerDecision || null;
  let tiebreakerReason = debate.debateScript?.tiebreakerReason || null;

  // 결정적 검증: finalVoteDeclaration 기반 재집계
  const finalVotes = (debate.debateScript?.finalVoteDeclaration || []).map((v) => v.vote);
  if (finalVotes.length === 3) {
    const finalCounts = tallyVotes(finalVotes);
    const finalUnique = Object.keys(finalCounts);
    if (finalUnique.length === 1) {
      finalVerdict = finalUnique[0];
      tiebreakerUsed = false;
    } else {
      // 재투표도 분열 → 한승훈 최종 결정권 (STARSHIP은 결국 대중성·시장성 중심)
      const seunghoonVote = (debate.debateScript?.finalVoteDeclaration || []).find((v) => v.speaker === '한승훈');
      if (!tiebreakerDecision) tiebreakerDecision = seunghoonVote?.vote || majority;
      finalVerdict = tiebreakerDecision;
      tiebreakerUsed = true;
      tiebreakerBy = '한승훈';
      if (!tiebreakerLine) tiebreakerLine = '...STARSHIP은 결국 대중성과 시장성을 가장 중요하게 봐야 해요. 그 기준으로 결정합니다.';
      if (!tiebreakerReason) tiebreakerReason = 'STARSHIP 대중성·시장성 우선 — 데뷔 후 실제 반응 중심 판단';
    }
  }

  return res.status(200).json({
    debateNeeded: true,
    unanimousVerdict: false,
    starshipCoreReason: debate.starshipCoreReason || '의견이 갈렸음 — 대중성·카메라·성장성 사이의 무게 차이.',
    marketEvaluation: debate.marketEvaluation || null,
    debateScript: {
      ...(debate.debateScript || {}),
      tiebreakerUsed,
      tiebreakerBy,
      tiebreakerDecision,
      tiebreakerLine,
      tiebreakerReason,
    },
    finalVerdict,
    source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
  });
};
