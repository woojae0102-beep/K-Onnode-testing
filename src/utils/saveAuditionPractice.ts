// @ts-nocheck
import { buildSessionKey, savePracticeSession } from '../services/practiceHistoryStore';

export function saveAuditionPractice(agencyId, result) {
  if (!result) return null;
  const weaknesses = (result.judgeSummaries || [])
    .flatMap((j) => j.improvements || j.weaknesses || [])
    .filter(Boolean);
  const strengths = (result.judgeSummaries || [])
    .flatMap((j) => j.highlights || j.strengths || [])
    .filter(Boolean);

  const { comparison } = savePracticeSession(
    'audition',
    buildSessionKey('audition', { agencyId }),
    {
      overallScore: result.avgScore,
      overall: result.avgScore,
      scores: { avgScore: result.avgScore },
      verdict: result.finalVerdict,
      weaknesses,
      strengths,
      agencyId,
      completedAt: new Date().toISOString(),
    },
  );
  return comparison;
}

export function saveAgencyResultPractice(agencyId, overallScore, feedbacks = []) {
  const weaknesses = feedbacks.map((f) => f.improvements).filter(Boolean);
  const strengths = feedbacks.map((f) => f.strengths).filter(Boolean);
  const scores = { avgScore: overallScore };
  feedbacks.forEach((f, i) => {
    if (typeof f.score === 'number') scores[`judge${i + 1}`] = f.score;
  });

  const { comparison } = savePracticeSession(
    'audition',
    buildSessionKey('audition', { agencyId }),
    {
      overallScore,
      overall: overallScore,
      scores,
      weaknesses,
      strengths,
      agencyId,
      completedAt: new Date().toISOString(),
    },
  );
  return comparison;
}
