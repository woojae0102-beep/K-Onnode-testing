const { collectYouTubeMetadata, extractTrainingKnowledge, upsertKnowledge } = require('../../lib/trainer-knowledge/engine');

const SEARCH_QUERIES = [
  'K-POP 댄스 트레이닝 팁',
  'K-POP 보컬 레슨 발성법',
  'K-POP dance tutorial technique',
  'K-POP vocal training method',
  '아이돌 댄스 교정 방법',
  '보컬 트레이닝 호흡법',
  'K-POP choreography tips',
  '연습생 댄스 훈련법',
];

function json(res, code, body) {
  return res.status(code).json(body);
}

module.exports = async function handler(req, res) {
  try {
    const allKnowledge = [];
    const queries = req.body?.queries || SEARCH_QUERIES;
    const maxResults = Number(req.body?.maxResults || process.env.TRAINER_KNOWLEDGE_DAILY_MAX_RESULTS || 3);

    for (const query of queries) {
      const metadataRows = await collectYouTubeMetadata({
        query,
        maxResults,
      });

      for (const metadata of metadataRows) {
        // 저작권 안전 원칙: 영상/오디오 다운로드 없이 공식 API 메타데이터와 자막 존재 여부만 사용합니다.
        const textForExtraction = [
          metadata.title,
          metadata.description,
          metadata.hasCaptions ? `captions available: ${metadata.captionLanguages.join(', ')}` : '',
        ].filter(Boolean).join('\n');

        const rows = await extractTrainingKnowledge({
          transcript: textForExtraction,
          metadata: {
            ...metadata,
            source: 'youtube_data_api_metadata_only',
          },
          domain: metadata.domain,
        });

        rows.forEach((row, idx) => {
          allKnowledge.push({
            ...row,
            id: `${metadata.videoId}_${idx}`,
            topic: row.domain,
            tags: [row.skill, ...(row.mistakes || [])].filter(Boolean).slice(0, 8),
            content: row.trainerCue || row.howToFix || row.drill || row.why,
            videoId: metadata.videoId,
            videoTitle: metadata.title,
            channelTitle: metadata.channelTitle,
            searchQuery: query,
            source: 'youtube_metadata',
          });
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const upsert = await upsertKnowledge(allKnowledge);

    return json(res, 200, {
      message: `${allKnowledge.length}개 지식 추가 완료`,
      topics: {
        dance: allKnowledge.filter((k) => k.topic === 'dance').length,
        vocal: allKnowledge.filter((k) => k.topic === 'vocal').length,
        korean: allKnowledge.filter((k) => k.topic === 'korean').length,
      },
      upsert,
    });
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) });
  }
};
