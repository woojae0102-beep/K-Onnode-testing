// Per-judge interview question pools, pre-seeded fallback lines, and
// phase-specific dialogue used when the LLM is unavailable. Keep these tight
// — each line should match the judge's persona so the audition feels alive
// even without the API key.

const JUDGE_QUESTION_POOL = {
  // ───── HYBE ─────
  'hybe-junhyuk': [
    '지금 부른 곡에서 가장 어렵게 느낀 부분이 어디였나요?',
    '음악을 들을 때 어떤 부분에 집중하나요?',
    '6개월 후 자신이 어떻게 성장해 있을 것 같아요?',
    'HYBE 아티스트 중 누구에게서 영향을 받았나요?',
    '자신의 음악적 색깔을 한 단어로 표현하면?',
  ],
  'hybe-soyeon': [
    '지금 이 순간 어떤 감정으로 노래했나요?',
    '음악을 처음 시작한 계기가 뭐예요?',
    '가장 힘들었던 순간에 음악이 어떻게 도움이 됐나요?',
    '데뷔하면 어떤 메시지를 팬들에게 전하고 싶어요?',
  ],
  'hybe-david': [
    'What kind of artist do you want to be globally?',
    '어떤 해외 아티스트에게서 영향을 받았나요?',
    '영어나 다른 언어로 노래할 준비가 되어 있나요?',
    '한국 밖에서도 활동하고 싶나요?',
  ],

  // ───── YG ─────
  'yg-taejun': [
    '지금 보여준 게 최선이에요?',
    'YG 아티스트 중 자신이 따라갈 수 있다고 생각하는 사람 있어요?',
    '실력이 부족하다고 느끼면 어떻게 해요?',
    'BIGBANG이나 BLACKPINK처럼 되려면 뭐가 더 필요하다고 생각해요?',
  ],
  'yg-narae': [
    '지금 춤 출 때 어느 부분이 가장 자신 없었어요?',
    'YG 퍼포먼스만의 특징이 뭐라고 생각해요?',
    '안무 익히는 데 보통 얼마나 걸려요?',
  ],
  'yg-marcus': [
    '힙합을 언제부터 좋아했어요?',
    '자기만의 스웩이 뭐라고 생각해요?',
    "Real talk — 지금 실력으로 YG 들어올 자격 있다고 생각해요?",
  ],

  // ───── JYP ─────
  'jyp-jaewon': [
    '지금 노래할 때 발성이 편했나요?',
    '평소에 어떻게 발성 연습을 해요?',
    '춤추면서 노래하면 얼마나 힘들어요?',
  ],
  'jyp-minji': [
    '춤 출 때 가장 좋아하는 순간이 언제예요?',
    '안무에서 가장 중요한 게 뭐라고 생각해요?',
  ],
  'jyp-soojin': [
    'JYP에 지원한 이유를 솔직하게 말해줄 수 있어요?',
    '팀원과 의견이 다를 때 어떻게 해요?',
    '지금까지 살면서 가장 어려웠던 순간이 언제였고 어떻게 극복했어요?',
    '데뷔 못 하면 어떻게 할 건가요?',
    '주변 친구들이 당신을 어떤 사람이라고 해요?',
    'JYP 연습생이 되면 SNS를 못 쓸 수도 있어요. 괜찮아요?',
  ],

  // ───── SM ─────
  'sm-seongho': [
    'SM 오디션에 지원한 구체적인 이유가 뭐예요?',
    'SM 아티스트 중 누구를 가장 좋아하고 왜요?',
    'SM 트레이닝은 매우 혹독합니다. 각오가 되어 있나요?',
    '5년 후 자신의 모습을 그려보세요.',
  ],
  'sm-yujin': [
    '자신의 음색의 강점이 뭐라고 생각해요?',
    '고음을 올릴 때 어떤 방법을 쓰나요?',
    'SM 보컬 스타일을 어떻게 이해하고 있어요?',
  ],
  'sm-taeeun': [
    '자신을 브랜드로 표현하면 어떤 단어예요?',
    '팬들에게 어떻게 기억되고 싶어요?',
    'SNS를 얼마나 잘 활용할 수 있어요?',
  ],

  // ───── STARSHIP ─────
  'starship-seunghoon': [
    '스타쉽에 지원한 이유가 뭐예요?',
    '그룹에서 어떤 포지션을 맡고 싶어요?',
    'IVE 중 누구에게서 영감을 받았나요?',
  ],
  'starship-nari': [
    '지금 자신의 가장 부족한 부분이 뭐라고 생각해요?',
    '하루에 얼마나 연습해요?',
  ],
  'starship-jisoo': [
    '팬들과 어떻게 소통하고 싶어요?',
    '당신의 팬이 될 사람은 어떤 사람일 것 같아요?',
  ],
};

