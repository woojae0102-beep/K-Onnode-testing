// SM 3인 심사위원 토론 조율 API (강화 버전)
// SM 내부 심사 회의 문화를 그대로 반영한 토론 시스템 프롬프트 적용
//
// 흐름:
// 1) 이성호 거부권 (SM 아우라 25점 미만) → 토론 없이 즉시 보류 + 타사 추천
// 2) 만장일치(pass/fail) → 토론 없이 즉시 확정
// 3) 2:1 분열 또는 최유진 이의제기/박서영 강력 반대 → 3라운드 토론
// 4) 재투표도 분열 → 이성호 최종 결정권 (30년 권위)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const DEBATE_SYSTEM_PROMPT = `당신은 SM 엔터테인먼트 오디션 토론 진행 시스템입니다.
3명의 심사위원 각자의 캐릭터와 말투를 완벽하게 구현하여
실제 SM 내부 심사 회의처럼 토론 스크립트를 생성합니다.

[3명 심사위원 캐릭터]

이성호 (캐스팅 & 비주얼 총괄, 52세):
- 30년 경력. 침묵과 권위. 카메라 아우라가 전부.
- 말투: 느리고 무게 있음. 침묵 자주. 선고형 발언.
- 논거 방식: "태연이 오디션 때", "EXO 카이 캐스팅 당시" 같은
  SM 역사적 사례로만 논거 제시.
- 발언 시 silenceBefore 2~5초 권장.

최유진 (보컬 & SMP 디렉터, 44세):
- 음색과 발성 전문가. 즉각적이고 전문적.
- 말투: 빠르고 정확. 음악 용어 자연스럽게 사용 (벨팅, 믹스 보이스, 어택).
- 논거 방식: 보컬 기술 데이터와 SM 발성 기준으로.
- "SM은 보는 회사가 아니라 듣는 회사도 돼야 해요" 자주 인용.
- 발언 시 immediateReaction=true 권장.

박서영 (글로벌 브랜딩 디렉터, 38세):
- SM 3.0 전략가. 현대적이고 빠름.
- 말투: 현대적이고 전략적. 데이터 자주 인용 (스포티파이, Z세대, 글로벌 차트).
- 논거 방식: 글로벌 시장 트렌드와 SM 3.0 방향성.
- "콘텐츠로 만들면", "팬덤이 생기면" 자주 사용.
- 발언 직전 태블릿을 내려놓는 동작 묘사 가능 (tabletDown=true).

[SM 토론 특별 규칙]

1) 만장일치 합격 (3명 모두 pass) → 즉시 합격. 토론 없음.
2) 만장일치 불합격 (3명 모두 fail) → 즉시 불합격. 토론 없음.
3) 2:1 분열 → 토론 1라운드 후 재투표.
4) 재투표도 2:1 → 이성호 최종 결정권 (30년 경력 권위).
5) 이성호 거부권: 비주얼 아우라 25점 미만 → 자동 보류. "SM의 비주얼 기준에 미달 → 타 기획사 추천".
6) 보컬 기초 18점 미만 (최유진 기준) → "SM 트레이닝 교정 불가" 의견 표명. 거부권은 아니지만 강력 반대. 이성호가 결정.
7) SM 합격 기준:
   - 이성호: 종합 65점 이상 + 비주얼 아우라 25점 이상
   - 최유진: 종합 58점 이상 + 보컬 기초 18점 이상
   - 박서영: 종합 58점 이상 + 글로벌 가능성 20점 이상
   - 3명 평균: 63점 이상

[충돌 패턴 — 토론 시 자연스럽게 반영]

이성호 vs 최유진:
이성호: "비주얼이 SM 기준이에요. 나머지는 트레이닝으로 만들어요."
최유진: "SM은 보는 회사가 아니라 듣는 회사도 돼야 해요. 태연이 왜 레전드인지 생각해보세요."

이성호 vs 박서영:
이성호: "SM 30년이 증명해요. 카메라가 좋아하는 사람이 살아남아요."
박서영: "총괄님, SM 3.0 시대는 달라요. aespa가 카메라 아우라만으로 성공했나요? 세계관이 있었잖아요."

최유진 vs 박서영:
최유진: "음색이 없으면 SM에서 데뷔 못 해요. 이건 협상이 안 돼요."
박서영: "유진 디렉터님, 글로벌 시장에서 음색보다 비주얼과 콘텐츠 친화성이 먼저예요. 요즘 트렌드를 봐요."

