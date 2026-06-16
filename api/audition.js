// Consolidated audition endpoint.
// Old URLs are rewritten here by vercel.json, preserving frontend calls while
// keeping Vercel Hobby function count below the limit.

const { createFlowHandler } = require('../lib/api-lib/agencyFlowHandler.js');
const { getJudge, getAgency, pickFallbackReaction } = require('../lib/api-lib/agencyJudges.js');
const { buildTrainerRagContext, buildTrainerSystemPrompt } = require('../lib/trainer-knowledge/engine');

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

async function callClaudeJson({ system, prompt, maxTokens = 800 }) {
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
    const parsed = tryParseJson(data?.content?.[0]?.text || '');
    if (!parsed) return { ok: false, reason: 'parse_error' };
    return { ok: true, parsed };
  } catch (err) {
    return { ok: false, reason: 'fetch_error', error: String(err?.message || err) };
  }
}

function getRouteParts(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const raw = url.searchParams.get('path') || '';
  return raw.split('/').filter(Boolean);
}

function normalizeJudgeId(agencyId, rawId) {
  const value = String(rawId || '').replace(/^judge-/, '');
  const maps = {
    hybe: { lee: 'hybe-junhyuk', kim: 'hybe-soyeon', david: 'hybe-david' },
    yg: { taejun: 'yg-taejun', narae: 'yg-narae', marcus: 'yg-marcus' },
    jyp: { jaewon: 'jyp-jaewon', minji: 'jyp-minji', seonghyeon: 'jyp-seonghyeon' },
    sm: { seongho: 'sm-seongho', yujin: 'sm-yujin', seoyoung: 'sm-seoyoung' },
    starship: { seunghoon: 'starship-seunghoon', nari: 'starship-nari', jisoo: 'starship-jisoo' },
  };
  return maps[agencyId]?.[value] || `${agencyId}-${value}`;
}

function genericJudgeFallback({ agencyId = 'hybe', judgeId = '', phase = 'final_evaluation' }, reason) {
  const resolvedJudgeId = normalizeJudgeId(agencyId, judgeId);
  const judge = getJudge(resolvedJudgeId) || { name: 'AI 심사위원', title: '심사위원', style: '균형 평가' };
  const total = phase === 'realtime_react' ? undefined : 68;
  return {
    speaking:
      phase === 'realtime_react'
        ? pickFallbackReaction(agencyId)
        : `${judge.name}입니다. 가능성은 있지만 기준을 더 정확히 맞춰야 합니다.`,
    instinct: '잠재력은 있으나 안정감 보강 필요',
    scores: {
      total: total || 68,
      stagePresence: 22,
      visualImpact: 16,
      dancePerformance: 17,
      uniqueness: 13,
      vocal: 68,
      rhythm: 64,
      attitude: 72,
    },
    verdict: 'conditional',
    vetoTriggered: false,
    vetoReason: null,
    strongPoints: ['성장 가능성', '꾸준함'],
    improvements: ['음정 안정성', '무대 디테일'],
    closing: '다음 단계로 가려면 기준을 더 선명하게 맞춰야 합니다.',
    debatePosition: '합격 가능성은 있으나 안정성 확인이 필요합니다.',
    judgeId: resolvedJudgeId,
    judgeName: judge.name,
    source: 'fallback',
    reason,
  };
}

async function handleJudge({ req, body, agencyId, slug }) {
  const phase = body.phase || body.stage || 'final_evaluation';
  const judgeId = normalizeJudgeId(agencyId, slug);
  const judge = getJudge(judgeId);
  const agency = getAgency(agencyId);
  const fallback = genericJudgeFallback({ agencyId, judgeId, phase });
  const rag = await buildTrainerRagContext({
    query: `audition judge agency:${agencyId} phase:${phase} data:${JSON.stringify(body)}`,
    domain: 'audition',
    personaId: agencyId === 'yg' ? 'yg' : agencyId === 'starship' ? 'starship' : 'jyp',
    topK: 5,
  });
  const prompt = `K-POP 기획사 심사위원 평가 JSON을 생성하세요.
기획사: ${agency?.name || agencyId}
심사위원: ${judge?.name || judgeId} / ${judge?.title || ''}
심사위원 스타일: ${judge?.style || ''}
요청 단계: ${phase}
입력 데이터: ${JSON.stringify(body)}
Trainer Knowledge Base를 근거로 왜 부족한지, 어떻게 고칠지, 다음 미션을 실제 심사위원처럼 말하세요.
필드: speaking, instinct, scores, verdict, vetoTriggered, vetoReason, strongPoints, improvements, closing, debatePosition`;
  const system = `${judge?.systemPrompt || ''}\n\n${buildTrainerSystemPrompt({ persona: rag.persona, domain: rag.domain, contextText: rag.contextText })}`;
  const result = await callClaudeJson({ system, prompt, maxTokens: 1000 });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, source: rag.results?.length ? 'trainer_knowledge_rag' : 'claude' } : genericJudgeFallback({ agencyId, judgeId, phase }, result.reason);
}

