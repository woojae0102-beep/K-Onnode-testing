// Consolidated monthly evaluation endpoint.
// Replaces:
//   /api/monthly/generate-profile
//   /api/monthly/agency-eval
//   /api/monthly/judge-debate
//   /api/monthly/final-result

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

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

async function callClaude({ system, prompt, maxTokens = 900 }) {
  if (!ANTHROPIC_API_KEY) return { ok: false, reason: 'no_api_key' };
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system: system || undefined,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) return { ok: false, reason: `http_${response.status}` };
    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = tryParseJson(text);
    if (!parsed) return { ok: false, reason: 'parse_error', raw: text };
    return { ok: true, parsed };
  } catch (err) {
    return { ok: false, reason: 'fetch_error', error: String(err?.message || err) };
  }
}

function languageLabel(language) {
  if (language === 'ja') return '日本語';
  if (language === 'en') return 'English';
  if (language === 'zh') return '中文';
  if (language === 'es') return 'Español';
  if (language === 'fr') return 'Français';
  if (language === 'th') return 'ภาษาไทย';
  if (language === 'vi') return 'Tiếng Việt';
  return '한국어';
}

function actionFromReq(req, body) {
  if (body?.action) return String(body.action);
  const url = new URL(req.url || '/', 'http://localhost');
  const q = url.searchParams.get('path') || '';
  return q.split('/').filter(Boolean).pop() || 'unknown';
}

const AGENCIES = ['hybe', 'yg', 'jyp', 'sm', 'starship'];
const AGENCY_NAMES = { hybe: 'HYBE', yg: 'YG', jyp: 'JYP', sm: 'SM', starship: 'Starship' };

function profileFallback(reason) {
  return {
    traineeType: '성장형 올라운더',
    mainStrength: '꾸준한 연습으로 전반적인 실력 향상',
    mainWeakness: '안정적인 라이브 능력 보완 필요',
    growthRate: 'fast',
    stagePresence: 'B',
    marketability: 'medium',
    primaryPosition: '메인댄서',
    potentialPositions: ['서브보컬', '퍼포머'],
    personalityTag: '성실형',
    growthNarrative: '이번 달 꾸준한 연습으로 전월 대비 눈에 띄는 성장을 보였습니다. 데이터에 새겨진 시간이 곧 캐릭터가 되고 있어요. 다음 달에는 더 큰 무대를 기대해도 좋겠습니다.',
    specialNote: '댄스 부문에서 특히 두드러진 발전',
    source: reason ? 'fallback' : 'local',
    reason,
  };
}

function agencyFallback(agencyId = 'hybe', reason) {
  const base = {
    hybe: { overallGrade: 'B+', passRate: 62, gradeReason: '성장 데이터는 긍정적이나 글로벌 어필 보강 필요' },
    yg: { overallGrade: 'B', passRate: 44, gradeReason: '완성도와 고유 색깔 보강 필요' },
    jyp: { overallGrade: 'B+', passRate: 68, gradeReason: '꾸준함과 태도가 인상적, 라이브 안정 필요' },
    sm: { overallGrade: 'B', passRate: 51, gradeReason: '음색 개성은 있으나 카메라 친화성 향상 필요' },
    starship: { overallGrade: 'A', passRate: 76, gradeReason: '대중성과 기본기의 균형이 좋음' },
  }[agencyId] || { overallGrade: 'B', passRate: 50, gradeReason: '종합 보완 필요' };
  return {
    agencyId,
    agencyName: AGENCY_NAMES[agencyId] || agencyId,
    ...base,
    judgeComments: [
      { judgeId: `${agencyId}-1`, judgeName: 'AI 심사위원 A', avatar: '🎤', agency: agencyId, tone: 'positive', comment: '성장 가능성이 보입니다.' },
      { judgeId: `${agencyId}-2`, judgeName: 'AI 심사위원 B', avatar: '💃', agency: agencyId, tone: 'neutral', comment: '무대 안정성을 더 보강하면 좋겠습니다.' },
      { judgeId: `${agencyId}-3`, judgeName: 'AI 심사위원 C', avatar: '⭐', agency: agencyId, tone: 'impressed', comment: '팬들이 좋아할 요소가 있습니다.' },
    ],
    focusCriteria: ['성장률', '꾸준함', '실력 완성도'],
    verdict: '가능성 있는 연습생. 지속적인 성장 필요.',
    recommendation: '기본기와 무대 표현을 함께 강화하세요.',
    source: 'fallback',
    reason,
  };
}

