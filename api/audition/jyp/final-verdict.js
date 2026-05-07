// JYP 최종 결과 통합 API — 박진영 철학 기반 리치 결과 생성
//
// 동작:
// 1) 결정적 점수 집계 (avgScore, individualPass, allCriteriaPass, characterScorePassed) — 서버에서 계산
// 2) 거부권 우선 검사 (이성현 인성 거부권 → 보류 / 평균 점수 기반 합격·조건부·불합격)
// 3) Claude 호출 — 박진영 철학 톤의 verdictInfo, judgeSummaries(총평·강·약점),
//    debateHighlight, jypPhilosophyHighlight, 4주 루틴(주간 철학 포인트), parkJinyoungWouldSay
// 4) Claude 응답을 결정적 플래그로 덮어써 JSON 일관성 보장

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const FINAL_SYSTEM_PROMPT = `당신은 JYP 엔터테인먼트 오디션 최종 결과를 생성하는 시스템입니다.
3명의 심사위원 평가와 토론 결과를 바탕으로
JYP 특유의 따뜻하지만 기준이 엄격한 최종 결과를 생성합니다.
결과는 박진영의 실제 철학을 반영해야 합니다.

[JYP 결과 유형 — 4가지]

합격 (PASS):
조건: 박재원 60점 이상 + 정민지 58점 이상 + 이성현 65점 이상
      인성 점수 20점 이상 (절대 조건)
      3명 평균 61점 이상
메시지: "JYP 엔터테인먼트 연습생으로 합격을 축하드립니다.
         좋은 사람으로 먼저 성장하고, 그 다음에 좋은 아티스트가 되어요."
결과 배경: #FF6348 (JYP 오렌지)

조건부 합격:
조건: 평균 54~60점 또는 1개 기준 미충족
      단, 인성 점수는 반드시 20점 이상
메시지: "가능성은 충분합니다. 아래 부분을 보완하고 재도전해주세요."
결과 배경: #FF9F43

보류:
조건: 이성현 인성 거부권 발동
      또는 인성 점수 20점 미만
메시지: "현재 JYP 연습생으로 함께하기 어렵습니다.
         이 결정은 당신의 인생을 위한 것이기도 해요.
         좋은 사람이 되는 것부터 시작해보세요."
결과 배경: #636E72

불합격:
조건: 평균 54점 미만 또는 2개 이상 기준 동시 미충족
메시지: "이번엔 함께하기 어렵습니다.
         하지만 JYP는 당신이 어디서든 좋은 사람으로
         성장하길 진심으로 응원합니다."
결과 배경: #2D3436

[JYP 특유의 결과 메시지 철학 — 모든 결과에서 반영]
- 불합격이어도 "당신의 미래를 생각했기 때문에" 표현 포함.
- "모두 누군가의 소중한 아들/딸" 관점 유지.
- 개선점은 비난이 아닌 방향 제시로.
- 재도전 시 구체적인 조언 포함.

[심사위원별 총평 작성 가이드]
박재원: 발성 습관·라이브·체력 중심. "공기반 소리반" 어휘.
정민지: 에너지·표현력·JYP 그룹 라인 중심. "오!", "그거예요!" 톤.
이성현: 인성·솔직함·장기 비전 중심. "그 대답이요", 박진영 어록.

[4주 루틴 작성 가이드 — JYP 철학 기반]
실력 + 인성 동시 성장 — 박진영 어록을 매 주 한 줄씩 포인트로 배치.
가장 부족한 항목부터 우선순위로.
JYP 실제 트레이닝 메서드 반영:
  · "공기반 소리반" 발성, 러닝머신 위 노래
  · 8카운트 즉석 흡수, ITZY/TWICE/NMIXX 영상 분석
  · 인성 면접 — 솔직함·자기 인식 훈련
  · 매 주 박진영 어록 한 줄 포인트
박진영 어록 풀:
  · "노래에 습관이 없어야 합니다."
  · "쌩라이브로 부르면서 춤 출 수 있는 사람이 살아남아."
  · "좋은 가수보다 좋은 사람이 먼저."
  · "실력 10에 인성 7이면 인성 7인 사람을 뽑겠다."
  · "데뷔시킬 자신이 없으면 얼른 내보낸다. 모두 누군가의 소중한 아들·딸이다."
  · "인맥 넓히느라 시간 쓰지 말고 스스로 실력 키우고 몸 관리하는 데 시간을 써라."

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 절대 금지]
{
  "finalVerdict": "pass | conditional | pending | fail",
  "verdictInfo": {
    "title": "결과 제목 (이모지 포함)",
    "message": "JYP 철학이 담긴 결과 메시지 1~2문장",
    "color": "#FF6348 | #FF9F43 | #636E72 | #2D3436",
    "jypPhilosophy": "이 결과와 연결된 박진영 철학 1줄",
    "nextStep": "다음 단계 안내 1줄"
  },
  "judgeSummaries": [
    {
      "name": "박재원",
      "score": 점수,
      "verdict": "pass|conditional|pending|fail",
      "summary": "총평 3~4문장 — 발성 & 라이브 관점",
      "strongPoints": ["잘한점1", "잘한점2"],
      "improvements": ["개선점1 + JYP 발성 교정 구체적 방법", "개선점2 + 방법"],
      "closing": "박재원 시그니처 한마디",
      "habitDetected": "발견된 발성 습관 또는 null",
      "habitCorrectionTime": "교정 예상 기간",
      "liveRating": "라이브 등급 A/B/C/D"
    },
    {
      "name": "정민지",
      "score": 점수,
      "verdict": "pass|conditional|pending|fail",
      "summary": "총평 3~4문장 — 퍼포먼스 관점",
      "strongPoints": ["잘한점1", "잘한점2"],
      "improvements": ["개선점1 + JYP 퍼포먼스 교정 방법", "개선점2 + 방법"],
      "closing": "정민지 시그니처 한마디",
      "jypGroupLine": "TWICE형 | ITZY형 | NMIXX형 | SKZ형 | 새로운형",
      "choreographyAbsorptionSpeed": "안무 습득 속도 평가"
    },
    {
      "name": "이성현",
      "score": 점수,
      "verdict": "pass|conditional|pending|fail",
      "summary": "총평 3~4문장 — 인성 & 비전 관점",
      "strongPoints": ["잘한점1", "잘한점2"],
      "improvements": ["개선점1 + JYP 인성 방향", "개선점2 + 방법"],
      "closing": "이성현 시그니처 한마디",
      "characterRating": "S | A | B | C | D",
      "longTermPotential": "JYP 장기 연습생 생활 적합성 1줄"
    }
  ],
  "debateHighlight": "토론 핵심 갈등 1~2문장",
  "jypPhilosophyHighlight": "토론 중 박진영 철학이 등장한 핵심 순간",
  "decisionMethod": "unanimous | majority | tiebreaker",
  "routine": [
    {
      "week": 1,
      "focus": "가장 부족한 항목",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "이번 주 목표",
      "jypPhilosophyPoint": "이 주의 박진영 어록 한 줄"
    },
    {
      "week": 2,
      "focus": "두 번째 취약 항목",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "주간 목표",
      "jypPhilosophyPoint": "어록"
    },
    {
      "week": 3,
      "focus": "통합 훈련 — 보컬+댄스+인성 동시",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "주간 목표",
      "jypPhilosophyPoint": "어록"
    },
    {
      "week": 4,
      "focus": "재오디션 준비 + 마음 준비",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "주간 목표",
      "jypPhilosophyPoint": "어록"
    }
  ],
  "jypSpecialAdvice": "JYP 재도전을 위한 핵심 조언 (박진영 철학 기반)",
  "parkJinyoungWouldSay": "박진영이 직접 해줄 것 같은 한마디 (따뜻하지만 핵심을 찌르는)",
  "nextAuditionTarget": "재도전 권장 시기 (예: 6개월 후)"
}`;

