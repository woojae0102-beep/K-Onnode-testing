// Song persona analysis — combine Spotify audio features + Claude analysis
// to produce a dance/vocal coaching persona blueprint for a track.
const { readJsonBody, callClaude, languageLabel } = require('./_helpers');

function buildFallback(features = {}, trackName = '', artistName = '') {
  const energy = Number(features.energy) || 0.5;
  const valence = Number(features.valence) || 0.5;
  const danceability = Number(features.danceability) || 0.5;
  const isHighEnergy = energy > 0.65;
  const isPositive = valence > 0.55;
  const isDance = danceability > 0.55;

  let danceStyle = '감성적';
  let vocalStyle = '부드러운';
  let mood = '감성';
  let personaName = '감성러';
  let personaDescription = '섬세하고 감정 중심의 표현';
  let emotionKeywords = ['감성', '섬세함', '따뜻함'];
  let colorPalette = ['파랑', '흰색'];
  let movementKeywords = ['부드러운', '흐르는', '섬세한'];
  let danceAttitude = '곡의 감정선에 몸을 맡기고, 매 동작을 호흡처럼 자연스럽게 표현하세요.';
  let vocalAttitude = '가사의 한 줄 한 줄에 진심을 담아, 듣는 사람과 같은 공간에 있는 듯이 부르세요.';

  if (isHighEnergy && isDance) {
    danceStyle = isPositive ? '걸크러쉬' : '파워풀';
    vocalStyle = '파워풀';
    mood = '카리스마';
    personaName = isPositive ? '퀸' : '다크히어로';
    personaDescription = '강렬하고 압도적인 존재감, 무대를 장악하는 카리스마';
    emotionKeywords = ['자신감', '도발적', '폭발적'];
    colorPalette = isPositive ? ['핫핑크', '검정'] : ['빨강', '검정'];
    movementKeywords = ['날카로운', '빠른', '강한'];
    danceAttitude = '눈빛부터 무대를 지배하세요. 모든 동작 끝에 ‘맺음’이 분명해야 합니다.';
    vocalAttitude = '주저하지 말고 가슴에서 끌어올린 감정을 그대로 던지세요.';
  } else if (isHighEnergy && !isDance) {
    danceStyle = '파워풀';
    vocalStyle = '폭발적';
    mood = '강렬함';
    personaName = '파이터';
    personaDescription = '폭발하는 에너지로 객석을 흔드는 존재';
    emotionKeywords = ['강렬함', '집념', '폭발'];
    colorPalette = ['빨강', '검정'];
    movementKeywords = ['폭발적', '큰', '결단력 있는'];
    danceAttitude = '한 동작 한 동작에 의지를 실으세요. 멈춤조차 강렬해야 합니다.';
    vocalAttitude = '터지는 순간을 위해 절제하고, 결정적인 한 줄에서 모든 걸 쏟아내세요.';
  } else if (!isHighEnergy && isPositive) {
    danceStyle = '큐트';
    vocalStyle = '청아한';
    mood = '설렘';
    personaName = '봄날의 너';
    personaDescription = '따뜻하고 사랑스러운 미소가 무기인 존재';
    emotionKeywords = ['사랑스러움', '설렘', '청량'];
    colorPalette = ['파스텔핑크', '하늘색'];
    movementKeywords = ['리듬감 있는', '가벼운', '발랄한'];
    danceAttitude = '미소가 첫 동작이라고 생각하세요. 시선과 발끝까지 ‘귀여움’이 흘러야 합니다.';
    vocalAttitude = '말하듯 자연스럽게, 그러나 음 하나하나는 또렷하게 발음하세요.';
  }

  return {
    genre: 'K-POP',
    mood,
    danceStyle,
    vocalStyle,
    emotionKeywords,
    colorPalette,
    movementKeywords,
    personaName,
    personaDescription,
    danceAttitude,
    vocalAttitude,
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
    trackName = '',
    artistName = '',
    features = {},
    language = 'ko',
  } = body || {};

  const fallback = buildFallback(features, trackName, artistName);

  const prompt = `당신은 K-POP 음악 분석 전문가입니다.
아래 곡의 음악적 특성을 분석해서 댄스 코칭과 보컬 코칭에 활용할 페르소나 데이터를 생성하세요.

곡: ${trackName || '(미상)'} - ${artistName || '(미상)'}
BPM: ${features.bpm ?? '미상'}
에너지: ${features.energy ?? '미상'} (0~1, 높을수록 강렬)
댄서빌리티: ${features.danceability ?? '미상'} (0~1, 높을수록 리드미컬)
감성(Valence): ${features.valence ?? '미상'} (0~1, 높을수록 긍정적)
어쿠스틱: ${features.acousticness ?? '미상'}
음량: ${features.loudness ?? '미상'}dB

곡명/아티스트 정보 + 위 데이터로 종합 분석하세요.

응답 언어: ${languageLabel(language)}

JSON만 출력:
{
  "genre": "장르 (예: K-POP 걸그룹, 힙합, R&B)",
  "mood": "곡의 핵심 감성 한 단어 (예: 당당함, 슬픔, 설렘, 카리스마)",
  "danceStyle": "댄스 스타일 (예: 걸크러쉬, 큐트, 파워풀, 섹시, 청순)",
  "vocalStyle": "보컬 스타일 (예: 청아한, 허스키, 파워풀, 부드러운)",
  "emotionKeywords": ["감정 키워드1", "감정 키워드2", "감정 키워드3"],
  "colorPalette": ["색상1", "색상2"],
  "movementKeywords": ["움직임 특성1", "움직임 특성2", "움직임 특성3"],
  "personaName": "이 곡의 댄스 페르소나 이름 (예: 다크히어로, 퀸, 야생마)",
  "personaDescription": "이 페르소나 한 문장 설명",
  "danceAttitude": "이 곡을 출 때 가져야 할 태도 (2~3문장)",
  "vocalAttitude": "이 곡을 부를 때 가져야 할 감정/태도 (2~3문장)"
}`;

  const result = await callClaude({ prompt, maxTokens: 600 });
  if (result.ok && result.parsed) {
    return res.status(200).json({ ...fallback, ...result.parsed, source: 'claude' });
  }
  return res.status(200).json({ ...fallback, reason: result.reason });
};
