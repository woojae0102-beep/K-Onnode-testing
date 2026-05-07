// STARSHIP 최종 결과 통합 API — STARSHIP 대중성 철학 기반 리치 결과 생성
//
// 동작:
// 1) 결정적 점수 집계 (avgScore, individualPass, starshipStylePassed, allCriteriaPass)
// 2) 4가지 결과 (pass / conditional / training_recommended / fail) 결정
// 3) Claude 호출 — STARSHIP 세련된 톤의 verdictInfo, judgeSummaries, debateHighlight,
//    starshipPhilosophyHighlight, 4주 루틴(주간 STARSHIP 포인트), starshipWouldSay
// 4) 결정적 플래그로 덮어써 JSON 일관성 보장

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const FINAL_SYSTEM_PROMPT = `당신은 STARSHIP 엔터테인먼트 오디션 최종 결과를 생성하는 시스템입니다.
3명의 심사위원 평가와 토론 결과를 바탕으로
STARSHIP 특유의 세련되고 현실적이며 대중 친화적인
최종 오디션 결과를 생성합니다.

STARSHIP은 단순히 "실력 좋은 연습생"보다:
- 대중이 좋아할 스타성
- 카메라 친화력
- 자연스러운 센터감
- 그룹 밸런스
- 오래 활동 가능한 안정감
을 더욱 중요하게 평가합니다.

STARSHIP은 "지금 당장 완벽한 사람"보다:
👉 "대중이 자연스럽게 끌리는 사람"
👉 "무대 밖에서도 스타 같은 사람"
👉 "시간이 갈수록 더 커질 사람"
을 선호합니다.

[STARSHIP 결과 유형 — 4가지]

PASS:
조건: 한승훈 63점 이상 + 박나리 60점 이상 + 최지수 62점 이상
      평균 62점 이상
      센터 존재감 18점 이상 + 카메라 흡입력 17점 이상 + 성장 가능성 20점 이상
메시지: "STARSHIP 엔터테인먼트 연습생 합격을 축하드립니다.
         당신은 대중이 자연스럽게 시선을 두게 되는 스타성을 가지고 있습니다.
         앞으로 STARSHIP에서 더 큰 가능성을 만들어가길 기대합니다."
배경색: #6C5CE7 (STARSHIP 퍼플)

CONDITIONAL:
조건: 평균 56~61점, 또는 1개 핵심 기준 미충족.
메시지: "가능성과 스타성은 충분히 보였습니다.
         조금 더 안정감과 완성도를 보완한다면
         더 강한 STARSHIP 스타일의 아티스트로 성장할 수 있습니다."
배경색: #A29BFE

TRAINING_RECOMMENDED:
조건: 평균 50~55점, 성장 가능성은 높지만 실전 안정감 부족.
메시지: "아직은 실전 무대 경험과 기본기 보완이 필요합니다.
         하지만 성장 가능성과 대중 친화력은 충분히 확인되었습니다.
         훈련 후 다시 도전해보길 권장합니다."
배경색: #636E72

FAIL:
조건: 평균 50점 미만, 또는 2개 이상 핵심 기준 미충족, 또는 STARSHIP 방향성과 큰 거리.
메시지: "이번에는 STARSHIP과 방향성이 맞지 않았습니다.
         하지만 당신만의 가능성과 매력은 분명 존재합니다.
         자신에게 맞는 방향을 계속 찾아가길 응원합니다."
배경색: #2D3436

[STARSHIP 특유의 결과 메시지 철학 — 모든 결과에서 반영]
- 지나치게 차갑지 않을 것.
- 현실적인 피드백 제공.
- "스타성" 중심 설명.
- 대중 관점 피드백 제공.
- 개선점은 세련되게 표현.
- 실제 연예계 관점 유지.

STARSHIP 스타일 표현 예시:
- "카메라가 자연스럽게 반응하는 타입입니다."
- "센터에 섰을 때 안정감이 있습니다."
- "대중 친화력이 강한 편입니다."
- "조금 더 힘을 빼면 훨씬 세련되어질 것 같아요."
- "무대보다 광고에서 먼저 눈에 띌 타입일 수도 있겠네요."
- "팀 안에서 더 강해질 스타일입니다."

[심사위원별 총평 작성 가이드]
한승훈: 대중성·센터·비주얼·연예인 느낌 중심. "대중성이 중요해요", "센터 느낌은 있어요".
        centerType은 IVE형/청순형/광고형/대중형/세련형 중. publicAppealLevel은 상/중/하 또는 한 줄.
        marketReaction은 광고형/팬덤형/대중형/SNS 화제형 중 한 줄로.
박나리: 카메라 친화력·표정 연결·퍼포먼스 안정감·아이돌 밸런스 중심. "카메라가 좋아할 얼굴이에요".
        cameraType은 광고형/화보형/센터형/무대형 중. performanceLine은 IVE형/MONSTA X형/감성형 중.
        cameraRetention은 카메라 유지력 한 줄 평가.
최지수: 장기 성장성·팀 적응력·꾸준함·장기 활동 적합성 중심. "꾸준히 성장할 타입 같아요".
        trainingType은 장기성장형/안정형/센터성장형 중. longTermProjection은 데뷔 가능성 & 성장 예측.
        teamSynergy는 팀 시너지 평가 한 줄.

[4주 루틴 작성 가이드 — STARSHIP 철학 기반]
"자연스러운 스타성 + 카메라 친화력 + 안정적인 성장" — 매 주 STARSHIP 포인트 한 줄씩 배치.
가장 부족한 항목부터 우선순위로.
주차별 표준 흐름:
  Week 1 — 가장 부족한 항목 ("카메라가 편하게 좋아하는 사람이 되어야 해요")
  Week 2 — 두 번째 취약 항목 ("센터는 억지로 만드는 게 아니에요")
  Week 3 — 표정 + 무대 + 카메라 통합 ("자연스러움이 가장 오래 갑니다")
  Week 4 — 실전 오디션 시뮬레이션 ("대중은 편하게 좋아할 수 있는 스타를 기억해요")
STARSHIP 포인트 풀:
  · "카메라가 좋아하는 사람이 있어요."
  · "센터는 억지로 만드는 게 아니에요."
  · "자연스러움이 가장 오래 갑니다."
  · "대중은 편하게 좋아할 수 있는 스타를 기억해요."
  · "팀 안에서 더 빛날 스타일이에요."
  · "무대보다 광고에서 먼저 뜰 수도 있겠네요."
  · "안정적으로 성장할 타입이 결국 살아남아요."

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 절대 금지]
{
  "finalVerdict": "pass | conditional | training_recommended | fail",
  "verdictInfo": {
    "title": "결과 제목 (이모지 포함)",
    "message": "STARSHIP 스타일 메시지 1~2문장",
    "color": "#6C5CE7 | #A29BFE | #636E72 | #2D3436",
    "starshipPhilosophy": "이 결과와 연결된 STARSHIP 철학 1줄",
    "nextStep": "다음 단계 안내 1줄"
  },
  "judgeSummaries": [
    {
      "name": "한승훈",
      "score": 점수,
      "verdict": "pass|conditional|training_recommended|fail",
      "scores": {
        "publicStarQuality": 0,
        "centerPresence": 0,
        "visualAtmosphere": 0,
        "growthStability": 0
      },
      "summary": "총평 3~4문장 — STARSHIP 대중성 & 스타성 관점",
      "strongPoints": ["잘한점1", "잘한점2"],
      "improvements": ["개선점1 + STARSHIP 스타일 방향", "개선점2 + 방법"],
      "closing": "한승훈 시그니처 한마디",
      "centerType": "IVE형 | 청순형 | 광고형 | 대중형 | 세련형",
      "marketReaction": "광고형 | 팬덤형 | 대중형 | SNS 화제형",
      "publicAppealLevel": "대중 호감도 등급 1줄"
    },
    {
      "name": "박나리",
      "score": 점수,
      "verdict": "pass|conditional|training_recommended|fail",
      "scores": {
        "cameraAttraction": 0,
        "expressionEyeContact": 0,
        "performanceStability": 0,
        "idolBalance": 0
      },
      "summary": "총평 3~4문장 — 카메라 & 퍼포먼스 관점",
      "strongPoints": ["잘한점1", "잘한점2"],
      "improvements": ["개선점1 + STARSHIP 퍼포먼스 방향", "개선점2 + 방법"],
      "closing": "박나리 시그니처 한마디",
      "cameraType": "광고형 | 화보형 | 센터형 | 무대형",
      "performanceLine": "IVE형 | MONSTA X형 | 감성형",
      "cameraRetention": "카메라 유지력 평가 1줄"
    },
    {
      "name": "최지수",
      "score": 점수,
      "verdict": "pass|conditional|training_recommended|fail",
      "scores": {
        "growthPotential": 0,
        "teamAdaptation": 0,
        "consistencyAttitude": 0,
        "longTermStarPower": 0
      },
      "summary": "총평 3~4문장 — 장기 성장 & 팀 적응 관점",
      "strongPoints": ["잘한점1", "잘한점2"],
      "improvements": ["개선점1 + STARSHIP 성장 방향", "개선점2 + 방법"],
      "closing": "최지수 시그니처 한마디",
      "trainingType": "장기성장형 | 안정형 | 센터성장형",
      "longTermProjection": "데뷔 가능성 & 성장 예측 1~2문장",
      "teamSynergy": "팀 시너지 평가 1줄"
    }
  ],
  "debateHighlight": "토론 핵심 갈등 1~2문장",
  "starshipPhilosophyHighlight": "STARSHIP 철학이 등장한 핵심 순간",
  "decisionMethod": "unanimous | majority | producer_override",
  "routine": [
    {
      "week": 1,
      "focus": "가장 부족한 항목",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "이번 주 목표",
      "starshipPoint": "이 주의 STARSHIP 포인트 한 줄"
    },
    {
      "week": 2,
      "focus": "두 번째 취약 항목",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "주간 목표",
      "starshipPoint": "포인트"
    },
    {
      "week": 3,
      "focus": "표정 + 무대 + 카메라 통합",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "주간 목표",
      "starshipPoint": "포인트"
    },
    {
      "week": 4,
      "focus": "실전 오디션 시뮬레이션",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "최종 재오디션 준비",
      "starshipPoint": "포인트"
    }
  ],
  "starshipSpecialAdvice": "STARSHIP 재도전을 위한 핵심 조언 (현실적이고 세련된 업계 관점)",
  "starshipWouldSay": "STARSHIP 프로듀서가 실제로 해줄 것 같은 조언 (세련되고 부드럽지만 현실적)",
  "nextAuditionTarget": "재도전 권장 시기 (예: 6개월 후)"
}`;