const FALLBACK_RICH = (computed) => ({
  finalVerdict: computed.finalVerdict,
  verdictInfo: buildFallbackVerdictInfo(computed.finalVerdict),
  judgeSummaries: [
    {
      name: '박재원',
      score: computed.totals[0] || 0,
      verdict: computed.individualPass.jaewon ? 'pass' : 'conditional',
      summary:
        '음색 자체는 자연스럽고 따뜻한 편인데, 고음 직전에 인상이 찡그려지는 습관이 발성 흐름을 끊어요. 라이브 체력은 평균 수준이지만 댄스를 더하면 호흡이 부족해질 수 있는 상태입니다. 감수성은 살아있어서 교정만 들어가면 빠르게 올라올 수 있는 케이스예요.',
      strongPoints: ['중저음 톤이 따뜻하고 자연스러움', '곡 후반 감정 표현이 살아있음'],
      improvements: [
        '음 끝 잡아당기는 버릇 — 매일 "공기반 소리반" 발성 30분으로 힘 빼는 감각 회복',
        '라이브 체력 — 제자리 뛰며 후렴구 부르기 1일 3세트로 호흡 분배 훈련',
      ],
      closing: '음색은 좋아요. 습관만 빼면 JYP에서 찾는 자연스러움이 나올 거예요.',
      habitDetected: '음 끝을 꼭 잡아당기는 버릇',
      habitCorrectionTime: '6~12개월',
      liveRating: 'C',
    },
    {
      name: '정민지',
      score: computed.totals[1] || 0,
      verdict: computed.individualPass.minji ? 'pass' : 'conditional',
      summary:
        '후렴구 폭발력이 살아있고, ITZY 류진이 처음 들어왔을 때 같은 자신감 있는 시선 처리가 인상적이었어요. 8카운트 즉석 시연도 한 번에 흡수했고, 댄스 + 노래 동시 가능성이 보입니다. 다만 카운트 끝처리가 흐려져서 디테일을 잡으면 한 단계 더 올라올 수 있어요.',
      strongPoints: ['후렴구 폭발력이 살아있음', '시선 처리에서 자신감이 보임'],
      improvements: [
        '안무 카운트 끝처리 — 8카운트의 마지막 동작 멈춤을 명확하게, ITZY 류진 영상 모방으로 디테일 잡기',
        '쌩라이브 호흡 — 제자리 뛰면서 후렴 부르기 매일 5세트로 댄스+노래 분리 능력 향상',
      ],
      closing: '에너지가 살아있어요. 이 느낌만 잃지 마세요.',
      jypGroupLine: 'ITZY형',
      choreographyAbsorptionSpeed: '평균 이상 — 8카운트 한 번에 흡수',
    },
    {
      name: '이성현',
      score: computed.totals[2] || 0,
      verdict: computed.individualPass.seonghyeon ? 'pass' : 'conditional',
      summary:
        '자기 약점을 솔직하게 말한 부분이 좋았어요. 준비된 답이 아니라 진짜 자기 이야기를 한다는 게 느껴졌고, 이건 JYP에서 가장 중요한 자질입니다. 다만 10년 후 비전이 아직 막연해서, "왜 JYP인지"를 자기 언어로 한 줄 정리하는 시간이 필요해 보여요.',
      strongPoints: ['솔직하게 자기 약점을 말함', '데뷔 못 할 가능성을 진지하게 받아들임'],
      improvements: [
        '구체적인 10년 비전 — TWICE 지효처럼 자기가 왜 여기 있어야 하는지 한 줄로 정의해보기',
        '팀워크 경험 부족 — 합주·합창 같은 협업 활동 6개월 권장',
      ],
      closing: '잘 되길 진심으로 바라요.',
      characterRating: 'A',
      longTermPotential: '7년 이상 연습생 생활 가능 — JYP 장기 적합형',
    },
  ],
  debateHighlight:
    '박재원이 발성 습관 교정 2년을 지적했고, 정민지·이성현이 "TWICE 지효도 10년이었다, 자기 인식이 살아있으면 빠르게 잡힌다"로 반박해 조건부 합격으로 정리되었습니다.',
  jypPhilosophyHighlight: '"이 친구도 누군가의 소중한 아들·딸이잖아요. 우리가 책임질 수 있는 결정인지 봐야 해요." — 이성현',
  decisionMethod:
    computed.unanimous ? 'unanimous' : computed.tiebreaker ? 'tiebreaker' : 'majority',
  routine: [
    {
      week: 1,
      focus: '습관 없는 발성 회복',
      daily: [
        '"공기반 소리반" 발성 30분 (힘 빼기)',
        '거울 앞 표정 모니터링 — 인상 찡그림 체크',
        '음 끝 잡아당기는 버릇 교정 드릴 20분',
      ],
      goal: '박진영 발성 철학 체화',
      jypPhilosophyPoint: '"노래에 습관이 없어야 합니다."',
    },
    {
      week: 2,
      focus: 'JYP 라이브 체력',
      daily: [
        '제자리 뛰며 후렴 부르기 5세트',
        '러닝머신 30분 + 발성 동시 훈련',
        'TWICE/ITZY/NMIXX 풀곡 댄스+노래 1회',
      ],
      goal: '쌩라이브 + 댄스 동시 가능',
      jypPhilosophyPoint: '"쌩라이브로 부르면서 춤 출 수 있는 사람이 살아남아."',
    },
    {
      week: 3,
      focus: '에너지 & 표현력 + 인성 동시',
      daily: [
        'ITZY 류진/TWICE 나연 영상 모방 분석 30분',
        '카메라 앞 표정 다양성 훈련 20분',
        '솔직한 셀프 인터뷰 녹화 후 검토',
      ],
      goal: 'JYP 무대 에너지 + 진정성 장착',
      jypPhilosophyPoint: '"좋은 가수보다 좋은 사람이 먼저."',
    },
    {
      week: 4,
      focus: '재오디션 준비 + 마음 준비',
      daily: [
        '"왜 JYP인지" 솔직한 답 한 줄 정의',
        '실수·약점 솔직하게 말하기 연습',
        '10년 후 자신 시나리오 작성',
      ],
      goal: 'JYP 재오디션 — 인성과 비전 정렬',
      jypPhilosophyPoint: '"데뷔시킬 자신이 없으면 얼른 내보낸다. 모두 누군가의 소중한 아들·딸이다."',
    },
  ],
  jypSpecialAdvice:
    'TWICE 지효는 10년이었어요. JYP는 빨리 데뷔시키는 회사가 아니라 오래 살아남게 하는 회사입니다. 좋은 사람이 결국 좋은 아티스트가 됩니다.',
  parkJinyoungWouldSay:
    '"솔직한 게 보여서 좋았어. 근데 노래에서 자기 의식하는 순간이 너무 많아. 자기를 잊고 노래에 빠지는 연습부터 해. 그게 진짜 시작이야."',
  nextAuditionTarget: '6개월 후',
});

