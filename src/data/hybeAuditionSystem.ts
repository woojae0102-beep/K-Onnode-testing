// HYBE 빅히트뮤직 — 3인 심사위원 토론 & 최종 결과 시스템
// 명세 그대로 결정론적으로 동작하도록 구현되었습니다.
// LLM(서사·총평)과 분리되어, 합격/거부권/토론 트리거는 모두 이 모듈에서 계산됩니다.

// ─────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────

export type HybeJudgeId = 'hybe-junhyuk' | 'hybe-soyeon' | 'hybe-david';

export type JunhyukScores = {
  trainingAbsorption: number;   // 트레이닝 흡수력 0-35
  musicalAuthenticity: number;  // 음악적 진정성 0-30
  selfAwareness: number;        // 자기 인식 능력 0-20
  musicalSensibility: number;   // 음악적 감수성 0-15
};

export type SoyeonScores = {
  stagePresence: number;        // 무대 장악력 & 아우라 0-35
  visualImpact: number;         // 비주얼 임팩트 0-25
  performanceLevel: number;     // 댄스 & 퍼포먼스 0-25
  uniqueness: number;           // 개성 & 차별화 0-15
};

export type DavidScores = {
  globalAppeal: number;         // 글로벌 어필 가능성 0-35
  artistVision: number;         // 아티스트 비전 & 정체성 0-30
  communication: number;        // 커뮤니케이션 & 소통 0-20
  sustainability: number;       // 지속 가능성 0-15
};

export type HybeAuditionScores = {
  junhyuk: JunhyukScores;
  soyeon: SoyeonScores;
  david: DavidScores;
};

export type HybeVerdict = 'pass' | 'conditional' | 'pending' | 'fail';

export type HybeJudgeVote = {
  judgeId: HybeJudgeId;
  judgeName: string;
  totalScore: number;           // 해당 심사위원의 100점 만점 점수
  individualPass: boolean;      // 해당 심사위원의 개별 합격 기준 통과 여부
  vote: HybeVerdict;
  reasoning: string;            // 한 줄 요약(UI 표시용)
};

export type HybeVeto = {
  triggered: boolean;
  type: 'authenticity-zero' | 'global-too-low' | null;
  by: HybeJudgeId | null;
  message: string;
};

export type DebateState =
  | { needed: false; reason: 'unanimous' }
  | { needed: true; round: 1 | 2; majority: HybeVerdict; minority: HybeVerdict; minorityJudge: HybeJudgeId };

export type HybeFinalResult = {
  scores: HybeAuditionScores;
  judgeVotes: HybeJudgeVote[];
  averageScore: number;
  veto: HybeVeto;
  debate: DebateState;
  finalVerdict: HybeVerdict;
  decisionMaker: HybeJudgeId | 'consensus' | 'veto';
  resultMessage: string;
  recommendedRoutineFocus: string[];
};

// ─────────────────────────────────────────────────────────────
// HYBE 합격 기준 (명세 그대로)
// ─────────────────────────────────────────────────────────────

export const HYBE_PASSING_CRITERIA = {
  junhyuk: {
    trainingAbsorption: { min: 25, max: 35 },
    musicalAuthenticity: { min: 20, max: 30 },
    totalMin: 65,
  },
  soyeon: {
    stagePresence: { min: 20, max: 35 },
    uniqueness: { min: 10, max: 15 },
    totalMin: 60,
  },
  david: {
    globalAppeal: { min: 20, max: 35 },
    artistVision: { min: 15, max: 30 },
    totalMin: 60,
  },
  averageMin: 65,
} as const;

// ─────────────────────────────────────────────────────────────
// 특별 거부권 (이준혁 / David Lim)
// ─────────────────────────────────────────────────────────────