const FALLBACK_RICH = (computed) => ({
  finalVerdict: computed.finalVerdict,
  verdictInfo: buildFallbackVerdictInfo(computed.finalVerdict),
  judgeSummaries: [
    {
      name: '한승훈',
      score: computed.totals[0] || 0,
      verdict: computed.individualPass.seunghoon ? 'pass' : 'conditional',
      scores: {
        publicStarQuality: 0,
        centerPresence: 0,
        visualAtmosphere: 0,
        growthStability: 0,
      },
      summary:
        '대중 호감 가능성은 보였어요. 카메라가 거부감 없이 받아주는 얼굴이고, 광고나 매거진에서 먼저 반응이 올 타입이에요. 다만 센터에 섰을 때 무게감이 조금 부족해서 그 부분이 STARSHIP에선 보완 포인트예요.',
      strongPoints: ['거부감 없는 대중 친화형 비주얼', '광고에서 먼저 반응 올 타입의 청량감'],
      improvements: [
        '센터 무게감 — 도입에서 카메라 정면을 1초 더 잡아두는 시선 처리',
        '과한 표현 — 후렴에서 표정·동작이 약간 과해지는 순간을 의식적으로 절제',
      ],
      closing: '대중성은 있어요. 무게감만 더 잡으면 STARSHIP 라인에 어울려요.',
      centerType: 'IVE형',
      marketReaction: '광고형',
      publicAppealLevel: '상위권 — 대중 진입 장벽 낮음',
    },
    {
      name: '박나리',
      score: computed.totals[1] || 0,
      verdict: computed.individualPass.nari ? 'pass' : 'conditional',
      scores: {
        cameraAttraction: 0,
        expressionEyeContact: 0,
        performanceStability: 0,
        idolBalance: 0,
      },
      summary:
        '카메라가 후렴 진입에서 잠깐 따라갔어요. 그건 기술로 만들 수 없는 부분이에요. 다만 표정 연결이 도입과 마무리에서 흐트러져서, 한 곡 안 무드 전환을 좀 더 매끄럽게 만들면 카메라 유지 시간이 길어질 거예요.',
      strongPoints: ['후렴 진입 카메라 시선 자연스럽게 고정', '아이돌 무대에 어울리는 정돈된 동선'],
      improvements: [
        '표정 연결 — 도입·벌스·후렴·브릿지 각 구간의 표정을 미리 설계',
        '안무 끝 마무리 — 동작 끝나는 순간 표정이 풀리지 않도록 마지막 1초 잡기',
      ],
      closing: '카메라가 좋아할 얼굴이에요. 표정 연결만 잡으면 무대도 따라옵니다.',
      cameraType: '광고형',
      performanceLine: 'IVE형',
      cameraRetention: '구간별로 흔들림 — 후렴은 안정적, 도입/마무리는 약함',
    },
    {
      name: '최지수',
      score: computed.totals[2] || 0,
      verdict: computed.individualPass.jisoo ? 'pass' : 'conditional',
      scores: {
        growthPotential: 0,
        teamAdaptation: 0,
        consistencyAttitude: 0,
        longTermStarPower: 0,
      },
      summary:
        '성장 곡선이 좋아 보여요. 지금 점수보다 2년 뒤가 기대되는 타입이에요. 팀 안에서 자기 역할을 찾는 감각도 있어 보이고, 슬럼프를 견딜 수 있는 멘탈 베이스도 인터뷰에서 확인됐어요.',
      strongPoints: ['빠른 피드백 흡수력', '팀 안에서 균형을 맞추는 협업 감각'],
      improvements: [
        '체력 관리 — 후반부 호흡이 짧아지는 구간 케어, 매일 유산소 30분',
        '꾸준한 자기 모니터링 — 주 1회 셀프 영상 분석으로 성장 곡선 시각화',
      ],
      closing: '오래 갈 수 있는 타입이에요. 지금보다 2년 뒤가 진짜 시작이에요.',
      trainingType: '장기성장형',
      longTermProjection: '6~12개월 안 데뷔조 진입 가능, 2년 후 안정적 활동 기대',
      teamSynergy: '걸/보이그룹 모두 서브 라인에서 팀 밸런스 강화 역할',
    },
  ],
  debateHighlight:
    '한승훈은 "센터 무게감이 부족하다"며 conditional을, 박나리는 "카메라 친화력은 진짜"라며 pass를, 최지수는 "성장 곡선 좋다"며 conditional 동의로 정리되었습니다.',
  starshipPhilosophyHighlight:
    '"대중이 편하게 좋아할 수 있어야 해요. 센터는 억지로 만드는 게 아니에요." — 한승훈',
  decisionMethod:
    computed.unanimous ? 'unanimous' : computed.tiebreaker ? 'producer_override' : 'majority',
  routine: [
    {
      week: 1,
      focus: '센터 무게감 & 시선 처리',
      daily: [
        '카메라 정면 1초 잡아두기 훈련 15분',
        '거울 앞 도입~후렴 시선 설계 20분',
        'IVE 무대 영상 분석 노트 1편',
      ],
      goal: '센터에 섰을 때 자연스럽게 시선이 모이게 만들기',
      starshipPoint: '"센터는 억지로 만드는 게 아니에요."',
    },
    {
      week: 2,
      focus: '표정 연결 & 카메라 친화력',
      daily: [
        '구간별 표정 4종 설계 + 영상 점검 30분',
        '클로즈업 셀프 촬영 후 무드 분석',
        '마무리 1초 표정 잡기 드릴 10세트',
      ],
      goal: '한 곡 안 표정 흐름이 끊기지 않게 연결',
      starshipPoint: '"카메라가 좋아하는 사람이 있어요."',
    },
    {
      week: 3,
      focus: '표정 + 무대 + 카메라 통합',
      daily: [
        '풀곡 안무 + 표정 + 카메라 동선 통합 1회',
        '셀프 영상 분석 후 흐트러진 구간 재훈련',
        'STARSHIP 라인 안무 1구간 본인 식 흡수',
      ],
      goal: '무대 전체에서 자연스러운 무드 유지',
      starshipPoint: '"자연스러움이 가장 오래 갑니다."',
    },
    {
      week: 4,
      focus: '실전 오디션 시뮬레이션',
      daily: [
        '원테이크 풀곡 촬영 (NG 없이) 1회',
        '예상 인터뷰 셀프 답변 녹화 후 모니터링',
        '긴장 상황 재현 — 낯선 환경에서 1회',
      ],
      goal: '실전형 무대 체질 + 인터뷰 자연스러움',
      starshipPoint: '"대중은 편하게 좋아할 수 있는 스타를 기억해요."',
    },
  ],
  starshipSpecialAdvice:
    'STARSHIP은 단기 화제성보다 오래 가는 호감형 스타를 찾습니다. 너무 많이 보여주려 하지 말고, 카메라가 자연스럽게 따라올 한 컷을 만드는 데 집중하세요.',
  starshipWouldSay:
    '"광고 한 컷 뜨는 게 무대 한 번보다 큰 임팩트일 수 있어요. 본인이 어떤 그림에서 가장 자연스러운지 먼저 찾아봐요. 그게 STARSHIP에서 시작하는 방법이에요."',
  nextAuditionTarget: '6개월 후',
});

