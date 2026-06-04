const {
  readJsonBody,
  callClaude,
  tryParseJson,
  buildFallbackDanceFeedback,
} = require('./_helpers');

const JOINT_LABELS = {
  left_wrist: '왼팔',
  right_wrist: '오른팔',
  left_elbow: '왼팔꿈치',
  right_elbow: '오른팔꿈치',
  left_knee: '왼다리',
  right_knee: '오른다리',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { myFrames = [], referenceFrames = [], songAnalysis } = body;

  const frameComparisons = myFrames
    .map((myFrame, i) => {
      const refFrame = referenceFrames[i];
      if (!refFrame) return null;

      const jointAccuracies = {};
      Object.keys(myFrame.joints || {}).forEach((joint) => {
        const myJoint = myFrame.joints[joint];
        const refJoint = refFrame.joints?.[joint];
        if (!myJoint || !refJoint) return;

        const distance = Math.sqrt(
          (myJoint.x - refJoint.x) ** 2 + (myJoint.y - refJoint.y) ** 2
        );
        jointAccuracies[joint] = Math.max(0, 100 - distance * 500);
      });

      const vals = Object.values(jointAccuracies);
      if (!vals.length) return null;

      const avgAccuracy = vals.reduce((a, b) => a + b, 0) / vals.length;
      const worstJoint = Object.entries(jointAccuracies).sort(([, a], [, b]) => a - b)[0]?.[0];

      return {
        timestamp: myFrame.timestamp,
        accuracy: avgAccuracy,
        jointAccuracies,
        worstJoint,
      };
    })
    .filter(Boolean);

  const overallAccuracy =
    frameComparisons.length > 0
      ? frameComparisons.reduce((sum, f) => sum + f.accuracy, 0) / frameComparisons.length
      : 0;

  const problemJoints = {};
  frameComparisons.forEach((frame) => {
    if (frame.worstJoint) {
      problemJoints[frame.worstJoint] = (problemJoints[frame.worstJoint] || 0) + 1;
    }
  });

  const topProblems = Object.entries(problemJoints)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([joint]) => joint);

  let feedback = buildFallbackDanceFeedback(
    Math.round(overallAccuracy),
    topProblems.map((j) => JOINT_LABELS[j] || j),
    songAnalysis
  );

  const claude = await callClaude({
    prompt: `K-POP 댄스 코치로서 분석 결과를 바탕으로 피드백:
전체 정확도: ${Math.round(overallAccuracy)}%
주요 문제 관절: ${topProblems.join(', ')}
곡 스타일: ${songAnalysis?.danceStyle || '일반'}

3문장으로 구체적 피드백. JSON만 반환:
{"overall": "전체평가", "problems": ["문제1+해결법", "문제2+해결법"], "praise": "잘된점"}`,
    maxTokens: 400,
  });

  if (claude.ok && claude.parsed) {
    feedback = claude.parsed;
  }

  return res.json({
    overallAccuracy: Math.round(overallAccuracy),
    frameComparisons,
    topProblems,
    feedback,
    bestMoments: frameComparisons.filter((f) => f.accuracy > 85).map((f) => f.timestamp),
    worstMoments: frameComparisons.filter((f) => f.accuracy < 50).map((f) => f.timestamp),
    source: claude.ok ? 'claude' : 'fallback',
  });
};