export const HYBE_VETO_RULES = {
  authenticityZero: {
    by: 'hybe-junhyuk' as HybeJudgeId,
    threshold: 0,
    description:
      '음악적 진정성 0점 — 음악을 도구로만 쓰는 게 명확히 보일 때 자동 보류',
  },
  globalTooLow: {
    by: 'hybe-david' as HybeJudgeId,
    threshold: 30,
    description:
      '글로벌 어필 점수가 30점(35점 만점) 미만이면 HYBE 기준 미달로 자동 보류 (불합격 아님)',
    suggestion: '국내 다른 기획사 추천',
  },
} as const;

// ─────────────────────────────────────────────────────────────
// 토론 진행 형식
// ─────────────────────────────────────────────────────────────

export const HYBE_DEBATE_PROTOCOL = {
  round1: {
    name: '개별 평가 공개',
    duration: '각 1분',
    order: [
      { judgeId: 'hybe-junhyuk', topic: '트레이닝 가능성 데이터 발표' },
      { judgeId: 'hybe-soyeon', topic: '퍼포먼스 & 비주얼 직관 발표' },
      { judgeId: 'hybe-david', topic: '글로벌 시장 관점 발표' },
    ],
  },
  round2: {
    name: '의견 충돌 토론 (2:1일 경우)',
    sequence: [
      { speaker: 'minority', limit: '최대 3문장', topic: '반론 제기' },
      { speaker: 'majority-rep', limit: '최대 3문장', topic: '반박' },
      { speaker: 'minority', limit: '최대 2문장', topic: '최종 입장' },
    ],
  },
  round3: {
    name: '최종 투표 발표',
    rule:
      '각자 "합격 / 조건부 / 보류 / 불합격" 한 단어로 선언. 2:1이면 이준혁 최종 결정권 행사',
  },
} as const;

// ─────────────────────────────────────────────────────────────
// 결과별 메시지 템플릿
// ─────────────────────────────────────────────────────────────

export const HYBE_RESULT_MESSAGES: Record<HybeVerdict, { headline: string; emoji: string; body: string }> = {
  pass: {
    emoji: '🏆',
    headline: 'HYBE 빅히트뮤직 연습생 합격',
    body:
      'HYBE 빅히트뮤직 연습생으로 합격을 축하합니다.\n다음 단계: 계약 면담 일정을 안내드리겠습니다.',
  },
  conditional: {
    emoji: '🌱',
    headline: '조건부 합격 — 6개월 후 재오디션 권고',
    body:
      '6개월 후 재오디션을 권고드립니다.\nAI 코치가 부족 항목 기반으로 4주 집중 루틴을 자동 생성해 드립니다.',
  },
  pending: {
    emoji: '⏸️',
    headline: '보류 — HYBE 기준 미달',
    body:
      '현재 기준으로는 HYBE 연습생으로 합류하기 어렵습니다.\n대신 본인 강점이 더 잘 맞을 수 있는 기획사 방향을 추천드립니다.',
  },
  fail: {
    emoji: '🌧️',
    headline: '불합격 — 다시 도전을 권장',
    body:
      '아쉽게도 이번 오디션은 통과하지 못했습니다.\n심사위원들의 조언을 참고해 기본기부터 다시 다져 보세요.',
  },
};

// ─────────────────────────────────────────────────────────────
// 점수 계산 헬퍼
// ─────────────────────────────────────────────────────────────

export function junhyukTotal(s: JunhyukScores): number {
  return s.trainingAbsorption + s.musicalAuthenticity + s.selfAwareness + s.musicalSensibility;
}

export function soyeonTotal(s: SoyeonScores): number {
  return s.stagePresence + s.visualImpact + s.performanceLevel + s.uniqueness;
}

export function davidTotal(s: DavidScores): number {
  return s.globalAppeal + s.artistVision + s.communication + s.sustainability;
}

// ─────────────────────────────────────────────────────────────
// 거부권 체크
// ─────────────────────────────────────────────────────────────

