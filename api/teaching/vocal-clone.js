const { readJsonBody, ELEVENLABS_API_KEY } = require('./_helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const audioBuffer = body.audioBuffer || body.audioBase64;
  const audioName = body.audioName || body.name || 'user_voice';
  const mimeType = body.mimeType || 'audio/mp3';

  if (!audioBuffer) {
    return res.status(400).json({ error: 'audioBuffer required' });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.json({
      voiceId: 'fallback-voice-id',
      voiceName: audioName,
      source: 'fallback',
      message: 'ELEVENLABS_API_KEY 미설정 — 데모 모드',
    });
  }

  try {
    const audioBytes = Buffer.from(audioBuffer, 'base64');
    const audioBlob = new Blob([audioBytes], { type: mimeType });
    const formData = new FormData();
    formData.append('name', audioName);
    formData.append('description', 'User voice clone for ONNODE coaching');
    formData.append('files', audioBlob, 'voice_sample.mp3');

    const cloneRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      body: formData,
    });

    if (!cloneRes.ok) {
      const error = await cloneRes.text();
      return res.status(500).json({ error: `ElevenLabs 에러: ${error}` });
    }

    const cloneData = await cloneRes.json();
    return res.json({
      voiceId: cloneData.voice_id,
      voiceName: cloneData.name || audioName,
      message: '목소리 클론 생성 완료',
      source: 'elevenlabs',
    });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
};