function buildFallbackVerdictInfo(verdict) {
  switch (verdict) {
    case 'pass':
      return {
        title: '🎉 JYP 엔터테인먼트 연습생 합격',
        message:
          'JYP 엔터테인먼트 연습생으로 합격을 축하드립니다. 좋은 사람으로 먼저 성장하고, 그 다음에 좋은 아티스트가 되어요.',
        color: '#FF6348',
        jypPhilosophy: '좋은 가수보다 좋은 사람이 먼저 — 박진영',
        nextStep: '계약 면담 일정과 인성 교육 오리엔테이션을 안내드리겠습니다.',
      };
    case 'conditional':
      return {
        title: '✅ 조건부 합격',
        message: '가능성은 충분합니다. 아래 부분을 보완하고 재도전해주세요.',
        color: '#FF9F43',
        jypPhilosophy: '실력은 트레이닝으로 만들 수 있어요 — 박진영',
        nextStep: '6개월 후 재오디션을 권고드립니다.',
      };
    case 'pending':
      return {
        title: '📋 보류 — 인성 재교육 후 재도전 권고',
        message:
          '현재 JYP 연습생으로 함께하기 어렵습니다. 이 결정은 당신의 인생을 위한 것이기도 해요. 좋은 사람이 되는 것부터 시작해보세요.',
        color: '#636E72',
        jypPhilosophy: '데뷔시킬 자신이 없으면 얼른 내보낸다 — 박진영',
        nextStep: '1년 후 재도전을 권고드립니다.',
      };
    default:
      return {
        title: '❌ 불합격',
        message:
          '이번엔 함께하기 어렵습니다. 하지만 JYP는 당신이 어디서든 좋은 사람으로 성장하길 진심으로 응원합니다.',
        color: '#2D3436',
        jypPhilosophy: '모두 누군가의 소중한 아들·딸이다 — 박진영',
        nextStep: '심사위원들의 피드백을 참고하여 다시 도전하세요.',
      };
  }
}

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

