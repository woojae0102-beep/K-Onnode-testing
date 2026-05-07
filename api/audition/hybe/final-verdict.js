// HYBE 최종 결과 집계 + 4주 맞춤 루틴 생성 API
// 토론 결과와 3명 평가를 받아서 최종 verdict, 평균 점수, 4주 루틴, 시각화용 데이터를 반환

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const VERDICT_INFO = {
  pass: {
    title: '🎉 HYBE 빅히트뮤직 연습생 합격',
    message: '축하합니다. 3명의 심사위원이 당신의 가능성을 인정했습니다.',
    color: '#6C5CE7',
    next: '계약 면담 일정을 안내드리겠습니다.',
  },
  conditional: {
    title: '✅ 조건부 합격',
    message: '가능성은 인정되었으나 보완이 필요합니다.',
    color: '#FF6B9D',
    next: '6개월 후 재오디션을 권고드립니다.',
  },
  pending: {
    title: '📋 보류',
    message: '현재 기준으로는 HYBE 연습생 합류가 어렵습니다.',
    color: '#00B894',
    next: '다른 기획사 또는 1년 후 재도전을 권고드립니다.',
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
    { week: 1, focus: '음악적 진정성', daily: ['좋아하는 곡 가사 분석 30분', '롤모델 무대 영상 정밀 관찰 30분', '자기 선곡 의도 일지 작성 15분'], goal: '음악을 도구가 아닌 사랑으로 대하기' },
    { week: 2, focus: '무대 장악력', daily: ['전신 거울 카메라 앵글 연습', '시선 처리 드릴 20분', '3초 임팩트 포즈 100회'], goal: '카메라 앞에서의 확신 만들기' },
    { week: 3, focus: '글로벌 어필', daily: ['영어 1분 자기소개 작성·녹화', '해외 아티스트 인터뷰 분석', '비전 보드 업데이트'], goal: '5년·10년 후 자신을 명확하게 그리기' },
    { week: 4, focus: '통합 점검', daily: ['전 항목 셀프 모의 오디션', '약점 1개 집중 보완', '심사위원 피드백 재검토'], goal: 'HYBE 재오디션 준비 완료' },
  ],
  priorityImprovement: '음악적 진정성과 무대 장악력의 동시 강화',
  nextAuditionTarget: '6개월 후',
  hybeSpecificAdvice: 'BTS·TXT·LE SSERAFIM처럼 자기 이야기를 음악으로 풀어낼 수 있는 아티스트가 되세요.',
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

  const lee = judgeResults[0]?.scores || {};
  const kim = judgeResults[1]?.scores || {};
  const dav = judgeResults[2]?.scores || {};

  const prompt = `HYBE 빅히트뮤직 오디션 결과를 바탕으로
4주 맞춤 연습 루틴을 생성하세요.

심사위원 점수:
이준혁: ${lee.total ?? 0}점
  - 트레이닝 흡수력: ${lee.trainingAbsorption ?? 0}/35
  - 음악적 진정성: ${lee.musicalSincerity ?? 0}/30
  - 자기 인식: ${lee.selfAwareness ?? 0}/20
  - 음악적 감수성: ${lee.musicalSensibility ?? 0}/15

김소연: ${kim.total ?? 0}점
  - 무대 장악력: ${kim.stagePresence ?? 0}/35
  - 비주얼 임팩트: ${kim.visualImpact ?? 0}/25
  - 댄스 & 퍼포먼스: ${kim.dancePerformance ?? 0}/25
  - 개성 & 차별화: ${kim.uniqueness ?? 0}/15

David Lim: ${dav.total ?? 0}점
  - 글로벌 어필: ${dav.globalAppeal ?? 0}/35
  - 아티스트 비전: ${dav.artistVision ?? 0}/30
  - 커뮤니케이션: ${dav.communicationAbility ?? 0}/20
  - 지속 가능성: ${dav.sustainability ?? 0}/15

최종 결과: ${finalVerdict}
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}

가장 점수가 낮은 항목부터 우선순위를 두고 4주 루틴을 짜세요.
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
  "hybeSpecificAdvice": "HYBE 재도전을 위한 특별 조언"
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

  const leePass = totals[0] >= 65;
  const kimPass = totals[1] >= 60;
  const davidPass = totals[2] >= 60;
  const allCriteriaPass = leePass && kimPass && davidPass;

  const routine = await generateRoutine({ judgeResults, finalVerdict, language });

  const judgeNames = ['이준혁', '김소연', 'David Lim'];
  const judgeIds = ['lee-junhyuk', 'kim-soyeon', 'david-lim'];

  return res.status(200).json({
    finalVerdict,
    avgScore,
    allCriteriaPass,
    individualPass: { lee: leePass, kim: kimPass, david: davidPass },
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
      scores: r.scores || {},
    })),
    source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
  });
};