function debateFallback(reason) {
  return {
    debateLines: [
      { speaker: 'HYBE 심사위원', agency: 'HYBE', avatar: '👨‍💼', line: '이번 달 성장 데이터는 긍정적입니다.', tone: 'positive', pauseBefore: 1 },
      { speaker: 'YG 심사위원', agency: 'YG', avatar: '😎', line: '다만 무대 완성도는 아직 부족합니다.', tone: 'critical', pauseBefore: 2 },
      { speaker: 'JYP 심사위원', agency: 'JYP', avatar: '🤝', line: '꾸준함과 태도는 높은 점수를 줄 수 있습니다.', tone: 'positive', pauseBefore: 1 },
      { speaker: 'SM 심사위원', agency: 'SM', avatar: '👑', line: '[침묵] 카메라 친화성을 더 봐야 합니다.', tone: 'neutral', pauseBefore: 3 },
      { speaker: 'Starship 심사위원', agency: 'Starship', avatar: '⭐', line: '대중성은 충분히 있어요. 다음 달이 기대됩니다.', tone: 'impressed', pauseBefore: 1 },
    ],
    keyConflict: '완성도(YG) vs 성장 가능성(HYBE) 의견 충돌',
    consensus: '성장세는 긍정적이나 안정감 보완 필요',
    finalSummary: '무대에서 시선을 끄는 능력은 확실히 있습니다. 안정감이 더 생기면 훨씬 강해질 거예요.',
    source: 'fallback',
    reason,
  };
}

function survivalFromProb(prob) {
  if (prob >= 80) return 'debut_candidate';
  if (prob >= 65) return 'top30';
  if (prob >= 50) return 'hold';
  if (prob >= 35) return 'danger';
  return 'eliminated';
}

function finalFallback({ agencyEvaluations = {}, previousResults = [] }, reason) {
  const evals = Object.values(agencyEvaluations || {});
  const avg = evals.length
    ? Math.round(evals.reduce((sum, e) => sum + (Number(e?.passRate) || 0), 0) / evals.length)
    : 55;
  const prev = previousResults?.[previousResults.length - 1]?.debutProbability ?? 50;
  const change = avg - prev;
  return {
    overallGrade: avg >= 70 ? 'A' : avg >= 55 ? 'B+' : 'B',
    overallScore: Math.max(40, Math.min(95, Math.round(avg * 0.9 + 10))),
    survivalStatus: survivalFromProb(avg),
    survivalMessage: avg >= 65 ? 'TOP 라인에 가까워졌습니다. 다음 달이 중요해요.' : '아직 보류 라인입니다. 기본기 보강이 필요합니다.',
    debutProbability: avg,
    debutProbabilityChange: change,
    debutProbabilityMessage: `전월 대비 ${Math.abs(change)}% ${change >= 0 ? '상승' : '하락'}`,
    positionChanges: [
      { position: '메인댄서', change: 'up', detail: '댄스 점수 향상' },
      { position: '리드보컬', change: 'stable', detail: '음정 안정세 유지' },
    ],
    biggestGrowth: '댄스 정확도 향상',
    biggestIssue: '라이브 안정성',
    aiJudgeSummary: '가능성은 충분합니다. 안정감과 표현력을 동시에 끌어올리면 다음 평가에서 큰 변화가 보일 거예요.',
    nextMonthGoals: ['라이브 능력 강화', '보컬 안정성 향상', '꾸준한 출석 유지'],
    groupMatch: { primaryGroup: 'NewJeans형', reason: '자연스러운 매력과 카메라 친화성', alternativeGroup: 'ITZY형' },
    traineeHistory: [],
    specialAward: null,
    emotionalMessage: '이 달의 당신은 분명 달라졌습니다. 포기하지 마세요.',
    source: 'fallback',
    reason,
  };
}

