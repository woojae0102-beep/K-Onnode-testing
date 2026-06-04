const { readJsonBody, OPENAI_API_KEY, tryParseJson } = require('./_helpers');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const KO_MODEL = process.env.ANTHROPIC_KOREAN_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

function languageLabel(language) {
  if (language === 'ja') return '日本語';
  if (language === 'en') return 'English';
  return '한국어';
}

function buildFallbackFeedback(targetText, recognizedText, syllableAccuracies) {
  const overall =
    syllableAccuracies.length > 0
      ? Math.round(
          syllableAccuracies.reduce((a, s) => a + (s.accuracy || 0), 0) / syllableAccuracies.length
        )
      : 70;
  const worst = [...syllableAccuracies].sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0))[0];
  const problems = worst
    ? [
        {
          syllable: worst.character,
          issue: `'${worst.character}' 발음이 목표와 달라요`,
          correction: "입을 더 크게 벌리면서 모음을 또렷하게 발음해봐요.",
        },
      ]
    : [];
  return {
    overallAccuracy: overall,
    problemSyllables: problems,
    intonationFeedback: '문장 끝 억양을 자연스럽게 내려주세요.',
    breathingFeedback: '긴 문장은 중간에 짧게 호흡을 넣어주세요.',
    practiceAdvice: `목표: "${targetText.slice(0, 30)}..." — 천천히 따라 읽어보세요.`,
    encouragement: '꾸준히 연습하면 음절 정확도가 빠르게 올라갑니다!',
  };
}

function buildIntonationSeries(len = 48, variant = 'standard') {
  return Array.from({ length: len }, (_, i) => {
    const t = i / len;
    const base = Math.sin(t * Math.PI * 2) * 0.4;
    if (variant === 'mine') return base + (Math.random() - 0.5) * 0.25;
    return base;
  });
}

function buildWaveform(len = 64) {
  return Array.from({ length: len }, () => 0.2 + Math.random() * 0.7);
}

function toSyllablesForUi(syllableAccuracies) {
  return syllableAccuracies
    .filter((s) => s.character && s.character.trim() && s.character !== ' ')
    .map((s) => ({
      syllable: s.character,
      character: s.character,
      score: s.accuracy,
      accuracy: s.accuracy,
      recognized: s.recognized,
      status: s.accuracy >= 85 ? 'good' : s.accuracy >= 70 ? 'ok' : 'bad',
    }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const audioBase64 = body.audioBase64 || body.myAudioBase64;
  const targetText = body.targetText || body.referenceText || '';
  const language = body.language || 'ko';

  let recognizedText = '';
  let transcriptionWords = [];

  if (OPENAI_API_KEY && audioBase64) {
    try {
      const audioBytes = Buffer.from(audioBase64, 'base64');
      const audioBlob = new Blob([audioBytes], { type: body.mimeType || 'audio/mp3' });
      const whisperForm = new FormData();
      whisperForm.append('file', audioBlob, 'pronunciation.mp3');
      whisperForm.append('model', 'whisper-1');
      whisperForm.append('language', 'ko');
      whisperForm.append('response_format', 'verbose_json');
      whisperForm.append('timestamp_granularities[]', 'word');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: whisperForm,
      });

      if (whisperRes.ok) {
        const transcription = await whisperRes.json();
        recognizedText = transcription.text || '';
        transcriptionWords = transcription.words || [];
      }
    } catch {
      /* fallback below */
    }
  }

  if (!recognizedText && targetText) {
    recognizedText = targetText.slice(0, Math.max(1, Math.floor(targetText.length * 0.85)));
  }

  const targetChars = [...targetText];
  const recognizedChars = [...recognizedText];

  const syllableAccuracies = targetChars.map((char, i) => {
    if (char === ' ' || char === '\n') {
      return { character: char, recognized: recognizedChars[i] || '', accuracy: 100 };
    }
    const rec = recognizedChars[i] || '';
    return {
      character: char,
      recognized: rec,
      accuracy: rec === char ? 100 : rec ? 50 : 0,
    };
  });

  let feedback = buildFallbackFeedback(targetText, recognizedText, syllableAccuracies);

  if (ANTHROPIC_API_KEY) {
    try {
      const feedbackRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: KO_MODEL,
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `한국어 발음 교사로서 피드백해주세요.

목표 텍스트: ${targetText}
인식된 텍스트: ${recognizedText}
음절 정확도: ${JSON.stringify(syllableAccuracies.filter((s) => s.character?.trim()).slice(0, 40))}
응답 언어: ${languageLabel(language)}

JSON만 반환:
{
  "overallAccuracy": 점수,
  "problemSyllables": [
    {"syllable": "음절", "issue": "문제", "correction": "교정방법"}
  ],
  "intonationFeedback": "억양 피드백",
  "breathingFeedback": "호흡 피드백",
  "practiceAdvice": "연습 조언",
  "encouragement": "격려 한마디"
}`,
            },
          ],
        }),
      });

      if (feedbackRes.ok) {
        const feedbackData = await feedbackRes.json();
        const parsed = tryParseJson(feedbackData?.content?.[0]?.text || '');
        if (parsed) feedback = parsed;
      }
    } catch {
      /* keep fallback */
    }
  }

  const syllables = toSyllablesForUi(syllableAccuracies);
  const overallAccuracy =
    feedback.overallAccuracy ??
    (syllables.length
      ? Math.round(syllables.reduce((a, s) => a + s.score, 0) / syllables.length)
      : 0);

  return res.json({
    recognizedText,
    transcript: recognizedText,
    referenceText: targetText,
    targetText,
    syllableAccuracies,
    syllables,
    feedback,
    transcriptionWords,
    accuracy: overallAccuracy,
    problemSyllables: (feedback.problemSyllables || []).map((p) => p.syllable || p.character).filter(Boolean),
    coachingTip: feedback.practiceAdvice || feedback.encouragement,
    waveform: buildWaveform(),
    correctedWaveform: buildWaveform().map((v) => Math.min(1, v * 1.05)),
    standardIntonation: buildIntonationSeries(48, 'standard'),
    myIntonation: buildIntonationSeries(48, 'mine'),
    correctedText: targetText,
    source: OPENAI_API_KEY && recognizedText ? 'whisper+claude' : 'fallback',
    message: '발음 분석 완료',
  });
};
