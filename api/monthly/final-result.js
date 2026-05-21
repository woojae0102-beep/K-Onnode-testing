// 월말 평가: 최종 결과 종합
const { readJsonBody, callClaude, languageLabel } = require('./_helpers');

function survivalFromProb(prob) {
  if (prob >= 80) return 'debut_candidate';
  if (prob >= 65) return 'top30';
  if (prob >= 50) return 'hold';
  if (prob >= 35) return 'danger';
  return 'eliminated';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = await readJsonBody(req);
  const {
    agencyEvaluations = {},
    traineeProfile = {},
    monthlyData = {},
    previousResults = [],
    language = 'ko',
  } = body || {};

  const evals = Object.values(agencyEvaluations || {});
  const passSum = evals.reduce((sum, e) => sum + (Number(e?.passRate) || 0), 0);
  const avgPass = evals.length ? passSum / evals.length : 50;
  const previousDebutProb = previousResults?.[previousResults.length - 1]?.debutProbability ?? 50;
  const currentDebutProb = Math.round(avgPass);
  const debutProbChange = currentDebutProb - previousDebutProb;
  const survivalStatus = survivalFromProb(currentDebutProb);

  const prompt = `당신은 K-POP 연습생 월말 최종 결과를 생성하는 시스템입니다.

중요: 절대 단순 분석으로 끝내면 안 됩니다.
반드시 "연습생 인생 시뮬레이터" 느낌이어야 합니다.
사용자가 감정적으로 몰입하고 다음 달을 기대하게 만드세요.

연습생 프로필: ${JSON.stringify(traineeProfile)}
이번 달 데이터: ${JSON.stringify(monthlyData)}
각 기획사 평가: ${JSON.stringify(agencyEvaluations)}
이전 달 결과: ${JSON.stringify(previousResults?.slice?.(-3) || [])}
이번 달 데뷔 확률: ${currentDebutProb}% (전월 대비 ${debutProbChange > 0 ? '+' : ''}${debutProbChange}%)
생존 상태: ${survivalStatus}

응답 언어: ${languageLabel(language)}

JSON만 출력:
{
  "overallGrade": "S|A|B+|B|C+|C|D",
  "overallScore": 숫자(0~100),
  "survivalStatus": "${survivalStatus}",
  "survivalMessage": "생존 상태 메시지 (드라마틱하게)",
  "debutProbability": ${currentDebutProb},
  "debutProbabilityChange": ${debutProbChange},
  "debutProbabilityMessage": "데뷔 확률 변화 설명 한 문장",
  "positionChanges": [
    { "position": "포지션명", "change": "up|down|stable|new", "detail": "설명" }
  ],
  "biggestGrowth": "가장 성장한 부분 + 수치",
  "biggestIssue": "가장 많이 지적된 문제",
  "aiJudgeSummary": "AI 심사위원 종합 총평 2~3문장",
  "nextMonthGoals": ["목표1", "목표2", "목표3"],
  "groupMatch": {
    "primaryGroup": "그룹 타입 (예: NewJeans형)",
    "reason": "이유 한 문장",
    "alternativeGroup": "대안 그룹 타입"
  },
  "traineeHistory": [
    { "month": "YYYY-MM", "event": "핵심 사건/성장", "tone": "positive|negative|neutral" }
  ],
  "specialAward": "이번 달 특별 시상 (없으면 null)",
  "emotionalMessage": "사용자 가슴에 남을 한마디 (감동적으로)"
}`;

  const fallback = {
    overallGrade: currentDebutProb >= 70 ? 'A' : currentDebutProb >= 55 ? 'B+' : 'B',
    overallScore: Math.max(40, Math.min(95, Math.round(currentDebutProb * 0.9 + 10))),
    survivalStatus,
    survivalMessage:
      survivalStatus === 'debut_candidate'
        ? '이대로면 데뷔 후보 라인입니다. 멈추지 마세요.'
        : survivalStatus === 'top30'
        ? 'TOP 30%. 한 끗만 더하면 데뷔 라인이 보입니다.'
        : survivalStatus === 'hold'
        ? '아직 보류 라인. 다음 달이 분기점입니다.'
        : survivalStatus === 'danger'
        ? '탈락 위기 라인. 지금이 가장 중요한 순간이에요.'
        : '한 번 무너졌지만, 다시 시작할 수 있어요.',
    debutProbability: currentDebutProb,
    debutProbabilityChange: debutProbChange,
    debutProbabilityMessage:
      debutProbChange === 0
        ? '전월과 동일한 라인입니다.'
        : `전월 대비 ${Math.abs(debutProbChange)}% ${debutProbChange > 0 ? '상승' : '하락'}`,
    positionChanges: [
      { position: '메인댄서', change: 'up', detail: '댄스 점수 향상' },
      { position: '리드보컬', change: 'stable', detail: '음정 안정세 유지' },
    ],
    biggestGrowth: '댄스 정확도 향상',
    biggestIssue: '라이브 안정성',
    aiJudgeSummary: '무대에서 시선을 끄는 능력은 확실히 있습니다. 다만 안정감이 보강되면 훨씬 강해질 거예요. 다음 달이 분기점입니다.',
    nextMonthGoals: ['라이브 능력 강화', '보컬 안정성 향상', '꾸준한 출석 유지'],
    groupMatch: { primaryGroup: 'NewJeans형', reason: '자연스러운 매력과 카메라 친화성', alternativeGroup: 'ITZY형' },
    traineeHistory: previousResults?.slice?.(-3)?.map?.((r) => ({
      month: r.month,
      event: r.biggestGrowth || '연습 이어감',
      tone: 'positive',
    })) || [],
    specialAward: null,
    emotionalMessage: '이 달의 당신은 분명 달라졌습니다. 포기하지 마세요.',
  };

  const result = await callClaude({ prompt, maxTokens: 1100 });
  if (result.ok && result.parsed) {
    return res.status(200).json({ ...fallback, ...result.parsed, source: 'claude' });
  }
  return res.status(200).json({ ...fallback, source: 'fallback', reason: result.reason });
};
