// @ts-nocheck
const STORAGE_KEY = 'onnode_practice_history_v1';
const MAX_HISTORY = 30;

const METRIC_LABELS = {
  overall: '종합',
  overallScore: '종합',
  rhythm: '리듬',
  posture: '자세',
  angle: '각도',
  expression: '표현',
  energy: '에너지',
  stability: '안정성',
  position: '포지션',
  timing: '타이밍',
  pose: '동작',
  formation: '대형',
  pronunciation: '발음',
  accuracy: '정확도',
  fluency: '유창성',
  avgScore: '평균 점수',
};

function loadAll() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('onnode-practice-history-update'));
  } catch {
    /* ignore */
  }
}

function normalizeScores(payload) {
  if (payload.scores && typeof payload.scores === 'object') return payload.scores;
  if (payload.syncScores) return payload.syncScores;
  if (payload.metrics) return payload.metrics;
  if (typeof payload.overallScore === 'number') return { overall: payload.overallScore };
  if (typeof payload.overall === 'number') return { overall: payload.overall };
  return {};
}

export function buildSessionKey(domain, parts = {}) {
  if (domain.startsWith('tv-')) return `${domain}:${parts.agency || 'default'}`;
  if (domain === 'group-practice') return `${domain}:${parts.songId || 'song'}:${parts.memberId || 'member'}`;
  if (domain === 'audition') return `${domain}:${parts.agencyId || 'agency'}`;
  if (domain.startsWith('korean')) return `${domain}:${parts.mode || 'pronunciation'}`;
  return `${domain}:${parts.id || 'default'}`;
}

export function compareSessions(current, previous) {
  if (!previous) return null;

  const curScores = normalizeScores(current);
  const prevScores = normalizeScores(previous);
  const curOverall = current.overallScore ?? current.overall ?? curScores.overall ?? 0;
  const prevOverall = previous.overallScore ?? previous.overall ?? prevScores.overall ?? 0;
  const overallDelta = curOverall - prevOverall;

  const improved = [];
  const stillWeak = [];

  const allKeys = new Set([...Object.keys(curScores), ...Object.keys(prevScores)]);
  allKeys.forEach((key) => {
    const cur = Number(curScores[key] ?? 0);
    const prev = Number(prevScores[key] ?? 0);
    if (!cur && !prev) return;
    const delta = cur - prev;
    const label = METRIC_LABELS[key] || key;
    if (delta >= 5) {
      improved.push({ key, label, current: cur, previous: prev, delta });
    } else if (cur < 70 && cur > 0) {
      stillWeak.push({ key, label, current: cur, previous: prev, delta });
    } else if (delta <= -5) {
      stillWeak.push({ key, label, current: cur, previous: prev, delta });
    }
  });

  if (overallDelta >= 5) {
    improved.unshift({ key: 'overall', label: '종합 점수', current: curOverall, previous: prevOverall, delta: overallDelta });
  } else if (overallDelta <= -5 || curOverall < 70) {
    stillWeak.unshift({ key: 'overall', label: '종합 점수', current: curOverall, previous: prevOverall, delta: overallDelta });
  }

  const prevWeak = previous.weaknesses || [];
  const curWeak = current.weaknesses || [];
  curWeak.forEach((w) => {
    if (prevWeak.includes(w)) {
      stillWeak.push({ key: 'weakness', label: w, current: null, previous: null, delta: 0, text: w });
    }
  });

  const prevStrengths = new Set(previous.strengths || []);
  (current.strengths || []).forEach((s) => {
    if (!prevStrengths.has(s)) {
      improved.push({ key: 'strength', label: s, current: null, previous: null, delta: 0, text: s });
    }
  });

  return {
    previousDate: previous.completedAt,
    previousOverall: prevOverall,
    currentOverall: curOverall,
    overallDelta,
    improved: improved.slice(0, 6),
    stillWeak: stillWeak.slice(0, 6),
    sessionCount: (previous.sessionCount || 1) + 1,
  };
}

export function savePracticeSession(domain, sessionKey, payload) {
  const all = loadAll();
  const bucket = all[sessionKey] || { latest: null, history: [] };
  const previous = bucket.latest;

  const entry = {
    ...payload,
    domain,
    sessionKey,
    completedAt: payload.completedAt || new Date().toISOString(),
    sessionCount: (previous?.sessionCount || 0) + 1,
  };

  if (previous) {
    bucket.history = [previous, ...bucket.history].slice(0, MAX_HISTORY);
  }
  bucket.latest = entry;
  all[sessionKey] = bucket;
  saveAll(all);

  return {
    entry,
    previous,
    comparison: compareSessions(entry, previous),
  };
}

export function getPreviousSession(sessionKey) {
  return loadAll()[sessionKey]?.latest || null;
}

export function getSessionHistory(sessionKey, limit = 10) {
  const bucket = loadAll()[sessionKey];
  if (!bucket) return [];
  return [bucket.latest, ...(bucket.history || [])].filter(Boolean).slice(0, limit);
}

export function getMetricLabel(key) {
  return METRIC_LABELS[key] || key;
}
