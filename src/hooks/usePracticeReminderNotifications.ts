// @ts-nocheck
import { useEffect } from 'react';
import i18n from '../i18n';
import { SETTINGS_STORAGE_KEY, useSettingsStore } from '../store/settingsSlice';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SENT_KEY_PREFIX = 'onnode.practiceReminder.sent';

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTimeKey(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function canUseNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

async function showPracticeReminderNotification(time) {
  if (!canUseNotifications() || Notification.permission !== 'granted') return;

  const isKorean = (i18n.language || 'ko').startsWith('ko');
  const title = isKorean ? 'ONNODE 연습 알림' : 'ONNODE Practice Reminder';
  const body = isKorean
    ? `지금은 ${time} 연습 시간이에요. 오늘의 K-POP 트레이닝을 시작해볼까요?`
    : `It is ${time}. Ready for today's K-POP training?`;
  const options = {
    body,
    tag: `onnode-practice-${time}`,
    renotify: true,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration?.showNotification) {
        await registration.showNotification(title, options);
        return;
      }
    }
  } catch {
    // Fallback to the page notification below.
  }

  const notification = new Notification(title, options);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

export function usePracticeReminderNotifications() {
  const settings = useSettingsStore((state) => state.settings);
  const hydrated = useSettingsStore((state) => state.hydrated);
  const hydrateSettings = useSettingsStore((state) => state.hydrateSettings);

  useEffect(() => {
    if (hydrated || typeof window === 'undefined') return;
    const localRaw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!localRaw) {
      hydrateSettings({});
      return;
    }
    try {
      hydrateSettings(JSON.parse(localRaw));
    } catch {
      hydrateSettings({});
    }
  }, [hydrateSettings, hydrated]);

  useEffect(() => {
    if (!hydrated || !settings.practiceReminderEnabled) return undefined;
    if (!canUseNotifications() || Notification.permission !== 'granted') return undefined;

    const checkReminder = () => {
      const now = new Date();
      const todayKey = DAY_KEYS[now.getDay()];
      const selectedDays = settings.practiceReminderDays || [];
      const reminderTime = settings.practiceReminderTime || '20:00';

      if (!selectedDays.includes(todayKey)) return;
      if (getTimeKey(now) !== reminderTime) return;

      const sentKey = `${SENT_KEY_PREFIX}.${getLocalDateKey(now)}.${reminderTime}`;
      if (window.localStorage.getItem(sentKey)) return;

      window.localStorage.setItem(sentKey, String(Date.now()));
      showPracticeReminderNotification(reminderTime);
    };

    checkReminder();
    const timer = window.setInterval(checkReminder, 30 * 1000);
    return () => window.clearInterval(timer);
  }, [
    hydrated,
    settings.practiceReminderDays,
    settings.practiceReminderEnabled,
    settings.practiceReminderTime,
  ]);
}