// Per-agency dialogue defaults (used when the API key is absent or the LLM
// fails). Each entry mirrors the JSON shape returned by judge-speak.js so the
// frontend never has to special-case a fallback path.
const AGENCY_PHASE_FALLBACKS = {
  hybe: {
    greeting: {
      text: '안녕하세요. 오늘 오디션에 오신 걸 환영합니다. 간단히 자기소개 부탁드릴게요.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'voice',
      duration: 30,
    },
    instruction_vocal: {
      text: '자신 있는 곡을 1절 불러보세요. 장르 제한은 없습니다.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'sing',
      duration: 90,
    },
    instruction_dance: {
      text: '준비된 안무로 30초 정도 춤을 보여주세요. 자기 색깔을 느끼고 싶어요.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'dance',
      duration: 60,
    },
    additional_instruction: {
      text: '이번엔 같은 곡의 후렴 구간만 다시 한 번 들려주세요. 감정 더 실어서요.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'sing',
      duration: 30,
    },
    interview: {
      text: '왜 HYBE에 지원하셨나요? 어떤 아티스트가 되고 싶으세요?',
      type: 'question',
      requiresResponse: true,
      responseType: 'voice',
      duration: 30,
    },
    react_answer: {
      text: '진심이 느껴졌어요. 그 마음 그대로 무대에서도 보여주세요.',
      type: 'reaction',
      requiresResponse: false,
      responseType: 'none',
    },
    react_performance: {
      text: '음악성!',
      type: 'reaction',
      requiresResponse: false,
      responseType: 'none',
    },
    deliberation: {
      text: '오늘 가능성 봤어요. 음악적 색깔이 분명한 친구라 흥미롭습니다.',
      type: 'comment',
      requiresResponse: false,
      responseType: 'none',
    },
  },
  yg: {
    greeting: {
      text: '들어오세요. 시간 없으니까 바로 시작하죠.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'voice',
      duration: 20,
    },
    instruction_vocal: {
      text: '노래 해보세요. 1절이면 충분합니다.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'sing',
      duration: 60,
    },
    instruction_dance: {
      text: '춤 봅시다. YG 감성으로.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'dance',
      duration: 45,
    },
    additional_instruction: {
      text: '다시. 이번엔 처음 8초만 임팩트 있게.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'sing',
      duration: 20,
    },
    interview: {
      text: 'YG에 왜 왔어요?',
      type: 'question',
      requiresResponse: true,
      responseType: 'voice',
      duration: 25,
    },
    react_answer: {
      text: '음... 알겠어요. 다음 거 봅시다.',
      type: 'reaction',
      requiresResponse: false,
      responseType: 'none',
    },
    react_performance: {
      text: '실력 부족.',
      type: 'reaction',
      requiresResponse: false,
      responseType: 'none',
    },
    deliberation: {
      text: '아직 멀었어요. YG 기준은 그렇게 만만하지 않습니다.',
      type: 'comment',
      requiresResponse: false,
      responseType: 'none',
    },
  },
  jyp: {
    greeting: {
      text: '안녕하세요! 긴장하지 말고 편하게 시작해봐요. 자기소개 해주세요!',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'voice',
      duration: 30,
    },
    instruction_vocal: {
      text: '자유곡 1절 불러주세요. 호흡 편하게, 습관 빼고요!',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'sing',
      duration: 90,
    },
    instruction_dance: {
      text: '춤도 한 번 볼게요. 즐기면서 표정도 같이 살려주세요!',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'dance',
      duration: 60,
    },
    additional_instruction: {
      text: '이번엔 노래하면서 가볍게 스텝까지 같이 해볼래요? 라이브로요!',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'sing',
      duration: 40,
    },
    interview: {
      text: 'JYP에 지원한 이유가 뭐예요? 왜 아이돌이 되고 싶어요?',
      type: 'question',
      requiresResponse: true,
      responseType: 'voice',
      duration: 30,
    },
    react_answer: {
      text: '진솔하게 말해줘서 고마워요. 그 마음, 잊지 마세요.',
      type: 'reaction',
      requiresResponse: false,
      responseType: 'none',
    },
    react_performance: {
      text: '습관 조심!',
      type: 'reaction',
      requiresResponse: false,
      responseType: 'none',
    },
    deliberation: {
      text: '인성도 괜찮고 라이브 의지도 좋네요. 더 보고 싶어요.',
      type: 'comment',
      requiresResponse: false,
      responseType: 'none',
    },
  },
  sm: {
    greeting: {
      text: 'SM 오디션에 오신 걸 환영합니다. 자기소개 부탁드립니다.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'voice',
      duration: 30,
    },
    instruction_vocal: {
      text: '준비한 곡을 부르시면 됩니다. 시선 처리도 신경 써주세요.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'sing',
      duration: 90,
    },
    instruction_dance: {
      text: '준비된 안무 보여주세요. SM 무대처럼 공간을 장악해보세요.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'dance',
      duration: 60,
    },
    additional_instruction: {
      text: '같은 곡에서 고음 구간만 한 번 더 부탁드립니다.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'sing',
      duration: 25,
    },
    interview: {
      text: 'SM에서 어떤 아티스트가 되고 싶으세요?',
      type: 'question',
      requiresResponse: true,
      responseType: 'voice',
      duration: 30,
    },
    react_answer: {
      text: '구체적이라 좋습니다. SM이 만드는 방향과 잘 맞아요.',
      type: 'reaction',
      requiresResponse: false,
      responseType: 'none',
    },
    react_performance: {
      text: '시선 처리!',
      type: 'reaction',
      requiresResponse: false,
      responseType: 'none',
    },
    deliberation: {
      text: '아우라 자체는 괜찮습니다. 트레이닝으로 다듬을 여지가 있네요.',
      type: 'comment',
      requiresResponse: false,
      responseType: 'none',
    },
  },
  starship: {
    greeting: {
      text: '안녕하세요! 반갑습니다. 자기소개 부탁드려요.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'voice',
      duration: 30,
    },
    instruction_vocal: {
      text: '자신 있는 노래 들려주세요! 1절이면 충분해요.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'sing',
      duration: 90,
    },
    instruction_dance: {
      text: '편하게 춤 한 번 보여주세요. 기본기 위주로 볼게요.',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'dance',
      duration: 60,
    },
    additional_instruction: {
      text: '이번엔 살짝 다른 분위기로 같은 곡 후렴만 다시 해볼까요?',
      type: 'instruction',
      requiresResponse: true,
      responseType: 'action',
      actionType: 'sing',
      duration: 30,
    },
    interview: {
      text: '스타쉽에 지원한 이유가 뭔가요?',
      type: 'question',
      requiresResponse: true,
      responseType: 'voice',
      duration: 30,
    },
    react_answer: {
      text: '좋아요. 팬들 입장에서 어떻게 보일지도 같이 고민해주세요.',
      type: 'reaction',
      requiresResponse: false,
      responseType: 'none',
    },
    react_performance: {
      text: '기본기!',
      type: 'reaction',
      requiresResponse: false,
      responseType: 'none',
    },
    deliberation: {
      text: '균형 잡힌 친구네요. 팀에서 빛날 수 있을 것 같습니다.',
      type: 'comment',
      requiresResponse: false,
      responseType: 'none',
    },
  },
};

function pickQuestion(judgeId) {
  const pool = JUDGE_QUESTION_POOL[judgeId];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getPhaseFallback(agencyId, phase) {
  const agency = AGENCY_PHASE_FALLBACKS[agencyId] || AGENCY_PHASE_FALLBACKS.hybe;
  return agency[phase] || agency.greeting;
}

module.exports = {
  JUDGE_QUESTION_POOL,
  AGENCY_PHASE_FALLBACKS,
  pickQuestion,
  getPhaseFallback,
};
