/**
 * 매 오디션 전용 질문 세트 생성 (기획사별 스타일 + 시드 변이)
 *
 * POST /api/audition/generate-questions
 * Body: { agencyId, applicantProfile?, performanceData?, previousAnswers?, randomSeed?, language }
 */
const { completeJson, readJsonBody } = require('../_lib/flowAnthropicHelper');

const QUESTION_GENERATOR_PROMPT = `당신은 K-POP 기획사 오디션 질문을 생성하는 전문 시스템입니다.
매번 다른 질문 세트를 생성합니다.

입력 JSON의 필드를 모두 활용하세요:
- applicantProfile.age, appliedField(vocal|dance|total), selfIntroKeywords[], practiceYears
- performanceData.phase1Score, phase1Issues[], phase1Strengths[], interruptionCount, improvementAfterCorrection
- previousAnswers[]: {question,answer,keywords}
- randomSeed: 같은 입력이라도 달라지도록 반드시 변주에 활용

규칙:
1. 자기소개 키워드에서 아직 탐색 안 된 부분 우선 공략
2. 실기 문제점 기반 멘트/질문
3. 이전 대답의 애매한 부분 꼬리 질문
4. 기획사 agencyId별 톤: hybe(음애·성장·글로벌), yg(무겁·짧음·무미), jyp(따듯하지만 신뢰 검증), sm(권위·카메라·아우라·세계관), starship(대중성·카메라·성장 균형)
5. 모든 문자열 출력은 사용자 언어(language) 우선(ko 기본).

반드시 ONLY JSON 출력 (코드펜스 금지):
{
  "phaseQuestions": {
    "phase0_followup": "자기소개 꼬리 질문 한 문장",
    "phase1_interruption_hint": "실기 중 개입 멘트 힌트(심사위원이 즉석에서 말할 말 컨셉)",
    "phase2_mission": "2차 실기 즉석 미션 한 줄",
    "phase3_main": ["압박 인터뷰 메인 질문 3~4개"],
    "phase3_followup": ["꼬리 질문 풀 3~4개"],
    "phase4_final": "마지막 기회(연습생 발언 유도) 질문"
  },
  "generationBasis": {
    "usedSelfIntroKeyword": "string 또는 null",
    "usedPerformanceData": "string 또는 null",
    "usedPreviousAnswer": "string 또는 null"
  }
}`;

function buildFallback(agencyId, seed) {
  const s = String(seed || Date.now());
  const n = [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rot = ['A', 'B', 'C', 'D'][(n + agencyId?.length || 0) % 4];
  return {
    phaseQuestions: {
      phase0_followup:
        rot === 'A'
          ? '지금 이 자리 오기까지 가장 무서웠던 순간이 언제였어요?'
          : rot === 'B'
            ? '요즘 못 잊는 무대/영상이 있다면 무엇이에요?'
            : rot === 'C'
              ? '처음 빛을 받고 싶다고 생각한 계기 한 문장으로요.'
              : '실패했던 경험 중 기억에 남는 것 하나만 들려줄래요?',
      phase1_interruption_hint: '실기 특정 순간 컷 후 짧게 이유 하나만 짚고 같은 구간 다시 요청.',
      phase2_mission:
        rot === 'A'
          ? '방금과 반대 속도로 동일 브릿지/메인만 처리해 보세요.'
          : rot === 'B'
            ? '좋아하는 팀 노래 하나, 준비 없이 30초만요.'
            : rot === 'C'
              ? '심사위원 세 명에게 번갈아 시선을 주며 같은 파트 재현.'
              : '소리 없이 움직임만으로 방금 무드만 표현.',
      phase3_main: [
        '오늘 본인이 가장 불안했던 구간과 이유?',
        `(${agencyId?.toUpperCase() || ''}) 선택 이유 한 문장.`,
        '같은 실수가 반복될 때 본인은 어떻게 돌파하려 하세요?',
      ],
      phase3_followup: [
        '그게 진짜 이유예요, 아니면 말하기 편한 이유예요?',
        '그 전랭이 현장에서는 어떻게 바뀌나요?',
        '10년 후에도 같은 답 할 수 있어요?',
      ],
      phase4_final: '지금 들은 심사 대화 들었어요. 마지막으로 한마디만 30초.',
    },
    generationBasis: {
      usedSelfIntroKeyword: seed ? 'fallback+seed' : 'fallback',
      usedPerformanceData: null,
      usedPreviousAnswer: null,
    },
    source: 'fallback',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const {
    agencyId = 'hybe',
    applicantProfile = {},
    performanceData = {},
    previousAnswers = [],
    randomSeed = `${agencyId}_${Date.now()}`,
    language = 'ko',
  } = body || {};

  const payload = {
    agencyId,
    applicantProfile,
    performanceData,
    previousAnswers,
    randomSeed,
    language,
  };

  const userBlock = `${QUESTION_GENERATOR_PROMPT}\n\n입력:\n${JSON.stringify(payload)}`;

  const { parsed } = await completeJson({
    system: '너는 JSON만 출력한다. 다른 텍스트·마크다운 금지.',
    userContent: userBlock,
    maxTokens: 2048,
  });

  const merged = parsed && parsed.phaseQuestions && parsed.generationBasis
    ? { ...parsed, source: 'claude', randomSeed }
    : { ...buildFallback(agencyId, randomSeed), randomSeed };

  return res.status(200).json(merged);
};