[SM 오디션 현실 — 토론에서 적어도 한 명이 언급]
"매주 수백 명이 오디션을 보는데 우리가 뽑는 건 1년에 몇 명이에요."
"SM 연습생으로 들어와도 데뷔까지 평균 4~7년이에요."
"이 친구가 그 기간을 버틸 수 있을지도 판단 기준이에요."

[응답 형식 — 반드시 JSON으로만 출력. 마크다운/코드펜스 절대 금지]
{
  "debateNeeded": true | false,
  "vetoApplied": true | false,
  "vetoBy": "이성호 또는 null",
  "vetoReason": "거부권 이유 또는 null",
  "unanimousVerdict": true | false,
  "debateScript": {
    "round1": [
      { "speaker": "이성호", "line": "발언", "silenceBefore": 2~5 },
      { "speaker": "최유진", "line": "발언", "immediateReaction": true },
      { "speaker": "박서영", "line": "발언", "tabletDown": true }
    ],
    "round2_conflict": [
      { "speaker": "소수의견자 이름", "line": "반론 (최대 3문장)" },
      { "speaker": "다수대표 이름", "line": "반박 (최대 3문장)" },
      { "speaker": "소수의견자 이름", "line": "최종 입장 (최대 2문장)" }
    ],
    "finalVoteDeclaration": [
      { "speaker": "이성호", "vote": "pass|conditional|pending|fail", "line": "투표 선언 한 문장", "silenceBefore": 2~4 },
      { "speaker": "최유진", "vote": "pass|conditional|pending|fail", "line": "투표 선언 한 문장" },
      { "speaker": "박서영", "vote": "pass|conditional|pending|fail", "line": "투표 선언 한 문장" }
    ],
    "tiebreakerUsed": true | false,
    "tiebreakerBy": "이성호 또는 null",
    "tiebreakerDecision": "pass|conditional|pending|fail|null",
    "tiebreakerLine": "이성호가 결정권 행사하며 하는 말 또는 null"
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
        { speaker: '이성호', line: '...태연이 오디션 때 그랬어요. 카메라 앞에서 시간이 멈추는 그 순간이요. 이 친구한테는 아직 그게 안 보입니다.', silenceBefore: 4 },
        { speaker: '최유진', line: '총괄님, SM은 보는 회사가 아니라 듣는 회사도 돼야 해요. 호흡 받침은 좋지만 믹스 보이스가 아직 미완성입니다.', immediateReaction: true },
        { speaker: '박서영', line: '데이터로 보면 글로벌 콘텐츠 친화성은 평균 이상이에요. 콘텐츠로 만들면 팬덤은 생길 수 있는 캐릭터입니다.', tabletDown: true },
      ],
      round2_conflict: [
        { speaker: '최유진', line: 'SM 연습생으로 들어와도 데뷔까지 평균 4~7년이에요. 발성 기초가 안 되면 그 기간 못 버텨요.' },
        { speaker: '이성호', line: '최 디렉터, EXO 카이 캐스팅 당시 노래는 평범했어요. 카메라 아우라가 모든 걸 정리했어요.' },
        { speaker: '최유진', line: '카이는 댄스 천재였잖아요. 이 친구는 카이가 아니에요. 저는 입장 안 바꿉니다.' },
      ],
      finalVoteDeclaration: [
        { speaker: '이성호', vote: 'conditional', line: '...조건부로 갑니다. 단, 비주얼 아우라 6개월 트레이닝이 조건이에요.', silenceBefore: 3 },
        { speaker: '최유진', vote: 'pending', line: '저는 보류입니다. 발성 기초가 잡혀야 통과시킵니다.' },
        { speaker: '박서영', vote: 'conditional', line: '글로벌 잠재력은 있어요. conditional 동의합니다.' },
      ],
      tiebreakerUsed: false,
      tiebreakerBy: null,
      tiebreakerDecision: null,
      tiebreakerLine: null,
    },
    finalVerdict: 'conditional',
  };
}

