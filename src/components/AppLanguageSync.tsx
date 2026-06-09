// @ts-nocheck
import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsSlice';
import { useLanguageStore } from '../store/languageStore';
import { DEFAULT_APP_LANGUAGE } from '../utils/appLanguage';

/**
 * 설정 스토어의 coachLanguage가 바뀔 때 UI 언어를 동기화합니다.
 * (기본값 ko, 사용자가 설정에서 선택한 경우에만 변경)
 */
export default function AppLanguageSync() {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const coachLanguage = useSettingsStore((s) => s.settings?.coachLanguage);
  const preferredLanguage = useSettingsStore((s) => s.settings?.preferredLanguage);
  const syncLanguage = useLanguageStore((s) => s.syncLanguage);

  useEffect(() => {
    if (!hydrated) return;
    syncLanguage(coachLanguage || preferredLanguage || DEFAULT_APP_LANGUAGE);
  }, [hydrated, coachLanguage, preferredLanguage, syncLanguage]);

  return null;
}
