// Consolidated coaching endpoint.
// Replaces /api/coaching/analyze-song, /dance-persona, /vocal-soul.

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

async function callClaude({ system, prompt, maxTokens = 600 }) {
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

function toneLabel(tone) {
  if (tone === 'expert') return '전문가형: 정확한 용어와 구체적인 교정 포인트를 사용';
  if (tone === 'strict') return '엄격형: 직설적이지만 무례하지 않게';
  if (tone === 'brief') return '간결형: 핵심만 짧게';
  return '친근형: 응원과 동기부여 중심';
}

function sensitivityLabel(value) {
  const level = Math.max(1, Math.min(5, Number(value) || 3));
  if (level <= 2) return `${level}/5: 부드러운 피드백, 장점 먼저 말하고 교정은 1개만`;
  if (level >= 4) return `${level}/5: 엄격한 피드백, 놓친 디테일과 다음 행동을 구체적으로`;
  return `${level}/5: 균형형 피드백, 칭찬과 교정을 함께`;
}

function coachModeLabel(mode) {
  if (mode === 'multi') return '멀티 코치: 기술/표현/멘탈 관점을 나누어 조언';
  if (mode === 'free') return '자유 연습: 사용자가 스스로 탐색하도록 개입을 줄이고 다음 선택지를 제시';
  return '단일 코치: 하나의 일관된 코치 목소리로 집중 피드백';
}

function fallbackStylePrefix({ coachTone, feedbackSensitivity, coachMode } = {}) {
  const parts = [];
  if (coachTone === 'expert') parts.push('전문가 기준으로');
  else if (coachTone === 'strict') parts.push('엄격하게');
  else if (coachTone === 'brief') parts.push('짧게');
  else parts.push('좋아요');

  const level = Math.max(1, Math.min(5, Number(feedbackSensitivity) || 3));
  if (level >= 4) parts.push('디테일까지');
  else if (level <= 2) parts.push('부드럽게');

  if (coachMode === 'multi') parts.push('기술/표현 관점에서');
  else if (coachMode === 'free') parts.push('자유 연습 흐름으로');
  return parts.join(' ');
}

function actionFromReq(req, body) {
  if (body?.action) return String(body.action);
  const url = new URL(req.url || '/', 'http://localhost');
  const q = url.searchParams.get('path') || '';
  return q.split('/').filter(Boolean).pop() || 'unknown';
}

function songFallback(features = {}, trackName = '', artistName = '') {
  const energy = Number(features.energy) || 0.5;
  const valence = Number(features.valence) || 0.5;
  const danceability = Number(features.danceability) || 0.5;
  const isHighEnergy = energy > 0.65;
  const isPositive = valence > 0.55;
  const isDance = danceability > 0.55;
  let mood = '감성';
  let personaName = '감성러';
  let danceStyle = '감성적';
  let vocalStyle = '부드러운';
  if (isHighEnergy && isDance) {
    mood = isPositive ? '자신감' : '카리스마';
    personaName = isPositive ? '퀸' : '다크히어로';
    danceStyle = isPositive ? '걸크러쉬' : '파워풀';
    vocalStyle = '파워풀';
  }
  return {
    genre: 'K-POP',
    mood,
    danceStyle,
    vocalStyle,
    emotionKeywords: [mood, '무대감', '집중'],
    colorPalette: ['핫핑크', '검정'],
    movementKeywords: ['선명한', '리듬감 있는', '표정 있는'],
    personaName,
    personaDescription: `${trackName || artistName || '이 곡'}의 분위기를 살리는 페르소나`,
    danceAttitude: '눈빛부터 무대를 지배하고, 동작 끝을 분명히 맺으세요.',
    vocalAttitude: '가사의 감정을 먼저 떠올리고 호흡 위에 음정을 얹으세요.',
    source: 'fallback',
  };
}

async function handleAnalyzeSong(body) {
  const { trackName = '', artistName = '', features = {}, language = 'ko' } = body || {};
  const fallback = songFallback(features, trackName, artistName);
  const prompt = `K-POP 곡 분석 JSON을 생성하세요.
곡: ${trackName || '(미상)'} - ${artistName || '(미상)'}
특성: ${JSON.stringify(features)}
응답 언어: ${languageLabel(language)}
필드: genre, mood, danceStyle, vocalStyle, emotionKeywords, colorPalette, movementKeywords, personaName, personaDescription, danceAttitude, vocalAttitude`;
  const result = await callClaude({ prompt, maxTokens: 600 });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, source: 'claude' } : fallback;
}