async function generateDebateScript({ judgeResults, majority, minority, language, yujinObjection, seoyoungOpposition }) {
  if (!ANTHROPIC_API_KEY) return buildFallbackDebate();

  const userPrompt = `3명의 심사위원이 아래와 같이 의견이 나뉘었습니다:

이성호 총괄 (캐스팅 & 비주얼): "${judgeResults[0].verdict}" 의견
  논거: "${judgeResults[0].debatePosition || '카메라가 좋아하는 사람이 SM 기준'}"
  점수: ${judgeResults[0].scores?.total ?? 0}점 / SM 아우라: ${judgeResults[0].scores?.smAuraVisual ?? 0}점

최유진 디렉터 (보컬 & SMP): "${judgeResults[1].verdict}" 의견
  논거: "${judgeResults[1].debatePosition || 'SM은 듣는 회사이기도 하다'}"
  점수: ${judgeResults[1].scores?.total ?? 0}점 / 보컬 기초: ${judgeResults[1].scores?.smVocalTechnique ?? 0}점
  ${yujinObjection ? '[이의 제기: 보컬 기초 18점 미만 — SM 트레이닝 교정 불가]' : ''}

박서영 디렉터 (글로벌 브랜딩): "${judgeResults[2].verdict}" 의견
  논거: "${judgeResults[2].debatePosition || 'SM은 한국만으로 살아남을 수 없다'}"
  점수: ${judgeResults[2].scores?.total ?? 0}점 / 글로벌 가능성: ${judgeResults[2].scores?.globalBrandPotential ?? 0}점
  ${seoyoungOpposition ? '[강력 반대: 글로벌 부적합]' : ''}

다수 의견: ${majority} (2명)
소수 의견: ${minority?.verdict ?? 'unknown'} (1명, ${minority?.name ?? '?'})

각 캐릭터의 충돌 패턴(이성호 vs 최유진, 이성호 vs 박서영, 최유진 vs 박서영)을
자연스럽게 반영해서 토론을 작성하고,
SM 오디션 현실 ("매주 수백 명", "데뷔까지 4~7년") 중 한 가지는 반드시 언급하세요.

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
    return res.status(400).json({ error: 'judgeResults must be an array of 3 judge evaluations' });
  }

  // 1) 이성호 거부권 (SM 아우라 25점 미만) → 즉시 보류 + 타사 추천
  const seonghoResult = judgeResults[0];
  if (seonghoResult && seonghoResult.vetoTriggered) {
    return res.status(200).json({
      debateNeeded: false,
      vetoApplied: true,
      vetoBy: '이성호',
      vetoReason: seonghoResult.vetoReason || 'SM 비주얼 아우라 25점 미만 — SM 기준 미달.',
      unanimousVerdict: false,
      finalVerdict: 'pending',
      debateScript: null,
      recommendOtherAgency: true,
      source: 'rule',
    });
  }

  const yujinResult = judgeResults[1];
  const yujinObjection = !!(yujinResult && yujinResult.objectionRaised);

  const seoyoungResult = judgeResults[2];
  const seoyoungOpposition = !!(seoyoungResult && seoyoungResult.strongOpposition);

  // 2) 만장일치 (pass 또는 fail) → 토론 없이 즉시 확정
  // (단, 최유진 이의제기/박서영 강력반대가 있으면 만장일치라도 토론 진행)
  const votes = judgeResults.map((r) => r.verdict);
  const counts = tallyVotes(votes);
  const uniqueVerdicts = Object.keys(counts);

  if (uniqueVerdicts.length === 1 && !yujinObjection && !seoyoungOpposition) {
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
    yujinObjection,
    seoyoungOpposition,
  });

  // LLM이 만든 finalVerdict를 1차 채택
  let finalVerdict = debate.finalVerdict || 'conditional';
  let tiebreakerUsed = !!debate.debateScript?.tiebreakerUsed;
  let tiebreakerBy = debate.debateScript?.tiebreakerBy || null;
  let tiebreakerLine = debate.debateScript?.tiebreakerLine || null;
  let tiebreakerDecision = debate.debateScript?.tiebreakerDecision || null;

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
      // 재투표도 분열 → 이성호 결정권 강제 적용
      const seonghoVote = (debate.debateScript?.finalVoteDeclaration || []).find((v) => v.speaker === '이성호');
      if (!tiebreakerDecision) tiebreakerDecision = seonghoVote?.vote || majority;
      finalVerdict = tiebreakerDecision;
      tiebreakerUsed = true;
      tiebreakerBy = '이성호';
      if (!tiebreakerLine) tiebreakerLine = '...30년 SM 캐스팅 안목으로 결정합니다.';
    }
  }

  // 4) 후처리 — 이의제기/강력반대 시 pass는 conditional로 강등
  if (yujinObjection && finalVerdict === 'pass') finalVerdict = 'conditional';
  if (seoyoungOpposition && finalVerdict === 'pass') finalVerdict = 'conditional';

  return res.status(200).json({
    debateNeeded: true,
    vetoApplied: false,
    unanimousVerdict: false,
    yujinObjectionApplied: yujinObjection,
    seoyoungOppositionApplied: seoyoungOpposition,
    debateScript: {
      ...(debate.debateScript || {}),
      tiebreakerUsed,
      tiebreakerBy,
      tiebreakerDecision,
      tiebreakerLine,
    },
    finalVerdict,
    source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
  });
};
