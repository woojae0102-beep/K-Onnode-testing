// 월말 평가: 기획사별 평가 생성
const { readJsonBody, callClaude, languageLabel } = require('./_helpers');

const AGENCY_PROMPTS = {
  hybe: `당신은 HYBE 빅히트뮤직의 월말 연습생 평가 시스템입니다.
3명의 심사위원(이준혁, 김소연, David Lim)이 한 달 데이터를 보고 평가합니다.

HYBE 월말 평가 기준:
- 음악성과 성장 가능성 최우선
- 꾸준함과 트레이닝 흡수력
- 글로벌 어필 가능성
- 자기만의 색깔 발전 여부

이준혁 스타일: 데이터 분석적. "이번 달 성장률 데이터를 보면..."
김소연 스타일: 직관적. "무대 위에서 뭔가 달라졌어요."
David Lim 스타일: 영한 혼용. "Globally speaking, 이번 달은..."`,

  yg: `당신은 YG 엔터테인먼트의 월말 연습생 평가 시스템입니다.
3명의 심사위원(양태준, 이나래, Marcus Kim)이 평가합니다.

YG 월말 평가 기준:
- 스타성과 아우라 변화
- 실력의 완성도
- 개성과 차별화
- YG DNA 체화 여부

양태준 스타일: 짧고 직설적. "됩니다/안 됩니다."
이나래 스타일: 퍼포먼스 전문. "무대 장악력이..."
Marcus Kim 스타일: 힙합 관점. "Real talk, 이번 달은..."`,

  jyp: `당신은 JYP 엔터테인먼트의 월말 연습생 평가 시스템입니다.
3명의 심사위원(박재원, 정민지, 이성현)이 평가합니다.

JYP 월말 평가 기준:
- 인성과 태도 변화
- 발성 습관 개선 여부
- 라이브 능력 향상
- 꾸준함과 성실함

박재원 스타일: 발성 전문. "공기반 소리반 기준으로..."
정민지 스타일: 에너지. "무대 에너지가 이번 달에..."
이성현 스타일: 인성 중심. "태도와 마음가짐에서..."`,

  sm: `당신은 SM 엔터테인먼트의 월말 연습생 평가 시스템입니다.
3명의 심사위원(이성호, 최유진, 박서영)이 평가합니다.

SM 월말 평가 기준:
- SM 아우라 발전 여부
- 보컬 개성과 음색 발전
- 카메라 친화성 향상
- SM 세계관 적합성

이성호 스타일: 권위 있고 침묵. "[침묵 후] 됩니다/아닙니다."
최유진 스타일: 보컬 집중. "음색에서 이번 달..."
박서영 스타일: 글로벌 브랜딩. "콘텐츠로 만들면..."`,

  starship: `당신은 스타쉽 엔터테인먼트의 월말 연습생 평가 시스템입니다.
3명의 심사위원(한승훈, 박나리, 최지수)이 평가합니다.

스타쉽 월말 평가 기준:
- 대중성과 팬덤 가능성
- 기본기 완성도
- 팀 시너지 가능성
- 센터 적합도

한승훈 스타일: 균형 있는 평가. "실력과 매력 균형이..."
박나리 스타일: 기본기. "기본이 이번 달에..."
최지수 스타일: 팬덤. "팬들이 좋아할..."`,
};

const AGENCY_NAMES = {
  hybe: 'HYBE',
  yg: 'YG',
  jyp: 'JYP',
  sm: 'SM',
  starship: 'Starship',
};

