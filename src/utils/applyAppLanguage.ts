// @ts-nocheck
import i18n from '../i18n';
import { DEFAULT_APP_LANGUAGE, normalizeAppLanguage, persistAppLanguageChoice } from './appLanguage';

/** i18n + html lang 적용 (저장 없음) */
export function applyAppLanguage(lang) {
  const normalized = normalizeAppLanguage(lang || DEFAULT_APP_LANGUAGE);
  if (i18n.language !== normalized) {
    i18n.changeLanguage(normalized);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized;
  }
  return normalized;
}

/** 사용자가 설정에서 언어를 선택했을 때 저장 + 적용 */
export function saveAppLanguageChoice(lang) {
  const normalized = persistAppLanguageChoice(lang);
  applyAppLanguage(normalized);
  return normalized;
}
