// @ts-nocheck
/** 음절별 문제에 집중한 한국어 코칭 메시지 */
export function getKoreanCoachMessage(analysis, currentTime = 0) {
  if (!analysis) {
    return {
      instruction: '기준 문장을 따라 말해 보세요. 음절별로 정확도를 확인할게요.',
      highlightSyllable: '',
    };
  }

  const feedback = analysis.feedback || {};
  const problems = feedback.problemSyllables || [];
  const syllables = analysis.syllables || analysis.syllableAccuracies || [];

  const worstFromAccuracies = [...syllables]
    .filter((s) => (s.accuracy ?? s.score ?? 100) < 85)
    .sort((a, b) => (a.accuracy ?? a.score ?? 0) - (b.accuracy ?? b.score ?? 0));

  const worstSyllable = worstFromAccuracies[0];
  const char = worstSyllable?.character || worstSyllable?.syllable;

  const problemMatch = problems.find((p) => {
    const syl = p.syllable || p.character;
    return syl === char || (char && String(p.issue || '').includes(char));
  });

  if (problemMatch?.correction) {
    const syl = problemMatch.syllable || char || '';
    return {
      instruction: `'${syl}' 음절: ${problemMatch.correction}`,
      highlightSyllable: syl,
    };
  }

  if (problemMatch?.issue) {
    const syl = problemMatch.syllable || char || '';
    return {
      instruction: `'${syl}'에서 ${problemMatch.issue}. ${problemMatch.correction || '입을 더 크게 벌리며 모음을 또렷하게 발음해 보세요.'}`,
      highlightSyllable: syl,
    };
  }

  if (char && worstSyllable) {
    const context = findSyllableContext(analysis.targetText || analysis.referenceText, char);
    const vowelHint = getVowelHint(char);
    return {
      instruction: context
        ? `'${context}'에서 '${char}'의 모음이 부정확해요. ${vowelHint}`
        : `'${char}' 발음을 다시 맞춰 보세요. ${vowelHint}`,
      highlightSyllable: char,
    };
  }

  if (feedback.practiceAdvice) {
    return { instruction: feedback.practiceAdvice, highlightSyllable: '' };
  }

  if (feedback.intonationFeedback) {
    return { instruction: feedback.intonationFeedback, highlightSyllable: '' };
  }

  return {
    instruction: feedback.encouragement || analysis.coachingTip || '박에 맞춰 또렷하게 발음해 보세요.',
    highlightSyllable: '',
  };
}

function findSyllableContext(text, char) {
  if (!text || !char) return '';
  const idx = text.indexOf(char);
  if (idx < 0) return '';
  const start = Math.max(0, idx - 1);
  const end = Math.min(text.length, idx + 2);
  return text.slice(start, end).trim();
}

function getVowelHint(char) {
  const hints = {
    ㅐ: "입을 더 크게 벌리면서 'ㅐ' 발음해봐요.",
    ㅔ: "입꼬리를 살짝 당기며 'ㅔ' 소리를 내봐요.",
    ㅓ: "턱을 내리고 'ㅓ' 모음을 길게 유지해봐요.",
    ㅗ: "입술을 둥글게 모아 'ㅗ' 발음해봐요.",
    ㅜ: "입술을 앞으로 내밀어 'ㅜ' 발음해봐요.",
    ㅡ: "입을 편하게 벌리고 'ㅡ' 소리를 내봐요.",
    ㅣ: "입꼬리를 올려 'ㅣ' 모음을 또렷하게 내봐요.",
  };
  return hints[char] || '입을 더 크게 벌리면서 모음을 또렷하게 발음해봐요.';
}