export function checkVetoes(scores: HybeAuditionScores): HybeVeto {
  if (scores.junhyuk.musicalAuthenticity <= HYBE_VETO_RULES.authenticityZero.threshold) {
    return {
      triggered: true,
      type: 'authenticity-zero',
      by: HYBE_VETO_RULES.authenticityZero.by,
      message:
        '이준혁 디렉터 거부권 발동: 음악적 진정성 0점. 음악을 도구로만 쓰는 게 명확히 보였습니다. 자동 보류 처리됩니다.',
    };
  }
  if (scores.david.globalAppeal < HYBE_VETO_RULES.globalTooLow.threshold) {
    return {
      triggered: true,
      type: 'global-too-low',
      by: HYBE_VETO_RULES.globalTooLow.by,
      message: `David Lim 거부권 발동: 글로벌 어필 ${scores.david.globalAppeal}점 (30점 미만). HYBE 글로벌 기준 미달로 자동 보류. 국내 다른 기획사 추천.`,
    };
  }
  return { triggered: false, type: null, by: null, message: '' };
}

// ─────────────────────────────────────────────────────────────
// 개별 심사위원 합격 기준 체크
// ─────────────────────────────────────────────────────────────

function evaluateJunhyuk(s: JunhyukScores): { total: number; pass: boolean; failedConditions: string[] } {
  const total = junhyukTotal(s);
  const c = HYBE_PASSING_CRITERIA.junhyuk;
  const failed: string[] = [];
  if (s.trainingAbsorption < c.trainingAbsorption.min) failed.push(`트레이닝 흡수력 ${s.trainingAbsorption}<${c.trainingAbsorption.min}`);
  if (s.musicalAuthenticity < c.musicalAuthenticity.min) failed.push(`음악적 진정성 ${s.musicalAuthenticity}<${c.musicalAuthenticity.min}`);
  if (total < c.totalMin) failed.push(`이준혁 종합 ${total}<${c.totalMin}`);
  return { total, pass: failed.length === 0, failedConditions: failed };
}

function evaluateSoyeon(s: SoyeonScores): { total: number; pass: boolean; failedConditions: string[] } {
  const total = soyeonTotal(s);
  const c = HYBE_PASSING_CRITERIA.soyeon;
  const failed: string[] = [];
  if (s.stagePresence < c.stagePresence.min) failed.push(`무대 장악력 ${s.stagePresence}<${c.stagePresence.min}`);
  if (s.uniqueness < c.uniqueness.min) failed.push(`개성·차별화 ${s.uniqueness}<${c.uniqueness.min}`);
  if (total < c.totalMin) failed.push(`김소연 종합 ${total}<${c.totalMin}`);
  return { total, pass: failed.length === 0, failedConditions: failed };
}

function evaluateDavid(s: DavidScores): { total: number; pass: boolean; failedConditions: string[] } {
  const total = davidTotal(s);
  const c = HYBE_PASSING_CRITERIA.david;
  const failed: string[] = [];
  if (s.globalAppeal < c.globalAppeal.min) failed.push(`글로벌 어필 ${s.globalAppeal}<${c.globalAppeal.min}`);
  if (s.artistVision < c.artistVision.min) failed.push(`아티스트 비전 ${s.artistVision}<${c.artistVision.min}`);
  if (total < c.totalMin) failed.push(`David 종합 ${total}<${c.totalMin}`);
  return { total, pass: failed.length === 0, failedConditions: failed };
}

// ─────────────────────────────────────────────────────────────
// 개별 투표 결정 (개별 합격 + 평균에 따른 verdict)
// ─────────────────────────────────────────────────────────────

function decideVote(individualPass: boolean, total: number, average: number): HybeVerdict {
  if (individualPass && average >= HYBE_PASSING_CRITERIA.averageMin) return 'pass';
  if (average >= 58 && average <= 64) return 'conditional';
  if (average >= 50 && average <= 57) return 'pending';
  if (average < 50) return 'fail';
  if (!individualPass && average >= HYBE_PASSING_CRITERIA.averageMin) return 'conditional';
  if (total < 50) return 'fail';
  return 'conditional';
}

