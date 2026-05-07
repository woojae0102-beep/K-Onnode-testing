// HYBE 3인 심사위원 토론 조율 API
// 만장일치면 토론 생략, 2:1이면 토론 스크립트 생성, 재투표도 분열 시 이준혁(tiebreaker) 결정
// 거부권 발동(이준혁/David)이면 토론 없이 즉시 보류 처리

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

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

function tallyVotes(votes) {
  const count = {};
  votes.forEach((v) => { count[v] = (count[v] || 0) + 1; });
  return count;
}

function getMajorityVerdict(votes) {
  const count = tallyVotes(votes);
  return Object.keys(count).reduce((a, b) => (count[a] > count[b] ? a : b));
}

function buildFallbackDebate() {
  return {
    round1: [
      { speaker: '이준혁', line: '제 데이터상으로는 성장 가능성이 보입니다. 6개월 트레이닝을 가정하면 충분히 발전할 수 있는 흡수력입니다.' },
      { speaker: '김소연', line: '잠깐요. 무대 장악력은 아직 부족했어요. 그 순간이 보였어야 하는데 안 보였어요.' },
      { speaker: 'David Lim', line: 'Globally speaking, 아직 확신이 없어요. 한국 시장 기준으로는 통할 수 있어요.' },
    ],
    round2_conflict: [
      { speaker: '이준혁', line: '지금 점수는 저도 봤습니다. 제가 보는 건 다음 6개월이에요. 즉석 교정 반영 속도를 보셨나요?' },
      { speaker: '김소연', line: '이준혁 디렉터님, 무대는 숫자로 안 움직여요. 관객은 잘하는 사람이 아니라 보고 싶은 사람을 봐요.' },
      { speaker: '이준혁', line: '데이터상으로는 흥미롭습니다. 단, 최종적으로는 조건부 합격을 권고합니다.' },
    ],
    finalVoteDeclaration: [
      { speaker: '이준혁', vote: 'conditional', line: '조건부 합격입니다.' },
      { speaker: '김소연', vote: 'pending', line: '저는 보류입니다. 무대에서 그 순간이 안 보였어요.' },
      { speaker: 'David Lim', vote: 'conditional', line: 'Okay. 저도 conditional로 갈게요.' },
    ],
    tiebreakerUsed: false,
    tiebreakerBy: null,
    tiebreakerDecision: null,
  };
}

