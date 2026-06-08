// @ts-nocheck

export const TV_HOST_MODE = '__TV_HOST__';

export function generateStudioCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** @deprecated use generateStudioCode */
export function generateTVSessionCode() {
  return generateStudioCode();
}

export function parseTVCodeFromUrl() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const tv = params.get('tv');
  const studio = params.get('studio');
  if (tv === null && studio === null) return '';
  const raw = tv ?? studio ?? '';
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === 'join' || trimmed === 'studio' || trimmed === 'tv') {
    return TV_HOST_MODE;
  }
  return trimmed.toUpperCase();
}

export function buildTVDisplayUrl(code) {
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return `${base}?tv=${encodeURIComponent(String(code || ''))}`;
}

export function buildStudioTvLandingUrl() {
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return `${base}?tv=join`;
}

export function isValidStudioCode(code) {
  return /^\d{6}$/.test(String(code || '').trim());
}
