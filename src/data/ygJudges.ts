// @ts-nocheck
// YG 엔터테인먼트 3인 심사위원 데이터 (UI/훅에서 사용하는 메타데이터)
// 양태준: 메인 프로듀서·스타성 (2:1 분열 시 최종 결정권)
// 이나래: 퍼포먼스·스타일 / Marcus Kim: 글로벌 A&R·힙합

export type YgJudgeMeta = {
  id: 'yg-taejun' | 'yg-narae' | 'yg-marcus';
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

export const ygJudges: YgJudgeMeta[] = [
  {
    id: 'yg-taejun',
    name: '양태준',
    title: '메인 프로듀서 / 스타성 총괄',
    avatar: '🖤',
    accentColor: '#111111',
    specialty: '스타성·존재감·시장성·팬흡입력',
    catchphrase: '잘하는데 재미없으면 의미 없다',
    decisionWeight: 'tiebreaker', // 2:1 분열 시 최종 결정권 (YG는 결국 프로듀서 감각으로 결정)
    evaluationCriteria: [
      { name: '스타성 & 존재감', maxScore: 40 },
      { name: '개성 & 캐릭터', maxScore: 30 },
      { name: '바이브 & 그루브', maxScore: 20 },
      { name: '시장성 & 팬흡입력', maxScore: 10 },
    ],
    passingThreshold: 65,
    vetoCondition: '스타성 18점 미만 시 강력 거부 (YG에 안 맞는다 — 잘하는데 안 끌린다)',
    apiEndpoint: '/api/audition/yg/judge-taejun',
  },
  {
    id: 'yg-narae',
    name: '이나래',
    title: '퍼포먼스 & 스타일 디렉터',
    avatar: '💃',
    accentColor: '#FF4757',
    specialty: '무대 장악력·카메라 흡입력·스타일링',
    catchphrase: '춤 잘 춘다고 YG 아니다. 시선 뺏는 사람이 YG다',
    decisionWeight: 'normal',
    evaluationCriteria: [
      { name: '무대 장악력', maxScore: 35 },
      { name: '표정 & 눈빛', maxScore: 30 },
      { name: '스타일 소화력', maxScore: 20 },
      { name: '퍼포먼스 자신감', maxScore: 15 },
    ],
    passingThreshold: 60,
    vetoCondition: '무대 장악력 15점 미만 시 강력 거부 (사람이 안 보여요 — 춤만 있고 무대가 없어요)',
    apiEndpoint: '/api/audition/yg/judge-narae',
  },
  {
    id: 'yg-marcus',
    name: 'Marcus Kim',
    title: '글로벌 A&R / 힙합 프로듀서',
    avatar: '🎤',
    accentColor: '#A29BFE',
    specialty: '음색·글로벌 시장성·힙합 바이브·캐릭터 IP',
    catchphrase: '톤은 못 만든다. 랩/보컬보다 캐릭터다',
    decisionWeight: 'normal',
    evaluationCriteria: [
      { name: '음색 & 톤', maxScore: 35 },
      { name: '글로벌 감각', maxScore: 25 },
      { name: '힙합/R&B 바이브', maxScore: 25 },
      { name: '캐릭터성', maxScore: 15 },
    ],
    passingThreshold: 62,
    vetoCondition: "음색 15점 미만 시 강력 거부 (Tone is the one thing we can't build)",
    apiEndpoint: '/api/audition/yg/judge-marcus',
  },
];

export function getYgJudge(id: YgJudgeMeta['id']): YgJudgeMeta | undefined {
  return ygJudges.find((j) => j.id === id);
}
