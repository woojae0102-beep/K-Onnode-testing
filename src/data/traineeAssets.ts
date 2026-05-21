// 역량 자산 대시보드(Trainee Asset Dashboard)에서 사용하는 데이터 타입과 더미 데이터.
// 추후 GET /api/user/trainee-assets 또는 Firestore document 로 교체 가능.

export type AbilityKey =
  | 'dance'
  | 'vocal'
  | 'visual'
  | 'attitude'
  | 'korean'
  | 'rhythm';

export interface AbilityScore {
  key: AbilityKey;
  label: string;
  current: number;        // 0~100
  previous: number;       // 0~100 (전월)
  percentile?: number;    // 상위 N% (0~100)
  isStrength?: boolean;   // 핵심 강점 여부
}

export interface AgencyReadiness {
  id: string;
  name: string;
  styleTag: string;       // "실력파", "비주얼", "퍼포먼스" 등
  matchPercent: number;   // 0~100
  matchDelta: number;     // 전월 대비 변화 (-/+)
  accentColor: string;
  topSignal: string;      // 가장 강한 매칭 시그널 한 줄
}

export interface TechnicalSkillPoint {
  date: string;           // ISO date
  value: number;          // 0~100
}

export interface TechnicalSkillSeries {
  id: string;
  label: string;          // "아이솔레이션 정확도", "고음 안정도" 등
  category: 'dance' | 'vocal' | 'korean' | 'attitude';
  color: string;
  unit?: string;          // "점", "%" 등
  points: TechnicalSkillPoint[];
  delta30d: number;       // 최근 30일 변화량
  masterScore: number;    // 마스터 점수 획득 임계값 도달 여부 판단용 0~100
}

export interface AIInsight {
  id: string;
  tone: 'positive' | 'caution' | 'neutral';
  headline: string;       // 핵심 한 줄 (예: "댄스 하체 안정성 상위 5%")
  message: string;        // 부연 설명
  ctaLabel?: string;
  ctaTarget?: string;     // 라우팅 키 (예: 'aicoach')
}

export interface PortfolioMastery {
  total: number;            // 추적 중인 역량 개수
  inProgress: number;       // 역량 확보 중
  mastered: number;         // 마스터 점수 획득
  topStrengthLabel: string; // 가장 두드러진 강점 (한 줄)
  debutReadiness: number;   // 데뷔 적합도 종합 0~100
  debutReadinessDelta: number;
}

export interface TraineeAssetDashboardData {
  generatedAt: string;
  portfolio: PortfolioMastery;
  abilities: AbilityScore[];
  agencyReadiness: AgencyReadiness[];
  technicalSeries: TechnicalSkillSeries[];
  insights: AIInsight[];
}

// ─────────────────────────────────────────────────────────────────────────
// 더미 데이터 (실서비스에서는 API 응답으로 교체)
// ─────────────────────────────────────────────────────────────────────────

function genSeries(start: number, end: number, days = 14): TechnicalSkillPoint[] {
  const pts: TechnicalSkillPoint[] = [];
  const now = Date.now();
  const span = days - 1;
  for (let i = 0; i < days; i += 1) {
    const ratio = i / span;
    const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * 1.6;
    const value = Math.round(start + (end - start) * ratio + noise);
    pts.push({
      date: new Date(now - (span - i) * 86400000).toISOString().slice(0, 10),
      value: Math.max(0, Math.min(100, value)),
    });
  }
  return pts;
}