function buildFallbackVerdictInfo(verdict) {
  switch (verdict) {
    case 'pass':
      return {
        title: '🏆 STARSHIP 엔터테인먼트 연습생 합격',
        message:
          'STARSHIP 엔터테인먼트 연습생 합격을 축하드립니다. 당신은 대중이 자연스럽게 시선을 두게 되는 스타성을 가지고 있습니다.',
        color: '#6C5CE7',
        starshipPhilosophy: '대중이 편하게 좋아할 수 있어야 해요 — STARSHIP',
        nextStep: '계약 면담 일정과 트레이닝 오리엔테이션을 안내드리겠습니다.',
      };
    case 'conditional':
      return {
        title: '✅ 조건부 합격',
        message:
          '가능성과 스타성은 충분히 보였습니다. 조금 더 안정감과 완성도를 보완한다면 더 강한 STARSHIP 스타일의 아티스트로 성장할 수 있습니다.',
        color: '#A29BFE',
        starshipPhilosophy: '자연스러움이 가장 오래 갑니다 — STARSHIP',
        nextStep: '4~6개월 후 재오디션 권고드립니다.',
      };
    case 'training_recommended':
      return {
        title: '🎯 트레이닝 권장',
        message:
          '아직은 실전 무대 경험과 기본기 보완이 필요합니다. 하지만 성장 가능성과 대중 친화력은 충분히 확인되었습니다. 훈련 후 다시 도전해보길 권장합니다.',
        color: '#636E72',
        starshipPhilosophy: '안정적으로 성장할 타입이 결국 살아남아요 — STARSHIP',
        nextStep: '6~12개월 트레이닝 후 재오디션 권고드립니다.',
      };
    default:
      return {
        title: '🌙 불합격 — 방향성 불일치',
        message:
          '이번에는 STARSHIP과 방향성이 맞지 않았습니다. 하지만 당신만의 가능성과 매력은 분명 존재합니다. 자신에게 맞는 방향을 계속 찾아가길 응원합니다.',
        color: '#2D3436',
        starshipPhilosophy: '본인에게 맞는 무대가 따로 있어요 — STARSHIP',
        nextStep: '심사위원들의 피드백을 참고하여 다른 길도 함께 고려해보세요.',
      };
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function tryParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// 결정적 합격 기준 검증
// 한승훈: 종합 63점 이상 + 센터 존재감 18점 이상
// 박나리: 종합 60점 이상 + 카메라 흡입력 17점 이상
// 최지수: 종합 62점 이상 + 성장 가능성 20점 이상
// 평균: 62점 이상
function computeDeterministic(judgeResults, debateResult) {
  const totals = judgeResults.map((r) => Number(r?.scores?.total ?? 0));
  const avgScore = Math.round(totals.reduce((a, b) => a + b, 0) / 3);

  const centerPresence = Number(judgeResults[0]?.scores?.centerPresence ?? 0);
  const cameraAttraction = Number(judgeResults[1]?.scores?.cameraAttraction ?? 0);
  const growthPotential = Number(judgeResults[2]?.scores?.growthPotential ?? 0);

  const seunghoonPass = totals[0] >= 63 && centerPresence >= 18;
  const naraePass = totals[1] >= 60 && cameraAttraction >= 17;
  const jisooPass = totals[2] >= 62 && growthPotential >= 20;
  const allCriteriaPass = seunghoonPass && naraePass && jisooPass;
  const starshipStylePassed = centerPresence >= 18 && cameraAttraction >= 17 && growthPotential >= 20;

  const debateVerdict = debateResult?.finalVerdict;

  let finalVerdict;
  if (debateVerdict && ['pass', 'conditional', 'training_recommended', 'fail'].includes(debateVerdict)) {
    finalVerdict = debateVerdict;
    // pass인데 점수 미달이면 conditional로 강등
    if (finalVerdict === 'pass' && (!allCriteriaPass || avgScore < 62 || !starshipStylePassed)) {
      finalVerdict = 'conditional';
    }
    // 평균 50 미만은 fail로 강등
    if (avgScore < 50) {
      finalVerdict = 'fail';
    } else if (avgScore < 56 && finalVerdict !== 'fail') {
      // 평균 50~55는 training_recommended로 강등 (단, 이미 fail이면 그대로)
      finalVerdict = 'training_recommended';
    }
  } else {
    // 폴백: 점수 기반
    if (allCriteriaPass && avgScore >= 62 && starshipStylePassed) finalVerdict = 'pass';
    else if (avgScore >= 56) finalVerdict = 'conditional';
    else if (avgScore >= 50) finalVerdict = 'training_recommended';
    else finalVerdict = 'fail';
  }

  const tiebreaker = !!debateResult?.debateScript?.tiebreakerUsed;
  const unanimous = !!debateResult?.unanimousVerdict;

  return {
    totals,
    avgScore,
    individualPass: { seunghoon: seunghoonPass, nari: naraePass, jisoo: jisooPass },
    allCriteriaPass,
    starshipStylePassed,
    finalVerdict,
    unanimous,
    tiebreaker,
  };
}

async function generateRichResult({ judgeResults, debateResult, computed, language }) {
  if (!ANTHROPIC_API_KEY) return FALLBACK_RICH(computed);

  const sh = judgeResults[0]?.scores || {};
  const nr = judgeResults[1]?.scores || {};
  const js = judgeResults[2]?.scores || {};

  const userPrompt = `STARSHIP 엔터테인먼트 오디션 결과 데이터입니다:

[심사위원 점수]
한승훈 (메인 프로듀서 / 스타성 & 대중성): ${sh.total ?? 0}점
  - 대중 스타성: ${sh.publicStarQuality ?? 0}/35
  - 센터 존재감: ${sh.centerPresence ?? 0}/25
  - 비주얼 & 분위기: ${sh.visualAtmosphere ?? 0}/25
  - 안정 성장성: ${sh.growthStability ?? 0}/15
  센터 타입: ${judgeResults[0]?.centerType || '미정'} / 시장 반응: ${judgeResults[0]?.marketReaction || '평가 중'}
  자체 verdict: ${judgeResults[0]?.verdict || '미정'}

박나리 (퍼포먼스 & 카메라 디렉터): ${nr.total ?? 0}점
  - 카메라 흡입력: ${nr.cameraAttraction ?? 0}/30
  - 표정 & 눈빛: ${nr.expressionEyeContact ?? 0}/25
  - 퍼포먼스 안정감: ${nr.performanceStability ?? 0}/25
  - 아이돌 밸런스: ${nr.idolBalance ?? 0}/20
  카메라 타입: ${judgeResults[1]?.cameraType || '미정'} / 퍼포먼스 라인: ${judgeResults[1]?.performanceLine || '미정'}
  자체 verdict: ${judgeResults[1]?.verdict || '미정'}

최지수 (트레이닝 & 장기 성장 디렉터): ${js.total ?? 0}점
  - 성장 가능성: ${js.growthPotential ?? 0}/35
  - 팀 적응력: ${js.teamAdaptation ?? 0}/25
  - 꾸준함 & 태도: ${js.consistencyAttitude ?? 0}/25
  - 장기 스타성 유지력: ${js.longTermStarPower ?? 0}/15
  트레이닝 타입: ${judgeResults[2]?.trainingType || '미정'} / 팀 적합성: ${judgeResults[2]?.teamFit || '미정'}
  자체 verdict: ${judgeResults[2]?.verdict || '미정'}

[결정적 집계 — 이 값을 그대로 사용]
평균 점수: ${computed.avgScore}점
한승훈 합격 기준 통과: ${computed.individualPass.seunghoon ? 'YES' : 'NO'}
박나리 합격 기준 통과: ${computed.individualPass.nari ? 'YES' : 'NO'}
최지수 합격 기준 통과: ${computed.individualPass.jisoo ? 'YES' : 'NO'}
STARSHIP 스타일 통과 (센터 18+ / 카메라 17+ / 성장 20+): ${computed.starshipStylePassed ? 'YES' : 'NO'}
모든 기준 통과: ${computed.allCriteriaPass ? 'YES' : 'NO'}
최종 결정: ${computed.finalVerdict}
결정 방식: ${computed.unanimous ? 'unanimous' : computed.tiebreaker ? 'producer_override (한승훈)' : 'majority'}

[토론 결과 요약]
STARSHIP 핵심 이유: ${debateResult?.starshipCoreReason || '(없음)'}
시장 평가: ${debateResult?.marketEvaluation ? JSON.stringify(debateResult.marketEvaluation) : '(없음)'}
STARSHIP 철학 모먼트: "${debateResult?.debateScript?.starshipPhilosophyMoment || '(없음)'}"
한승훈 최종 결정 사용: ${debateResult?.debateScript?.tiebreakerUsed ? 'YES' : 'NO'}

[지시]
finalVerdict는 반드시 "${computed.finalVerdict}"로 출력하세요.
decisionMethod는 "${computed.unanimous ? 'unanimous' : computed.tiebreaker ? 'producer_override' : 'majority'}"로 출력하세요.
judgeSummaries[i].score는 위 점수를 그대로, scores도 위 세부 점수 그대로 사용하세요.
응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}

지정된 JSON 형식으로만 출력. 마크다운/코드펜스 금지.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2400,
        system: FINAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`CLAUDE_FAIL_${res.status}`);
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = tryParseJson(text);
    if (!parsed || !Array.isArray(parsed.routine) || !Array.isArray(parsed.judgeSummaries)) {
      return FALLBACK_RICH(computed);
    }
    return parsed;
  } catch {
    return FALLBACK_RICH(computed);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { judgeResults = [], debateResult = {}, language = 'ko' } = body || {};

  if (!Array.isArray(judgeResults) || judgeResults.length !== 3) {
    return res
      .status(400)
      .json({ error: 'judgeResults must be an array of 3 judge evaluations [한승훈, 박나리, 최지수]' });
  }

  // 1) 결정적 집계
  const computed = computeDeterministic(judgeResults, debateResult);

  // 2) Claude 호출 — 풍부한 결과 텍스트
  const rich = await generateRichResult({ judgeResults, debateResult, computed, language });

  // 3) 결정적 플래그 강제 덮어쓰기
  const finalVerdict = computed.finalVerdict;
  const verdictInfo = rich.verdictInfo || buildFallbackVerdictInfo(finalVerdict);

  const judgeNames = ['한승훈', '박나리', '최지수'];
  const judgeIds = ['starship-seunghoon', 'starship-nari', 'starship-jisoo'];
  const judgeSummaries = judgeResults.map((r, idx) => {
    const llmSummary = Array.isArray(rich.judgeSummaries) ? rich.judgeSummaries[idx] || {} : {};
    return {
      judgeId: r.judgeId || judgeIds[idx],
      name: r.name || judgeNames[idx],
      score: Number(r?.scores?.total ?? 0),
      verdict: r.verdict || llmSummary.verdict || 'conditional',
      scores: r.scores || llmSummary.scores || {},
      summary: llmSummary.summary || '',
      strongPoints: llmSummary.strongPoints || r.strongPoints || [],
      improvements: llmSummary.improvements || r.improvements || [],
      closing: llmSummary.closing || r.closing || '',
      // 한승훈 고유
      centerType: idx === 0 ? llmSummary.centerType || r.centerType || null : undefined,
      marketReaction: idx === 0 ? llmSummary.marketReaction || r.marketReaction || null : undefined,
      publicAppealLevel: idx === 0 ? llmSummary.publicAppealLevel || r.publicAppealLevel || null : undefined,
      // 박나리 고유
      cameraType: idx === 1 ? llmSummary.cameraType || r.cameraType || null : undefined,
      performanceLine: idx === 1 ? llmSummary.performanceLine || r.performanceLine || null : undefined,
      cameraRetention: idx === 1 ? llmSummary.cameraRetention || r.cameraRetention || null : undefined,
      // 최지수 고유
      trainingType: idx === 2 ? llmSummary.trainingType || r.trainingType || null : undefined,
      longTermProjection: idx === 2 ? llmSummary.longTermProjection || r.longTermProjection || null : undefined,
      teamSynergy: idx === 2 ? llmSummary.teamSynergy || r.teamFit || r.teamSynergy || null : undefined,
    };
  });

  const decisionMethod = computed.unanimous
    ? 'unanimous'
    : computed.tiebreaker
      ? 'producer_override'
      : 'majority';

  return res.status(200).json({
    finalVerdict,
    avgScore: computed.avgScore,
    starshipStylePassed: computed.starshipStylePassed,
    allCriteriaPass: computed.allCriteriaPass,
    individualPass: computed.individualPass,
    judgeResults,
    debateResult,
    verdictInfo,
    judgeSummaries,
    debateHighlight: rich.debateHighlight || debateResult?.starshipCoreReason || '',
    starshipPhilosophyHighlight:
      rich.starshipPhilosophyHighlight || debateResult?.debateScript?.starshipPhilosophyMoment || '',
    marketEvaluation: debateResult?.marketEvaluation || null,
    finalVotes: {
      한승훈: judgeResults[0]?.verdict || 'conditional',
      박나리: judgeResults[1]?.verdict || 'conditional',
      최지수: judgeResults[2]?.verdict || 'conditional',
    },
    decisionMethod,
    routine: rich.routine || FALLBACK_RICH(computed).routine,
    starshipSpecialAdvice: rich.starshipSpecialAdvice || '',
    starshipWouldSay: rich.starshipWouldSay || '',
    nextAuditionTarget: rich.nextAuditionTarget || '6개월 후',
    source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
  });
};
