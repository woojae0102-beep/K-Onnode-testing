// @ts-nocheck

export const TV_HOST_MODE = '__TV_HOST__';

export function generateStudioCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** @deprecated use generateStudioCode */
export function generateTVSessionCode() {
  return generateStudioCode();
}

export function isTvLandingPath() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/tv' || path.endsWith('/tv');
}

export function parseTVCodeFromUrl() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);

  if (isTvLandingPath()) {
    const codeParam = params.get('code');
    if (isValidStudioCode(codeParam)) return String(codeParam).trim();
    return TV_HOST_MODE;
  }

  const tv = params.get('tv');
  const studio = params.get('studio');
  if (tv === null && studio === null) return '';
  const raw = tv ?? studio ?? '';
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === 'join' || trimmed === 'studio' || trimmed === 'tv') {
    return TV_HOST_MODE;
  }
  return trimmed;
}

export function buildTVDisplayUrl(code) {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  return `${origin}/tv?code=${encodeURIComponent(String(code || ''))}`;
}

export function buildStudioTvLandingUrl() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/tv`;
}

export function isValidStudioCode(code) {
  return /^\d{6}$/.test(String(code || '').trim());
}
