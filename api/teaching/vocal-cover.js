const { readJsonBody, ELEVENLABS_API_KEY } = require('./_helpers');

const DEFAULT_VOICE = 'pNInz6obpgDQGcFmaJgB';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const {
    voiceId,
    lyrics = '',
    targetPitches,
    songAnalysis,
    language = 'ko',
    songTitle = '',
  } = body;

  const coachingText = (lyrics || songTitle || '모범 창법 연습 구간입니다.').trim();

  if (!ELEVENLABS_API_KEY) {
    return res.json({
      audioBase64: '',
      audioUrl: '',
      mimeType: 'audio/mpeg',
      source: 'fallback',
      message: 'ELEVENLABS_API_KEY 미설정',
    });
  }

  try {
    const vid = voiceId || DEFAULT_VOICE;
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: coachingText,
        model_id: 'eleven_multilingual_v2',
        language_code: language === 'ko' ? 'ko' : language === 'ja' ? 'ja' : 'en',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: songAnalysis?.energy > 0.7 ? 0.5 : 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      return res.status(500).json({ error: 'ElevenLabs TTS 실패', detail: errText });
    }

    const buf = await ttsRes.arrayBuffer();
    const base64Audio = Buffer.from(buf).toString('base64');
    return res.json({
      audioBase64: base64Audio,
      audioUrl: `data:audio/mpeg;base64,${base64Audio}`,
      mimeType: 'audio/mpeg',
      targetPitches: targetPitches || null,
      message: 'AI 모범창 생성 완료',
      source: 'elevenlabs',
    });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
};
