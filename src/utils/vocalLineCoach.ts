// @ts-nocheck

export const VOCAL_LINE_PASS_SCORE = 72;
export const VOCAL_LINE_MAX_ATTEMPTS = 3;
export const VOCAL_LINE_RETRY_MS = 6000;

export function findWeakestLine(lineScores = [], threshold = 75) {
  let idx = -1;
  let score = 101;
  lineScores.forEach((s, i) => {
    if (!Number.isFinite(s)) return;
    if (s < score) {
      score = s;
      idx = i;
    }
  });
  if (idx < 0 || score >= threshold) return null;
  return { idx, score };
}

export function findAllWeakLines(lineScores = [], threshold = 75) {
  return lineScores
    .map((s, idx) => ({ idx, score: s }))
    .filter((x) => Number.isFinite(x.score) && x.score < threshold)
    .sort((a, b) => a.score - b.score);
}

export function averageSamples(samples = []) {
  const valid = samples.filter((n) => Number.isFinite(n));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export function buildRetryLiveTip({ tuningState, pitchAccuracy, pitchFeedback, attempt = 0 }) {
  if (pitchFeedback && pitchAccuracy < 60) return pitchFeedback;
  if (tuningState === 'sharp') return '음정이 높아요. 턱 힘을 빼고 호흡을 아래로 내려보세요.';
  if (tuningState === 'flat') return '음정이 낮아요. 첫 음 전에 호흡 압력을 조금 더 만들어주세요.';
  if (pitchAccuracy < 55) return '한 음을 길게 유지하면서 목표 음정에 천천히 붙여보세요.';
  if (attempt >= 2) return '속도를 줄이고, AI가 불러준 감정을 그대로 따라가 보세요.';
  return 'AI 모범창 직후의 호흡과 음정을 그대로 이어서 불러보세요.';
}

export function buildRefinedLineTip({ retryScore, tuningState, lineText, attempt }) {
  const line = lineText ? `'${lineText.slice(0, 20)}${lineText.length > 20 ? '…' : ''}'` : '이 구간';
  if (retryScore < 45) {
    return `${line}에서 음정이 많이 흔들렸어요. 한 음씩 끊어서 AI와 똑같이 불러보세요.`;
  }
  if (tuningState === 'sharp') return `${line} 고음이 살짝 높아요. 공명을 입 안쪽으로 모아보세요.`;
  if (tuningState === 'flat') return `${line} 시작음이 낮아요. 첫 음 전에 호흡을 더 채워보세요.`;
  if (attempt >= 2) return `${line} 감정 전달은 좋아요. 음정만 AI와 한 박 늦게 맞춰보세요.`;
  return `${line} 거의 다 왔어요. AI 모범창의 리듬을 그대로 따라가 보세요.`;
}

export function buildLineCoachingIntro({ lineText, attempt, retryScore }) {
  if (attempt === 0) {
    return `이 구간이 조금 부족해요. 내 목소리 톤으로 모범창을 들려줄게요.`;
  }
  if (retryScore < 50) {
    return `아직 음정이 흔들려요. 이번엔 더 천천히, 한 음씩 맞춰볼게요.`;
  }
  return `거의 다 왔어요. 이번 모범창을 듣고 바로 이어서 불러보세요.`;
}
