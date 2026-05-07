// @ts-nocheck
// JYP 엔터테인먼트 3인 심사위원 데이터 (UI/훅에서 사용하는 메타데이터)
// 박재원: 보컬 발성·라이브 / 정민지: 댄스·에너지 / 이성현: 인성·비전 (최강 거부권 + 결정권)

export type JypJudgeMeta = {
  id: 'jyp-jaewon' | 'jyp-minji' | 'jyp-seonghyeon';
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

export const jypJudges: JypJudgeMeta[] = [
  {
    id: 'jyp-jaewon',
    name: '박재원',
    title: '수석 보컬 디렉터',
    avatar: '🎹',
    accentColor: '#FF6348',
    specialty: '"공기반 소리반" 발성·라이브 능력',
    catchphrase: '노래에 습관이 없어야 합니다. 자연스럽게',
    decisionWeight: 'normal',
    evaluationCriteria: [
      { name: '습관 없는 자연스러운 발성', maxScore: 40 },
      { name: '라이브 능력 & 체력', maxScore: 25 },
      { name: '음악적 감수성 & 감정 전달', maxScore: 25 },
      { name: '성장 가능성 & 트레이닝 적합성', maxScore: 10 },
    ],
    passingThreshold: 60,
    vetoCondition: '자연스러운 발성 22점 미만 시 이의 제기 (JYP 보컬 시스템 교정 어려움)',
    apiEndpoint: '/api/audition/jyp/judge-jaewon',
  },
  {
    id: 'jyp-minji',
    name: '정민지',
    title: '댄스 & 퍼포먼스 총괄',
    avatar: '💃',
    accentColor: '#FF9F43',
    specialty: 'ITZY·TWICE·NMIXX·SKZ 안무·에너지',
    catchphrase: '에너지가 전부예요. 기술은 그 다음이에요',
    decisionWeight: 'normal',
    evaluationCriteria: [
      { name: '에너지 & 생동감', maxScore: 35 },
      { name: '댄스 기술 정확도', maxScore: 30 },
      { name: '표현력 & 시선 처리', maxScore: 25 },
      { name: 'JYP 스타일 적합성 & 그룹 시너지', maxScore: 10 },
    ],
    passingThreshold: 58,
    vetoCondition: '에너지 18점 미만 시 강력 반대 (JYP 무대에 세울 수 없는 수준)',
    apiEndpoint: '/api/audition/jyp/judge-minji',
  },
  {
    id: 'jyp-seonghyeon',
    name: '이성현',
    title: '아티스트 개발 & 인성 평가 팀장',
    avatar: '🌟',
    accentColor: '#6C5CE7',
    specialty: '박진영 인성 철학·장기 비전·팀워크',
    catchphrase: '좋은 사람이 결국 좋은 아티스트가 됩니다',
    decisionWeight: 'tiebreaker', // 박진영 인성 철학 대표, 2:1 분열 시 최종 결정권 + 인성 거부권
    evaluationCriteria: [
      { name: '인성 & 태도', maxScore: 40 },
      { name: '목표 의식 & 비전', maxScore: 30 },
      { name: '팀워크 & 대인 관계', maxScore: 20 },
      { name: 'JYP 생활 적합성 & 지속 가능성', maxScore: 10 },
    ],
    passingThreshold: 65,
    vetoCondition: '인성 & 태도 20점 미만 시 거부권 발동 (인성 재교육 후 재도전 권고) — JYP 최강 거부권',
    apiEndpoint: '/api/audition/jyp/judge-seonghyeon',
  },
];

export function getJypJudge(id: JypJudgeMeta['id']): JypJudgeMeta | undefined {
  return jypJudges.find((j) => j.id === id);
}
