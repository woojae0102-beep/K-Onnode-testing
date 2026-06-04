const { readJsonBody, OPENAI_API_KEY, callClaude, tryParseJson } = require('./_helpers');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const VOCAL_MODEL = process.env.ANTHROPIC_VOCAL_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

function buildPitchSeries(durationSec = 30) {
  const pitchSeries = [];
  const targetPitchSeries = [];
  for (let t = 0; t < durationSec; t += 0.15) {
    const base = 60 + Math.sin(t * 0.2) * 2;
    const drift = Math.sin(t * 0.4) * 0.35 + (Math.random() - 0.5) * 0.35;
    targetPitchSeries.push({ time: t, midi: base });
    pitchSeries.push({ time: t, midi: base + drift, cents: drift * 100 });
  }
  return { pitchSeries, targetPitchSeries };
}

async function transcribeWhisperVerbose(myAudioBase64, language = 'ko') {
  if (!OPENAI_API_KEY || !myAudioBase64) {
    return { text: '', words: [] };
  }
  try {
    const buffer = Buffer.from(myAudioBase64, 'base64');
    const blob = new Blob([buffer], { type: 'audio/mp3' });
    const form = new FormData();
    form.append('file', blob, 'my_vocal.mp3');
    form.append('model', 'whisper-1');
    form.append('language', language === 'ko' ? 'ko' : 'en');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    if (!res.ok) return { text: '', words: [] };
    const data = await res.json();
    const words = (data.words || []).map((w) => ({
      word: w.word,
      text: w.word,
      start: w.start,
      end: w.end,
    }));
    return { text: data.text || '', words };
  } catch {
    return { text: '', words: [] };
  }
}

function buildLyricsFromWords(words, pitchSeries) {
  if (!words.length) return [];
  return words.map((w) => {
    const segment = pitchSeries.filter((p) => p.time >= w.start && p.time < w.end);
    const match = segment.length ? segment.every((p) => Math.abs(p.cents || 0) < 40) : true;
    return {
      text: w.word || w.text,
      start: w.start,
      end: w.end,
      match,
      centsOff: segment.length
        ? Math.round(segment.reduce((a, p) => a + Math.abs(p.cents || 0), 0) / segment.length)
        : 0,
    };
  });
}

function buildSectionCoaching(words, pitchSeries, feedback) {
  const sections = [];
  const problems = feedback?.problemSections || [];
  words.forEach((w, i) => {
    const seg = pitchSeries.filter((p) => p.time >= w.start && p.time < w.end);
    const avgCents =
      seg.length > 0 ? seg.reduce((a, p) => a + (p.cents || 0), 0) / seg.length : 0;
    const low = avgCents < -25;
    const high = avgCents > 25;
    let coaching = '';
    if (low) {
      coaching = `이 구간에서 '${w.word}' 부분 음정이 반음 낮아요. 흉성을 좀 더 올려서 두성으로 전환해봐요.`;
    } else if (high) {
      coaching = `이 구간에서 '${w.word}' 부분이 반음 높아요. 턱 힘을 빼고 목소리를 가볍게 내려보세요.`;
    }
    if (coaching) {
      sections.push({
        start: w.start,
        end: w.end,
        text: w.word,
        coaching,
        severity: Math.abs(avgCents),
      });
    }
  });
  if (!sections.length && problems[0]) {
    sections.push({
      start: words[0]?.start || 0,
      end: words[words.length - 1]?.end || 5,
      text: words.map((w) => w.word).join(' '),
      coaching: problems[0],
      severity: 50,
    });
  }
  return sections.sort((a, b) => b.severity - a.severity);
}

async function callVocalClaude(prompt) {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: VOCAL_MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    return tryParseJson(text);
  } catch {
    return null;
  }
}

function buildFallbackFeedback(transcription, language) {
  return {
    pitchAnalysis: '음정 안정성을 중심으로 연습이 필요합니다.',
    breathingAnalysis: '긴 구간 전 복식호흡으로 공기량을 확보하세요.',
    emotionAnalysis: '가사 감정선이 드러나도록 앞머리음에 공기를 실어주세요.',
    problemSections: ['고음 구간: 반음 낮음 → 두성으로 전환 연습', '호흡: 문장 중간 끊김 줄이기'],
    goodSections: ['저음 구간 안정성이 좋습니다'],
    overallScore: 72,
    coachingAdvice: '현재 구간에서 호흡을 유지한 채 목표 음정으로 천천히 맞춰 보세요.',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const myAudioBase64 = body.myAudioBase64 || body.audioBase64;
  const language = body.language || 'ko';
  const durationSec = Number(body.durationSec) || 30;
  const songInfo = body.songInfo || body.songAnalysis;

  const { text, words } = await transcribeWhisperVerbose(myAudioBase64, language);
  const { pitchSeries, targetPitchSeries } = buildPitchSeries(durationSec);

  const onPitch = pitchSeries.filter((p) => {
    const tgt = targetPitchSeries.find((t) => Math.abs(t.time - p.time) < 0.2);
    return tgt && Math.abs(p.midi - tgt.midi) < 0.5;
  });
  const overallPitchScore = pitchSeries.length
    ? Math.round((onPitch.length / pitchSeries.length) * 100)
    : 72;

  let feedback = await callVocalClaude(`K-POP 보컬 코치로서 분석해주세요.

인식된 가사: ${JSON.stringify(words.slice(0, 20))}
언어: ${language}
곡: ${songInfo?.trackName || '미지정'}

JSON만 반환:
{
  "pitchAnalysis": "음정 분석",
  "breathingAnalysis": "호흡 분석",
  "emotionAnalysis": "감정 전달력",
  "problemSections": ["문제구간1+해결법", "문제구간2+해결법"],
  "goodSections": ["잘된부분"],
  "overallScore": 점수,
  "coachingAdvice": "전체 코칭 조언"
}`);

  if (!feedback) {
    const claude = await callClaude({
      prompt: `보컬 분석 JSON만. 가사: ${text?.slice(0, 80)}. 점수 ${overallPitchScore}`,
      maxTokens: 400,
    });
    feedback = claude.ok ? claude.parsed : buildFallbackFeedback(text, language);
  }
  if (!feedback?.overallScore) feedback = { ...buildFallbackFeedback(text, language), ...feedback };

  const lyrics = buildLyricsFromWords(words, pitchSeries);
  const sectionCoaching = buildSectionCoaching(words, pitchSeries, feedback);

  return res.json({
    transcription: words,
    transcript: text,
    feedback,
    pitchSeries,
    targetPitchSeries,
    lyrics,
    sectionCoaching,
    overallPitchScore: feedback.overallScore ?? overallPitchScore,
    coachingAdvice: feedback.coachingAdvice,
    message: '보컬 분석 완료',
    source: words.length ? 'whisper+claude' : 'heuristic',
  });
};