// ─────────────────────────────────────────────────────────────
// 토론 필요 여부 판정
// ─────────────────────────────────────────────────────────────

function determineDebate(votes: HybeJudgeVote[]): DebateState {
  const tally: Record<HybeVerdict, HybeJudgeId[]> = { pass: [], conditional: [], pending: [], fail: [] };
  votes.forEach((v) => tally[v.vote].push(v.judgeId));
  const verdicts = (Object.keys(tally) as HybeVerdict[]).filter((k) => tally[k].length > 0);

  if (verdicts.length === 1) {
    return { needed: false, reason: 'unanimous' };
  }

  const majority = verdicts.reduce((a, b) => (tally[a].length >= tally[b].length ? a : b));
  const minority = verdicts.reduce((a, b) => (tally[a].length <= tally[b].length ? a : b));
  const minorityJudge = tally[minority][0];

  return { needed: true, round: 1, majority, minority, minorityJudge };
}

// ─────────────────────────────────────────────────────────────
// 4주 집중 루틴 추천 (가장 약한 항목 기반)
// ─────────────────────────────────────────────────────────────

function buildRecommendedRoutine(scores: HybeAuditionScores): string[] {
  const items: { label: string; ratio: number }[] = [
    { label: '트레이닝 흡수력 (피드백 즉시 반영 훈련)', ratio: scores.junhyuk.trainingAbsorption / 35 },
    { label: '음악적 진정성 (선곡 의도 + 가사 해석 노트)', ratio: scores.junhyuk.musicalAuthenticity / 30 },
    { label: '자기 인식 (강·약점 분석 일지)', ratio: scores.junhyuk.selfAwareness / 20 },
    { label: '무대 장악력 (카메라 마인드셋 훈련)', ratio: scores.soyeon.stagePresence / 35 },
    { label: '비주얼 임팩트 (표정·시선 처리 드릴)', ratio: scores.soyeon.visualImpact / 25 },
    { label: '퍼포먼스 완성도 (손끝·발끝 디테일)', ratio: scores.soyeon.performanceLevel / 25 },
    { label: '개성 & 차별화 (자기 해석 안무 만들기)', ratio: scores.soyeon.uniqueness / 15 },
    { label: '글로벌 어필 (영어 자기소개 + 보편적 메시지)', ratio: scores.david.globalAppeal / 35 },
    { label: '아티스트 비전 (5년·10년 비전 보드 작성)', ratio: scores.david.artistVision / 30 },
    { label: '커뮤니케이션 (다국어 인터뷰 시뮬레이션)', ratio: scores.david.communication / 20 },
  ];
  return items
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 4)
    .map((item, i) => `Week ${i + 1}: ${item.label}`);
}

// ─────────────────────────────────────────────────────────────
// 메인 진입점 — 명세대로 결과 도출
// ─────────────────────────────────────────────────────────────

