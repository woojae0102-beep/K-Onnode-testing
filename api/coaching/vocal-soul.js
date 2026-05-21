// Vocal soul coaching — translates pitch / breathing problems into
// emotion-language guidance, tied to the song's persona.
const { readJsonBody, callClaude, languageLabel } = require('./_helpers');

const COACH_PROMPTS = {
  jyp_park: `당신은 JYP 수석 보컬 트레이너 박재원입니다.
"공기반 소리반" 철학. 인상 찡그리면 즉시 지적.
따뜻하지만 발성 습관에 타협 없음.
"힘 빼고", "자연스럽게", "공기를 섞어서" 자주 사용.`,
  sm_choi: `당신은 SM 보컬 디렉터 최유진입니다.
음색 전문가. 눈 감고 듣다가 즉각 반응.
"그 음색이요", "처음 들어봤어요" 자주 사용.
SM 발성법 기반 교정.`,
  hybe_soul: `당신은 HYBE 보컬 트레이너입니다.
음악성과 감정 전달 중심.
"진심이 느껴졌어요/안 느껴졌어요" 자주 사용.
BTS, LE SSERAFIM 보컬 스타일 자주 비교.`,
  yg_vocal: `당신은 YG 보컬 디렉터입니다.
스웩과 그루브가 우선. 정형화된 발성보다 ‘느낌’을 중시.
"플로우가 어디 있어요?" 자주 사용.`,
};

const PHASE_INSTRUCTIONS = {
  start: `이 곡을 부르기 전 감정/소울 준비 코칭.
"이 곡을 부르려면 ~한 감정이 필요해요" 형태.
구체적인 감정 이미지와 시각화 방법 제시.
예: "눈을 감고 ~한 상황을 상상하면서 시작하세요"`,
  realtime: `현재 부르는 도중 즉각 피드백.
10~15자 이내 짧게.
음정 이탈 시: 기술적 교정이 아닌 감정 교정으로.
예: "음정이 낮아요" ❌
    "그 감정을 더 올려요, 하늘을 보면서" ✓`,
  mid: `중간 점검. 감정 전달이 되고 있는지 평가.
이 곡의 핵심 감정이 목소리에 실리고 있는지.
구체적 개선 방법 1가지.`,
  end: `세션 종료 종합 코칭.
감정 전달력 평가 + 음정 정확도 평가.
"이 곡의 소울을 얼마나 살렸는가"가 핵심.
다음 연습을 위한 감정 이미지 과제 제시.`,
};

