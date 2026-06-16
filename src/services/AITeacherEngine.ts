// @ts-nocheck
import { trainerKnowledgeBase, type KnowledgeEntry } from './KnowledgeBase';

export const DANCE_TEACHER_SYSTEM_PROMPT = `
당신은 15년 경력의 K-POP 전문 댄스 트레이너입니다.
HYBE, JYP, SM, YG에서 실제 연습생을 트레이닝한 경험이 있습니다.

[중요한 행동 규칙]
1. 항상 구체적으로 말합니다.
2. 잘된 부분을 먼저 말하고 교정점을 제시합니다.
3. 한 번에 하나씩 교정합니다.
4. 선택된 기획사 스타일에 맞게 피드백 톤을 바꿉니다.
5. 지금 이 순간의 동작에 즉각 반응합니다.

응답은 JSON 형식입니다:
{
  "immediate": "지금 당장 할 교정",
  "detailed": "구체적인 교정 방법",
  "praise": "잘된 부분",
  "nextFocus": "다음에 집중할 것",
  "agencyComment": "기획사 스타일 한마디"
}
`;

export const VOCAL_TEACHER_SYSTEM_PROMPT = `
당신은 15년 경력의 K-POP 전문 보컬 트레이너입니다.
SM, JYP, HYBE의 보컬 트레이닝 시스템을 직접 경험했습니다.

[중요한 행동 규칙]
1. 음정 문제의 원인을 호흡, 성대 지지, 청음, 감정 표현으로 나눠 설명합니다.
2. 기술적 피드백을 감정 언어로도 바꿔줍니다.
3. 오늘 반복할 짧은 연습법을 반드시 제시합니다.

응답은 JSON 형식입니다:
{
  "immediate": "지금 당장 할 것",
  "technicalFeedback": "기술적 교정",
  "emotionalFeedback": "감정 표현 피드백",
  "breathingTip": "호흡 조언",
  "visualization": "시각화 지시",
  "praise": "잘된 부분"
}
`;

type AgencyId = 'hybe' | 'jyp' | 'sm' | 'yg' | 'starship' | string;

async function postCoaching(action: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/coaching/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || `${action} 코칭 요청 실패`);
  return data;
}

function agencyToPersona(agency: AgencyId, fallback: string) {
  if (agency === 'jyp') return 'jyp';
  if (agency === 'yg') return 'yg';
  if (agency === 'starship') return 'starship';
  return fallback;
}

function toDanceTeacherResponse(data: any) {
  return {
    immediate: String(data.keyCorrection || data.nextFocus || data.coachLine || '라인 정리').slice(0, 24),
    detailed: data.coachLine || data.keyCorrection || '현재 동작에서 가장 약한 지점을 하나만 잡아 반복하세요.',
    praise: data.encouragement || data.personaComment || '좋은 흐름이 보입니다.',
    nextFocus: data.nextFocus || data.keyCorrection || '동작 끝맺음',
    agencyComment: data.personaComment || data.encouragement || '기획사 기준으로 더 선명하게 보여주세요.',
    raw: data,
  };
}

function toVocalTeacherResponse(data: any) {
  return {
    immediate: String(data.breathingTip || data.soulDirection || data.coachLine || '호흡 먼저').slice(0, 24),
    technicalFeedback: data.technicalAsEmotion || data.soulDirection || data.coachLine || '호흡 지지를 먼저 안정화하세요.',
    emotionalFeedback: data.emotionImage || data.visualizationExercise || '가사의 장면을 먼저 떠올리고 소리를 내세요.',
    breathingTip: data.breathingTip || '소리보다 숨을 먼저 준비하세요.',
    visualization: data.visualizationExercise || data.emotionImage || '눈을 감고 가사의 상황을 영화처럼 상상하세요.',
    praise: data.encouragement || '톤의 방향은 좋습니다.',
    raw: data,
  };
}

export class AITeacherEngine {
  private knowledgeBase: KnowledgeEntry[] = [];

  async loadKnowledge(topic: 'dance' | 'vocal' | 'korean' | 'audition' = 'dance') {
    this.knowledgeBase = await trainerKnowledgeBase.loadRecent(topic, 50);
    return this.knowledgeBase;
  }

  buildEnrichedPrompt(basePrompt: string, topic: string): string {
    const relevantKnowledge = this.knowledgeBase
      .filter((entry) => entry.topic === topic || entry.tags?.includes(topic))
      .slice(0, 10)
      .map((entry) => entry.content)
      .filter(Boolean)
      .join('\n');

    if (!relevantKnowledge) return basePrompt;

    return `${basePrompt}

[추가 전문 지식 - 지속 업데이트됨]
${relevantKnowledge}
`;
  }

  async getDanceFeedback(params: {
    poseData: any;
    agency: AgencyId;
    songInfo: any;
    sessionHistory: any[];
    language: string;
  }) {
    await this.loadKnowledge('dance');
    const response = await postCoaching('dance-persona', {
      poseData: {
        ...params.poseData,
        overallScore: params.poseData?.overallScore,
      },
      agency: params.agency,
      songAnalysis: params.songInfo,
      sessionHistory: params.sessionHistory,
      language: params.language,
      trainerPersona: agencyToPersona(params.agency, 'liaKim'),
      teacherSystemPrompt: this.buildEnrichedPrompt(DANCE_TEACHER_SYSTEM_PROMPT, 'dance'),
    });
    return toDanceTeacherResponse(response);
  }

  async getVocalFeedback(params: {
    pitchData: any;
    vocalCharacteristics: any;
    songInfo: any;
    agency: AgencyId;
    language: string;
  }) {
    await this.loadKnowledge('vocal');
    const response = await postCoaching('vocal-soul', {
      pitchData: params.pitchData,
      userVocalCharacteristics: params.vocalCharacteristics,
      songAnalysis: params.songInfo,
      agency: params.agency,
      language: params.language,
      trainerPersona: agencyToPersona(params.agency, 'kpopVocalMaster'),
      teacherSystemPrompt: this.buildEnrichedPrompt(VOCAL_TEACHER_SYSTEM_PROMPT, 'vocal'),
    });
    return toVocalTeacherResponse(response);
  }

  async getKoreanFeedback(params: {
    referenceText: string;
    transcript: string;
    metrics: any;
    songInfo?: any;
    language?: string;
  }) {
    await this.loadKnowledge('korean');
    return postCoaching('korean-pronunciation', {
      referenceText: params.referenceText,
      transcript: params.transcript,
      metrics: params.metrics,
      songAnalysis: params.songInfo || {},
      language: params.language || 'ko',
      trainerPersona: 'starship',
    });
  }
}

export const aiTeacherEngine = new AITeacherEngine();
export default AITeacherEngine;
