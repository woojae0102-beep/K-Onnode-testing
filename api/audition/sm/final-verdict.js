// SM 최종 결과 집계 + 4주 맞춤 루틴 생성 API
// 토론 결과와 3명 평가를 받아 최종 verdict, 평균 점수, 4주 SM-tailored 루틴 반환

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const VERDICT_INFO = {
  pass: {
    title: '🎉 SM 엔터테인먼트 연습생 합격',
    message: '축하합니다. SM의 30년 캐스팅 안목이 당신을 선택했습니다.',
    color: '#1A237E',
    next: '계약 면담 일정을 안내드리겠습니다.',
  },
  conditional: {
    title: '✅ 조건부 합격',
    message: '가능성은 인정되었으나 보완이 필요합니다. SM의 트레이닝 시스템이 함께 합니다.',
    color: '#E91E63',
    next: '6개월 후 재오디션을 권고드립니다.',
  },
  pending: {
    title: '📋 보류 + 타사 추천',
    message: '현재 SM 기준으로는 합류가 어렵습니다. 다른 기획사가 더 적합할 수 있어요.',
    color: '#00BCD4',
    next: '타 기획사 또는 1년 후 재도전을 권고드립니다.',
  },
  fail: {
    title: '❌ 불합격',
    message: '이번 오디션은 통과하지 못했습니다.',
    color: '#636E72',
    next: '심사위원들의 피드백을 참고하여 다시 도전하세요.',
  },
};

