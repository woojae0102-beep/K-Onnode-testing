// Dance persona coaching — generates real-coach-style line + correction
// tied to the song's persona. Phases: start | realtime | mid | end.
const { readJsonBody, callClaude, languageLabel } = require('./_helpers');

const COACH_PROMPTS = {
  jyp_jung: `당신은 JYP의 댄스 트레이너 정민지입니다.
활기차고 에너지 넘치는 말투.
"오!", "그거예요!", "바로 그 느낌!" 같은 즉각적 반응.
잘하면 박수치거나 직접 따라하는 스타일.`,
  yg_lee: `당신은 YG의 퍼포먼스 팀장 이나래입니다.
직설적이고 기준이 높음.
"BLACKPINK라면", "YG 무대에서는" 자주 언급.
부족한 부분은 구체적으로 지적.`,
  hybe_kim: `당신은 HYBE의 퍼포먼스 디렉터 김소연입니다.
날카로운 직관. "그 순간이요" "느껴져요/안 느껴져요".
LE SSERAFIM, NewJeans 스타일 자주 비교.`,
  sm_choi: `당신은 SM의 퍼포먼스 디렉터입니다.
침착하고 권위 있는 말투. 카메라 친화성과 아우라를 중시.
"카메라가 좋아하는 각도가 있어요" 자주 언급.`,
};

const PHASE_INSTRUCTIONS = {
  start: `오디션 시작 전 이 곡에 대한 댄스 페르소나를 설명해주세요.
"이 곡은 ~이니까 ~하게 춰야 해" 형태로.
페르소나 이름을 먼저 선언하고 시작하세요.
2~3문장으로 간결하게.`,
  realtime: `현재 자세 분석 데이터를 보고 실시간 코칭을 해주세요.
10~15자 이내로 짧게. 즉각적으로.
곡의 페르소나와 맞지 않는 부분을 지적하세요.`,
  mid: `중간 점검 코칭입니다.
지금까지의 퍼포먼스에서 페르소나가 살아있는지 평가하세요.
구체적인 개선 포인트 1~2가지.`,
  end: `세션 종료 후 종합 코칭입니다.
이 곡의 페르소나를 얼마나 살렸는지 총평.
가장 잘한 순간 1가지 + 다음 연습에서 집중할 것 1가지.
감정적으로 마무리하세요.`,
};

function buildFallback({ songAnalysis = {}, sessionPhase = 'realtime', poseData = {} }) {
  const personaName = songAnalysis.personaName || '이 곡의 주인공';
  const overallScore = Number(poseData.overallScore) || 0;
  const technicalBase = overallScore || 70;
  const emotionalBase = Math.max(40, Math.min(95, technicalBase - 5));

  let coachLine = `${personaName}의 에너지를 더 살려봐요!`;
  if (sessionPhase === 'start') {
    coachLine = `이 곡의 페르소나는 ‘${personaName}’이에요. ${songAnalysis.danceAttitude || '곡의 감정에 몸을 맡기고 시작해봐요.'}`;
  } else if (sessionPhase === 'mid') {
    coachLine = `좋아요, ${personaName}가 보이기 시작했어요. 시선과 어깨를 한 번만 더 단단하게.`;
  } else if (sessionPhase === 'end') {
    coachLine = `오늘은 ${personaName}의 한 면을 충분히 보여줬어요. 다음엔 동작 끝맺음만 더 분명하게.`;
  }

  return {
    coachLine,
    personaActivated: overallScore >= 70,
    personaComment: `${personaName}답게 표현해보세요`,
    keyCorrection: `${personaName}는 동작 끝을 칼처럼 맺어야 해요`,
    encouragement: '계속 가요. 점점 살아나고 있어요.',
    nextFocus: '시선 처리와 동작 끝맺음',
    emotionalScore: emotionalBase,
    technicalScore: technicalBase,
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
    poseData = {},
    sessionPhase = 'realtime',
    coachPersona = 'jyp_jung',
    language = 'ko',
  } = body || {};

  const fallback = buildFallback({ songAnalysis, sessionPhase, poseData });

  const coachIntro = COACH_PROMPTS[coachPersona] || COACH_PROMPTS.jyp_jung;
  const phaseInstruction = PHASE_INSTRUCTIONS[sessionPhase] || PHASE_INSTRUCTIONS.realtime;
  const personaName = songAnalysis.personaName || '이 곡의 주인공';
  const energyLabel =
    (Number(songAnalysis.energy) || 0) > 0.7
      ? '높음'
      : (Number(songAnalysis.energy) || 0) > 0.4
      ? '중간'
      : '낮음';

  const prompt = `${coachIntro}

[이 곡의 페르소나]
곡: ${songAnalysis.trackName || ''} - ${songAnalysis.artistName || ''}
페르소나 이름: ${personaName}
댄스 스타일: ${songAnalysis.danceStyle || ''}
태도: ${songAnalysis.danceAttitude || ''}
움직임 키워드: ${(songAnalysis.movementKeywords || []).join(', ')}
감정 키워드: ${(songAnalysis.emotionKeywords || []).join(', ')}
BPM: ${songAnalysis.bpm || '-'}
에너지 레벨: ${energyLabel}

[현재 자세 분석 데이터]
전체 정확도: ${poseData.overallScore ?? 0}점
주요 문제: ${(poseData.mainIssues || []).join(', ') || '없음'}
잘된 부분: ${(poseData.strengths || []).join(', ') || '없음'}
리듬 정확도: ${poseData.rhythmScore ?? 0}점
표현력: ${poseData.expressionScore ?? 0}점

[현재 단계]
${phaseInstruction}

[중요]
반드시 곡의 페르소나(${personaName})와 연결지어 피드백.
"이 곡의 ${personaName}라면 ~" 형태로 자주 언급.
기술적 교정을 페르소나 언어로 표현.
예: "팔 각도 교정 필요" ❌
    "${personaName}는 팔을 칼처럼 써야 해요" ✓

응답 언어: ${languageLabel(language)}

JSON만 출력:
{
  "coachLine": "코치가 실제로 하는 말",
  "personaActivated": true또는false,
  "personaComment": "페르소나 관점 코멘트",
  "keyCorrection": "핵심 교정 포인트 (페르소나 언어로)",
  "encouragement": "격려 한마디",
  "nextFocus": "다음에 집중할 것",
  "emotionalScore": 점수,
  "technicalScore": 점수
}`;

  const result = await callClaude({ prompt, maxTokens: 500 });
  if (result.ok && result.parsed) {
    return res.status(200).json({ ...fallback, ...result.parsed, source: 'claude' });
  }
  return res.status(200).json({ ...fallback, reason: result.reason });
};