// 결정적 합격 기준 검증
// 박재원: 종합 60점 이상 + 자연스러운 발성 22점 이상
// 정민지: 종합 58점 이상 + 에너지 18점 이상
// 이성현: 종합 65점 이상 + 인성 20점 이상 (절대적)
function computeDeterministic(judgeResults, debateResult) {
  const totals = judgeResults.map((r) => Number(r?.scores?.total ?? 0));
  const avgScore = Math.round(totals.reduce((a, b) => a + b, 0) / 3);

  const naturalVocal = Number(judgeResults[0]?.scores?.naturalVocalHabit ?? 0);
  const energy = Number(judgeResults[1]?.scores?.energyVitality ?? 0);
  const character = Number(judgeResults[2]?.scores?.characterAttitude ?? 0);

  const jaewonPass = totals[0] >= 60 && naturalVocal >= 22;
  const minjiPass = totals[1] >= 58 && energy >= 18;
  const seonghyeonPass = totals[2] >= 65 && character >= 20;
  const allCriteriaPass = jaewonPass && minjiPass && seonghyeonPass;
  const characterScorePassed = character >= 20;

  // 거부권/투표 → 최종 결정
  const vetoApplied = !!debateResult?.vetoApplied;
  const debateVerdict = debateResult?.finalVerdict;

  let finalVerdict;
  if (vetoApplied || !characterScorePassed) {
    finalVerdict = 'pending';
  } else if (debateVerdict && ['pass', 'conditional', 'pending', 'fail'].includes(debateVerdict)) {
    // 토론에서 정해진 verdict를 우선 신뢰하되, 합격 기준 미달이면 강등
    finalVerdict = debateVerdict;
    if (finalVerdict === 'pass' && (!allCriteriaPass || avgScore < 61)) {
      finalVerdict = 'conditional';
    }
    if (finalVerdict === 'conditional' && avgScore < 54) {
      finalVerdict = 'fail';
    }
  } else {
    // 폴백: 점수 기반
    if (allCriteriaPass && avgScore >= 61) finalVerdict = 'pass';
    else if (avgScore >= 54) finalVerdict = 'conditional';
    else finalVerdict = 'fail';
  }

  // 결정 방식
  const tiebreaker = !!debateResult?.debateScript?.tiebreakerUsed;
  const unanimous = !!debateResult?.unanimousVerdict;

  return {
    totals,
    avgScore,
    individualPass: { jaewon: jaewonPass, minji: minjiPass, seonghyeon: seonghyeonPass },
    allCriteriaPass,
    characterScorePassed,
    finalVerdict,
    unanimous,
    tiebreaker,
  };
}