function danceFallback(args = {}) {
  const { songAnalysis = {}, sessionPhase = 'realtime', poseData = {} } = args;
  const personaName = songAnalysis.personaName || '이 곡의 주인공';
  const overallScore = Number(poseData.overallScore) || 70;
  return {
    coachLine:
      sessionPhase === 'start'
        ? `${fallbackStylePrefix(args)}, 이 곡의 페르소나는 '${personaName}'이에요. ${songAnalysis.danceAttitude || '곡의 감정에 몸을 맡기고 시작해봐요.'}`
        : `${fallbackStylePrefix(args)}, ${personaName}의 에너지를 더 살려봐요!`,
    personaActivated: overallScore >= 70,
    personaComment: `${personaName}답게 표현해보세요`,
    keyCorrection: `${personaName}는 동작 끝을 칼처럼 맺어야 해요`,
    encouragement: '계속 가요. 점점 살아나고 있어요.',
    nextFocus: '시선 처리와 동작 끝맺음',
    emotionalScore: Math.max(40, Math.min(95, overallScore - 5)),
    technicalScore: overallScore,
    source: 'fallback',
  };
}

async function handleDancePersona(body) {
  const fallback = danceFallback(body);
  const prompt = `댄스 페르소나 코칭 JSON을 생성하세요.
곡 페르소나: ${JSON.stringify(body.songAnalysis || {})}
자세 데이터: ${JSON.stringify(body.poseData || {})}
단계: ${body.sessionPhase || 'realtime'}
응답 언어: ${languageLabel(body.language)}
코치 톤: ${toneLabel(body.coachTone)}
피드백 민감도: ${sensitivityLabel(body.feedbackSensitivity)}
AI 코치 모드: ${coachModeLabel(body.coachMode)}
필드: coachLine, personaActivated, personaComment, keyCorrection, encouragement, nextFocus, emotionalScore, technicalScore`;
  const result = await callClaude({ prompt, maxTokens: 500 });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, source: 'claude' } : fallback;
}

function vocalFallback(args = {}) {
  const { songAnalysis = {}, sessionPhase = 'realtime', pitchData = {} } = args;
  const mood = songAnalysis.mood || '감정';
  const pitchAccuracy = Number(pitchData.avgAccuracy) || 70;
  const pitchScore = Math.round(Math.min(98, Math.max(40, pitchAccuracy)));
  return {
    coachLine:
      sessionPhase === 'start'
        ? `${fallbackStylePrefix(args)}, 이 곡은 '${mood}'의 곡이에요. ${songAnalysis.vocalAttitude || '감정을 먼저 떠올린 다음 입을 여세요.'}`
        : `${fallbackStylePrefix(args)}, 지금 감정이 목소리에 충분히 실리지 않았어요. 다시 해봐요.`,
    emotionImage: `${mood}의 한가운데에 서 있는 자기 자신의 모습`,
    soulDirection: '기술보다 감정을 먼저 생각하세요',
    technicalAsEmotion: '음정이 아니라 감정의 높낮이를 생각하세요',
    breathingTip: '숨을 먼저 느끼고, 그 다음에 소리를 내세요',
    visualizationExercise: '눈을 감고 이 가사의 상황을 영화처럼 상상해보세요',
    encouragement: '계속해요. 조금씩 나오고 있어요.',
    soulScore: Math.max(40, Math.min(95, pitchScore - 5)),
    pitchScore,
    source: 'fallback',
  };
}

async function handleVocalSoul(body) {
  const fallback = vocalFallback(body);
  const prompt = `보컬 소울 코칭 JSON을 생성하세요.
곡 페르소나: ${JSON.stringify(body.songAnalysis || {})}
피치 데이터: ${JSON.stringify(body.pitchData || {})}
사용자 목소리: ${JSON.stringify(body.userVocalCharacteristics || {})}
단계: ${body.sessionPhase || 'realtime'}
응답 언어: ${languageLabel(body.language)}
코치 톤: ${toneLabel(body.coachTone)}
피드백 민감도: ${sensitivityLabel(body.feedbackSensitivity)}
AI 코치 모드: ${coachModeLabel(body.coachMode)}
필드: coachLine, emotionImage, soulDirection, technicalAsEmotion, breathingTip, visualizationExercise, encouragement, soulScore, pitchScore`;
  const result = await callClaude({ prompt, maxTokens: 500 });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, source: 'claude' } : fallback;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = await readJsonBody(req);
  const action = actionFromReq(req, body);
  if (action === 'analyze-song') return res.status(200).json(await handleAnalyzeSong(body));
  if (action === 'dance-persona') return res.status(200).json(await handleDancePersona(body));
  if (action === 'vocal-soul') return res.status(200).json(await handleVocalSoul(body));
  return res.status(404).json({ error: 'Unknown coaching action', action });
};