async function generateDebateScript({ judgeResults, majority, minority, language }) {
  if (!ANTHROPIC_API_KEY) return buildFallbackDebate();

  const prompt = `당신은 HYBE 빅히트뮤직 오디션 토론을 중계하는 시스템입니다.

3명의 심사위원이 아래와 같이 의견이 나뉘었습니다:

이준혁 디렉터: "${judgeResults[0].verdict}" 의견
  논거: "${judgeResults[0].debatePosition}"
  점수: ${judgeResults[0].scores?.total ?? 0}점

김소연 디렉터: "${judgeResults[1].verdict}" 의견
  논거: "${judgeResults[1].debatePosition}"
  점수: ${judgeResults[1].scores?.total ?? 0}점

David Lim: "${judgeResults[2].verdict}" 의견
  논거: "${judgeResults[2].debatePosition}"
  점수: ${judgeResults[2].scores?.total ?? 0}점

다수 의견: ${majority} (2명)
소수 의견: ${minority?.verdict ?? 'unknown'} (1명, ${minority?.name ?? '?'})

각 심사위원의 실제 캐릭터와 말투로 토론 스크립트를 작성하세요.

이준혁: 데이터와 성장 가능성으로 논거. 차분하고 분석적. "데이터상으로는", "제가 본 바로는".
김소연: 직관과 퍼포먼스 느낌으로 논거. 빠르고 직관적. "잠깐요", "그 순간이요".
David Lim: 글로벌 스탠다드로 논거. 영한 혼용. "Look", "Real talk", "Globally speaking".

응답 언어: ${language === 'ko' ? '한국어' : language === 'ja' ? '日本語' : 'English'}

반드시 아래 JSON 형식으로만, 마크다운/코드펜스 금지:
{
  "round1": [
    { "speaker": "이준혁", "line": "발언 내용" },
    { "speaker": "김소연", "line": "발언 내용" },
    { "speaker": "David Lim", "line": "발언 내용" }
  ],
  "round2_conflict": [
    { "speaker": "소수의견자 이름", "line": "반론 (최대 3문장)" },
    { "speaker": "다수의견 대표", "line": "반박 (최대 3문장)" },
    { "speaker": "소수의견자 이름", "line": "최종 입장 (최대 2문장)" }
  ],
  "finalVoteDeclaration": [
    { "speaker": "이준혁", "vote": "pass|conditional|pending|fail", "line": "투표 선언 한 문장" },
    { "speaker": "김소연", "vote": "pass|conditional|pending|fail", "line": "투표 선언 한 문장" },
    { "speaker": "David Lim", "vote": "pass|conditional|pending|fail", "line": "투표 선언 한 문장" }
  ],
  "tiebreakerUsed": true|false,
  "tiebreakerBy": "이준혁|null",
  "tiebreakerDecision": "pass|conditional|pending|fail|null"
}`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`CLAUDE_FAIL_${res.status}`);
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = tryParseJson(text);
    if (!parsed || !Array.isArray(parsed.finalVoteDeclaration)) return buildFallbackDebate();
    return parsed;
  } catch {
    return buildFallbackDebate();
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const { judgeResults = [], language = 'ko' } = body || {};

  if (!Array.isArray(judgeResults) || judgeResults.length !== 3) {
    return res.status(400).json({ error: 'judgeResults must be an array of 3 judge evaluations' });
  }

  // 거부권 체크 (이준혁 = 진정성 / David = 글로벌)
  const vetoJudge = judgeResults.find((r) => r && r.vetoTriggered);
  if (vetoJudge) {
    return res.status(200).json({
      debateNeeded: false,
      vetoApplied: true,
      vetoBy: vetoJudge.judgeId || vetoJudge.name,
      vetoReason: vetoJudge.vetoReason,
      finalVerdict: 'pending',
      debateScript: null,
      source: 'rule',
    });
  }

  // 만장일치 체크
  const votes = judgeResults.map((r) => r.verdict);
  const counts = tallyVotes(votes);
  const uniqueVerdicts = Object.keys(counts);

  if (uniqueVerdicts.length === 1) {
    const v = uniqueVerdicts[0];
    return res.status(200).json({
      debateNeeded: false,
      vetoApplied: false,
      finalVerdict: v,
      unanimousVerdict: true,
      debateScript: null,
      source: 'rule',
    });
  }

  // 2:1 분열 → 토론 진행
  const majority = getMajorityVerdict(votes);
  const minority = judgeResults.find((r) => r.verdict !== majority);

  const debateScript = await generateDebateScript({
    judgeResults,
    majority,
    minority,
    language,
  });

  // 최종 투표 집계
  const finalVotes = (debateScript.finalVoteDeclaration || []).map((v) => v.vote);
  const finalCounts = tallyVotes(finalVotes);
  const finalUnique = Object.keys(finalCounts);
  let finalVerdict;
  let tiebreakerUsed = false;
  let tiebreakerBy = null;

  if (finalUnique.length === 1) {
    finalVerdict = finalUnique[0];
  } else {
    // 재투표도 분열 → 이준혁(tiebreaker) 결정권 행사
    const leeVote = (debateScript.finalVoteDeclaration || []).find((v) => v.speaker === '이준혁');
    finalVerdict = leeVote?.vote || debateScript.tiebreakerDecision || majority;
    tiebreakerUsed = true;
    tiebreakerBy = '이준혁';
  }

  // LLM이 명시적으로 tiebreaker를 사용했다면 그것을 우선
  if (debateScript.tiebreakerUsed && debateScript.tiebreakerDecision) {
    finalVerdict = debateScript.tiebreakerDecision;
    tiebreakerUsed = true;
    tiebreakerBy = debateScript.tiebreakerBy || '이준혁';
  }

  return res.status(200).json({
    debateNeeded: true,
    vetoApplied: false,
    debateScript: { ...debateScript, tiebreakerUsed, tiebreakerBy },
    finalVerdict,
    source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
  });
};
