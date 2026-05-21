// 월말 평가 4단계 API를 순서대로 호출해 결과를 콘솔에 보여주는 테스트 스크립트
// 실행: node scripts/test-monthly-eval.cjs

const path = require('path');
const fs = require('fs');

// .env 수동 로드 (dotenv 미설치 가정)
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  });
}
loadEnv();

const generateProfile = require(path.resolve(__dirname, '..', 'api', 'monthly', 'generate-profile.js'));
const agencyEval = require(path.resolve(__dirname, '..', 'api', 'monthly', 'agency-eval.js'));
const judgeDebate = require(path.resolve(__dirname, '..', 'api', 'monthly', 'judge-debate.js'));
const finalResult = require(path.resolve(__dirname, '..', 'api', 'monthly', 'final-result.js'));

// req/res 모킹
function mockReqRes(body) {
  const req = { method: 'POST', body, headers: {}, on: () => {} };
  let _status = 200;
  let _payload = null;
  const res = {
    status(code) { _status = code; return res; },
    json(obj) { _payload = obj; return res; },
    setHeader() {},
    headersSent: false,
    end() {},
    get statusCode() { return _status; },
    get payload() { return _payload; },
  };
  return { req, res };
}

async function call(handler, body) {
  const { req, res } = mockReqRes(body);
  await handler(req, res);
  return { status: res.statusCode, body: res.payload };
}

// 샘플 월간 누적 데이터
const monthlyData = {
  month: '2026-05',
  userId: 'test-user',
  dance: {
    sessions: 14,
    avgScore: 78,
    improvement: 6,
    topWeakness: '표정 연결 끊김',
    topStrength: '동작 임팩트',
    consistencyScore: 82,
    bestSessionScore: 88,
  },
  vocal: {
    sessions: 11,
    avgPitchAccuracy: 74,
    breathingStability: 68,
    improvement: 4,
    topWeakness: '호흡 안정성',
    topStrength: '음색',
    liveAbility: 66,
  },
  korean: {
    sessions: 6,
    pronunciation: 82,
    intonation: 75,
    improvement: 8,
    topWeakness: '받침 발음',
  },
  audition: {
    attempts: 2,
    bestResult: 'conditional',
    agencyResults: { hybe: 'conditional', jyp: 'pending' },
    interviewScore: 71,
  },
  consistency: {
    weeklyAttendance: 4.2,
    totalDays: 21,
    streakDays: 9,
    lateDays: 2,
  },
  previousMonths: [],
};

const previousResults = [
  {
    month: '2026-04',
    overallGrade: 'B',
    overallScore: 65,
    survivalStatus: 'hold',
    debutProbability: 54,
    debutProbabilityChange: 0,
    biggestGrowth: '댄스 정확도 5% 상승',
    biggestIssue: '라이브 안정성',
    aiJudgeSummary: '꾸준함 확인. 다음 달이 분기점.',
    nextMonthGoals: ['라이브 안정', '표정 연결', '호흡 훈련'],
    groupMatch: { primaryGroup: 'NewJeans형', reason: '자연스러움', alternativeGroup: 'ITZY형' },
    traineeHistory: [{ month: '2026-04', event: '댄스 성장세 확인', tone: 'positive' }],
    positionChanges: [],
    agencyPassRates: { hybe: 56, yg: 38, jyp: 60, sm: 47, starship: 70 },
  },
];

function printDivider(title) {
  const bar = '─'.repeat(60);
  console.log(`\n${bar}\n  ${title}\n${bar}`);
}