async function handleGenerateProfile(body) {
  const fallback = profileFallback();
  const prompt = `한 달 누적 데이터로 K-POP 연습생 프로필을 JSON으로 생성하세요.
데이터: ${JSON.stringify(body.monthlyData || {})}
이전 결과: ${JSON.stringify(body.previousResults?.slice?.(-3) || [])}
응답 언어: ${languageLabel(body.language)}
필드: traineeType, mainStrength, mainWeakness, growthRate, stagePresence, marketability, primaryPosition, potentialPositions, personalityTag, growthNarrative, specialNote`;
  const result = await callClaude({ prompt, maxTokens: 700 });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, source: 'claude' } : profileFallback(result.reason);
}

async function handleAgencyEval(body) {
  const agencyId = body.agencyId || 'hybe';
  const fallback = agencyFallback(agencyId);
  const prompt = `${AGENCY_NAMES[agencyId] || agencyId} 기준으로 월말 연습생 평가 JSON을 생성하세요.
월간 데이터: ${JSON.stringify(body.monthlyData || {})}
프로필: ${JSON.stringify(body.traineeProfile || {})}
응답 언어: ${languageLabel(body.language)}
필드: agencyId, overallGrade, passRate, judgeComments, focusCriteria, verdict, recommendation, gradeReason`;
  const result = await callClaude({ prompt, maxTokens: 900 });
  return result.ok && result.parsed
    ? { ...fallback, ...result.parsed, agencyId, agencyName: AGENCY_NAMES[agencyId], source: 'claude' }
    : agencyFallback(agencyId, result.reason);
}

async function handleDebate(body) {
  const prompt = `5개 기획사 심사위원 토론 결과를 JSON으로 생성하세요.
평가: ${JSON.stringify(body.agencyEvaluations || {})}
프로필: ${JSON.stringify(body.traineeProfile || {})}
응답 언어: ${languageLabel(body.language)}
필드: debateLines, keyConflict, consensus, finalSummary`;
  const result = await callClaude({ prompt, maxTokens: 1200 });
  return result.ok && result.parsed ? { ...debateFallback(), ...result.parsed, source: 'claude' } : debateFallback(result.reason);
}

async function handleFinal(body) {
  const fallback = finalFallback(body);
  const prompt = `월말 최종 결과 JSON을 생성하세요.
평가: ${JSON.stringify(body.agencyEvaluations || {})}
프로필: ${JSON.stringify(body.traineeProfile || {})}
이전 결과: ${JSON.stringify(body.previousResults?.slice?.(-3) || [])}
응답 언어: ${languageLabel(body.language)}
필드: overallGrade, overallScore, survivalStatus, survivalMessage, debutProbability, debutProbabilityChange, debutProbabilityMessage, positionChanges, biggestGrowth, biggestIssue, aiJudgeSummary, nextMonthGoals, groupMatch, traineeHistory, specialAward, emotionalMessage`;
  const result = await callClaude({ prompt, maxTokens: 1100 });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, source: 'claude' } : finalFallback(body, result.reason);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = await readJsonBody(req);
  const action = actionFromReq(req, body);
  try {
    if (action === 'generate-profile') return res.status(200).json(await handleGenerateProfile(body));
    if (action === 'agency-eval') return res.status(200).json(await handleAgencyEval(body));
    if (action === 'judge-debate') return res.status(200).json(await handleDebate(body));
    if (action === 'final-result') return res.status(200).json(await handleFinal(body));
    return res.status(404).json({ error: 'Unknown monthly action', action });
  } catch (err) {
    return res.status(500).json({ error: 'monthly_failed', detail: String(err?.message || err) });
  }
};
