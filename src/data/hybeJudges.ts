// @ts-nocheck
// HYBE 빅히트뮤직 3인 심사위원 데이터 (UI/훅에서 사용하는 메타데이터)
// 점수 계산·거부권·합격 판정 로직은 src/data/hybeAuditionSystem.ts 가 담당합니다.

export type HybeJudgeMeta = {
  id: 'lee-junhyuk' | 'kim-soyeon' | 'david-lim';
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

export const hybeJudges: HybeJudgeMeta[] = [
  {
    id: 'lee-junhyuk',
    name: '이준혁',
    title: '트레이닝 총괄 디렉터',
    avatar: '👨‍💼',
    accentColor: '#6C5CE7',
    specialty: '성장 가능성 & 음악적 진정성',
    catchphrase: '지금의 실력이 아니라 6개월 후의 가능성을 사겠습니다',
    decisionWeight: 'tiebreaker', // 2:1 시 최종 결정권
    evaluationCriteria: [
      { name: '트레이닝 흡수력', maxScore: 35 },
      { name: '음악적 진정성', maxScore: 30 },
      { name: '자기 인식 능력', maxScore: 20 },
      { name: '음악적 감수성', maxScore: 15 },
    ],
    passingThreshold: 65,
    vetoCondition: '음악적 진정성 20점 미만 시 거부권 발동',
    apiEndpoint: '/api/audition/hybe/judge-lee',
  },
  {
    id: 'kim-soyeon',
    name: '김소연',
    title: '퍼포먼스 & 비주얼 디렉터',
    avatar: '👩‍🎤',
    accentColor: '#FF6B9D',
    specialty: '무대 장악력 & 비주얼 임팩트',
    catchphrase: '무대는 거짓말을 못해요. 3초 안에 보여요',
    decisionWeight: 'normal',
    evaluationCriteria: [
      { name: '무대 장악력 & 아우라', maxScore: 35 },
      { name: '비주얼 임팩트', maxScore: 25 },
      { name: '댄스 & 퍼포먼스', maxScore: 25 },
      { name: '개성 & 차별화', maxScore: 15 },
    ],
    passingThreshold: 60,
    vetoCondition: null,
    apiEndpoint: '/api/audition/hybe/judge-kim',
  },
  {
    id: 'david-lim',
    name: 'David Lim',
    title: 'Global Artist Development Director',
    avatar: '🌍',
    accentColor: '#00B894',
    specialty: '글로벌 경쟁력 & 아티스트 비전',
    catchphrase: 'K-POP은 이미 글로벌이에요. 당신이 글로벌한지가 문제죠',
    decisionWeight: 'normal',
    evaluationCriteria: [
      { name: '글로벌 어필 가능성', maxScore: 35 },
      { name: '아티스트 비전 & 정체성', maxScore: 30 },
      { name: '커뮤니케이션 능력', maxScore: 20 },
      { name: '지속 가능성', maxScore: 15 },
    ],
    passingThreshold: 60,
    vetoCondition: '글로벌 어필 가능성 20점 미만 시 자동 보류',
    apiEndpoint: '/api/audition/hybe/judge-david',
  },
];

export function getHybeJudge(id: HybeJudgeMeta['id']): HybeJudgeMeta | undefined {
  return hybeJudges.find((j) => j.id === id);
}
