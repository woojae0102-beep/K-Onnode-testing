const { readJsonBody, callClaude } = require('./_helpers');

function buildFallbackLyrics(songTitle, artistName) {
  const title = songTitle || '연습 곡';
  return `${title}${artistName ? ` — ${artistName}` : ''}\n\n사랑해요, 오늘도 너를 생각해요.\n함께 걸어가요, 이 길 끝까지.\n발음을 또렷하게, 천천히 따라 말해 보세요.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { songTitle = '', artistName = '' } = body;

  const claude = await callClaude({
    prompt: `K-POP 곡 "${songTitle}" (${artistName}) 연습용 가사 4~6줄을 한국어로 작성.
실제 가사와 비슷한 느낌이되 저작권 회피를 위해 완전히 다른 문장으로.
JSON만: {"lyrics":"줄바꿈으로 연결된 가사"}`,
    maxTokens: 300,
  });

  const lyrics = claude.ok && claude.parsed?.lyrics
    ? claude.parsed.lyrics
    : buildFallbackLyrics(songTitle, artistName);

  return res.json({
    lyrics,
    songTitle,
    artistName,
    source: claude.ok ? 'claude' : 'fallback',
  });
};
