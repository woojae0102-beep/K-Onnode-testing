// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AGENCY_IDS,
  MonthlyAccumulatedData,
  MonthlyResult,
  SessionRecord,
  SessionType,
} from '../data/monthlyEvalData';

const SESSIONS_KEY = 'onnode.monthly.sessions';
const RESULTS_KEY = 'onnode.monthly.results';

function formatMonth(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function loadSessions(): SessionRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse<SessionRecord[]>(window.localStorage.getItem(SESSIONS_KEY), []);
}

function saveSessions(items: SessionRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(items.slice(-2000)));
}

function loadResults(): Record<string, MonthlyResult> {
  if (typeof window === 'undefined') return {};
  return safeParse<Record<string, MonthlyResult>>(window.localStorage.getItem(RESULTS_KEY), {});
}

function saveResults(map: Record<string, MonthlyResult>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RESULTS_KEY, JSON.stringify(map));
}

function avg(nums: number[], digits = 1): number {
  if (!nums.length) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Number((sum / nums.length).toFixed(digits));
}

function topItem(items: string[]): string {
  if (!items?.length) return '';
  const counts = new Map<string, number>();
  items.forEach((s) => counts.set(s, (counts.get(s) || 0) + 1));
  let best = '';
  let bestCount = 0;
  counts.forEach((c, key) => {
    if (c > bestCount) {
      best = key;
      bestCount = c;
    }
  });
  return best;
}

function uniqueDays(records: SessionRecord[]): number {
  const set = new Set<string>();
  records.forEach((r) => {
    const d = new Date(r.date);
    set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });
  return set.size;
}

