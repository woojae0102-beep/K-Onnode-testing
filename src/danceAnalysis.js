/**
 * 수정됨 — 안무 분석 유틸 (세션 로그, 랜드마크 스무딩)
 * MediaPipe Tasks Holistic은 modelComplexity/smoothLandmarks 옵션이 없어 EMA로 지터 완화
 */

// 수정됨 — 이전 프레임 가중치 ↑ = 더 부드럽게 (지터 감소)
export const POSE_LANDMARK_SMOOTH_ALPHA = 0.5;
export const HAND_LANDMARK_SMOOTH_ALPHA = 0.45;

/** @param {Array<{x:number,y:number,z?:number,visibility?:number}|null|undefined>|null} prev */
export function smoothLandmarksEMA(prev, curr, alpha = POSE_LANDMARK_SMOOTH_ALPHA) {
  try {
    if (!curr?.length) return null;
    if (!prev?.length || prev.length !== curr.length) {
      return curr.map((p) =>
        p
          ? {
              x: Number(p.x),
              y: Number(p.y),
              z: Number(p.z ?? 0),
              visibility: Number(p.visibility ?? 0),
            }
          : null
      );
    }
    return curr.map((p, i) => {
      const q = prev[i];
      if (!p) return q || null;
      if (!q) {
        return {
          x: Number(p.x),
          y: Number(p.y),
          z: Number(p.z ?? 0),
          visibility: Number(p.visibility ?? 0),
        };
      }
      const a = alpha;
      return {
        x: q.x * a + Number(p.x) * (1 - a),
        y: q.y * a + Number(p.y) * (1 - a),
        z: (q.z ?? 0) * a + Number(p.z ?? 0) * (1 - a),
        visibility: Number(p.visibility ?? 0),
      };
    });
  } catch (e) {
    console.error(e);
    return curr;
  }
}

export function smoothHandLandmarks21(prev, curr, alpha = HAND_LANDMARK_SMOOTH_ALPHA) {
  return smoothLandmarksEMA(prev, curr, alpha);
}

/** 수정됨 — 세션 로그 한 줄 (0.1초 단위 저장용) */
export function buildDanceSessionLogEntry(tSec, analysis) {
  try {
    const wi = analysis?.worstIssue;
    return {
      t: Math.round(tSec * 10) / 10,
      grade: analysis?.grade ?? '—',
      wrongPart: wi?.labelKo ?? (analysis?.feedback?.[0] ?? ''),
      userAngle: wi?.userDeg ?? null,
      guideAngle: wi?.guideDeg ?? null,
      bodyKey: wi?.key ?? null,
      score: analysis?.score ?? null,
      feedbackLine: analysis?.feedback?.[0] ?? '',
    };
  } catch (e) {
    console.error(e);
    return {
      t: Math.round(tSec * 10) / 10,
      grade: '—',
      wrongPart: '',
      userAngle: null,
      guideAngle: null,
      bodyKey: null,
      score: null,
    };
  }
}
