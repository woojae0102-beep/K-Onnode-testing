const { readJsonBody, callClaude, tryParseJson } = require('../../../api/coaching/_helpers');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

async function readMultipart(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  return null;
}

function buildFallbackDanceFeedback(overallAccuracy, topProblems, songAnalysis) {
  return {
    overall: `전체 정확도 ${overallAccuracy}%입니다. ${songAnalysis?.danceStyle || 'K-POP'} 스타일에 맞춰 연습을 이어가 보세요.`,
    problems: topProblems.slice(0, 2).map((j) => `${j} 관절 위치를 레퍼런스와 맞춰 보세요.`),
    praise: '리듬감은 유지되고 있습니다. 디테일만 다듬으면 좋아집니다.',
  };
}

module.exports = {
  readJsonBody,
  readMultipart,
  callClaude,
  tryParseJson,
  ELEVENLABS_API_KEY,
  OPENAI_API_KEY,
  buildFallbackDanceFeedback,
};
