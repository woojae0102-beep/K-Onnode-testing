const { readJsonBody, completeJson } = require('./flowAnthropicHelper');
const { promptByAgency } = require('./agencyFlowSystemPrompts');

function pick(arr, seed) {
  const s = String(seed || '0');
  const n = Math.abs([...s].reduce((a, c) => a + c.charCodeAt(0), 0));
  return arr[n % arr.length];
}

function fallbackCues(agencyId, phase, step, session, questionSet) {
  const seed = session?.randomSeed || agencyId;
  const qs = questionSet?.phaseQuestions || {};
  const self = session?.selfIntroText?.slice(0, 80) || '';

  if (phase === 0 && step === 'opening') {
    const lines = {
      hybe: '들어오세요. 지금부터 심사예요. 긴장하면 그대로 드러나요. 편하게 서주세요.',
      yg: '[10초 침묵] 이름이요.',
      jyp: '안녕하세요! 오시느라 고생 많으셨어요. 오늘은 잘하려고 하지 말고 본인답게만요.',
      sm: '[15초 관찰] 그냥 서 있어봐요. 카메라는 아직 아니에요.',
      starship: '반갑습니다. 오늘 현장을 그대로 즐겨주세요. 팬이 어떻게 느낄지가 중요합니다.',
    };
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking: lines[agencyId] || lines.hybe,
        silenceDuration: agencyId === 'yg' ? 10 : agencyId === 'sm' ? 15 : 0,
        actionType: 'opening',
        noExplanation: agencyId === 'yg',
        requiresUserAction: true,
        userActionType: 'speak',
        duration: agencyId === 'hybe' ? 30 : undefined,
      },
    ];
  }

  if (phase === 0 && step === 'intro_followup') {
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking: qs.phase0_followup || '방금 소개해서 가장 불안한 게 뭐였어요?',
        actionType: 'question',
        requiresUserAction: true,
        userActionType: 'speak',
        dynamicQuestion: {
          isGenerated: true,
          basedOn: 'questionSet',
          question: qs.phase0_followup || '불안한 지점 하나만요.',
        },
      },
    ];
  }

  if (phase === 1 && step === 'instruct_primary') {
    const isVocal = session?.phase1Medium === 'vocal';
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking: isVocal
          ? pick(
              ['자신 있는 곡 1절, 마이크 없이 부르세요.', '앉아서 준비한 후렴만 30초요.', '왔을 때 들리던 노래 버전으로 시작하세요.'],
              seed + 'pv',
            )
          : pick(
              ['자유 안무 1분, 처음 5초에 시선 셋 잡아요.', '무음으로 30초만요.', '가장 어렵다던 동작으로 시작 요령 포함.'],
              seed + 'pd',
            ),
        actionType: 'mission',
        requiresUserAction: true,
        userActionType: 'perform',
        duration: 180,
      },
    ];
  }

  if (phase === 1 && step === 'intervention_primary') {
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking:
          qs.phase1_interruption_hint ||
          `[${session?.performanceElapsedSec || 18}초] 잠깐요. 들숨 줄이고 그 구간 다시 같은 파원으로.`,
        actionType: 'interrupt',
        requiresUserAction: true,
        userActionType: 'perform',
      },
    ];
  }

  if (phase === 1 && step === 'redo_feedback') {
    const ok = session?.lastRedoSucceeded;
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking: ok ? '네, 들렸습니다. 같은 기준 다음으로 넘길게요.' : `${session.phase1Redo}/3 회차예요. 짧게 같은 구간 다시.`,
        actionType: 'redo',
        requiresUserAction: !ok && session.phase1Redo < 3,
        userActionType: 'perform',
      },
    ];
  }

  if (phase === 2 && step === 'instruct_secondary') {
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking: qs.phase2_mission || pick(['반대 카테고리로 교차 미션 시작.', '좋아하는 레이블 곡 무준비 30초.', '무음 카피 카운트 따라 잡아요.'], seed),
        actionType: 'mission',
        requiresUserAction: true,
        userActionType: 'perform',
        duration: 180,
      },
    ];
  }

  if (phase === 2 && step === 'intervention_secondary') {
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking: `[${session?.performanceElapsedSec || 22}초] 스톱. 이번엔 시선 레벨링만 교정.`,
        actionType: 'interrupt',
        requiresUserAction: true,
        userActionType: 'perform',
      },
    ];
  }

  if (phase === 2 && step === 'redo_secondary') {
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking:
          session?.lastRedoSucceeded ? '통과예요 다음 파트.' : `2차 ${session.phase2Redo}/3. 다시.`,
        actionType: 'redo',
        requiresUserAction: !session?.lastRedoSucceeded && session.phase2Redo < 3,
        userActionType: 'perform',
      },
    ];
  }

  if (phase === 3 && step === 'pressure_interview_tick') {
    const idx = Number(session.questionIndex || 0);
    const pool = qs.phase3_main || [];
    const follow = qs.phase3_followup || [];
    const qMain = pool[idx] || pool[0] || '오늘이 끝났을 때 무엇이 남기고 싶은가요?';
    const fq = idx > 0 && follow[idx - 1] ? follow[idx - 1] : qMain;
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking: fq,
        actionType: 'question',
        requiresUserAction: true,
        userActionType: 'speak',
        dynamicQuestion: { isGenerated: true, basedOn: 'pressure', question: fq },
      },
    ];
  }

  if (phase === 4 && step === 'public_debate') {
    const names =
      agencyId === 'hybe'
        ? ['이준혁', '김소연', 'David Lim']
        : agencyId === 'yg'
          ? ['양태준', '이나래', 'Marcus Kim']
          : agencyId === 'jyp'
            ? ['박재원', '정민지', '이성현']
            : agencyId === 'sm'
              ? ['이성호', '최유진', '박서영']
              : ['한승훈', '박나리', '최지수'];

    const lines =
      agencyId === 'yg'
        ? ['데이터 적인 파트는 패스.', '무드는 들어오긴 했어요.', '해외에서는 아직 헷갈릴 거예요.']
        : agencyId === 'jyp'
          ? ['목은 나아졌지만 자세.', '케미는 따뜻하지만 카운트.', '감점 없이 버틴 태도는 좋아요.']
          : agencyId === 'sm'
            ? ['무드 브레이크는 필요.', '상단 발성은 교정해야.', '콘셉 브랜딩 신호 확인할게요.']
            : agencyId === 'starship'
              ? ['대중 접점은 명확.', '렌즈 품격은 업.', '팀 레벨 테스트를 더해야.']
            : ['성장 속도 신호 재밌네요.', '무대 체격은 변수.', '글로벌 설득 불명확.'];

    return names.map((n, i) => ({
      speaker: n,
      judgeSeat: 'debate',
      speaking: `${lines[i]} (요약 의견)`,
      silenceDuration: agencyId === 'yg' ? 3 : agencyId === 'sm' ? 4 : 0,
      actionType: 'debate',
      requiresUserAction: false,
      userActionType: 'wait',
    }));
  }

  if (phase === 4 && step === 'final_word_prompt') {
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking: qs.phase4_final || '지금 들은 대화 들었죠? 마지막으로 30초만요.',
        actionType: 'question',
        requiresUserAction: true,
        userActionType: 'speak',
      },
    ];
  }

  if (phase === 5 && step === 'reveal_cards') {
    const judges =
      agencyId === 'hybe'
        ? [
            ['이준혁', '72', '표현 직진을 응원했어요.'],
            ['김소연', '68', '무대 훅이 필요해요.'],
            ['David', '70', '글로벌 설득은 조건부예요.'],
          ]
        : [['심사A', '70', pick(['굿사인', '리스크', '패스'], seed)], ['심사B', '65', pick(['패치', '쿨링', '콜백'], seed)], ['심사C', '69', pick(['네트', '팀워크', '톤업'], seed)]];

    return judges.map(([speaker, score, txt]) => ({
      speaker,
      judgeSeat: 'score',
      speaking: `${score}. ${txt}`,
      actionType: 'result_card',
      requiresUserAction: false,
      userActionType: 'wait',
    }));
  }

  if (phase === 5 && step === 'average_reveal') {
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking: pick(['평균 카운트 업… 69예요.', '평균 67. 근사치 결과 보여줄게요.', '평균 71 들어오네요.'], seed + 'avg'),
        actionType: 'result_average',
        requiresUserAction: false,
      },
    ];
  }

  if (phase === 5 && step === 'final_verdict_copy') {
    return [
      {
        speaker: 'MC',
        judgeSeat: 'flow',
        speaking: pick(
          [
            '오늘은 조건부 합격입니다. 과제 명확해요.',
            '아쉽지만 여기까지입니다. 가장 빛나던 순간 상기 예요.',
            '합격 축합니다. 과제 많아요 현실적으로.',
          ],
          seed + 'vf',
        ),
        actionType: 'result_final',
        requiresUserAction: false,
      },
    ];
  }

  return [
    {
      speaker: 'MC',
      judgeSeat: 'flow',
      speaking: '다음 진행 확인 중이에요.',
      actionType: 'reaction',
      requiresUserAction: false,
      userActionType: 'wait',
    },
  ];
}

