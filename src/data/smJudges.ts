// @ts-nocheck
// SM 엔터테인먼트 3인 심사위원 데이터 (UI/훅에서 사용하는 메타데이터)
// 이성호: 비주얼·아우라·세계관 / 최유진: 보컬·SMP / 박서영: 글로벌·SM 3.0

export type SmJudgeMeta = {
  id: 'sm-seongho' | 'sm-yujin' | 'sm-seoyoung';
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

export const smJudges: SmJudgeMeta[] = [
  {
    id: 'sm-seongho',
    name: '이성호',
    title: '캐스팅 & 비주얼 총괄',
    avatar: '👑',
    accentColor: '#1A237E',
    specialty: '비주얼·아우라·SM 세계관',
    catchphrase: 'SM이 배출한 아티스트들을 보면 기준이 보입니다',
    decisionWeight: 'tiebreaker', // 30년 SM 캐스팅, 최종 결정권자
    evaluationCriteria: [
      { name: 'SM 아우라 & 비주얼 임팩트', maxScore: 40 },
      { name: '무대 장악력 & 시선 처리', maxScore: 30 },
      { name: '개성 & SM 차별화', maxScore: 20 },
      { name: 'SM 세계관 적합성', maxScore: 10 },
    ],
    passingThreshold: 65,
    vetoCondition: 'SM 아우라 & 비주얼 임팩트 25점 미만 시 거부권 발동 (보류 + 타사 추천)',
    apiEndpoint: '/api/audition/sm/judge-seongho',
  },
  {
    id: 'sm-yujin',
    name: '최유진',
    title: '보컬 & SMP 퍼포먼스 디렉터',
    avatar: '🎤',
    accentColor: '#E91E63',
    specialty: 'SM 발성법·음색·SMP 퍼포먼스 발성',
    catchphrase: '기술 위에 예술, 예술 위에 개성 있는 음색',
    decisionWeight: 'normal',
    evaluationCriteria: [
      { name: 'SM 발성 기초 & 기술 완성도', maxScore: 35 },
      { name: '음색 개성 & 독창성', maxScore: 30 },
      { name: 'SMP 감성 & 퍼포먼스 중 발성', maxScore: 25 },
      { name: '음악적 이해력 & 발전 가능성', maxScore: 10 },
    ],
    passingThreshold: 60,
    vetoCondition: 'SM 발성 기초 18점 미만 시 이의 제기 (트레이닝 시스템으로 교정 불가능)',
    apiEndpoint: '/api/audition/sm/judge-yujin',
  },
  {
    id: 'sm-seoyoung',
    name: '박서영',
    title: '글로벌 브랜딩 & 아티스트 정체성 디렉터',
    avatar: '🌐',
    accentColor: '#00BCD4',
    specialty: '글로벌 브랜드·SM 세계관 구현·SM 3.0',
    catchphrase: '아이돌은 아티스트이면서 브랜드이면서 세계관입니다',
    decisionWeight: 'normal',
    evaluationCriteria: [
      { name: '글로벌 브랜드 가능성', maxScore: 35 },
      { name: 'SM 세계관 구현 능력', maxScore: 30 },
      { name: '미디어 & 콘텐츠 친화성', maxScore: 25 },
      { name: '아티스트 자아 & 롱런 가능성', maxScore: 10 },
    ],
    passingThreshold: 60,
    vetoCondition: null, // 거부권 없음 (15점 미만 시 강력 반대만)
    apiEndpoint: '/api/audition/sm/judge-seoyoung',
  },
];

export function getSmJudge(id: SmJudgeMeta['id']): SmJudgeMeta | undefined {
  return smJudges.find((j) => j.id === id);
}