const JUDGE_TEMPLATES = {
  hybe: [
    { judgeId: 'j_lee', judgeName: '이준혁', avatar: '👨‍💼' },
    { judgeId: 'j_kim', judgeName: '김소연', avatar: '👩‍🎤' },
    { judgeId: 'j_david', judgeName: 'David Lim', avatar: '🌍' },
  ],
  yg: [
    { judgeId: 'y_tj', judgeName: '양태준', avatar: '😎' },
    { judgeId: 'y_nr', judgeName: '이나래', avatar: '💃' },
    { judgeId: 'y_marcus', judgeName: 'Marcus Kim', avatar: '🎧' },
  ],
  jyp: [
    { judgeId: 'jy_jw', judgeName: '박재원', avatar: '🎤' },
    { judgeId: 'jy_mj', judgeName: '정민지', avatar: '🌟' },
    { judgeId: 'jy_sh', judgeName: '이성현', avatar: '🤝' },
  ],
  sm: [
    { judgeId: 's_sh', judgeName: '이성호', avatar: '👑' },
    { judgeId: 's_yj', judgeName: '최유진', avatar: '🎙️' },
    { judgeId: 's_sy', judgeName: '박서영', avatar: '🎬' },
  ],
  starship: [
    { judgeId: 'st_sh', judgeName: '한승훈', avatar: '⭐' },
    { judgeId: 'st_nr', judgeName: '박나리', avatar: '🎯' },
    { judgeId: 'st_js', judgeName: '최지수', avatar: '💖' },
  ],
};

const FALLBACKS = {
  hybe: { overallGrade: 'B+', passRate: 62, gradeReason: '성장 데이터는 긍정적이나 글로벌 어필 보강 필요' },
  yg: { overallGrade: 'B', passRate: 44, gradeReason: '완성도 부족, 아우라 보강 필요' },
  jyp: { overallGrade: 'B+', passRate: 68, gradeReason: '꾸준함과 태도가 인상적, 라이브 안정 필요' },
  sm: { overallGrade: 'B', passRate: 51, gradeReason: '음색 개성은 있으나 카메라 친화성 향상 필요' },
  starship: { overallGrade: 'A', passRate: 76, gradeReason: '대중성과 기본기의 균형이 좋음' },
};

const DEFAULT_COMMENTS = {
  hybe: [
    { tone: 'positive', comment: '이번 달 성장률 데이터를 보면 가능성이 보입니다.' },
    { tone: 'neutral', comment: '무대에서 뭔가 달라졌어요. 아직 확신은 이르지만요.' },
    { tone: 'positive', comment: 'Globally speaking, 이번 달은 한 단계 올라온 느낌이에요.' },
  ],
  yg: [
    { tone: 'critical', comment: '아직 완성도가 부족해요.' },
    { tone: 'neutral', comment: '무대 장악력이 조금씩 잡혀가는 중입니다.' },
    { tone: 'critical', comment: 'Real talk, 이번 달은 좀 더 색깔이 필요해요.' },
  ],
  jyp: [
    { tone: 'positive', comment: '공기반 소리반 기준으로 점점 좋아지고 있어요.' },
    { tone: 'positive', comment: '무대 에너지가 이번 달에 살아났어요.' },
    { tone: 'positive', comment: '태도와 마음가짐에서 단단함이 보입니다.' },
  ],
  sm: [
    { tone: 'neutral', comment: '[침묵] 카메라가 더 좋아해야 해요.' },
    { tone: 'positive', comment: '음색에서 이번 달 색깔이 보이기 시작했어요.' },
    { tone: 'neutral', comment: '콘텐츠로 만들면 어떻게 보일까가 중요합니다.' },
  ],
  starship: [
    { tone: 'positive', comment: '실력과 매력 균형이 잘 잡히고 있어요.' },
    { tone: 'positive', comment: '기본이 이번 달에 확실히 자리잡았어요.' },
    { tone: 'impressed', comment: '팬들이 좋아할 디테일이 많이 보입니다.' },
  ],
};

