// @ts-nocheck
/** API 실패 시에도 코칭 UI가 동작하도록 하는 클라이언트 fallback */

function tonePrefix(args = {}) {
  const tone = args.coachTone || 'friendly';
  if (tone === 'strict') return '정확하게 말할게요.';
  if (tone === 'encouraging') return '잘하고 있어요!';
  return '함께 연습해요.';
}

export function buildDancePersonaFallback(args = {}) {
  const { songAnalysis = {}, sessionPhase = 'realtime', poseData = {} } = args;
  const personaName = songAnalysis.personaName || '이 곡의 주인공';
  const overallScore = Number(poseData.overallScore) || 70;
  return {
    coachLine:
      sessionPhase === 'start'
        ? `${tonePrefix(args)} 이 곡의 페르소나는 '${personaName}'이에요. ${songAnalysis.danceAttitude || '곡의 감정에 몸을 맡기고 시작해봐요.'}`
        : `${tonePrefix(args)} ${personaName}의 에너지를 더 살려봐요!`,
    personaActivated: overallScore >= 70,
    personaComment: `${personaName}답게 표현해보세요`,
    keyCorrection: `${personaName}는 동작 끝을 칼처럼 맺어야 해요`,
    encouragement: '계속 가요. 점점 살아나고 있어요.',
    nextFocus: '시선 처리와 동작 끝맺음',
    emotionalScore: Math.max(40, Math.min(95, overallScore - 5)),
    technicalScore: overallScore,
    source: 'client-fallback',
  };
}

export function buildVocalSoulFallback(args = {}) {
  const { songAnalysis = {}, sessionPhase = 'realtime', pitchData = {} } = args;
  const mood = songAnalysis.mood || '감정';
  const pitchAccuracy = Number(pitchData.avgAccuracy) || 70;
  const pitchScore = Math.round(Math.min(98, Math.max(40, pitchAccuracy)));
  return {
    coachLine:
      sessionPhase === 'start'
        ? `${tonePrefix(args)}, 이 곡은 '${mood}'의 곡이에요. ${songAnalysis.vocalAttitude || '감정을 먼저 떠올린 다음 입을 여세요.'}`
        : `${tonePrefix(args)}, 지금 감정이 목소리에 충분히 실리지 않았어요. 다시 해봐요.`,
    emotionImage: `${mood}의 한가운데에 서 있는 자기 자신의 모습`,
    soulDirection: '기술보다 감정을 먼저 생각하세요',
    technicalAsEmotion: '음정이 아니라 감정의 높낮이를 생각하세요',
    breathingTip: '숨을 먼저 느끼고, 그 다음에 소리를 내세요',
    visualizationExercise: '눈을 감고 이 가사의 상황을 영화처럼 상상해보세요',
    encouragement: '계속해요. 조금씩 나오고 있어요.',
    soulScore: Math.max(40, Math.min(95, pitchScore - 5)),
    pitchScore,
    source: 'client-fallback',
  };
}

export function buildVocalCloneFallback({ vocalCharacteristics = {}, songAnalysis = {} } = {}) {
  const avgPitch = Number(vocalCharacteristics.avgPitch) || 220;
  return {
    voiceId: `voice_${Date.now()}`,
    profile: {
      avgPitch,
      range: vocalCharacteristics.range || '중음역',
      type: vocalCharacteristics.type || '맑은 중음형',
      stability: Number(vocalCharacteristics.stability) || 70,
      timbre: avgPitch > 250 ? '밝고 맑은 톤' : avgPitch > 180 ? '안정적인 중음' : '깊고 따뜻한 저음',
    },
    teachingNote: '당신의 목소리 톤을 학습했습니다. AI가 같은 음색으로 모범창을 불러드릴게요.',
    source: 'client-fallback',
  };
}

export function buildVocalCoverFallback({ songAnalysis = {}, lyrics = [] } = {}) {
  const song = songAnalysis || {};
  const lines =
    Array.isArray(lyrics) && lyrics.length
      ? lyrics
      : ['첫 소절을 감정을 담아 부르세요', '호흡을 먼저 느끼고 음정을 얹어보세요'];
  return {
    teachingIntro: `'${song.trackName || '이 곡'}'을 당신 목소리 톤으로 모범창해 드릴게요. 내 녹음과 비교하며 따라 불러보세요.`,
    coverLines: lines.map((text, i) => ({
      text: typeof text === 'string' ? text : String(text),
      tip: i === 0 ? '가사보다 감정을 먼저 떠올리세요' : '이전 음정을 이어가세요',
    })),
    comparisonTip: 'AI 모범창을 듣고 바로 이어서 내 목소리로 따라 불러보세요.',
    source: 'client-fallback',
  };
}

export function buildKoreanLyricsFallback({ songTitle = '', songArtist = '' } = {}) {
  const title = songTitle || '연습 곡';
  const artist = songArtist ? ` — ${songArtist}` : '';
  return {
    lyrics: [
      `${title}${artist}의 분위기에 맞춰 천천히 읽어보세요.`,
      '오늘도 정확한 발음과 리듬으로 연습해요.',
      '받침을 또렷하게, 억양은 자연스럽게 이어가세요.',
      '한 문장씩 끊어 말하면 발음이 더 안정됩니다.',
    ].join('\n'),
    source: 'client-fallback',
  };
}

export function buildKoreanPronunciationFallback(args = {}) {
  const {
    referenceText = '',
    transcript = '',
    metrics = {},
    songAnalysis = {},
    sessionPhase = 'realtime',
  } = args;
  const similarity = Number(metrics.similarity) || 0;
  const overall = Number(metrics.overall) || similarity;
  const personaName = songAnalysis.personaName || '한국어 코치';
  const tips = [];
  if (similarity < 60) tips.push('받침과 어미를 기준 문장과 동일하게 맞춰보세요.');
  if (metrics.pace < 60) tips.push('속도를 줄이고 음절마다 끊어 읽어보세요.');
  if (metrics.clarity < 60) tips.push('자음을 더 또렷하게 내보세요.');
  if (!tips.length) tips.push('발음이 안정적입니다. 억양 디테일을 더 살려보세요.');

  return {
    coachLine:
      sessionPhase === 'start'
        ? `${personaName} 페르소나로 '${referenceText.slice(0, 24)}...' 문장을 연습해 볼게요.`
        : transcript
          ? `${tonePrefix(args)} ${tips[0]}`
          : '마이크에 대고 기준 문장을 따라 읽어주세요.',
    accuracy: overall,
    syllableTips: tips,
    correctedReading: referenceText || '기준 문장을 입력해주세요.',
    encouragement: overall >= 70 ? '좋아요! 이 흐름을 유지하세요.' : '천천히 한 번 더 따라해 보세요.',
    personaComment: songAnalysis.vocalAttitude || '가사의 감정을 먼저 떠올리고 발음하세요.',
    source: 'client-fallback',
  };
}