function maxStreak(records: SessionRecord[]): number {
  if (!records.length) return 0;
  const days = Array.from(
    new Set(
      records.map((r) => {
        const d = new Date(r.date);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      })
    )
  ).sort((a, b) => a - b);
  let best = 1;
  let cur = 1;
  for (let i = 1; i < days.length; i += 1) {
    const diffDays = Math.round((days[i] - days[i - 1]) / 86400000);
    if (diffDays === 1) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

function summarizeType(records: SessionRecord[], previousAvg: number) {
  const scores = records.map((r) => Number(r.score) || 0).filter(Number.isFinite);
  const avgScore = avg(scores);
  return {
    sessions: records.length,
    avgScore,
    improvement: previousAvg ? Math.round(avgScore - previousAvg) : 0,
    bestSessionScore: scores.length ? Math.round(Math.max(...scores)) : 0,
    topWeakness: topItem(records.flatMap((r) => r.weakness || [])),
    topStrength: topItem(records.flatMap((r) => r.strength || [])),
  };
}

export function processRawData(
  month: string,
  allSessions: SessionRecord[],
  previousResults: MonthlyResult[]
): MonthlyAccumulatedData {
  const monthRecords = allSessions.filter((s) => formatMonth(new Date(s.date)) === month);

  const dance = monthRecords.filter((s) => s.type === 'dance');
  const vocal = monthRecords.filter((s) => s.type === 'vocal');
  const korean = monthRecords.filter((s) => s.type === 'korean');
  const audition = monthRecords.filter((s) => s.type === 'audition');

  const lastResult = previousResults[previousResults.length - 1];
  const previousDanceAvg = lastResult?.month
    ? averageFromHistory(allSessions, lastResult.month, 'dance')
    : 0;
  const previousVocalAvg = lastResult?.month
    ? averageFromHistory(allSessions, lastResult.month, 'vocal')
    : 0;
  const previousKoreanAvg = lastResult?.month
    ? averageFromHistory(allSessions, lastResult.month, 'korean')
    : 0;

  const danceSummary = summarizeType(dance, previousDanceAvg);
  const vocalSummary = summarizeType(vocal, previousVocalAvg);
  const koreanSummary = summarizeType(korean, previousKoreanAvg);

  const totalDays = uniqueDays(monthRecords);
  const streakDays = maxStreak(monthRecords);
  const lateDays = monthRecords.filter((r) => (r.duration || 0) < 5 * 60).length;
  const weeksInMonth = Math.max(1, Math.ceil(new Date().getDate() / 7));

  const agencyResults: Record<string, string> = {};
  AGENCY_IDS.forEach((id) => {
    const matches = audition.filter((s) => (s.weakness || []).includes(id) || (s.strength || []).includes(id));
    agencyResults[id] = matches.length ? 'pending' : '';
  });

  return {
    month,
    userId: 'local',
    dance: {
      sessions: danceSummary.sessions,
      avgScore: danceSummary.avgScore,
      improvement: danceSummary.improvement,
      topWeakness: danceSummary.topWeakness || '안정적인 표정 연결',
      topStrength: danceSummary.topStrength || '동작 임팩트',
      consistencyScore: dance.length ? Math.min(100, Math.round((uniqueDays(dance) / 28) * 100)) : 0,
      bestSessionScore: danceSummary.bestSessionScore,
    },
    vocal: {
      sessions: vocalSummary.sessions,
      avgPitchAccuracy: vocalSummary.avgScore,
      breathingStability: vocalSummary.bestSessionScore
        ? Math.max(50, Math.min(95, vocalSummary.avgScore - 5))
        : 0,
      improvement: vocalSummary.improvement,
      topWeakness: vocalSummary.topWeakness || '호흡 안정성',
      topStrength: vocalSummary.topStrength || '음색',
      liveAbility: vocalSummary.avgScore ? Math.max(40, vocalSummary.avgScore - 8) : 0,
    },
    korean: {
      sessions: koreanSummary.sessions,
      pronunciation: koreanSummary.avgScore,
      intonation: koreanSummary.bestSessionScore
        ? Math.max(40, koreanSummary.avgScore - 4)
        : 0,
      improvement: koreanSummary.improvement,
      topWeakness: koreanSummary.topWeakness || '받침 발음',
    },
    audition: {
      attempts: audition.length,
      bestResult: audition.length ? 'pending' : 'pending',
      agencyResults,
      interviewScore: avg(audition.map((s) => s.score || 0)),
    },
    consistency: {
      weeklyAttendance: Number((totalDays / weeksInMonth).toFixed(1)),
      totalDays,
      streakDays,
      lateDays,
    },
    previousMonths: previousResults,
  };
}

function averageFromHistory(allSessions: SessionRecord[], month: string, type: SessionType): number {
  const inMonth = allSessions.filter(
    (s) => formatMonth(new Date(s.date)) === month && s.type === type
  );
  if (!inMonth.length) return 0;
  return avg(inMonth.map((s) => Number(s.score) || 0));
}

export function useMonthlyData() {
  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadSessions());
  const [results, setResults] = useState<Record<string, MonthlyResult>>(() => loadResults());
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const recordSession = useCallback((sessionData: Partial<SessionRecord> & { type: SessionType; score: number }) => {
    const record: SessionRecord = {
      type: sessionData.type,
      score: Number(sessionData.score) || 0,
      duration: Number(sessionData.duration) || 0,
      weakness: sessionData.weakness || [],
      strength: sessionData.strength || [],
      date: typeof sessionData.date === 'number' ? sessionData.date : Date.now(),
    };
    setSessions((prev) => {
      const next = [...prev, record].slice(-2000);
      saveSessions(next);
      return next;
    });
  }, []);

  const previousResults = useMemo(() => {
    return Object.values(results).sort((a, b) => (a.month < b.month ? -1 : 1));
  }, [results]);

  const getMonthlyData = useCallback(
    (month?: string): MonthlyAccumulatedData => {
      const targetMonth = month || formatMonth(new Date());
      return processRawData(targetMonth, sessionsRef.current, previousResults.filter((r) => r.month < targetMonth));
    },
    [previousResults]
  );

  const saveMonthlyResult = useCallback((month: string, result: MonthlyResult) => {
    setResults((prev) => {
      const next = { ...prev, [month]: result };
      saveResults(next);
      return next;
    });
  }, []);

  const getEvalCountdown = useCallback(() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return Math.max(0, lastDay - today.getDate());
  }, []);

  const isEvalAvailable = useCallback(() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return today.getDate() >= lastDay - 2;
  }, []);

  const isEvalDay = useCallback(() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return today.getDate() === lastDay;
  }, []);

  const seedSampleData = useCallback(() => {
    const now = Date.now();
    const samples: SessionRecord[] = [];
    const types: SessionType[] = ['dance', 'vocal', 'korean'];
    for (let i = 0; i < 24; i += 1) {
      const t = types[i % types.length];
      samples.push({
        type: t,
        score: 60 + Math.floor(Math.random() * 30),
        duration: 5 * 60 + Math.floor(Math.random() * 25 * 60),
        weakness: t === 'dance' ? ['표정 연결'] : t === 'vocal' ? ['호흡 안정성'] : ['받침 발음'],
        strength: t === 'dance' ? ['동작 임팩트'] : t === 'vocal' ? ['음색'] : ['억양'],
        date: now - i * 86400000,
      });
    }
    setSessions((prev) => {
      const next = [...prev, ...samples].slice(-2000);
      saveSessions(next);
      return next;
    });
  }, []);

  return {
    sessions,
    recordSession,
    getMonthlyData,
    previousResults,
    saveMonthlyResult,
    getEvalCountdown,
    isEvalAvailable,
    isEvalDay,
    seedSampleData,
  };
}

export { formatMonth };
