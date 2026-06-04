// @ts-nocheck
/** AI 코치 탭 리포트와 동기화 (localStorage + 커스텀 이벤트) */
export const TEACHING_REPORTS_KEY = 'onnode_teaching_reports_v1';

export function saveTeachingReport(domain, payload) {
  if (typeof window === 'undefined') return;
  const entry = {
    domain,
    payload,
    updatedAt: Date.now(),
  };
  try {
    const raw = window.localStorage.getItem(TEACHING_REPORTS_KEY);
    const prev = raw ? JSON.parse(raw) : {};
    const next = {
      ...prev,
      [domain]: { ...entry, history: [...(prev[domain]?.history || []), entry].slice(-20) },
    };
    window.localStorage.setItem(TEACHING_REPORTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('onnode-teaching-report', { detail: { domain, payload } }));
}

export function loadTeachingReports() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(TEACHING_REPORTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
