// YG 최종 결과 통합 API — YG 스타성 철학 기반 리치 결과 생성
//
// 동작:
// 1) 결정적 점수 집계 (avgScore, individualPass, starPotentialPassed, characterPotentialPassed, marketabilityPassed)
// 2) 4가지 결과 (pass / hold / training_recommended / fail) 결정 — 토론 결과 우선, 점수 기준으로 강등 가능
// 3) Claude 호출 — YG 시장 중심 톤의 verdictInfo, judgeSummaries(총평·강·약점), debateHighlight,
//    ygPhilosophyHighlight, 4주 루틴(주간 YG 철학 포인트), yangTaejunWouldSay
// 4) Claude 응답을 결정적 플래그로 덮어써 JSON 일관성 보장

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

const FINAL_SYSTEM_PROMPT = `당신은 YG 엔터테인먼트 오디션 최종 결과를 생성하는 시스템입니다.
3명의 심사위원 평가와 토론 결과를 바탕으로
YG 특유의 냉정하고 현실적이며 스타성을 중심으로 한
최종 오디션 결과를 생성합니다.

YG는 단순히 "잘하는 사람"을 뽑지 않습니다.

YG 핵심 철학:
- 기술보다 분위기
- 안정감보다 개성
- 완벽함보다 기억남
- 모범생보다 스타성
- 실수해도 시선을 뺏는 사람

YG 결과 시스템은 반드시 아래 감성을 반영해야 합니다:
- 냉정함
- 시장성 중심 판단
- 팬덤 가능성 분석
- "될 놈인가?"에 대한 평가
- 위험하지만 끌리는 매력 인정

[YG 결과 유형 — 4가지]

PASS:
조건: 양태준 65점 이상 + 이나래 60점 이상 + Marcus 62점 이상
      스타성/캐릭터 점수 20점 이상
      3명 평균 63점 이상
메시지: "YG는 완벽한 사람보다 무대에서 사람을 끌어당기는 사람을 찾습니다.
         당신에게는 그 가능성이 보였습니다."
배경색: #111111 (YG 블랙)

HOLD:
조건: 평균 58~62점, 스타성은 있으나 확신 부족, 시장성 재평가 필요.
메시지: "가능성은 보였습니다.
         하지만 아직은 확신이 부족합니다.
         조금 더 자기 색을 만들어보세요."
배경색: #2F3640

TRAINING_RECOMMENDED:
조건: 개성/스타성 존재 + 기본기 부족 + 발전 가능성 존재.
메시지: "지금 당장은 부족하지만,
         YG가 좋아할 만한 색은 분명히 있습니다.
         기본기를 만든 뒤 다시 보여주세요."
배경색: #57606F

FAIL:
조건: 평균 58점 미만, 개성 부족, YG 방향성과 부적합.
메시지: "잘하는 사람은 많습니다.
         하지만 YG는 기억에 남는 사람을 찾습니다.
         이번에는 함께하기 어렵습니다."
배경색: #000000

[YG 특유의 결과 메시지 철학 — 모든 결과에서 반영]
- 따뜻한 위로보다 현실적 피드백 중심.
- 시장성·스타성·팬덤 가능성 분석 포함.
- "왜 기억에 남지 않았는가" 또는 "왜 끌렸는가"를 반드시 설명.
- 단순 비난 금지. 방향성·캐릭터·자기 색 관점에서 피드백 제공.
- PASS여도 칭찬 과도하게 금지 (YG는 쉽게 만족하지 않음).
- FAIL이어도 차갑게 끝내지 않음 — "방향이 다르다" 중심.
- HOLD 많이 사용 — YG 특유의 애매한 가능성 판단.
- 스타성 발견 시 실력 부족 일부 허용 가능.
- 지나치게 모범생 스타일은 감점 요소 가능.

[심사위원별 총평 작성 가이드]
양태준: 스타성·존재감·시장성·팬흡입력 중심. "느낌 있네", "근데 너무 안전해", "쟤는 무대 체질이야".
        ygCharacterType은 GD형/Jennie형/Bobby형/CL형/MINO형 중.
이나래: 무대 장악력·표정·카메라 흡입력 중심. "사람이 보여야 돼요", "춤 말고 무대 하세요".
        ygPerformanceLine은 BLACKPINK형/iKON형/TREASURE형 중.
        cameraAttraction은 "상/중/하" 중.
Marcus Kim: 톤·글로벌 시장성·힙합 바이브·캐릭터 브랜딩 중심. 한영 혼용.
        "That tone is dangerous", "캐릭터가 안 보여", "미국에선 안 먹혀".
        globalMarketFit은 미국/일본/동남아/유럽 4개 시장에 대한 한 줄 평가.

[4주 루틴 작성 가이드 — YG 철학 기반]
"잘하는 연습생"이 아니라 "기억나는 아티스트" 만들기 — 매 주 YG 어록 한 줄 포인트로 배치.
가장 부족한 항목부터 우선순위로.
주차별 표준 흐름:
  Week 1 — 자기 색 찾기 ("개성 없는 완벽함은 의미 없다")
  Week 2 — 무대 장악력 강화 ("카메라가 좋아하는 사람이 있다")
  Week 3 — 캐릭터 & 바이브 구축 ("톤은 못 만든다. 근데 자기 스타일은 만들 수 있다")
  Week 4 — 재오디션 준비 ("무대 올라가면 사람이 달라져야 한다")
YG 어록 풀 (랜덤 활용 가능):
  · "YG는 모범생 뽑는 회사 아니에요."
  · "잘하는 애는 많아. 근데 스타는 별로 없어."
  · "쟤는 무대 체질이야."
  · "연습으로 안 되는 게 있거든."
  · "위험한데... 끌리네."
  · "팬 붙겠다."
  · "카메라가 좋아하는 얼굴이 있어."

[응답 형식 — 반드시 JSON으로만, 마크다운/코드펜스 절대 금지]
{
  "finalVerdict": "pass | hold | training_recommended | fail",
  "verdictInfo": {
    "title": "결과 제목 (이모지 포함)",
    "message": "YG 철학이 담긴 결과 메시지 1~2문장",
    "color": "#111111 | #2F3640 | #57606F | #000000",
    "ygPhilosophy": "이 결과와 연결된 YG 철학 1줄",
    "nextStep": "다음 단계 안내 1줄"
  },
  "judgeSummaries": [
    {
      "name": "양태준",
      "score": 점수,
      "verdict": "pass|hold|training_recommended|fail",
      "scores": {
        "starPresence": 0,
        "individualityCharacter": 0,
        "grooveVibe": 0,
        "marketability": 0
      },
      "summary": "총평 3~4문장 — YG 스타성 관점",
      "strongPoints": ["잘한점1", "잘한점2"],
      "improvements": ["개선점1 + YG 스타일 방향", "개선점2 + 방법"],
      "closing": "양태준 시그니처 한마디",
      "ygCharacterType": "GD형 | Jennie형 | Bobby형 | CL형 | MINO형",
      "fanAttraction": "팬덤 흡입력 분석 1~2문장",
      "riskFactor": "위험 요소 또는 스타 가능성 1문장"
    },
    {
      "name": "이나래",
      "score": 점수,
      "verdict": "pass|hold|training_recommended|fail",
      "scores": {
        "stagePresence": 0,
        "facialExpressionEyeContact": 0,
        "styleDigest": 0,
        "confidencePerformance": 0
      },
      "summary": "총평 3~4문장 — 퍼포먼스 관점",
      "strongPoints": ["잘한점1", "잘한점2"],
      "improvements": ["개선점1 + YG 무대 스타일 개선법", "개선점2 + 방법"],
      "closing": "이나래 시그니처 한마디",
      "cameraAttraction": "상 | 중 | 하",
      "ygPerformanceLine": "BLACKPINK형 | iKON형 | TREASURE형",
      "performanceRisk": "퍼포먼스 위험 요소 1문장"
    },
    {
      "name": "Marcus Kim",
      "score": 점수,
      "verdict": "pass|hold|training_recommended|fail",
      "scores": {
        "toneVoice": 0,
        "globalSense": 0,
        "hiphopRnbVibe": 0,
        "brandingCharacter": 0
      },
      "summary": "총평 3~4문장 — 글로벌 시장 관점 (한영 혼용 자연스럽게)",
      "strongPoints": ["잘한점1", "잘한점2"],
      "improvements": ["개선점1 + 글로벌 시장 기준 개선", "개선점2 + 방법"],
      "closing": "Marcus 시그니처 한마디",
      "globalMarketFit": {
        "us": "미국 시장 적합도 한 줄",
        "japan": "일본 시장 적합도 한 줄",
        "seAsia": "동남아 시장 적합도 한 줄",
        "europe": "유럽 시장 적합도 한 줄"
      },
      "viralPotential": "글로벌 바이럴 가능성 1~2문장",
      "globalRisk": "해외 시장 리스크 1문장"
    }
  ],
  "debateHighlight": "토론 핵심 갈등 1~2문장",
  "ygPhilosophyHighlight": "YG 철학이 등장한 핵심 순간",
  "decisionMethod": "unanimous | majority | taejun_final",
  "routine": [
    {
      "week": 1,
      "focus": "자기 색 구축",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "주간 목표",
      "ygPhilosophyPoint": "YG 어록 한 줄"
    },
    {
      "week": 2,
      "focus": "무대 장악력",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "주간 목표",
      "ygPhilosophyPoint": "어록"
    },
    {
      "week": 3,
      "focus": "톤 & 바이브",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "주간 목표",
      "ygPhilosophyPoint": "어록"
    },
    {
      "week": 4,
      "focus": "실전 오디션",
      "daily": ["활동1", "활동2", "활동3"],
      "goal": "주간 목표",
      "ygPhilosophyPoint": "어록"
    }
  ],
  "ygSpecialAdvice": "YG 재도전을 위한 핵심 조언",
  "yangTaejunWouldSay": "양태준이 마지막으로 할 법한 말 (짧고 단호)",
  "nextAuditionTarget": "재오디션 권장 시기 (예: 6개월 후)"
}`;

