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

function danceFallback({ songAnalysis = {}, sessionPhase = 'realtime', poseData = {} }) {
  const personaName = songAnalysis.personaName || '이 곡의 주인공';
  const overallScore = Number(poseData.overallScore) || 70;
  return {
    coachLine:
      sessionPhase === 'start'
        ? `이 곡의 페르소나는 '${personaName}'이에요. ${songAnalysis.danceAttitude || '곡의 감정에 몸을 맡기고 시작해봐요.'}`
        : `${personaName}의 에너지를 더 살려봐요!`,
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
필드: coachLine, personaActivated, personaComment, keyCorrection, encouragement, nextFocus, emotionalScore, technicalScore`;
  const result = await callClaude({ prompt, maxTokens: 500 });
  return result.ok && result.parsed ? { ...fallback, ...result.parsed, source: 'claude' } : fallback;
}

function vocalFallback({ songAnalysis = {}, sessionPhase = 'realtime', pitchData = {} }) {
  const mood = songAnalysis.mood || '감정';
  const pitchAccuracy = Number(pitchData.avgAccuracy) || 70;
  const pitchScore = Math.round(Math.min(98, Math.max(40, pitchAccuracy)));
  return {
    coachLine:
      sessionPhase === 'start'
        ? `이 곡은 '${mood}'의 곡이에요. ${songAnalysis.vocalAttitude || '감정을 먼저 떠올린 다음 입을 여세요.'}`
        : '지금 감정이 목소리에 충분히 실리지 않았어요. 다시 해봐요.',
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
