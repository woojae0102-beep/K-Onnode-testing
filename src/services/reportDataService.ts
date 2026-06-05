// @ts-nocheck
import { loadTeachingReports, TEACHING_REPORTS_KEY } from './teachingReportStore';
import { groupReportsByDate } from '../mocks/reportMocks';

const GROWTH_KEY = 'onnode_growth_sessions_v1';

const DOMAIN_TO_TRACK = {
  dance: 'dance',
  vocal: 'vocal',
  korean: 'korean',
  'tv-mode': 'dance',
};

function dayKeyFromTs(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function extractOverall(payload, domain) {
  if (!payload) return 0;
  if (domain === 'tv-mode') return Number(payload.overallScore ?? 0);
  if (domain === 'dance') return Number(payload.overall ?? payload.metrics?.overall ?? payload.score ?? 0);
  if (domain === 'vocal') {
    return Number(
      payload.overallPitchScore ?? payload.metrics?.overall ?? payload.liveScore ?? 0,
    );
  }
  if (domain === 'korean') return Number(payload.metrics?.overall ?? payload.overall ?? 0);
  return Number(payload.overallScore ?? payload.score ?? payload.metrics?.overall ?? 0);
}

function buildDetailScores(payload, domain, track) {
  if (domain === 'tv-mode' && payload.scores) {
    const s = payload.scores;
    if (track === 'vocal') {
      return {
        pitch: s.angle ?? 0,
        tempo: s.rhythm ?? 0,
        voice: s.stability ?? 0,
        emotion: s.expression ?? 0,
      };
    }
    return {
      posture: s.posture ?? 0,
      rhythm: s.rhythm ?? 0,
      completion: s.angle ?? 0,
      expression: s.expression ?? 0,
    };
  }
  if (track === 'dance') {
    const overall = extractOverall(payload, domain);
    return {
      posture: overall,
      rhythm: overall,
      completion: overall,
      expression: overall,
    };
  }
  if (track === 'vocal') {
    const overall = extractOverall(payload, domain);
    return { pitch: overall, tempo: overall, voice: overall, emotion: overall };
  }
  const overall = extractOverall(payload, domain);
  return { pronunciation: overall, intonation: overall, fluency: overall, vocabulary: overall };
}

function buildTitle(payload, domain) {
  if (payload.title) return payload.title;
  if (domain === 'tv-mode') {
    const agency = (payload.agency || 'hybe').toUpperCase();
    const mode = payload.mode === 'vocal' ? '보컬' : '댄스';
    return `TV 연습실 — ${agency} ${mode}`;
  }
  if (domain === 'dance') return payload.contentName || '댄스 트레이닝 세션';
  if (domain === 'vocal') return payload.songTitle || payload.contentName || '보컬 트레이닝 세션';
  if (domain === 'korean') return payload.lineText || '한국어 발음 세션';
  return `${domain} 트레이닝`;
}

function entryToReport(domain, entry, index) {
  const payload = entry.payload || entry;
  const ts = entry.updatedAt || payload.completedAt || payload.updatedAt || Date.now();
  const track =
    domain === 'tv-mode'
      ? payload.mode === 'vocal'
        ? 'vocal'
        : 'dance'
      : DOMAIN_TO_TRACK[domain] || 'dance';
  const overall = extractOverall(payload, domain);
  const date = dayKeyFromTs(ts);

  return {
    id: `real-${domain}-${ts}-${index}`,
    userId: 'local',
    track,
    date,
    contentName: buildTitle(payload, domain),
    overallScore: Math.round(overall),
    detailScores: buildDetailScores(payload, domain, track),
    aiComment:
      payload.weaknesses?.[0] ||
      payload.feedback?.summary ||
      payload.pitchFeedback ||
      'AI 분석 완료',
    aiFeedback:
      payload.recommendations?.join('\n') ||
      payload.feedback?.message ||
      payload.feedback ||
      `종합 점수 ${Math.round(overall)}점으로 기록되었습니다.`,
    timeline: [],
    recommendedRoutine: (payload.recommendations || []).slice(0, 3).map((rec, i) => ({
      day: i + 1,
      track,
      activity: typeof rec === 'string' ? rec : rec.activity || '연습',
      duration: 10,
    })),
    recommendedContent: [],
    createdAt: new Date(ts).toISOString(),
    source: domain,
  };
}

function collectFromTeachingStore() {
  const stored = loadTeachingReports();
  const reports = [];

  Object.entries(stored).forEach(([domain, bucket]) => {
    const history = bucket?.history || [];
    history.forEach((entry, i) => {
      if (entry?.payload) reports.push(entryToReport(domain, entry, i));
    });
    if (bucket?.payload && !history.length) {
      reports.push(entryToReport(domain, { payload: bucket.payload, updatedAt: bucket.updatedAt }, 0));
    }
  });

  return reports;
}

function collectFromGrowthSessions() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GROWTH_KEY);
    const sessions = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(sessions)) return [];

    return sessions.map((s, i) => {
      const track = s.domain === 'korean' ? 'korean' : s.domain === 'vocal' ? 'vocal' : 'dance';
      const ts = s.at || Date.now();
      const score = Math.round(Number(s.score) || 0);
      return {
        id: `growth-${ts}-${i}`,
        userId: 'local',
        track,
        date: dayKeyFromTs(ts),
        contentName: `${track} 라이브 세션`,
        overallScore: score,
        detailScores: buildDetailScores({ score }, track, track),
        aiComment: '실시간 트레이닝 기록',
        aiFeedback: `라이브 트레이닝에서 ${score}점을 기록했습니다.`,
        timeline: [],
        recommendedRoutine: [],
        recommendedContent: [],
        createdAt: new Date(ts).toISOString(),
        source: 'growth',
      };
    });
  } catch {
    return [];
  }
}

export function fetchRealReports({ track = 'all', limit = 10, offset = 0 } = {}) {
  const merged = [...collectFromTeachingStore(), ...collectFromGrowthSessions()];
  const deduped = merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const filtered = deduped.filter((r) => (track === 'all' ? true : r.track === track));

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    hasRealData: filtered.length > 0,
  };
}

export function fetchRealReportById(id) {
  const { items } = fetchRealReports({ track: 'all', limit: 500, offset: 0 });
  return items.find((r) => r.id === id) || null;
}

export function subscribeReportUpdates(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener('onnode-teaching-report', handler);
  window.addEventListener('storage', (e) => {
    if (e.key === TEACHING_REPORTS_KEY || e.key === GROWTH_KEY) handler();
  });
  return () => {
    window.removeEventListener('onnode-teaching-report', handler);
  };
}

export { groupReportsByDate };
