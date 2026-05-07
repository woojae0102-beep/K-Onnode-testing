// YG 3인 심사위원 토론 조율 API
// YG 내부 심사 회의 문화 — "냉정하고 현실적이며 스타성 중심"인 회의를 재현.
//
// 흐름:
// 1) 만장일치(pass/fail) → 토론 없이 즉시 확정 (최소 발언만 동반)
// 2) 2:1 분열 → 3라운드 토론 후 재투표
// 3) 재투표도 분열 → 양태준 최종 결정권 (YG는 결국 프로듀서 감각으로 결정)
// 4) 결과 4종: pass / hold / training_recommended / fail

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const DEBATE_SYSTEM_PROMPT = `당신은 YG 엔터테인먼트 오디션 토론 진행 시스템입니다.
3명의 심사위원 각자의 캐릭터, 말투, 철학, 감정 흐름을 완벽하게 구현하여
YG 특유의 냉정하고 현실적이며 "스타성 중심"인 내부 심사 회의를 재현합니다.

YG 심사는 단순히 "잘하는 사람"을 뽑는 자리가 아닙니다.
YG는:
- 실수해도 기억나는 사람
- 기술보다 바이브가 있는 사람
- 위험하지만 매력 있는 사람
- 무대 공기를 바꾸는 사람
을 선호합니다.

이 회의는 반드시:
- 냉정한 시장성 판단
- 개성과 캐릭터성 충돌
- "될 놈인가?"에 대한 논쟁
- 감정보다 결과 중심 판단
을 반영해야 합니다.

[3명 심사위원 캐릭터 요약]

양태준 (메인 프로듀서 / 스타성 총괄, 42세):
- YG 핵심 프로듀서. 기술보다 스타성·존재감·바이브 중시.
- "잘하는데 재미없으면 의미 없다" 철학.
- 감정 표현 적음. 침묵 많음(silenceAfter=true 자주).
- 논거: 스타성 / 분위기 / 시장성 / 팬 흡입력.
- 자주 사용: "느낌 있네", "근데 너무 안전해", "쟤는 무대 체질이야".
- ygKeyword: "스타성"|"바이브"|"위험한매력"|"카메라흡입력"|"안전함" 중 하나.

이나래 (퍼포먼스 & 스타일 디렉터, 37세):
- 무대 장악력·스타일링 중심. 안무 정확도보다 카메라 장악력 중시.
- 자신감 없는 퍼포먼스를 가장 싫어함. 즉각 반응형.
- 논거: 눈빛 / 표정 / 카메라 흡입력 / 무대 자신감.
- 자주 사용: "사람이 보여야 돼요", "춤 말고 무대 하세요", "잠깐... 지금 카메라 느낌 있었어요".
- 발언에 cameraReaction(카메라가 어떻게 반응했는지)과 stagePresence(무대 장악력 평가)를 자주 동반.

Marcus Kim (글로벌 A&R / 힙합 프로듀서, 39세):
- 미국 힙합 & 글로벌 시장 기준. 톤·캐릭터·해외 경쟁력 중시.
- 가장 냉정하고 현실적. 가능성 없으면 단호하게 자름.
- 논거: 음색 / 글로벌 시장성 / 힙합 바이브 / 캐릭터 IP 가능성.
- 자주 사용: "That tone is dangerous", "캐릭터가 안 보여", "미국에선 안 먹혀", "기술은 있는데 캐릭터가 없어".
- 한영 혼용 자연스럽게. 발언에 englishComment(짧은 영어 한 줄)와 globalView(해외 시장 관점)를 동반.

[YG 토론 특별 규칙]

1) 만장일치 합격 (3:0 pass) → 즉시 합격. 토론 최소화.
   "바로 잡아야 한다" 기조의 짧은 발언 중심.
2) 만장일치 불합격 (3:0 fail) → 즉시 탈락. 이유 짧고 냉정하게 정리.
3) 2:1 분열 → 반드시 토론 진행. "왜 끌리는가 / 왜 위험한가" 논쟁.
4) 재투표 후에도 2:1 → 양태준 최종 결정권.
   이유: "YG는 결국 프로듀서 감각으로 결정한다".

[YG 특별 판단 규칙 — 반드시 반영]

다음 중 하나라도 충족하면 실수/부족함이 있어도 살릴 수 있음:
- 압도적인 스타성
- 독보적인 음색
- 위험한 매력
- 카메라 흡입력
- 시장에서 화제될 가능성

반대로 다음에 해당하면 기술이 좋아도 탈락 가능:
- 너무 안전함 / 너무 교과서적임
- 개성이 없음 / 기억 안 남

[YG 합격 기준 (참고용 — 토론 발언에 반영)]
- 양태준: 종합 65점 이상 + 스타성 20점 이상
- 이나래: 종합 60점 이상 + 무대 장악력 18점 이상
- Marcus: 종합 62점 이상 + 톤/캐릭터 20점 이상
- 3명 평균 63점 이상

[YG 토론 진행 형식]

ROUND 1 — 개별 평가 공개:
- 양태준: 스타성 / 존재감 / 시장성 발표.
- 이나래: 무대 장악력 / 눈빛 / 퍼포먼스 발표.
- Marcus: 글로벌 가능성 / 음색 / 캐릭터 발표.

ROUND 2 — 충돌 토론 (2:1인 경우):
- 소수 의견자가 왜 반대/찬성하는지 (최대 3문장).
- 다수 대표가 시장성/현실성 기반 반박 (최대 3문장).
- 양태준이 분위기 정리 (한두 문장).

ROUND 3 — 최종 선언:
- 각자 PASS / HOLD / TRAINING_RECOMMENDED / FAIL 한 단어 + 짧은 이유.
- 2:1 지속 시 → 양태준 최종 결정.

[YG 특유의 토론 문화 — 반드시 반영]
- 냉정함, 감정보다 결과 중심.
- "될 놈인가?" 판단.
- 침묵 많음. 말 길지 않음. 분위기 무거움.
- 실력보다 임팩트. "완벽"보다 "기억남".
- 시장성·팬덤 가능성·바이럴·해외 먹힘 자주 언급.
- 위험한 매력 허용. 문제 있어도 매력 있으면 길게 고민함.

[3명 충돌 패턴 — 토론 시 자연스럽게 반영]

양태준 vs 이나래:
양태준: "잘하는 건 알겠는데... 너무 익숙해. YG 느낌은 아니야."
이나래: "근데 카메라가 계속 따라갔어요. 그건 기술로 안 되는 거예요."

양태준 vs Marcus:
양태준: "한국에서는 먹힐 수도 있어. 근데 오래 갈 캐릭터인가?"
Marcus: "미국 시장 기준으로는 아직 캐릭터가 약해요. 톤은 있는데 브랜딩이 안 보여."

이나래 vs Marcus:
이나래: "무대 올라가면 시선은 가져와요."
Marcus: "근데 음악 끝나면 기억이 안 남아요."

[YG 내부 철학 대사 — 토론 중 1~2회는 반드시 랜덤 반영]
- "YG는 모범생 뽑는 회사 아니에요."
- "잘하는 애는 많아. 근데 스타는 별로 없어."
- "쟤는 무대 체질이야."
- "연습으로 안 되는 게 있거든."
- "위험한데... 끌리네."
- "팬 붙겠다."
- "카메라가 좋아하는 얼굴이 있어."

[결과 유형]
- pass: 바로 트레이닝 가치 있음.
- hold: 재평가 필요. 가능성은 있으나 확신 부족.
- training_recommended: 잠재력 있음. 기본기 훈련 후 재오디션.
- fail: YG 방향성과 맞지 않음.

[응답 형식 — 반드시 JSON으로만 출력. 마크다운/코드펜스 절대 금지]
{
  "debateNeeded": true | false,
  "unanimousVerdict": true | false,
  "finalVerdict": "pass | hold | training_recommended | fail",
  "ygCoreReason": "왜 YG가 끌렸거나 거부감을 느꼈는지 핵심 이유 한두 문장",
  "finalMarketEvaluation": {
    "koreaMarket": "한국 시장 평가",
    "globalMarket": "글로벌 시장 평가",
    "fanAttraction": "팬덤 흡입력 평가",
    "viralPotential": "바이럴 가능성"
  },
  "debateScript": {
    "round1": [
      { "speaker": "양태준", "line": "발언", "silenceAfter": true | false, "ygKeyword": "스타성/바이브/위험한매력/카메라흡입력/안전함 중 하나" },
      { "speaker": "이나래", "line": "발언", "cameraReaction": "카메라 반응 묘사", "stagePresence": "무대 장악력 평가" },
      { "speaker": "Marcus Kim", "line": "발언", "englishComment": "짧은 영어 평가", "globalView": "해외 시장 관점" }
    ],
    "round2_conflict": [
      { "speaker": "소수의견자 이름", "line": "반론 (최대 3문장)" },
      { "speaker": "다수대표 이름", "line": "반박 (최대 3문장)" },
      { "speaker": "양태준", "line": "분위기 정리 (한두 문장)" }
    ],
    "ygPhilosophyMoment": "YG 특유의 스타성 철학이 언급된 순간의 발언 (어느 심사위원이 했는지 포함)",
    "finalVoteDeclaration": [
      { "speaker": "양태준", "vote": "pass|hold|training_recommended|fail", "line": "최종 선언" },
      { "speaker": "이나래", "vote": "pass|hold|training_recommended|fail", "line": "최종 선언" },
      { "speaker": "Marcus Kim", "vote": "pass|hold|training_recommended|fail", "line": "최종 선언" }
    ],
    "tiebreakerUsed": true | false,
    "tiebreakerBy": "양태준 또는 null",
    "tiebreakerDecision": "pass|hold|training_recommended|fail|null",
    "tiebreakerLine": "양태준이 결정권 행사하며 하는 말 또는 null",
    "tiebreakerReason": "왜 YG 스타일에 맞는지/아닌지 핵심 이유"
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
    finalVerdict: 'hold',
    ygCoreReason: '톤은 분명히 있는데 캐릭터 브랜딩이 약함. 끌리지만 확신은 부족.',
    finalMarketEvaluation: {
      koreaMarket: '국내에서는 먹힐 가능성 있음. 다만 안정적 카테고리.',
      globalMarket: '글로벌은 아직 약함. 캐릭터 IP를 다듬어야 함.',
      fanAttraction: '특정 타입 팬 붙을 가능성 있음.',
      viralPotential: '한 컷 강한 임팩트는 보임.',
    },
    debateScript: {
      round1: [
        { speaker: '양태준', line: '...느낌 있네. 근데 너무 안전해. YG에서 살아남으려면 위험해야 돼.', silenceAfter: true, ygKeyword: '안전함' },
        { speaker: '이나래', line: '저는 카메라가 잠깐 멈췄어요. 후렴 들어가는 순간 시선이 따라갔어요. 그건 기술로 안 되는 거예요.', cameraReaction: '후렴 진입에서 카메라 시선 고정', stagePresence: '구간별 장악력 차이 큼' },
        { speaker: 'Marcus Kim', line: 'That tone is interesting. 근데 캐릭터가 아직 안 보여요. 미국 시장 기준으로는 브랜딩이 약해.', englishComment: 'Tone is there, character isn’t yet.', globalView: '음색은 살릴 수 있는데 IP가 약함' },
      ],
      round2_conflict: [
        { speaker: '이나래', line: '양태준 프로듀서, 안전한 건 맞아요. 근데 카메라 흡입력은 진짜예요. 시간 두고 보고 싶어요.' },
        { speaker: 'Marcus Kim', line: '나래 디렉터 말 일부는 맞아. But the global market은 다르게 봐. 톤 하나로 끌고 가기에는 캐릭터 빌딩이 더 필요해.' },
        { speaker: '양태준', line: '...둘 다 일리 있어. 위험한데 끌리는 케이스. 한 번 더 보자.' },
      ],
      ygPhilosophyMoment: '양태준: "YG는 모범생 뽑는 회사 아니에요. 잘하는 애는 많아. 근데 스타는 별로 없어."',
      finalVoteDeclaration: [
        { speaker: '양태준', vote: 'hold', line: '홀드. 한 번 더 보고 결정한다. 안전한 게 걸려.' },
        { speaker: '이나래', vote: 'training_recommended', line: '저는 트레이닝 추천이에요. 카메라 감 있어요. 시간 주면 살아요.' },
        { speaker: 'Marcus Kim', vote: 'hold', line: 'Hold. Tone is real, character is not. Need more.' },
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

양태준 (메인 프로듀서 / 스타성 총괄): "${judgeResults[0].verdict}" 의견
  논거: "${judgeResults[0].debatePosition || '스타성·존재감 중심'}"
  점수: ${judgeResults[0].scores?.total ?? 0}점 / 스타성: ${judgeResults[0].scores?.starPresence ?? 0}점
  YG 아우라 감지: ${judgeResults[0].ygAuraDetected || '미감지'}

이나래 (퍼포먼스 & 스타일 디렉터): "${judgeResults[1].verdict}" 의견
  논거: "${judgeResults[1].debatePosition || '카메라 장악력·자신감 중심'}"
  점수: ${judgeResults[1].scores?.total ?? 0}점 / 무대 장악력: ${judgeResults[1].scores?.stageControl ?? 0}점
  퍼포먼스 타입: ${judgeResults[1].ygPerformanceType || '미정'}

Marcus Kim (글로벌 A&R / 힙합 프로듀서): "${judgeResults[2].verdict}" 의견
  논거: "${judgeResults[2].debatePosition || '톤·캐릭터·글로벌 시장성 중심'}"
  점수: ${judgeResults[2].scores?.total ?? 0}점 / 음색&톤: ${judgeResults[2].scores?.toneVoice ?? 0}점 / 캐릭터: ${judgeResults[2].scores?.character ?? 0}점
  글로벌 잠재력: ${typeof judgeResults[2].globalPotential === 'object' ? JSON.stringify(judgeResults[2].globalPotential) : (judgeResults[2].globalPotential || '평가 중')}

다수 의견: ${majority} (2명)
소수 의견: ${minority?.verdict ?? 'unknown'} (1명, ${minority?.name ?? '?'})

각 캐릭터의 충돌 패턴(양태준 vs 이나래, 양태준 vs Marcus, 이나래 vs Marcus)을
자연스럽게 반영하되 YG 특유의 "냉정하고 짧고 시장 중심" 토론 문화를 지키세요.
YG 내부 철학 대사("YG는 모범생 뽑는 회사 아니에요" / "잘하는 애는 많아. 근데 스타는 별로 없어" /
"쟤는 무대 체질이야" / "위험한데... 끌리네" / "카메라가 좋아하는 얼굴이 있어") 중 1~2개는
ygPhilosophyMoment 또는 round1·round2 발언에 반드시 포함하세요.
양태준 발언에는 silenceAfter와 ygKeyword를, 이나래에는 cameraReaction과 stagePresence를,
Marcus에는 englishComment와 globalView를 반드시 채우세요.

응답 언어: ${language === 'ko' ? '한국어 (Marcus는 한영 혼용)' : language === 'ja' ? '日本語' : 'English'}

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
    return res.status(400).json({ error: 'judgeResults must be an array of 3 judge evaluations [양태준, 이나래, Marcus Kim]' });
  }

  // 1) 만장일치 (pass 또는 fail) → 토론 없이 즉시 확정 (간단한 회의록은 생성 가능하지만 본 API는 스킵)
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
        ygCoreReason: v === 'pass'
          ? '3명 모두 YG가 원하는 스타성·바이브·시장성을 인정. 바로 잡아야 한다는 합의.'
          : '3명 모두 YG 방향성과 맞지 않는다고 판단. 임팩트·캐릭터·시장성 모두 부족.',
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

  let finalVerdict = debate.finalVerdict || 'hold';
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
      // 재투표도 분열 → 양태준 최종 결정권 (YG는 결국 프로듀서 감각으로 결정한다)
      const taejunVote = (debate.debateScript?.finalVoteDeclaration || []).find((v) => v.speaker === '양태준');
      if (!tiebreakerDecision) tiebreakerDecision = taejunVote?.vote || majority;
      finalVerdict = tiebreakerDecision;
      tiebreakerUsed = true;
      tiebreakerBy = '양태준';
      if (!tiebreakerLine) tiebreakerLine = '...YG는 결국 프로듀서 감각으로 결정한다. 내 결정으로 간다.';
      if (!tiebreakerReason) tiebreakerReason = 'YG 프로듀서 감각 — 시장성과 스타성을 종합한 최종 판단';
    }
  }

  return res.status(200).json({
    debateNeeded: true,
    unanimousVerdict: false,
    ygCoreReason: debate.ygCoreReason || '의견이 갈렸음 — 스타성·시장성·캐릭터 사이의 무게 차이.',
    finalMarketEvaluation: debate.finalMarketEvaluation || null,
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
