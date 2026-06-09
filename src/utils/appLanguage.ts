// @ts-nocheck
/**
 * 앱 UI 언어 정책
 * - 기본값: 한국어(ko)
 * - 변경: 설정 화면에서 사용자가 언어를 선택했을 때만
 * - 저장소: settings.localStorage (coachLanguage / preferredLanguage)
 */
import { SETTINGS_STORAGE_KEY } from '../store/settingsSlice';

export const DEFAULT_APP_LANGUAGE = 'ko';

export const SUPPORTED_APP_LANGUAGES = ['ko', 'en', 'ja', 'th', 'vi', 'es', 'fr', 'zh'] as const;

export function normalizeAppLanguage(lang) {
  return SUPPORTED_APP_LANGUAGES.includes(lang) ? lang : DEFAULT_APP_LANGUAGE;
}

function readLanguageFromSettingsStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lang = parsed?.coachLanguage || parsed?.preferredLanguage;
    return SUPPORTED_APP_LANGUAGES.includes(lang) ? lang : null;
  } catch {
    return null;
  }
}

/** 앱 시작 시 사용할 언어 (설정에 저장된 값 없으면 한국어) */
export function resolveAppLanguage() {
  if (typeof window === 'undefined') return DEFAULT_APP_LANGUAGE;
  return normalizeAppLanguage(readLanguageFromSettingsStorage());
}

/** 사용자가 설정에서 언어를 선택했을 때 localStorage에 저장 */
export function persistAppLanguageChoice(lang) {
  const normalized = normalizeAppLanguage(lang);

  if (typeof window === 'undefined') return normalized;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...parsed,
        coachLanguage: normalized,
        preferredLanguage: normalized,
      }),
    );
    window.localStorage.setItem('onnode-language', normalized);
    window.localStorage.setItem('onnode.preferredLanguage', normalized);
  } catch {
    /* ignore */
  }

  return normalized;
}
