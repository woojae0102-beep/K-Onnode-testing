import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_APP_LANGUAGE, resolveAppLanguage } from './utils/appLanguage';
import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import th from './locales/th.json';
import vi from './locales/vi.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';

const resources = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
  th: { translation: th },
  vi: { translation: vi },
  es: { translation: es },
  fr: { translation: fr },
  zh: { translation: zh },
};

const initialLanguage = resolveAppLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: DEFAULT_APP_LANGUAGE,
  supportedLngs: ['ko', 'en', 'ja', 'th', 'vi', 'es', 'fr', 'zh'],
  interpolation: { escapeValue: false },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage;
}

export default i18n;
