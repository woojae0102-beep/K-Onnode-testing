// @ts-nocheck
// STARSHIP 엔터테인먼트 3인 심사위원 데이터 (UI/훅에서 사용하는 메타데이터)
// 한승훈: 메인 프로듀서·스타성 (2:1 분열 시 최종 결정권 — 대중성·시장성 우선)
// 박나리: 퍼포먼스·카메라 / 최지수: 트레이닝·장기 성장

export type StarshipJudgeMeta = {
  id: 'starship-seunghoon' | 'starship-nari' | 'starship-jisoo';
  name: string;
  title: string;
  avatar: string;
  accentColor: string;
  specialty: string;
  catchphrase: string;
  decisionWeight: 'tiebreaker' | 'normal';
  evaluationCriteria: { name: string; maxScore: number }[];
  passingThreshold: number;
  vetoCondition: string | null;
  apiEndpoint: string;
};

export const starshipJudges: StarshipJudgeMeta[] = [
  {
    id: 'starship-seunghoon',
    name: '한승훈',
    title: '메인 프로듀서 / 스타성 & 대중성 총괄',
    avatar: '🎯',
    accentColor: '#6C5CE7', // STARSHIP 퍼플
    specialty: '대중 스타성·센터 존재감·비주얼 무드·안정 성장성',
    catchphrase: '대중성이 중요해요. 부담스럽지 않은 스타성이 살아남아요',
    decisionWeight: 'tiebreaker', // 2:1 분열 시 최종 결정권 — STARSHIP은 결국 대중성·시장성 우선
    evaluationCriteria: [
      { name: '대중 스타성', maxScore: 35 },
      { name: '센터 존재감', maxScore: 25 },
      { name: '비주얼 & 분위기', maxScore: 25 },
      { name: '안정 성장성', maxScore: 15 },
    ],
    passingThreshold: 63,
    vetoCondition: null,
    apiEndpoint: '/api/audition/starship/judge-seunghoon',
  },
  {
    id: 'starship-nari',
    name: '박나리',
    title: '퍼포먼스 & 카메라 디렉터',
    avatar: '🌟',
    accentColor: '#E84393',
    specialty: '카메라 흡입력·표정 연결·퍼포먼스 안정감·아이돌 밸런스',
    catchphrase: '카메라가 좋아할 얼굴이에요. 표정 연결이 중요해요',
    decisionWeight: 'normal',
    evaluationCriteria: [
      { name: '카메라 흡입력', maxScore: 30 },
      { name: '표정 & 눈빛', maxScore: 25 },
      { name: '퍼포먼스 안정감', maxScore: 25 },
      { name: '아이돌 밸런스', maxScore: 20 },
    ],
    passingThreshold: 60,
    vetoCondition: null,
    apiEndpoint: '/api/audition/starship/judge-nari',
  },
  {
    id: 'starship-jisoo',
    name: '최지수',
    title: '트레이닝 & 장기 성장 디렉터',
    avatar: '🌱',
    accentColor: '#A29BFE',
    specialty: '성장 가능성·팀 적응력·꾸준함·장기 활동 적합성',
    catchphrase: '꾸준함이 중요해요. 오래 갈 수 있는 타입을 봅니다',
    decisionWeight: 'normal',
    evaluationCriteria: [
      { name: '성장 가능성', maxScore: 35 },
      { name: '팀 적응력', maxScore: 25 },
      { name: '꾸준함 & 태도', maxScore: 25 },
      { name: '장기 스타성 유지력', maxScore: 15 },
    ],
    passingThreshold: 62,
    vetoCondition: null,
    apiEndpoint: '/api/audition/starship/judge-jisoo',
  },
];

export function getStarshipJudge(id: StarshipJudgeMeta['id']): StarshipJudgeMeta | undefined {
  return starshipJudges.find((j) => j.id === id);
}