function buildFallback(agencyId) {
  const judges = JUDGE_TEMPLATES[agencyId] || [];
  const tones = DEFAULT_COMMENTS[agencyId] || [];
  const base = FALLBACKS[agencyId] || { overallGrade: 'B', passRate: 50 };
  return {
    agencyId,
    agencyName: AGENCY_NAMES[agencyId],
    overallGrade: base.overallGrade,
    passRate: base.passRate,
    gradeReason: base.gradeReason || '',
    judgeComments: judges.map((j, i) => ({
      ...j,
      agency: agencyId,
      tone: tones[i]?.tone || 'neutral',
      comment: tones[i]?.comment || '평가 진행 중입니다.',
    })),
    focusCriteria: ['성장률', '꾸준함', '실력 완성도'],
    verdict: '가능성 있는 연습생. 지속적인 성장 필요.',
    recommendation: '기본기 강화에 집중하세요.',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = await readJsonBody(req);
  const { agencyId = 'hybe', monthlyData = {}, traineeProfile = {}, language = 'ko' } = body || {};

  const fallback = buildFallback(agencyId);
  const agencyPrompt = AGENCY_PROMPTS[agencyId];
  if (!agencyPrompt) {
    return res.status(200).json({ ...fallback, source: 'fallback', reason: 'unknown_agency' });
  }

  const prompt = `${agencyPrompt}

연습생 이번 달 데이터:
댄스: 세션 ${monthlyData?.dance?.sessions || 0}회, 평균 ${monthlyData?.dance?.avgScore || 0}점, 향상 ${monthlyData?.dance?.improvement || 0}점
보컬: 세션 ${monthlyData?.vocal?.sessions || 0}회, 음정 정확도 ${monthlyData?.vocal?.avgPitchAccuracy || 0}%, 호흡 ${monthlyData?.vocal?.breathingStability || 0}%
한국어: 발음 ${monthlyData?.korean?.pronunciation || 0}점, 억양 ${monthlyData?.korean?.intonation || 0}점
꾸준함: 주간 ${monthlyData?.consistency?.weeklyAttendance || 0}일, 총 ${monthlyData?.consistency?.totalDays || 0}일
오디션: ${monthlyData?.audition?.attempts || 0}회 시도, 최고 결과 ${monthlyData?.audition?.bestResult || 'pending'}

AI 생성 연습생 프로필:
타입: ${traineeProfile?.traineeType || ''}
강점: ${traineeProfile?.mainStrength || ''}
약점: ${traineeProfile?.mainWeakness || ''}
서사: ${traineeProfile?.growthNarrative || ''}

이번 달 이 기획사의 월말 평가를 진행하세요.
각 심사위원이 실제 성격으로 코멘트해야 합니다.
합격 가능성은 데이터 기반으로 현실적으로 산출하세요.

응답 언어: ${languageLabel(language)}

JSON만 출력:
{
  "agencyId": "${agencyId}",
  "overallGrade": "S|A|B+|B|C+|C|D",
  "passRate": 숫자,
  "judgeComments": [
    {
      "judgeId": "심사위원ID",
      "judgeName": "이름",
      "avatar": "이모지",
      "comment": "실제 발언 (해당 심사위원 말투로)",
      "tone": "positive|critical|neutral|impressed"
    }
  ],
  "focusCriteria": ["기준1", "기준2", "기준3"],
  "verdict": "최종 평가 한 줄",
  "recommendation": "이 기획사를 위한 구체적 조언",
  "gradeReason": "이 등급을 준 이유"
}`;

  const result = await callClaude({ prompt, maxTokens: 900 });
  if (result.ok && result.parsed) {
    const merged = {
      ...fallback,
      ...result.parsed,
      agencyId,
      agencyName: AGENCY_NAMES[agencyId],
      judgeComments: Array.isArray(result.parsed.judgeComments) && result.parsed.judgeComments.length
        ? result.parsed.judgeComments.map((c) => ({ ...c, agency: agencyId }))
        : fallback.judgeComments,
      source: 'claude',
    };
    return res.status(200).json(merged);
  }
  return res.status(200).json({ ...fallback, source: 'fallback', reason: result.reason });
};