const FALLBACK_RICH = (computed) => ({
  finalVerdict: computed.finalVerdict,
  verdictInfo: buildFallbackVerdictInfo(computed.finalVerdict),
  judgeSummaries: [
    {
      name: '양태준',
      score: computed.totals[0] || 0,
      verdict: computed.individualPass.taejun ? 'pass' : 'hold',
      scores: {
        starPresence: 0,
        individualityCharacter: 0,
        grooveVibe: 0,
        marketability: 0,
      },
      summary:
        '느낌은 있어. 근데 한 곡 안에 임팩트가 한 번뿐이야. YG는 매 구간 시선을 뺏는 사람이 살아남는 곳이야. 너무 안전한 게 걸려.',
      strongPoints: ['후렴 진입의 표정 변화', '특정 구간 카메라 흡입력'],
      improvements: [
        '안정감보다 위험한 매력 — 무대에서 자기만의 모먼트를 구간별로 3번 이상 만들어내야 함',
        '캐릭터 한 줄 정의 — "쟤는 이런 애" 한 문장으로 설명되는 색깔 만들기',
      ],
      closing: '느낌 있네. 근데 너무 안전해.',
      ygCharacterType: 'MINO형',
      fanAttraction: '특정 타입 팬덤은 빠르게 형성될 수 있음 — 다만 대중성으로 확장은 시간 필요.',
      riskFactor: '안전한 선택지로만 가는 경향 — YG에서는 감점 요소.',
    },
    {
      name: '이나래',
      score: computed.totals[1] || 0,
      verdict: computed.individualPass.narae ? 'pass' : 'hold',
      scores: {
        stagePresence: 0,
        facialExpressionEyeContact: 0,
        styleDigest: 0,
        confidencePerformance: 0,
      },
      summary:
        '카메라가 잠깐 멈추는 순간이 있었어요. 그건 기술로 안 되는 거예요. 근데 그 외 구간은 사람이 안 보여요. 무대 전체를 가져오는 연습이 필요해요.',
      strongPoints: ['후렴 진입에서 카메라 시선 고정', '눈빛 변화의 의도가 보임'],
      improvements: [
        '구간별 시선 처리 — 도입·벌스·후렴·브릿지 각각 다른 표정과 눈빛 설계',
        '안무보다 무대 — 동작 정확도 신경쓰지 말고 "내가 맞다"의 자신감으로 공간을 가져와야 함',
      ],
      closing: '잠깐... 지금 카메라 느낌 있었어요. 근데 거기서 멈춰요.',
      cameraAttraction: '중',
      ygPerformanceLine: 'BLACKPINK형',
      performanceRisk: '특정 구간 외에는 무대 장악력이 빠르게 떨어짐.',
    },
    {
      name: 'Marcus Kim',
      score: computed.totals[2] || 0,
      verdict: computed.individualPass.marcus ? 'pass' : 'hold',
      scores: {
        toneVoice: 0,
        globalSense: 0,
        hiphopRnbVibe: 0,
        brandingCharacter: 0,
      },
      summary:
        'That tone is interesting. 톤 자체는 살아있어. 근데 캐릭터 브랜딩이 약해. 미국 시장 기준으로는 "이 사람은 누구야?"가 한 줄로 안 와. 톤만으로 끌고 가기엔 IP가 부족해.',
      strongPoints: ['타고난 음색의 색깔', '특정 구간 그루브 감각'],
      improvements: [
        '캐릭터 브랜딩 — 한 문장으로 자기를 설명하는 키워드 3개 만들기 (글로벌 시장 기준)',
        '글로벌 트렌드 흡수 — 빌보드/스포티파이 흐름을 본인 식으로 재해석한 커버 영상 주 1회',
      ],
      closing: 'Tone is real. Character is not. Yet.',
      globalMarketFit: {
        us: '톤은 통할 가능성 있음. 캐릭터 빌딩 후 재평가 필요.',
        japan: '비주얼·스타일 정돈하면 가장 빠르게 반응 올 시장.',
        seAsia: '바이브 자체는 통함. 콘텐츠 양 늘리면 화제성 가능.',
        europe: '아직 약함 — 글로벌 IP가 명확해진 후 도전 권장.',
      },
      viralPotential: '톤 한 컷 짧은 영상 기준 바이럴 가능성은 있음. 풀곡 단위로는 약함.',
      globalRisk: '캐릭터 IP가 약해 글로벌 팬덤 형성 속도가 느릴 수 있음.',
    },
  ],
  debateHighlight:
    '이나래는 "카메라 흡입력은 진짜"라며 트레이닝 추천을, Marcus는 "톤은 있는데 캐릭터가 없다"며 hold를 주장. 양태준이 "위험한데 끌리는 케이스"라며 정리.',
  ygPhilosophyHighlight: '"YG는 모범생 뽑는 회사 아니에요. 잘하는 애는 많아. 근데 스타는 별로 없어." — 양태준',
  decisionMethod:
    computed.unanimous ? 'unanimous' : computed.tiebreaker ? 'taejun_final' : 'majority',
  routine: [
    {
      week: 1,
      focus: '자기 색 찾기',
      daily: [
        '자유 스타일 영상 1일 1컷 촬영',
        '좋아하는 아티스트 1명 분석 노트',
        '거울 없이 프리스타일 30분',
      ],
      goal: '남 흉내 제거 — "쟤는 이런 애" 한 줄 정의',
      ygPhilosophyPoint: '"개성 없는 완벽함은 의미 없다."',
    },
    {
      week: 2,
      focus: '무대 장악력 강화',
      daily: [
        '카메라 아이컨택 훈련 20분',
        '구간별 표정 변화 연습',
        '무반주 퍼포먼스 1회',
      ],
      goal: '카메라 끌어당기기 — 매 구간 시선 모먼트 만들기',
      ygPhilosophyPoint: '"카메라가 좋아하는 사람이 있다."',
    },
    {
      week: 3,
      focus: '캐릭터 & 바이브 구축',
      daily: [
        '음색 연구 — 본인 톤 녹음 후 비교 분석',
        '힙합/R&B 리듬 트레이닝 30분',
        '글로벌 트렌드 1곡 본인식 재해석 커버',
      ],
      goal: '한 번 들으면 기억되는 톤 만들기',
      ygPhilosophyPoint: '"톤은 못 만든다. 근데 자기 스타일은 만들 수 있다."',
    },
    {
      week: 4,
      focus: '재오디션 준비',
      daily: [
        '원테이크 촬영 — NG 없이 1일 1회',
        '실제 오디션 시뮬레이션 (긴장 상황 재현)',
        '예상 질문 셀프 인터뷰 녹화',
      ],
      goal: '실전형 무대 체질 만들기',
      ygPhilosophyPoint: '"무대 올라가면 사람이 달라져야 한다."',
    },
  ],
  ygSpecialAdvice:
    '잘하는 사람보다 기억나는 사람이 되어야 합니다. 안전한 선택지를 버리고, 자기만의 위험한 매력을 한 줄로 설명할 수 있을 때 다시 오세요.',
  yangTaejunWouldSay: '"...느낌은 있어. 근데 안전해. 다음엔 위험해져서 와."',
  nextAuditionTarget: '6개월 후',
});

