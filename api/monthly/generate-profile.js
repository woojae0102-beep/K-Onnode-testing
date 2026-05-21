// 월말 평가: 연습생 AI 프로필 생성
const { readJsonBody, callClaude, languageLabel } = require('./_helpers');

const SYSTEM_PROMPT = `당신은 K-POP 연습생 AI 프로필 생성 전문가입니다.
한 달간의 연습 데이터를 보고 연습생의 현재 상태를 캐릭터로 정의합니다.

중요: 단순 분석이 아닌 "연습생 정체성"을 만들어야 합니다.
사람은 분석보다 정체성에 몰입합니다.

출력 규칙:
1. traineeType: 4~10자의 임팩트 있는 타입명 (예: "센터형 올라운더", "카리스마 보컬")
2. 각 항목은 사용자가 자랑하고 싶게 만들어야 함
3. growthNarrative: 이번 달의 드라마틱한 성장 서사 (3~4문장)
   반드시 이전 달 데이터와 비교해서 서사 만들기
4. 반드시 JSON만 출력. 마크다운/코드펜스 금지.`;

const FALLBACK = {
  traineeType: '성장형 올라운더',
  mainStrength: '꾸준한 연습으로 전반적인 실력 향상',
  mainWeakness: '안정적인 라이브 능력 보완 필요',
  growthRate: 'fast',
  stagePresence: 'B',
  marketability: 'medium',
  primaryPosition: '메인댄서',
  potentialPositions: ['서브보컬', '퍼포머'],
  personalityTag: '성실형',
  growthNarrative: '이번 달 꾸준한 연습으로 전월 대비 눈에 띄는 성장을 보였습니다. 데이터에 새겨진 시간이 곧 캐릭터가 되고 있어요. 다음 달에는 더 큰 무대를 기대해도 좋겠습니다.',
  specialNote: '댄스 부문에서 특히 두드러진 발전',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = await readJsonBody(req);
  const { monthlyData = {}, previousResults = [], language = 'ko' } = body || {};

  const prompt = `이번 달 누적 데이터:
${JSON.stringify(monthlyData, null, 2)}

이전 달 결과:
${JSON.stringify(previousResults?.slice?.(-3) || [], null, 2)}

응답 언어: ${languageLabel(language)}

JSON만 출력:
{
  "traineeType": "타입명",
  "mainStrength": "핵심 강점 한 문장",
  "mainWeakness": "핵심 약점 한 문장",
  "growthRate": "very_fast|fast|normal|slow",
  "stagePresence": "S|A|B|C",
  "marketability": "very_high|high|medium|low",
  "primaryPosition": "포지션",
  "potentialPositions": ["포지션1", "포지션2"],
  "personalityTag": "성격 태그",
  "growthNarrative": "이번 달 성장 서사 (드라마틱하게)",
  "specialNote": "이번 달 특별히 눈에 띈 점"
}`;

  const result = await callClaude({ system: SYSTEM_PROMPT, prompt, maxTokens: 700 });
  if (result.ok && result.parsed) {
    return res.status(200).json({ ...FALLBACK, ...result.parsed, source: 'claude' });
  }
  return res.status(200).json({ ...FALLBACK, source: 'fallback', reason: result.reason });
};