// 라벨/문구는 i18n 키로 작성하고, 컴포넌트에서 `dashboard.`로 시작하는 값을
// t()로 자동 해석합니다. AI/Firestore 응답으로 교체 시 일반 문자열을 그대로
// 넣어도 호환됩니다.
export const DUMMY_ASSET_DATA: TraineeAssetDashboardData = {
  generatedAt: new Date().toISOString(),
  portfolio: {
    total: 12,
    inProgress: 7,
    mastered: 5,
    topStrengthLabel: 'dashboard.portfolio.topStrengthDummy',
    debutReadiness: 78,
    debutReadinessDelta: +6,
  },
  abilities: [
    { key: 'dance',    label: 'dashboard.abilities.dance',    current: 86, previous: 78, percentile: 5,  isStrength: true },
    { key: 'vocal',    label: 'dashboard.abilities.vocal',    current: 72, previous: 68, percentile: 22 },
    { key: 'visual',   label: 'dashboard.abilities.visual',   current: 80, previous: 76, percentile: 14 },
    { key: 'attitude', label: 'dashboard.abilities.attitude', current: 88, previous: 84, percentile: 8,  isStrength: true },
    { key: 'korean',   label: 'dashboard.abilities.korean',   current: 74, previous: 65, percentile: 18 },
    { key: 'rhythm',   label: 'dashboard.abilities.rhythm',   current: 82, previous: 75, percentile: 11 },
  ],
  agencyReadiness: [
    {
      id: 'hybe',
      name: 'HYBE',
      styleTag: 'dashboard.agencyReadinessTags.hybe',
      matchPercent: 84,
      matchDelta: +5,
      accentColor: '#7C3AED',
      topSignal: 'dashboard.agencyReadinessSignal.hybe',
    },
    {
      id: 'jyp',
      name: 'JYP',
      styleTag: 'dashboard.agencyReadinessTags.jyp',
      matchPercent: 88,
      matchDelta: +9,
      accentColor: '#22C55E',
      topSignal: 'dashboard.agencyReadinessSignal.jyp',
    },
    {
      id: 'sm',
      name: 'SM',
      styleTag: 'dashboard.agencyReadinessTags.sm',
      matchPercent: 72,
      matchDelta: +2,
      accentColor: '#0EA5E9',
      topSignal: 'dashboard.agencyReadinessSignal.sm',
    },
    {
      id: 'yg',
      name: 'YG',
      styleTag: 'dashboard.agencyReadinessTags.yg',
      matchPercent: 66,
      matchDelta: -3,
      accentColor: '#111111',
      topSignal: 'dashboard.agencyReadinessSignal.yg',
    },
    {
      id: 'starship',
      name: 'Starship',
      styleTag: 'dashboard.agencyReadinessTags.starship',
      matchPercent: 81,
      matchDelta: +4,
      accentColor: '#FF1F8E',
      topSignal: 'dashboard.agencyReadinessSignal.starship',
    },
  ],
  technicalSeries: [
    {
      id: 'dance-iso',
      label: 'dashboard.timeline.items.danceIso',
      category: 'dance',
      color: '#FF1F8E',
      points: genSeries(72, 88),
      delta30d: +14,
      masterScore: 88,
    },
    {
      id: 'vocal-pitch',
      label: 'dashboard.timeline.items.vocalPitch',
      category: 'vocal',
      color: '#7C3AED',
      points: genSeries(64, 78),
      delta30d: +9,
      masterScore: 78,
    },
    {
      id: 'dance-bottom',
      label: 'dashboard.timeline.items.danceBottom',
      category: 'dance',
      color: '#22C55E',
      points: genSeries(70, 92),
      delta30d: +18,
      masterScore: 92,
    },
    {
      id: 'korean-intonation',
      label: 'dashboard.timeline.items.koreanIntonation',
      category: 'korean',
      color: '#0EA5E9',
      points: genSeries(60, 74),
      delta30d: +11,
      masterScore: 74,
    },
  ],
  insights: [
    {
      id: 'ins-1',
      tone: 'positive',
      headline: 'dashboard.insight.items.danceBottom.headline',
      message: 'dashboard.insight.items.danceBottom.message',
      ctaLabel: 'dashboard.insight.items.danceBottom.cta',
      ctaTarget: 'dance',
    },
    {
      id: 'ins-2',
      tone: 'positive',
      headline: 'dashboard.insight.items.koreanIntonation.headline',
      message: 'dashboard.insight.items.koreanIntonation.message',
      ctaLabel: 'dashboard.insight.items.koreanIntonation.cta',
      ctaTarget: 'korean',
    },
    {
      id: 'ins-3',
      tone: 'caution',
      headline: 'dashboard.insight.items.vocalColor.headline',
      message: 'dashboard.insight.items.vocalColor.message',
      ctaLabel: 'dashboard.insight.items.vocalColor.cta',
      ctaTarget: 'aicoach',
    },
  ],
};
