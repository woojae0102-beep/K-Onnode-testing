// @ts-nocheck
import type { Agency, SessionData } from '../types/tv';

const COACH_NAMES: Record<Agency, string> = {
  hybe: '이준혁 코치',
  jyp: '정민지 코치',
  sm: '최유진 코치',
  yg: '이나래 코치',
};

export function buildLocalCoachReview(session: SessionData): string {
  const name = COACH_NAMES[session.agency] || 'AI 코치';
  const score = session.overallScore || 0;
  const weak =
    session.weaknesses?.length > 0
      ? session.weaknesses.join('. ')
      : '전신 프레이밍과 기본 동작 리듬';
  const tip = session.recommendations?.[0] || '기본 워밍업 10분을 꾸준히 해보세요.';
  const praise =
    session.strengths?.length > 0 ? `특히 ${session.strengths[0]}은 잘하고 있어요.` : '';

  if (score >= 80) {
    return `${name}입니다. 오늘 연습 정말 수고했어요! 종합 ${score}점으로 아주 좋은 편이에요. ${praise} ${weak}만 조금 더 다듬으면 완성도가 훨씬 올라갈 거예요. 다음에는 ${tip}`;
  }
  if (score >= 60) {
    return `${name}입니다. 오늘도 열심히 했네요. 종합 ${score}점이에요. ${praise} 지금은 ${weak} 쪽에 집중이 필요해 보여요. ${tip}을 추천드릴게요.`;
  }
  return `${name}입니다. 첫 연습부터 여기까지 온 것만으로도 대단해요. 종합 ${score}점이에요. 우선 ${weak}부터 천천히 맞춰가면 돼요. ${tip}부터 시작해볼까요?`;
}