export function resolveHybeAudition(scores: HybeAuditionScores): HybeFinalResult {
  const j = evaluateJunhyuk(scores.junhyuk);
  const s = evaluateSoyeon(scores.soyeon);
  const d = evaluateDavid(scores.david);
  const averageScore = Math.round((j.total + s.total + d.total) / 3);

  const judgeVotes: HybeJudgeVote[] = [
    {
      judgeId: 'hybe-junhyuk',
      judgeName: '이준혁',
      totalScore: j.total,
      individualPass: j.pass,
      vote: decideVote(j.pass, j.total, averageScore),
      reasoning: j.pass
        ? `종합 ${j.total}점 — 트레이닝 흡수력 기준 충족. 6개월 후가 기대됩니다.`
        : `종합 ${j.total}점 — 미달 항목: ${j.failedConditions.join(', ')}`,
    },
    {
      judgeId: 'hybe-soyeon',
      judgeName: '김소연',
      totalScore: s.total,
      individualPass: s.pass,
      vote: decideVote(s.pass, s.total, averageScore),
      reasoning: s.pass
        ? `종합 ${s.total}점 — 무대에서 그 순간이 보였어요.`
        : `종합 ${s.total}점 — 미달 항목: ${s.failedConditions.join(', ')}`,
    },
    {
      judgeId: 'hybe-david',
      judgeName: 'David Lim',
      totalScore: d.total,
      individualPass: d.pass,
      vote: decideVote(d.pass, d.total, averageScore),
      reasoning: d.pass
        ? `Total ${d.total} — 글로벌 시장 기준에서도 통할 수 있는 가능성이 보입니다.`
        : `Total ${d.total} — 미달: ${d.failedConditions.join(', ')}`,
    },
  ];

  const veto = checkVetoes(scores);
  if (veto.triggered) {
    return {
      scores,
      judgeVotes,
      averageScore,
      veto,
      debate: { needed: false, reason: 'unanimous' },
      finalVerdict: 'pending',
      decisionMaker: 'veto',
      resultMessage: veto.message,
      recommendedRoutineFocus: buildRecommendedRoutine(scores),
    };
  }

  const debate = determineDebate(judgeVotes);

  let finalVerdict: HybeVerdict;
  let decisionMaker: HybeFinalResult['decisionMaker'];

  if (!debate.needed) {
    finalVerdict = judgeVotes[0].vote;
    decisionMaker = 'consensus';
  } else {
    const junhyukVote = judgeVotes.find((v) => v.judgeId === 'hybe-junhyuk')!;
    finalVerdict = junhyukVote.vote;
    decisionMaker = 'hybe-junhyuk';
  }

  if (averageScore < HYBE_PASSING_CRITERIA.averageMin && finalVerdict === 'pass') {
    finalVerdict = 'conditional';
  }

  const message = HYBE_RESULT_MESSAGES[finalVerdict];

  return {
    scores,
    judgeVotes,
    averageScore,
    veto,
    debate,
    finalVerdict,
    decisionMaker,
    resultMessage: `${message.emoji} ${message.headline}\n\n${message.body}`,
    recommendedRoutineFocus: buildRecommendedRoutine(scores),
  };
}

// ─────────────────────────────────────────────────────────────
// 디스플레이용 직렬화 (UI에서 그대로 렌더하기 좋은 형태)
// ─────────────────────────────────────────────────────────────

export function buildResultDisplay(result: HybeFinalResult) {
  const tally: Record<HybeVerdict, number> = { pass: 0, conditional: 0, pending: 0, fail: 0 };
  result.judgeVotes.forEach((v) => {
    tally[v.vote] += 1;
  });

  const debateHighlight = result.veto.triggered
    ? `${result.veto.by === 'hybe-junhyuk' ? '이준혁' : 'David Lim'} 거부권 자동 발동 → 토론 생략`
    : result.debate.needed
      ? `의견 ${result.debate.majority.toUpperCase()} ${tally[result.debate.majority]}명 vs ${result.debate.minority.toUpperCase()} ${tally[result.debate.minority]}명 → 이준혁 최종 결정`
      : `만장일치 ${result.judgeVotes[0].vote.toUpperCase()} → 토론 없이 즉시 확정`;

  return {
    header: 'HYBE 빅히트뮤직 오디션 심사 결과',
    individualScores: result.judgeVotes.map((v) => ({
      judgeId: v.judgeId,
      judgeName: v.judgeName,
      score: v.totalScore,
      vote: v.vote,
      passed: v.individualPass,
      reasoning: v.reasoning,
    })),
    debateHighlight,
    voteTally: `이준혁(${result.judgeVotes[0].vote}) 김소연(${result.judgeVotes[1].vote}) David(${result.judgeVotes[2].vote})`,
    averageScore: result.averageScore,
    passingScore: HYBE_PASSING_CRITERIA.averageMin,
    finalVerdict: result.finalVerdict,
    finalMessage: result.resultMessage,
    recommendedRoutine: result.recommendedRoutineFocus,
  };
}