function buildFallbackVerdictInfo(verdict) {
  switch (verdict) {
    case 'pass':
      return {
        title: '🏆 YG ENTERTAINMENT — PASS',
        message:
          'YG는 완벽한 사람보다 무대에서 사람을 끌어당기는 사람을 찾습니다. 당신에게는 그 가능성이 보였습니다.',
        color: '#111111',
        ygPhilosophy: '잘하는 애는 많아. 근데 스타는 별로 없어.',
        nextStep: '계약 면담 일정과 트레이닝 오리엔테이션을 안내드리겠습니다.',
      };
    case 'hold':
      return {
        title: '⏸ HOLD — 재평가 보류',
        message:
          '가능성은 보였습니다. 하지만 아직은 확신이 부족합니다. 조금 더 자기 색을 만들어보세요.',
        color: '#2F3640',
        ygPhilosophy: '위험한데... 끌리네.',
        nextStep: '3~6개월 후 재오디션 권고드립니다.',
      };
    case 'training_recommended':
      return {
        title: '🎯 TRAINING RECOMMENDED',
        message:
          '지금 당장은 부족하지만, YG가 좋아할 만한 색은 분명히 있습니다. 기본기를 만든 뒤 다시 보여주세요.',
        color: '#57606F',
        ygPhilosophy: '연습으로 안 되는 게 있거든. 근데 연습으로 되는 것도 있어.',
        nextStep: '6개월~1년 후 재오디션 권고드립니다.',
      };
    default:
      return {
        title: '✖ FAIL — 방향성 불일치',
        message:
          '잘하는 사람은 많습니다. 하지만 YG는 기억에 남는 사람을 찾습니다. 이번에는 함께하기 어렵습니다.',
        color: '#000000',
        ygPhilosophy: 'YG는 모범생 뽑는 회사 아니에요.',
        nextStep: '심사위원들의 피드백을 참고하여 자기 색을 만든 뒤 다시 도전하세요.',
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
// 양태준: 종합 65점 이상 + 스타성 20점 이상
// 이나래: 종합 60점 이상 + 무대 장악력 18점 이상
// Marcus: 종합 62점 이상 + 톤/캐릭터 20점 이상 (toneVoice 또는 character 중 하나라도 20점 이상)
// 평균: 63점 이상 → pass / 58~62 → hold / <58 → fail (혹은 training_recommended)
function computeDeterministic(judgeResults, debateResult) {
  const totals = judgeResults.map((r) => Number(r?.scores?.total ?? 0));
  const avgScore = Math.round(totals.reduce((a, b) => a + b, 0) / 3);

  const starPresence = Number(judgeResults[0]?.scores?.starPresence ?? 0);
  const stageControl = Number(judgeResults[1]?.scores?.stageControl ?? 0);
  const toneVoice = Number(judgeResults[2]?.scores?.toneVoice ?? 0);
  const character = Number(judgeResults[2]?.scores?.character ?? 0);

  const taejunPass = totals[0] >= 65 && starPresence >= 20;
  const naraePass = totals[1] >= 60 && stageControl >= 18;
  const marcusPass = totals[2] >= 62 && (toneVoice >= 20 || character >= 20);
  const allCriteriaPass = taejunPass && naraePass && marcusPass;

  const starPotentialPassed = starPresence >= 20;
  const characterPotentialPassed = character >= 20;
  const marketabilityPassed = totals[0] >= 60 || character >= 20;

  const debateVerdict = debateResult?.finalVerdict;

  let finalVerdict;
  if (debateVerdict && ['pass', 'hold', 'training_recommended', 'fail'].includes(debateVerdict)) {
    finalVerdict = debateVerdict;
    // pass인데 점수 기준 미달이면 hold로 강등
    if (finalVerdict === 'pass' && (!allCriteriaPass || avgScore < 63)) {
      finalVerdict = 'hold';
    }
    // 평균 58 미만은 fail 또는 training_recommended로 강등
    if (avgScore < 58) {
      // 스타성·캐릭터 중 하나라도 살아있으면 training_recommended, 아니면 fail
      if (starPotentialPassed || characterPotentialPassed) finalVerdict = 'training_recommended';
      else finalVerdict = 'fail';
    }
  } else {
    // 폴백: 점수 기반
    if (allCriteriaPass && avgScore >= 63) finalVerdict = 'pass';
    else if (avgScore >= 58) finalVerdict = 'hold';
    else if (starPotentialPassed || characterPotentialPassed) finalVerdict = 'training_recommended';
    else finalVerdict = 'fail';
  }

  const tiebreaker = !!debateResult?.debateScript?.tiebreakerUsed;
  const unanimous = !!debateResult?.unanimousVerdict;

  return {
    totals,
    avgScore,
    individualPass: { taejun: taejunPass, narae: naraePass, marcus: marcusPass },
    allCriteriaPass,
    starPotentialPassed,
    characterPotentialPassed,
    marketabilityPassed,
    finalVerdict,
    unanimous,
    tiebreaker,
  };
}

async function generateRichResult({ judgeResults, debateResult, computed, language }) {
  if (!ANTHROPIC_API_KEY) return FALLBACK_RICH(computed);

  const tj = judgeResults[0]?.scores || {};
  const nr = judgeResults[1]?.scores || {};
  const mk = judgeResults[2]?.scores || {};

  const userPrompt = `YG 엔터테인먼트 오디션 결과 데이터입니다:

[심사위원 점수]
양태준 (메인 프로듀서 / 스타성 총괄): ${tj.total ?? 0}점
  - 스타성 & 존재감: ${tj.starPresence ?? 0}/40
  - 개성 & 캐릭터: ${tj.individuality ?? 0}/30
  - 바이브 & 그루브: ${tj.vibeGroove ?? 0}/20
  - 시장성 & 팬흡입력: ${tj.marketability ?? 0}/10
  YG 아우라 감지: ${judgeResults[0]?.ygAuraDetected || '미감지'}
  자체 verdict: ${judgeResults[0]?.verdict || '미정'}

이나래 (퍼포먼스 & 스타일 디렉터): ${nr.total ?? 0}점
  - 무대 장악력: ${nr.stageControl ?? 0}/35
  - 표정 & 눈빛: ${nr.facialExpression ?? 0}/30
  - 스타일 소화력: ${nr.styleDigest ?? 0}/20
  - 퍼포먼스 자신감: ${nr.confidence ?? 0}/15
  퍼포먼스 타입: ${judgeResults[1]?.ygPerformanceType || '미정'}
  자체 verdict: ${judgeResults[1]?.verdict || '미정'}

Marcus Kim (글로벌 A&R / 힙합 프로듀서): ${mk.total ?? 0}점
  - 음색 & 톤: ${mk.toneVoice ?? 0}/35
  - 글로벌 감각: ${mk.globalSense ?? 0}/25
  - 힙합/R&B 바이브: ${mk.hiphopVibe ?? 0}/25
  - 캐릭터성: ${mk.character ?? 0}/15
  글로벌 잠재력: ${typeof judgeResults[2]?.globalPotential === 'object' ? JSON.stringify(judgeResults[2].globalPotential) : (judgeResults[2]?.globalPotential || '평가 중')}
  자체 verdict: ${judgeResults[2]?.verdict || '미정'}

[결정적 집계 — 이 값을 그대로 사용]
평균 점수: ${computed.avgScore}점
양태준 합격 기준 통과: ${computed.individualPass.taejun ? 'YES' : 'NO'}
이나래 합격 기준 통과: ${computed.individualPass.narae ? 'YES' : 'NO'}
Marcus 합격 기준 통과: ${computed.individualPass.marcus ? 'YES' : 'NO'}
스타성 통과 (20점 이상): ${computed.starPotentialPassed ? 'YES' : 'NO'}
캐릭터 통과 (20점 이상): ${computed.characterPotentialPassed ? 'YES' : 'NO'}
시장성 통과: ${computed.marketabilityPassed ? 'YES' : 'NO'}
모든 기준 통과: ${computed.allCriteriaPass ? 'YES' : 'NO'}
최종 결정: ${computed.finalVerdict}
결정 방식: ${computed.unanimous ? 'unanimous' : computed.tiebreaker ? 'taejun_final' : 'majority'}

[토론 결과 요약]
YG 핵심 이유: ${debateResult?.ygCoreReason || '(없음)'}
시장 평가: ${debateResult?.finalMarketEvaluation ? JSON.stringify(debateResult.finalMarketEvaluation) : '(없음)'}
YG 철학 모먼트: "${debateResult?.debateScript?.ygPhilosophyMoment || '(없음)'}"
양태준 최종 결정 사용: ${debateResult?.debateScript?.tiebreakerUsed ? 'YES' : 'NO'}

[지시]
finalVerdict는 반드시 "${computed.finalVerdict}"로 출력하세요.
decisionMethod는 "${computed.unanimous ? 'unanimous' : computed.tiebreaker ? 'taejun_final' : 'majority'}"로 출력하세요.
judgeSummaries[i].score는 위 점수를 그대로, scores도 위 세부 점수 그대로 사용하세요.
응답 언어: ${language === 'ko' ? '한국어 (Marcus는 한영 혼용 자연스럽게)' : language === 'ja' ? '日本語' : 'English'}

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
      .json({ error: 'judgeResults must be an array of 3 judge evaluations [양태준, 이나래, Marcus Kim]' });
  }

  // 1) 결정적 집계
  const computed = computeDeterministic(judgeResults, debateResult);

  // 2) Claude 호출 — 풍부한 결과 텍스트
  const rich = await generateRichResult({ judgeResults, debateResult, computed, language });

  // 3) 결정적 플래그 강제 덮어쓰기
  const finalVerdict = computed.finalVerdict;
  const verdictInfo = rich.verdictInfo || buildFallbackVerdictInfo(finalVerdict);

  const judgeNames = ['양태준', '이나래', 'Marcus Kim'];
  const judgeIds = ['yg-taejun', 'yg-narae', 'yg-marcus'];
  const judgeSummaries = judgeResults.map((r, idx) => {
    const llmSummary = Array.isArray(rich.judgeSummaries) ? rich.judgeSummaries[idx] || {} : {};
    return {
      judgeId: r.judgeId || judgeIds[idx],
      name: r.name || judgeNames[idx],
      score: Number(r?.scores?.total ?? 0),
      verdict: r.verdict || llmSummary.verdict || 'hold',
      scores: r.scores || llmSummary.scores || {},
      summary: llmSummary.summary || '',
      strongPoints: llmSummary.strongPoints || r.strongPoints || [],
      improvements: llmSummary.improvements || r.improvements || [],
      closing: llmSummary.closing || r.closing || '',
      // 양태준 고유
      ygCharacterType: idx === 0 ? llmSummary.ygCharacterType || r.ygCharacterType || null : undefined,
      fanAttraction: idx === 0 ? llmSummary.fanAttraction || r.fanAttraction || null : undefined,
      riskFactor: idx === 0 ? llmSummary.riskFactor || r.riskFactor || null : undefined,
      // 이나래 고유
      cameraAttraction: idx === 1 ? llmSummary.cameraAttraction || r.cameraAttraction || null : undefined,
      ygPerformanceLine: idx === 1 ? llmSummary.ygPerformanceLine || r.ygPerformanceType || null : undefined,
      performanceRisk: idx === 1 ? llmSummary.performanceRisk || r.performanceRisk || null : undefined,
      // Marcus 고유
      globalMarketFit: idx === 2 ? llmSummary.globalMarketFit || r.globalPotential || null : undefined,
      viralPotential: idx === 2 ? llmSummary.viralPotential || r.viralPotential || null : undefined,
      globalRisk: idx === 2 ? llmSummary.globalRisk || r.globalRisk || null : undefined,
    };
  });

  const decisionMethod = computed.unanimous
    ? 'unanimous'
    : computed.tiebreaker
      ? 'taejun_final'
      : 'majority';

  return res.status(200).json({
    finalVerdict,
    avgScore: computed.avgScore,
    starPotentialPassed: computed.starPotentialPassed,
    characterPotentialPassed: computed.characterPotentialPassed,
    marketabilityPassed: computed.marketabilityPassed,
    allCriteriaPass: computed.allCriteriaPass,
    individualPass: computed.individualPass,
    judgeResults,
    debateResult,
    verdictInfo,
    judgeSummaries,
    debateHighlight: rich.debateHighlight || debateResult?.ygCoreReason || '',
    ygPhilosophyHighlight:
      rich.ygPhilosophyHighlight || debateResult?.debateScript?.ygPhilosophyMoment || '',
    finalMarketEvaluation: debateResult?.finalMarketEvaluation || null,
    finalVotes: {
      양태준: judgeResults[0]?.verdict || 'hold',
      이나래: judgeResults[1]?.verdict || 'hold',
      'Marcus Kim': judgeResults[2]?.verdict || 'hold',
    },
    decisionMethod,
    routine: rich.routine || FALLBACK_RICH(computed).routine,
    ygSpecialAdvice: rich.ygSpecialAdvice || '',
    yangTaejunWouldSay: rich.yangTaejunWouldSay || '',
    nextAuditionTarget: rich.nextAuditionTarget || '6개월 후',
    source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
  });
};
