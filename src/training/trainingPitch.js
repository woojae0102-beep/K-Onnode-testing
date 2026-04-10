// 수정됨 — 보컬: Hz ↔ 음계, 자기상관 피치 검출 (외부 라이브러리 없음)

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const KO_DOREMI = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];

export function hzToMidiFloat(hz) {
  try {
    if (!hz || hz <= 0 || !Number.isFinite(hz)) return null;
    return 69 + 12 * (Math.log(hz / 440) / Math.LN2);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function midiToNoteName(midiRound) {
  try {
    const m = Math.round(midiRound);
    const oct = Math.floor(m / 12) - 1;
    const name = NOTE_NAMES[((m % 12) + 12) % 12];
    return `${name}${oct}`;
  } catch (e) {
    console.error(e);
    return '';
  }
}

export function midiToKoSyllable(midiRound) {
  try {
    const m = Math.round(midiRound);
    return KO_DOREMI[((m % 12) + 12) % 12];
  } catch (e) {
    console.error(e);
    return '';
  }
}

function targetHzFromMidi(targetMidi) {
  try {
    return 440 * Math.pow(2, (targetMidi - 69) / 12);
  } catch (e) {
    console.error(e);
    return 261.63;
  }
}

export function detectPitchHzAutocorr(analyser, sampleRate) {
  try {
    const bufferLength = analyser.fftSize;
    const data = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(data);
    let rms = 0;
    for (let i = 0; i < bufferLength; i += 1) {
      rms += data[i] * data[i];
    }
    rms = Math.sqrt(rms / bufferLength);
    if (rms < 0.015) return null;

    const minLag = Math.max(2, Math.floor(sampleRate / 1800));
    const maxLag = Math.min(bufferLength - 1, Math.floor(sampleRate / 75));
    let bestLag = -1;
    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let corr = 0;
      for (let i = 0; i < bufferLength - lag; i += 1) {
        corr += data[i] * data[i + lag];
      }
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }
    if (bestLag <= 0 || bestCorr <= 0) return null;
    return sampleRate / bestLag;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function buildVocalPitchFeedback(hz, targetMidi) {
  try {
    const thz = targetHzFromMidi(targetMidi);
    if (!thz || thz <= 0) {
      return { cents: 0, feedback: '목표 음높이를 확인할 수 없습니다.', accuracy: 0 };
    }
    const centsRaw = 1200 * (Math.log(hz / thz) / Math.LN2);
    const cents = Math.max(-100, Math.min(100, centsRaw));
    const accuracy = Math.max(0, Math.min(100, Math.round(100 - Math.abs(centsRaw) * 0.35)));
    let feedback = '잘 맞고 있어요.';
    if (centsRaw > 25) feedback = '조금 높습니다.';
    else if (centsRaw < -25) feedback = '조금 낮습니다.';
    else if (Math.abs(centsRaw) > 10) feedback = '미세하게 조정해 보세요.';
    return { cents: centsRaw, feedback, accuracy };
  } catch (e) {
    console.error(e);
    return { cents: 0, feedback: '분석 오류', accuracy: 0 };
  }
}
