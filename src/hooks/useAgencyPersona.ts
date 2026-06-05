// @ts-nocheck
import { useMemo } from 'react';
import type { Agency } from '../types/tv';
import { AGENCY_COLORS } from '../types/tv';

export interface AgencyPersona {
  id: Agency;
  name: string;
  color: string;
  focus: string;
  artists: string;
  coachStyle: string;
  coachName: string;
  coachAvatar: string;
  coachTagline: string;
  feedbackStyle: string;
}

const PERSONAS: Record<Agency, Omit<AgencyPersona, 'id' | 'color'>> = {
  hybe: {
    name: 'HYBE',
    focus: '음악성 & 표현력',
    artists: 'BTS · TXT · LE SSERAFIM',
    coachStyle: '감성과 자기 표현을 중시',
    coachName: '이준혁 코치',
    coachAvatar: '👨‍💼',
    coachTagline: '음악성과 표현력',
    feedbackStyle: '데이터 기반',
  },
  jyp: {
    name: 'JYP',
    focus: '정확성 & 라이브',
    artists: 'TWICE · ITZY · Stray Kids',
    coachStyle: '기술적 정확도와 라이브 능력',
    coachName: '정민지 코치',
    coachAvatar: '💃',
    coachTagline: '정확성과 라이브',
    feedbackStyle: '즉각적 교정',
  },
  sm: {
    name: 'SM',
    focus: '디테일 & 아우라',
    artists: 'EXO · aespa · NCT',
    coachStyle: '완성도와 SM 특유의 아우라',
    coachName: '최유진 코치',
    coachAvatar: '👩‍🎤',
    coachTagline: '디테일과 아우라',
    feedbackStyle: '디테일 집중',
  },
  yg: {
    name: 'YG',
    focus: '카리스마 & 스타성',
    artists: 'BLACKPINK · TREASURE',
    coachStyle: '강렬한 존재감과 스타성',
    coachName: '이나래 코치',
    coachAvatar: '🔥',
    coachTagline: '카리스마와 스타성',
    feedbackStyle: '스타성 강조',
  },
};

export function useAgencyPersona(agency: Agency): AgencyPersona {
  return useMemo(
    () => ({
      id: agency,
      color: AGENCY_COLORS[agency],
      ...PERSONAS[agency],
    }),
    [agency],
  );
}

export function getAllAgencies(): Agency[] {
  return ['hybe', 'jyp', 'sm', 'yg'];
}

export function getAgencyInfo(agency: Agency) {
  return { ...PERSONAS[agency], color: AGENCY_COLORS[agency] };
}

export default useAgencyPersona;
