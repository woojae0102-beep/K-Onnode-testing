// @ts-nocheck
import { create } from 'zustand';
import i18n from '../i18n';

const STORAGE_KEY = 'onnode-language';
const SUPPORTED = ['ko', 'en', 'ja', 'th', 'vi', 'es', 'fr', 'zh'];

function detectInitialLanguage() {
  if (typeof window === 'undefined') return 'ko';
  try {
    const saved = window.localStorage?.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch {
    // localStorage 접근 실패 시 기본값(ko)으로 폴백
  }
  return 'ko';
}

const initialLanguage = detectInitialLanguage();
if (i18n?.language !== initialLanguage) {
  i18n?.changeLanguage?.(initialLanguage);
}

export const useLanguageStore = create((set) => ({
  language: initialLanguage,
  setLanguage: (lang) => {
    const normalized = SUPPORTED.includes(lang) ? lang : 'en';
    try {
      window.localStorage?.setItem(STORAGE_KEY, normalized);
    } catch {
      // localStorage 접근 실패는 무시
    }
    i18n?.changeLanguage?.(normalized);
    set({ language: normalized });
  },
}));

export const SUPPORTED_LANGUAGES = SUPPORTED;