function debateFallback(agencyId = 'hybe', reason) {
  const agency = getAgency(agencyId);
  const judges = agency?.judges || [];
  return {
    agencyId,
    debateLines: judges.map((id, idx) => {
      const j = getJudge(id);
      return {
        speaker: j?.name || `심사위원 ${idx + 1}`,
        line: idx === 0 ? '가능성은 보입니다.' : idx === 1 ? '하지만 완성도는 더 봐야 합니다.' : '다음 라운드에서 확인합시다.',
        tone: idx === 1 ? 'critical' : 'neutral',
      };
    }),
    consensus: '가능성은 있으나 안정감 보강 필요',
    finalSummary: '심사위원 의견은 갈렸지만 성장 가능성은 확인되었습니다.',
    source: 'fallback',
    reason,
  };
}

async function handleDebate(body, agencyId) {
  const fallback = debateFallback(agencyId);
  const prompt = `${agencyId} 오디션 심사위원 토론 JSON을 생성하세요.
입력 데이터: ${JSON.stringify(body)}
필드: debateLines, consensus, finalSummary`;
  const result = await callClaudeJson({ prompt, maxTokens: 900 });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, agencyId, source: 'claude' } : debateFallback(agencyId, result.reason);
}

function finalVerdictFallback(agencyId = 'hybe', rounds = {}, reason) {
  const scores = Object.values(rounds || {}).filter((v) => Number.isFinite(Number(v))).map(Number);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 68;
  return {
    agencyId,
    result: avg >= 78 ? 'pass' : avg >= 60 ? 'hold' : 'fail',
    verdict: avg >= 78 ? '합격 가능성 있음' : avg >= 60 ? '보류, 추가 트레이닝 필요' : '탈락, 기본기 보완 필요',
    finalScore: avg,
    overallScore: avg,
    passProbability: Math.max(10, Math.min(92, avg)),
    strengths: ['꾸준함', '무대에 대한 의지'],
    weaknesses: ['라이브 안정성', '표현 디테일'],
    nextMission: '음정 안정과 표정 연결을 함께 연습하세요.',
    judgeSummary: '가능성은 있으나 다음 평가에서 안정감이 관건입니다.',
    source: 'fallback',
    reason,
  };
}

async function handleFinalVerdict(body, agencyId) {
  const fallback = finalVerdictFallback(agencyId, body.rounds || body.scores);
  const rag = await buildTrainerRagContext({
    query: `audition final verdict agency:${agencyId} rounds:${JSON.stringify(body.rounds || body.scores || {})}`,
    domain: 'audition',
    personaId: agencyId === 'yg' ? 'yg' : agencyId === 'starship' ? 'starship' : 'jyp',
    topK: 5,
  });
  const prompt = `${agencyId} 오디션 최종 판정 JSON을 생성하세요.
입력 데이터: ${JSON.stringify(body)}
Trainer Knowledge Base를 근거로 최종 판정뿐 아니라 오늘부터 해야 할 훈련 미션을 구체화하세요.
필드: result, verdict, finalScore, overallScore, passProbability, strengths, weaknesses, nextMission, judgeSummary`;
  const result = await callClaudeJson({
    system: buildTrainerSystemPrompt({ persona: rag.persona, domain: rag.domain, contextText: rag.contextText }),
    prompt,
    maxTokens: 900,
  });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, agencyId, source: rag.results?.length ? 'trainer_knowledge_rag' : 'claude' } : finalVerdictFallback(agencyId, body.rounds || body.scores, result.reason);
}