async function generateRichResult({ judgeResults, debateResult, computed, language }) {
  if (!ANTHROPIC_API_KEY) return FALLBACK_RICH(computed);

  const jw = judgeResults[0]?.scores || {};
  const mj = judgeResults[1]?.scores || {};
  const sh = judgeResults[2]?.scores || {};

  const userPrompt = `JYP 엔터테인먼트 오디션 결과 데이터입니다:

[심사위원 점수]
박재원 디렉터 (수석 보컬): ${jw.total ?? 0}점
  - 습관 없는 자연스러운 발성: ${jw.naturalVocalHabit ?? 0}/40
  - 라이브 능력 & 체력: ${jw.liveAbilityStamina ?? 0}/25
  - 음악적 감수성 & 감정 전달: ${jw.musicalSensitivity ?? 0}/25
  - 성장 가능성 & 트레이닝 적합성: ${jw.trainingPotential ?? 0}/10
  발견된 습관: ${judgeResults[0]?.habitDetected || '없음'}
  자체 verdict: ${judgeResults[0]?.verdict || '미정'}

정민지 팀장 (댄스 & 퍼포먼스): ${mj.total ?? 0}점
  - 에너지 & 생동감: ${mj.energyVitality ?? 0}/35
  - 댄스 기술 정확도: ${mj.danceTechniqueAccuracy ?? 0}/30
  - 표현력 & 시선 처리: ${mj.expressionEyeContact ?? 0}/25
  - JYP 스타일 적합성: ${mj.jypStyleFit ?? 0}/10
  JYP 그룹 라인: ${judgeResults[1]?.jypGroupLine || '미정'}
  자체 verdict: ${judgeResults[1]?.verdict || '미정'}

이성현 팀장 (인성 평가): ${sh.total ?? 0}점
  - 인성 & 태도: ${sh.characterAttitude ?? 0}/40
  - 목표 의식 & 비전: ${sh.purposeVision ?? 0}/30
  - 팀워크 & 대인 관계: ${sh.teamworkRelationship ?? 0}/20
  - JYP 생활 적합성: ${sh.jypLifeFit ?? 0}/10
  진정성 평가: ${judgeResults[2]?.sincerityAssessment || '관찰 중'}
  자체 verdict: ${judgeResults[2]?.verdict || '미정'}
  거부권 발동: ${judgeResults[2]?.vetoTriggered ? 'YES' : 'NO'}

[결정적 집계 — 이 값을 그대로 사용]
평균 점수: ${computed.avgScore}점
박재원 합격 기준 통과: ${computed.individualPass.jaewon ? 'YES' : 'NO'}
정민지 합격 기준 통과: ${computed.individualPass.minji ? 'YES' : 'NO'}
이성현 합격 기준 통과: ${computed.individualPass.seonghyeon ? 'YES' : 'NO'}
인성 점수 통과: ${computed.characterScorePassed ? 'YES' : 'NO'}
모든 기준 통과: ${computed.allCriteriaPass ? 'YES' : 'NO'}
최종 결정: ${computed.finalVerdict}
결정 방식: ${computed.unanimous ? 'unanimous' : computed.tiebreaker ? 'tiebreaker (이성현)' : 'majority'}

[토론 결과 요약]
거부권 적용: ${debateResult?.vetoApplied ? 'YES' : 'NO'} ${debateResult?.vetoBy ? `(${debateResult.vetoBy})` : ''}
박재원 이의 제기: ${debateResult?.jaewonObjectionApplied ? 'YES' : 'NO'}
정민지 강력 반대: ${debateResult?.minjiOppositionApplied ? 'YES' : 'NO'}
박진영 철학 모먼트: "${debateResult?.debateScript?.jypPhilosophyMoment || '(없음)'}"

[지시]
finalVerdict는 반드시 "${computed.finalVerdict}"로 출력하세요.
decisionMethod는 "${computed.unanimous ? 'unanimous' : computed.tiebreaker ? 'tiebreaker' : 'majority'}"로 출력하세요.
judgeSummaries[i].score는 위 점수를 그대로, scores도 위 세부 점수 그대로 사용하세요.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}

지정된 JSON 형식으로만 출력. 마크다운/코드펜스 금지.`;

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
        max_tokens: 2400,
        system: FINAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`CLAUDE_FAIL_${res.status}`);
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = tryParseJson(text);
    if (!parsed || !Array.isArray(parsed.routine) || !Array.isArray(parsed.judgeSummaries)) {
      return FALLBACK_RICH(computed);
    }
    return parsed;
  } catch {
    return FALLBACK_RICH(computed);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { judgeResults = [], debateResult = {}, language = 'ko' } = body || {};

  if (!Array.isArray(judgeResults) || judgeResults.length !== 3) {
    return res
      .status(400)
      .json({ error: 'judgeResults must be an array of 3 judge evaluations [박재원, 정민지, 이성현]' });
  }

  // 1) 결정적 집계
  const computed = computeDeterministic(judgeResults, debateResult);

  // 2) Claude 호출 — 풍부한 결과 텍스트
  const rich = await generateRichResult({ judgeResults, debateResult, computed, language });

  // 3) 결정적 플래그 강제 덮어쓰기 (Claude 응답이 어긋날 때 안전망)
  const finalVerdict = computed.finalVerdict;
  const verdictInfo = rich.verdictInfo || buildFallbackVerdictInfo(finalVerdict);

  // judgeSummaries — Claude의 텍스트(summary 등) 살리되 점수·verdict는 결정적 값으로 강제
  const judgeNames = ['박재원', '정민지', '이성현'];
  const judgeIds = ['jyp-jaewon', 'jyp-minji', 'jyp-seonghyeon'];
  const judgeSummaries = judgeResults.map((r, idx) => {
    const llmSummary = Array.isArray(rich.judgeSummaries) ? rich.judgeSummaries[idx] || {} : {};
    return {
      judgeId: r.judgeId || judgeIds[idx],
      name: r.name || judgeNames[idx],
      score: Number(r?.scores?.total ?? 0),
      verdict: r.verdict || llmSummary.verdict || 'conditional',
      scores: r.scores || {},
      summary: llmSummary.summary || '',
      strongPoints: llmSummary.strongPoints || r.strongPoints || [],
      improvements: llmSummary.improvements || r.improvements || [],
      closing: llmSummary.closing || r.closing || '',
      // 박재원 고유
      habitDetected: idx === 0 ? llmSummary.habitDetected || r.habitDetected || null : undefined,
      habitCorrectionTime: idx === 0 ? llmSummary.habitCorrectionTime || r.habitCorrectionTime : undefined,
      liveRating: idx === 0 ? llmSummary.liveRating || r.liveRating : undefined,
      // 정민지 고유
      jypGroupLine: idx === 1 ? llmSummary.jypGroupLine || r.jypGroupLine : undefined,
      choreographyAbsorptionSpeed:
        idx === 1 ? llmSummary.choreographyAbsorptionSpeed || r.choreographyAbsorptionSpeed : undefined,
      // 이성현 고유
      characterRating: idx === 2 ? llmSummary.characterRating || r.characterRating : undefined,
      longTermPotential: idx === 2 ? llmSummary.longTermPotential || r.longTermPotential : undefined,
      // 거부권/이의제기 (서버측 데이터 우선)
      vetoTriggered: !!r.vetoTriggered,
      vetoReason: r.vetoReason || null,
    };
  });

  return res.status(200).json({
    finalVerdict,
    avgScore: computed.avgScore,
    allCriteriaPass: computed.allCriteriaPass,
    characterScorePassed: computed.characterScorePassed,
    individualPass: computed.individualPass,
    judgeResults,
    debateResult,
    verdictInfo,
    judgeSummaries,
    debateHighlight: rich.debateHighlight || '',
    jypPhilosophyHighlight:
      rich.jypPhilosophyHighlight || debateResult?.debateScript?.jypPhilosophyMoment || '',
    finalVotes: {
      박재원: judgeResults[0]?.verdict || 'conditional',
      정민지: judgeResults[1]?.verdict || 'conditional',
      이성현: judgeResults[2]?.verdict || 'conditional',
    },
    decisionMethod: computed.unanimous ? 'unanimous' : computed.tiebreaker ? 'tiebreaker' : 'majority',
    routine: rich.routine || FALLBACK_RICH(computed).routine,
    jypSpecialAdvice: rich.jypSpecialAdvice || '',
    parkJinyoungWouldSay: rich.parkJinyoungWouldSay || '',
    nextAuditionTarget: rich.nextAuditionTarget || '6개월 후',
    source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
  });
};
