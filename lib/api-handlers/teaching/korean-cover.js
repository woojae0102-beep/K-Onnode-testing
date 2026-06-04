const { readJsonBody, ELEVENLABS_API_KEY } = require('./_helpers');

const DEFAULT_KO_VOICE = 'pNInz6obpgDQGcFmaJgB';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const voiceId = body.voiceId;
  const text = (body.text || body.correctedText || body.referenceText || '').trim();
  const language = body.language || 'ko';

  if (!text) {
    return res.status(400).json({ error: 'text required' });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.json({
      audioBase64: '',
      audioUrl: '',
      mimeType: 'audio/mpeg',
      source: 'fallback',
      message: 'ELEVENLABS_API_KEY 미설정 — 클라이언트 Web Speech 폴백',
      fallbackText: text,
    });
  }

  try {
    const targetVoiceId = voiceId || DEFAULT_KO_VOICE;
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        language_code: language === 'ko' ? 'ko' : language === 'ja' ? 'ja' : 'en',
        voice_settings: {
          stability: 0.75,
          similarity_boost: voiceId ? 0.85 : 0.5,
          style: 0.2,
        },
      }),
    });

    if (!ttsRes.ok) {
      const error = await ttsRes.text();
      return res.status(500).json({ error, fallbackText: text });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    return res.json({
      audioBase64: base64Audio,
      audioUrl: `data:audio/mpeg;base64,${base64Audio}`,
      mimeType: 'audio/mpeg',
      message: '교정 발음 생성 완료',
      source: 'elevenlabs',
    });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err), fallbackText: text });
  }
};
