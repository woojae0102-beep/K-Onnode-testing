// Consolidated audition endpoint.
// Old URLs are rewritten here by vercel.json, preserving frontend calls while
// keeping Vercel Hobby function count below the limit.

const { createFlowHandler } = require('../lib/api-lib/agencyFlowHandler.cjs');
const { getJudge, getAgency, pickFallbackReaction } = require('../lib/api-lib/agencyJudges.cjs');
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
  const judge = getJudge(resolvedJudgeId) || { name: 'AI Judge', title: 'Judge', style: 'balanced evaluation' };
  const total = phase === 'realtime_react' ? undefined : 68;
  return {
    speaking:
      phase === 'realtime_react'
        ? pickFallbackReaction(agencyId)
        : `${judge.name}: You have potential, but the basics need to be more accurate.`,
    instinct: 'Potential is visible, but stability needs work.',
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
    strongPoints: ['growth potential', 'consistent effort'],
    improvements: ['pitch stability', 'stage detail'],
    closing: 'For the next stage, align the basics more clearly.',
    debatePosition: 'Pass is possible, but stability must be verified.',
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
  const prompt = `K-POP ?????????? ???? JSON??????????
???? ${agency?.name || agencyId}
??????: ${judge?.name || judgeId} / ${judge?.title || ''}
?????? ?????? ${judge?.style || ''}
??? ???: ${phase}
??? ????? ${JSON.stringify(body)}
Trainer Knowledge Base????????????, ????????, ??? ??????? ???????? ?????.
???: speaking, instinct, scores, verdict, vetoTriggered, vetoReason, strongPoints, improvements, closing, debatePosition`;
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
        speaker: j?.name || `?????? ${idx + 1}`,
        line: idx === 0 ? '?????? ?????.' : idx === 1 ? '???????????? ???? ?????' : '??? ????????????????',
        tone: idx === 1 ? 'critical' : 'neutral',
      };
    }),
    consensus: '?????? ???????????? ???',
    finalSummary: '?????? ????? ???????? ?????? ???????????',
    source: 'fallback',
    reason,
  };
}

async function handleDebate(body, agencyId) {
  const fallback = debateFallback(agencyId);
  const prompt = `${agencyId} ??????????? ??? JSON??????????
??? ????? ${JSON.stringify(body)}
???: debateLines, consensus, finalSummary`;
  const result = await callClaudeJson({ prompt, maxTokens: 900 });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, agencyId, source: 'claude' } : debateFallback(agencyId, result.reason);
}

function finalVerdictFallback(agencyId = 'hybe', rounds = {}, reason) {
  const scores = Object.values(rounds || {}).filter((v) => Number.isFinite(Number(v))).map(Number);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 68;
  return {
    agencyId,
    result: avg >= 78 ? 'pass' : avg >= 60 ? 'hold' : 'fail',
    verdict: avg >= 78 ? 'Pass is possible' : avg >= 60 ? 'Hold, more training needed' : 'Fail, basics need work',
    finalScore: avg,
    overallScore: avg,
    passProbability: Math.max(10, Math.min(92, avg)),
    strengths: ['consistent effort', 'stage potential'],
    weaknesses: ['line stability', 'expression detail'],
    nextMission: 'Practice pitch stability and movement connection together.',
    judgeSummary: 'There is potential, but consistency is the key.',
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
  const prompt = `${agencyId} ??????? ??? JSON??????????
??? ????? ${JSON.stringify(body)}
Trainer Knowledge Base???????? ??????????????????? ????? ????????????.
???: result, verdict, finalScore, overallScore, passProbability, strengths, weaknesses, nextMission, judgeSummary`;
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
      phase0_followup: '?? ????????? ?????? ????????? ????????',
      phase1_interruption_hint: '????? ??? ???????????????? ??????.',
      phase2_mission: '??? ??????30???? ???????????',
      phase3_main: ['??????????? ?????', '?? ???????? ???????????????', '?????? ?????????? ????????'],
      phase3_followup: ['??? ???? ?? ?????', '?? ?????????????'],
      phase4_final: '???????30????? ?????????????.',
    },
    generationBasis: {},
    randomSeed: String(Date.now()),
    source: 'fallback',
  };
}

async function handleGenerateQuestions(body) {
  const fallback = questionFallback();
  const prompt = `?????????5??? ?? JSON??????????
???: ${JSON.stringify(body)}
???: phaseQuestions, generationBasis, randomSeed`;
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
    prompt: `??? ?????????10????? ?????? ??????? JSON {"message": "..."}????.
???? ${agency?.name || agencyId}
??? ????? ${JSON.stringify(currentData || {})}
??: ${elapsedSeconds || 0}??
????? ${roundType || 'free'}`,
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
    question: body.followup ? '???????????????????????????' : '?????????????? ?????',
    intent: '????? ?? ??? ???',
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