const FALLBACK_ROUTINE = {
  routine: [
    { week: 1, focus: 'SM 발성 기초', daily: ['러닝머신 30분 + 발성 동시 훈련', '복식 호흡 + 물구나무 5분', '진성·믹스 보이스 전환 드릴 30분'], goal: '호흡과 발성의 토대 다지기' },
    { week: 2, focus: 'SM 아우라 & 비주얼', daily: ['카메라 앞 정지 30분 (시선 처리)', '댄스 라이브 풀곡 1회', 'SM 선배 무대 모방 분석'], goal: '카메라 앞 존재감 만들기' },
    { week: 3, focus: 'SMP 감성 & 글로벌', daily: ['SMP 곡 풀 라이브 댄스 + 노래', '영어 1분 자기소개 녹화', 'aespa·NCT 세계관 분석 30분'], goal: 'SM 콘셉트 흡수 + 글로벌 노출 시작' },
    { week: 4, focus: '통합 점검 & 자기 정체성', daily: ['전 항목 셀프 모의 오디션', '본인만의 톤·캐릭터 한 줄 정의', '심사위원 피드백 재검토'], goal: 'SM 재오디션 준비 완료' },
  ],
  priorityImprovement: 'SM 발성 기초와 카메라 아우라 동시 강화',
  nextAuditionTarget: '6개월 후',
  smSpecificAdvice: 'BoA·태연·태용처럼 자기 톤과 자기 캐릭터를 가진 아티스트가 되세요. SM이 찾는 건 새로운 타입입니다.',
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

async function generateRoutine({ judgeResults, finalVerdict, language }) {
  if (!ANTHROPIC_API_KEY) return FALLBACK_ROUTINE;

  const seo = judgeResults[0]?.scores || {};
  const yu = judgeResults[1]?.scores || {};
  const park = judgeResults[2]?.scores || {};

  const prompt = `SM 엔터테인먼트 오디션 결과를 바탕으로
4주 SM-tailored 맞춤 연습 루틴을 생성하세요.

심사위원 점수:
이성호 총괄: ${seo.total ?? 0}점
  - SM 아우라 & 비주얼: ${seo.smAuraVisual ?? 0}/40
  - 무대 장악력 & 시선 처리: ${seo.stageDominance ?? 0}/30
  - 개성 & SM 차별화: ${seo.uniqueness ?? 0}/20
  - SM 세계관 적합성: ${seo.smWorldCompatibility ?? 0}/10

최유진 디렉터: ${yu.total ?? 0}점
  - SM 발성 기초 & 기술: ${yu.smVocalTechnique ?? 0}/35
  - 음색 개성 & 독창성: ${yu.vocalUniqueColor ?? 0}/30
  - SMP 감성 & 퍼포먼스 발성: ${yu.smpPerformanceVocal ?? 0}/25
  - 음악적 이해력 & 발전 가능성: ${yu.musicalUnderstanding ?? 0}/10

박서영 디렉터: ${park.total ?? 0}점
  - 글로벌 브랜드 가능성: ${park.globalBrandPotential ?? 0}/35
  - SM 세계관 구현 능력: ${park.smWorldviewCompatibility ?? 0}/30
  - 미디어 & 콘텐츠 친화성: ${park.mediaContentFriendliness ?? 0}/25
  - 아티스트 자아 & 롱런 가능성: ${park.artistIdentityLongevity ?? 0}/10

최종 결과: ${finalVerdict}
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}

가장 점수가 낮은 항목부터 우선순위를 두고 SM의 실제 트레이닝 방법론
(러닝머신 발성, 물구나무 호흡, 댄스 라이브, SMP 감성, aespa·NCT 세계관)을
적극 반영해서 4주 루틴을 짜세요.

반드시 아래 JSON 형식으로만, 마크다운/코드펜스 금지:
{
  "routine": [
    { "week": 1, "focus": "집중 영역", "daily": ["활동1", "활동2", "활동3"], "goal": "이번 주 목표" },
    { "week": 2, "focus": "집중 영역", "daily": ["활동1", "활동2", "활동3"], "goal": "이번 주 목표" },
    { "week": 3, "focus": "집중 영역", "daily": ["활동1", "활동2", "활동3"], "goal": "이번 주 목표" },
    { "week": 4, "focus": "집중 영역", "daily": ["활동1", "활동2", "활동3"], "goal": "이번 주 목표" }
  ],
  "priorityImprovement": "가장 급한 개선 항목",
  "nextAuditionTarget": "재도전 예상 시기",
  "smSpecificAdvice": "SM 재도전을 위한 특별 조언"
}`;

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`CLAUDE_FAIL_${res.status}`);
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = tryParseJson(text);
    if (!parsed || !Array.isArray(parsed.routine)) return FALLBACK_ROUTINE;
    return parsed;
  } catch {
    return FALLBACK_ROUTINE;
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
    return res.status(400).json({ error: 'judgeResults must be an array of 3 judge evaluations' });
  }

  const finalVerdict = debateResult?.finalVerdict || 'conditional';
  const totals = judgeResults.map((r) => Number(r?.scores?.total ?? 0));
  const avgScore = Math.round(totals.reduce((a, b) => a + b, 0) / 3);

  const seonghoPass = totals[0] >= 65;
  const yujinPass = totals[1] >= 60;
  const seoyoungPass = totals[2] >= 60;
  const allCriteriaPass = seonghoPass && yujinPass && seoyoungPass;

  const routine = await generateRoutine({ judgeResults, finalVerdict, language });

  const judgeNames = ['이성호', '최유진', '박서영'];
  const judgeIds = ['sm-seongho', 'sm-yujin', 'sm-seoyoung'];

  return res.status(200).json({
    finalVerdict,
    avgScore,
    allCriteriaPass,
    individualPass: { seongho: seonghoPass, yujin: yujinPass, seoyoung: seoyoungPass },
    judgeResults,
    debateResult,
    verdictInfo: VERDICT_INFO[finalVerdict] || VERDICT_INFO.conditional,
    routine,
    judgeSummaries: judgeResults.map((r, idx) => ({
      judgeId: r.judgeId || judgeIds[idx],
      name: r.name || judgeNames[idx],
      score: Number(r?.scores?.total ?? 0),
      verdict: r.verdict || 'conditional',
      strongPoints: r.strongPoints || [],
      improvements: r.improvements || [],
      closing: r.closing || '',
      vetoTriggered: !!r.vetoTriggered,
      vetoReason: r.vetoReason || null,
      objectionRaised: !!r.objectionRaised,
      objectionReason: r.objectionReason || null,
      strongOpposition: !!r.strongOpposition,
      oppositionReason: r.oppositionReason || null,
      scores: r.scores || {},
    })),
    source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
  });
};