async function synthesizeViaClaude(agencyId, incoming) {
  const system = promptByAgency(agencyId);
  const { parsed } = await completeJson({
    system: `${system}\n\n항상 사용자 언어: ${incoming.language === 'ko' ? '한국어' : incoming.language || '한국어'}`,
    userContent: incoming,
    maxTokens: 4096,
  });
  return parsed;
}

function createFlowHandler(forcedAgencyId) {
  return async function agencyFlow(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const body = await readJsonBody(req);
    const agencyId = forcedAgencyId || body.agencyId || 'hybe';
    const {
      phase = 0,
      step = 'opening',
      language = 'ko',
      applicantProfile = {},
      questionSet = {},
      session = {},
    } = body;

    const payload = {
      agencyId,
      phase,
      step,
      language,
      applicantProfile,
      questionSet,
      session,
    };

    let parsed = await synthesizeViaClaude(agencyId, payload);
    let source = 'claude';
    if (!parsed || !Array.isArray(parsed.cues)) {
      const cues = fallbackCues(agencyId, phase, step, session, questionSet);
      parsed = {
        agencyId,
        phase,
        step,
        cueIndex: 0,
        cues,
        advance: { nextPhaseSuggested: phase, stay: false, hint: 'fallback' },
      };
      source = 'fallback';
    } else {
      parsed.agencyId = agencyId;
      parsed.phase = parsed.phase ?? phase;
      parsed.step = step;
    }

    parsed.source = source;
    return res.status(200).json(parsed);
  };
}

module.exports = { createFlowHandler, fallbackCues };