function questionFallback() {
  return {
    phaseQuestions: {
      phase0_followup: '방금 자기소개에서 가장 자신 없었던 부분은 무엇인가요?',
      phase1_interruption_hint: '잠깐요. 같은 구간을 호흡을 줄이고 다시 해보세요.',
      phase2_mission: '반대 카테고리로 30초 교차 미션을 진행하세요.',
      phase3_main: ['왜 아이돌이어야 하나요?', '팀 안에서 어떤 역할을 할 수 있나요?', '가장 오래 고쳐온 습관은 무엇인가요?'],
      phase3_followup: ['준비한 답 말고 진짜 이유요.', '그걸 증명한 경험이 있나요?'],
      phase4_final: '마지막으로 30초 안에 본인을 설득해보세요.',
    },
    generationBasis: {},
    randomSeed: String(Date.now()),
    source: 'fallback',
  };
}

async function handleGenerateQuestions(body) {
  const fallback = questionFallback();
  const prompt = `기획사 오디션 5단계 질문 JSON을 생성하세요.
입력: ${JSON.stringify(body)}
필드: phaseQuestions, generationBasis, randomSeed`;
  const result = await callClaudeJson({ prompt, maxTokens: 900 });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, source: 'claude' } : fallback;
}

async function handleJudgeSpeak(body) {
  const { agencyId = 'hybe', judgeId, currentData, elapsedSeconds, roundType } = body || {};
  const fallback = pickFallbackReaction(agencyId);
  if (!ANTHROPIC_API_KEY) return { message: fallback, source: 'fallback' };
  const judge = getJudge(judgeId);
  const agency = getAgency(agencyId);
  const result = await callClaudeJson({
    system: judge?.systemPrompt,
    prompt: `아래 상황에 대한 10자 이내 심사위원 한마디를 JSON {"message": "..."}로 출력.
기획사: ${agency?.name || agencyId}
현재 데이터: ${JSON.stringify(currentData || {})}
경과: ${elapsedSeconds || 0}초
라운드: ${roundType || 'free'}`,
    maxTokens: 120,
  });
  return { message: result.parsed?.message || fallback, source: result.ok ? 'claude' : 'fallback' };
}

async function handleAgencyResult(body) {
  const agencyId = body.agencyId || body.agency || 'hybe';
  const verdict = finalVerdictFallback(agencyId, body.rounds || body.scores);
  return {
    ...verdict,
    summary: verdict.judgeSummary,
    agencyName: getAgency(agencyId)?.name || agencyId,
  };
}

async function handleAgencyReact(body) {
  return {
    message: pickFallbackReaction(body.agencyId || body.agency || 'hybe'),
    emotion: 'neutral',
    source: 'fallback',
  };
}

async function handleJudgeInterview(body) {
  return {
    question: body.followup ? '그 답변을 증명한 경험을 하나만 말해주세요.' : '왜 지금 아이돌이어야 하나요?',
    intent: '진정성과 목표 의식 확인',
    source: 'fallback',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const parts = getRouteParts(req);
  const body = await readJsonBody(req);
  const [first, second] = parts;

  try {
    if (first === 'generate-questions') return res.status(200).json(await handleGenerateQuestions(body));
    if (first === 'judge-speak') return res.status(200).json(await handleJudgeSpeak(body));
    if (first === 'judge-interview') return res.status(200).json(await handleJudgeInterview(body));
    if (first === 'agency-react') return res.status(200).json(await handleAgencyReact(body));
    if (first === 'agency-result') return res.status(200).json(await handleAgencyResult(body));

    const agencyId = body.agencyId || first || 'hybe';
    if (second === 'flow') {
      return createFlowHandler(agencyId)(req, res);
    }
    if (second === 'debate') return res.status(200).json(await handleDebate(body, agencyId));
    if (second === 'final-verdict') return res.status(200).json(await handleFinalVerdict(body, agencyId));
    if (second?.startsWith('judge-')) return res.status(200).json(await handleJudge({ req, body, agencyId, slug: second }));

    return res.status(404).json({ error: 'Unknown audition action', path: parts.join('/') });
  } catch (err) {
    return res.status(500).json({ error: 'audition_failed', detail: String(err?.message || err) });
  }
};