function buildFallback({ songAnalysis = {}, sessionPhase = 'realtime', pitchData = {} }) {
  const mood = songAnalysis.mood || '감정';
  const pitchAccuracy = Number(pitchData.avgAccuracy) || 0;
  const pitchScore = pitchAccuracy
    ? Math.round(Math.min(98, Math.max(40, pitchAccuracy)))
    : 70;
  const soulScore = Math.max(40, Math.min(95, pitchScore - 5));

  let coachLine = '지금 감정이 목소리에 충분히 실리지 않았어요. 다시 해봐요.';
  if (sessionPhase === 'start') {
    coachLine = `이 곡은 ‘${mood}’의 곡이에요. ${songAnalysis.vocalAttitude || '눈을 감고 그 감정을 먼저 떠올린 다음 입을 여세요.'}`;
  } else if (sessionPhase === 'mid') {
    coachLine = `소리는 나오고 있어요. 다음엔 ‘${mood}’의 감정을 한 번만 더 깊게 떠올려보세요.`;
  } else if (sessionPhase === 'end') {
    coachLine = `오늘은 ‘${mood}’의 한 조각을 들려줬어요. 다음 연습엔 그 감정 위에 음정을 올리세요.`;
  }

  return {
    coachLine,
    emotionImage: `${mood}의 한가운데에 서 있는 자기 자신의 모습`,
    soulDirection: '기술보다 감정을 먼저 생각하세요',
    technicalAsEmotion: '음정이 아니라 감정의 높낮이를 생각하세요',
    breathingTip: '숨을 먼저 느끼고, 그 다음에 소리를 내세요',
    visualizationExercise: '눈을 감고 이 가사의 상황을 영화처럼 상상해보세요',
    encouragement: '계속해요. 조금씩 나오고 있어요.',
    soulScore,
    pitchScore,
    source: 'fallback',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = await readJsonBody(req);
  const {
    songAnalysis = {},
    pitchData = {},
    sessionPhase = 'realtime',
    coachPersona = 'jyp_park',
    userVocalCharacteristics = {},
    language = 'ko',
  } = body || {};

  const fallback = buildFallback({ songAnalysis, sessionPhase, pitchData });

  const coachIntro = COACH_PROMPTS[coachPersona] || COACH_PROMPTS.jyp_park;
  const phaseInstruction = PHASE_INSTRUCTIONS[sessionPhase] || PHASE_INSTRUCTIONS.realtime;
  const energyLabel =
    (Number(songAnalysis.energy) || 0) > 0.7
      ? '강렬함'
      : (Number(songAnalysis.energy) || 0) > 0.4
      ? '중간'
      : '잔잔함';

  const pitchAccuracy = pitchData.avgAccuracy ?? 0;
  const problemSections = Array.isArray(pitchData.problemSections) ? pitchData.problemSections : [];
  const bestMoments = Array.isArray(pitchData.bestMoments) ? pitchData.bestMoments : [];

  const prompt = `${coachIntro}

[이 곡의 보컬 페르소나]
곡: ${songAnalysis.trackName || ''} - ${songAnalysis.artistName || ''}
보컬 스타일: ${songAnalysis.vocalStyle || ''}
곡의 핵심 감성: ${songAnalysis.mood || ''}
감정 키워드: ${(songAnalysis.emotionKeywords || []).join(', ')}
보컬 태도: ${songAnalysis.vocalAttitude || ''}
에너지: ${energyLabel}

[사용자 목소리 특성]
음역대: ${userVocalCharacteristics.range || '중음역'}
목소리 타입: ${userVocalCharacteristics.type || '분석 중'}
강점: ${userVocalCharacteristics.strength || '분석 중'}
약점: ${userVocalCharacteristics.weakness || '분석 중'}

[현재 음정 분석 데이터]
전체 음정 정확도: ${pitchAccuracy}%
문제 구간: ${problemSections.slice(0, 3).join(', ') || '없음'}
잘된 구간: ${bestMoments.slice(0, 2).join(', ') || '없음'}
호흡 안정성: ${pitchData.breathingStability ?? 0}%
감정 표현 점수: ${pitchData.emotionScore ?? 0}점

[현재 단계]
${phaseInstruction}

[핵심 원칙]
음정 교정을 기술이 아닌 감정 언어로:
"음정이 낮아요" → "그 감정이 아직 충분히 올라오지 않았어요"
"고음이 떨려요" → "거기서 두려워하지 말고 뛰어들어요"
"발성이 약해요" → "그 감정을 더 믿어봐요"

응답 언어: ${languageLabel(language)}

JSON만 출력:
{
  "coachLine": "코치가 실제로 하는 말",
  "emotionImage": "이 곡/구간에서 상상해야 할 감정 이미지",
  "soulDirection": "소울 방향성 (예: '가슴에서 끌어올리는 느낌으로')",
  "technicalAsEmotion": "기술적 교정을 감정 언어로 변환한 것",
  "breathingTip": "호흡/발성 팁 (감정 언어로)",
  "visualizationExercise": "다음 시도 전 눈 감고 할 시각화 연습",
  "encouragement": "격려 한마디",
  "soulScore": 점수,
  "pitchScore": 점수
}`;

  const result = await callClaude({ prompt, maxTokens: 500 });
  if (result.ok && result.parsed) {
    return res.status(200).json({ ...fallback, ...result.parsed, source: 'claude' });
  }
  return res.status(200).json({ ...fallback, reason: result.reason });
};