(async () => {
  console.log('🎤 ONNODE 월말 평가 시뮬레이션 테스트');
  console.log(`API 키: ${process.env.ANTHROPIC_API_KEY ? 'set ✓' : 'missing ✗'}`);
  console.log(`모델: ${process.env.ANTHROPIC_MODEL || '(default)'}`);

  // 1) 프로필
  printDivider('① 연습생 AI 프로필 생성');
  const profileRes = await call(generateProfile, {
    monthlyData,
    previousResults,
    language: 'ko',
  });
  const profile = profileRes.body;
  console.log(`source: ${profile.source}`);
  console.log(`타입       : ${profile.traineeType}`);
  console.log(`강점       : ${profile.mainStrength}`);
  console.log(`약점       : ${profile.mainWeakness}`);
  console.log(`성장 속도   : ${profile.growthRate}`);
  console.log(`아우라     : ${profile.stagePresence}`);
  console.log(`대중성     : ${profile.marketability}`);
  console.log(`주포지션    : ${profile.primaryPosition}`);
  console.log(`잠재 포지션 : ${(profile.potentialPositions || []).join(', ')}`);
  console.log(`성격 태그   : ${profile.personalityTag}`);
  console.log(`서사       : ${profile.growthNarrative}`);
  if (profile.specialNote) console.log(`특이점     : ${profile.specialNote}`);

  // 2) 기획사별 평가 (병렬)
  printDivider('② 5개 기획사 심사위원 평가 (병렬)');
  const agencies = ['hybe', 'yg', 'jyp', 'sm', 'starship'];
  const evalsArr = await Promise.all(
    agencies.map((id) =>
      call(agencyEval, { agencyId: id, monthlyData, traineeProfile: profile, language: 'ko' })
    )
  );
  const evals = {};
  evalsArr.forEach((r, i) => {
    const e = r.body;
    evals[agencies[i]] = e;
    console.log(`\n[${e.agencyName || agencies[i].toUpperCase()}]  등급 ${e.overallGrade} · 합격 가능성 ${e.passRate}%  (source: ${e.source})`);
    console.log(`  verdict: ${e.verdict}`);
    if (e.gradeReason) console.log(`  reason : ${e.gradeReason}`);
    (e.judgeComments || []).forEach((c) => {
      console.log(`  - ${c.avatar} ${c.judgeName} [${c.tone}] : ${c.comment}`);
    });
    console.log(`  focus  : ${(e.focusCriteria || []).join(' · ')}`);
    console.log(`  조언   : ${e.recommendation}`);
  });

  // 3) 심사위원 토론
  printDivider('③ 심사위원 토론');
  const debateRes = await call(judgeDebate, {
    agencyEvaluations: evals,
    traineeProfile: profile,
    monthlyData,
    language: 'ko',
  });
  const debate = debateRes.body;
  console.log(`source: ${debate.source}`);
  (debate.debateLines || []).forEach((line, i) => {
    console.log(`  ${i + 1}. ${line.avatar} ${line.speaker} (${line.agency}) [${line.tone}]`);
    console.log(`     "${line.line}"`);
  });
  console.log(`\n  핵심 충돌 : ${debate.keyConflict}`);
  console.log(`  공통 의견 : ${debate.consensus}`);
  console.log(`  종합 총평 : ${debate.finalSummary}`);

  // 4) 최종 결과
  printDivider('④ 최종 결과 종합');
  const finalRes = await call(finalResult, {
    agencyEvaluations: evals,
    traineeProfile: profile,
    monthlyData,
    previousResults,
    language: 'ko',
  });
  const final = finalRes.body;
  console.log(`source: ${final.source}`);
  console.log(`종합 등급        : ${final.overallGrade}  (총점 ${final.overallScore})`);
  console.log(`데뷔 가능성      : ${final.debutProbability}% (전월 대비 ${final.debutProbabilityChange >= 0 ? '+' : ''}${final.debutProbabilityChange}%)`);
  console.log(`생존 상태        : ${final.survivalStatus}`);
  console.log(`생존 메시지      : ${final.survivalMessage}`);
  console.log(`최대 성장        : ${final.biggestGrowth}`);
  console.log(`최대 이슈        : ${final.biggestIssue}`);
  console.log(`AI 심사위원 총평 : ${final.aiJudgeSummary}`);
  console.log(`다음 달 목표     :`);
  (final.nextMonthGoals || []).forEach((g, i) => console.log(`   ${i + 1}. ${g}`));
  if (final.groupMatch) {
    console.log(`AI 그룹 매칭     : ${final.groupMatch.primaryGroup} — ${final.groupMatch.reason}`);
    console.log(`                  대안: ${final.groupMatch.alternativeGroup}`);
  }
  if (final.positionChanges?.length) {
    console.log('포지션 변화      :');
    final.positionChanges.forEach((p) => console.log(`   - ${p.position} (${p.change}) : ${p.detail}`));
  }
  if (final.specialAward) console.log(`특별 시상        : ${final.specialAward}`);
  console.log(`\n💌 ${final.emotionalMessage}`);

  console.log('\n✅ 테스트 완료');
})().catch((err) => {
  console.error('❌ 테스트 실패:', err);
  process.exit(1);
});
