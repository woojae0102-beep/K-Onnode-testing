// @ts-nocheck
import { create } from 'zustand';
import { applyAppLanguage, saveAppLanguageChoice } from '../utils/applyAppLanguage';
import {
  DEFAULT_APP_LANGUAGE,
  normalizeAppLanguage,
  resolveAppLanguage,
  SUPPORTED_APP_LANGUAGES,
} from '../utils/appLanguage';

const initialLanguage = resolveAppLanguage();
applyAppLanguage(initialLanguage);

export const useLanguageStore = create((set) => ({
  language: initialLanguage,
  /** 설정에서 언어 변경 시 호출 — 저장 + 적용 */
  setLanguage: (lang) => {
    const normalized = saveAppLanguageChoice(lang);
    set({ language: normalized });
    return normalized;
  },
  /** 저장 없이 현재 설정값만 UI에 반영 */
  syncLanguage: (lang) => {
    const normalized = normalizeAppLanguage(lang || DEFAULT_APP_LANGUAGE);
    applyAppLanguage(normalized);
    set({ language: normalized });
    return normalized;
  },
}));

export const SUPPORTED_LANGUAGES = [...SUPPORTED_APP_LANGUAGES];
