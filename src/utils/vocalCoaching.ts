// @ts-nocheck
/** 현재 재생 시각에 맞는 구간 코칭 메시지 */
export function getVocalCoachMessage(analysis, currentTime) {
  if (!analysis) {
    return {
      instruction: '마이크를 켜고 노래를 시작하세요. 구간별로 음정 피드백을 드릴게요.',
      highlightText: '',
    };
  }

  const sections = analysis.sectionCoaching || [];
  const active = sections.find((s) => currentTime >= s.start && currentTime < s.end);
  if (active?.coaching) {
    return { instruction: active.coaching, highlightText: active.text || '' };
  }

  const lyrics = analysis.lyrics || [];
  const activeLine = lyrics.find((l) => currentTime >= l.start && currentTime < l.end);
  if (activeLine && !activeLine.match) {
    const cents = activeLine.centsOff || 30;
    const dir = cents > 0 ? '높' : '낮';
    return {
      instruction: `이 구간에서 '${activeLine.text}' 부분 음정이 반음 ${dir}아요. ${
        dir === '낮'
          ? '흉성을 좀 더 올려서 두성으로 전환해봐요.'
          : '턱 힘을 빼고 목소리를 가볍게 내려보세요.'
      }`,
      highlightText: activeLine.text,
    };
  }

  const advice = analysis.coachingAdvice || analysis.feedback?.coachingAdvice;
  if (advice) return { instruction: advice, highlightText: '' };

  const problem = analysis.feedback?.problemSections?.[0];
  if (problem) return { instruction: problem, highlightText: '' };

  return {
    instruction: '좋아요! 호흡을 유지하면서 다음 구간도 같은 톤으로 이어가 보세요.',
    highlightText: activeLine?.text || '',
  };
}
