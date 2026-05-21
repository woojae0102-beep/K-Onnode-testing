// 월말 평가: 5개 기획사 심사위원 토론
const { readJsonBody, callClaude, languageLabel } = require('./_helpers');

const FALLBACK = {
  debateLines: [
    { speaker: '이준혁', agency: 'HYBE', avatar: '👨‍💼',
      line: '이번 달 성장 데이터를 보면 가능성이 보입니다.', tone: 'positive', pauseBefore: 1 },
    { speaker: '양태준', agency: 'YG', avatar: '😎',
      line: '아직 완성도가 부족해요. 다음 달엔 색이 더 나와야 합니다.', tone: 'critical', pauseBefore: 2 },
    { speaker: '이성현', agency: 'JYP', avatar: '🤝',
      line: '꾸준히 나온 것만으로도 의미가 큽니다. 마음가짐이 좋아요.', tone: 'positive', pauseBefore: 1 },
    { speaker: '이성호', agency: 'SM', avatar: '👑',
      line: '[침묵] 카메라가 더 좋아해야 합니다.', tone: 'neutral', pauseBefore: 3 },
    { speaker: '한승훈', agency: 'Starship', avatar: '⭐',
      line: '대중성은 충분히 있어요. 다음 달이 정말 기대됩니다.', tone: 'impressed', pauseBefore: 1 },
  ],
  keyConflict: '완성도(YG) vs 성장 가능성(HYBE) 의견 충돌',
  consensus: '성장세는 긍정적이나 안정감 보완 필요',
  finalSummary: '무대에서 시선을 끄는 능력은 확실히 있습니다. 다만 안정감이 더 생기면 훨씬 강해질 거예요.',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = await readJsonBody(req);
  const {
    agencyEvaluations = {},
    traineeProfile = {},
    monthlyData = {},
    language = 'ko',
  } = body || {};

  const grades = (id) => agencyEvaluations?.[id] || {};
  const danceImp = monthlyData?.dance?.improvement || 0;
  const vocalImp = monthlyData?.vocal?.improvement || 0;

  const prompt = `당신은 5개 기획사 심사위원들이 한 연습생을 공동 평가하는 토론 장면을 생성합니다.

중요: 이 토론은 사용자가 "AI들이 나를 진짜 평가하고 있다"고 느끼게 해야 합니다.
현실적이고 구체적이어야 합니다.

참여 심사위원 (기획사별 대표 1명씩):
이준혁 (HYBE) — 데이터 분석적, 성장 가능성 중심
양태준 (YG) — 짧고 직설적, 실력 완성도 중심
이성현 (JYP) — 따뜻하지만 기준 명확, 인성 중심
이성호 (SM) — 권위 있고 침묵 많음, 비주얼/아우라 중심
한승훈 (Starship) — 균형적, 대중성 중심

연습생 이번 달 프로필:
타입: ${traineeProfile?.traineeType || ''}
강점: ${traineeProfile?.mainStrength || ''}
약점: ${traineeProfile?.mainWeakness || ''}
성장 서사: ${traineeProfile?.growthNarrative || ''}

각 기획사 평가 등급 / 합격 가능성:
HYBE: ${grades('hybe').overallGrade || ''} (${grades('hybe').passRate || 0}%)
YG: ${grades('yg').overallGrade || ''} (${grades('yg').passRate || 0}%)
JYP: ${grades('jyp').overallGrade || ''} (${grades('jyp').passRate || 0}%)
SM: ${grades('sm').overallGrade || ''} (${grades('sm').passRate || 0}%)
Starship: ${grades('starship').overallGrade || ''} (${grades('starship').passRate || 0}%)

이번 달 핵심 데이터:
가장 성장한 부분: ${danceImp > vocalImp ? '댄스' : '보컬'}
꾸준함: ${monthlyData?.consistency?.totalDays || 0}일

토론 규칙:
1. 각 심사위원이 자신만의 말투로 발언 (이성호는 [침묵] 표시 사용)
2. 서로 의견 충돌이 있어야 몰입감 상승 (특히 YG vs HYBE)
3. 연습생의 구체적인 데이터를 언급해야 함
4. 총 5~7번의 발언 교환
5. 마지막은 종합 총평으로 마무리

응답 언어: ${languageLabel(language)}

JSON만 출력:
{
  "debateLines": [
    {
      "speaker": "이름",
      "agency": "HYBE|YG|JYP|SM|Starship",
      "avatar": "이모지",
      "line": "발언 내용",
      "tone": "positive|critical|neutral|impressed|conflicted",
      "pauseBefore": 숫자(초)
    }
  ],
  "keyConflict": "핵심 의견 충돌 요약 한 줄",
  "consensus": "공통된 의견 한 줄",
  "finalSummary": "AI 심사위원 종합 총평 (2~3문장, 감정적 몰입)"
}`;

  const result = await callClaude({ prompt, maxTokens: 1300 });
  if (result.ok && result.parsed && Array.isArray(result.parsed.debateLines)) {
    return res.status(200).json({ ...result.parsed, source: 'claude' });
  }
  return res.status(200).json({ ...FALLBACK, source: 'fallback', reason: result.reason });
};
