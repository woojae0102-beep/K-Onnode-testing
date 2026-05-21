import { create } from 'zustand';

const defaultSettings = {
  profile: {
    nickname: 'ONNODE STAR',
    level: 'LV.3',
    avatarUrl: '',
  },
  tracks: ['dance', 'vocal', 'korean'],
  coachLanguage: 'ko',
  coachTone: 'friendly',
  feedbackSensitivity: 3,
  coachMode: 'single',
  dancePersona: 'jyp_jung',
  vocalPersona: 'jyp_park',
  micSensitivity: 6,
  noiseFilter: true,
  cameraDefault: 'front',
  autoSaveVideo: true,
  storageDuration: 'days30',
  storageUsageGb: 1.2,
  reportFormat: 'pdf',
  preferredLanguage: 'ko',
  snsConnections: {
    tiktok: { connected: false, username: null, token: null },
    instagram: { connected: false, username: null, token: null },
    youtube: { connected: false, username: null, token: null },
    twitter: { connected: false, username: null, token: null },
  },
  practiceReminderEnabled: false,
  practiceReminderTime: '20:00',
  practiceReminderDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  weeklyPlan: {},
  subscription: {
    plan: 'free',
    status: 'inactive',
    nextBillingDate: '',
    monthlyPrice: 9900,
    currency: 'KRW',
  },
};

export const useSettingsStore = create((set) => ({
  settings: defaultSettings,
  hydrated: false,
  hydrateSettings: (payload) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...payload,
        profile: { ...state.settings.profile, ...(payload?.profile || {}) },
        subscription: { ...state.settings.subscription, ...(payload?.subscription || {}) },
        snsConnections: {
          ...state.settings.snsConnections,
          ...(payload?.snsConnections || {}),
        },
        weeklyPlan: { ...state.settings.weeklyPlan, ...(payload?.weeklyPlan || {}) },
      },
      hydrated: true,
    })),
  updateSetting: (key, value) =>
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    })),
  updateNestedSetting: (key, payload) =>
    set((state) => ({
      settings: { ...state.settings, [key]: { ...(state.settings[key] || {}), ...(payload || {}) } },
    })),
  updateSNSConnection: (platform, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        snsConnections: {
          ...state.settings.snsConnections,
          [platform]: { ...(state.settings.snsConnections?.[platform] || {}), ...(value || {}) },
        },
      },
    })),
}));

export const SETTINGS_STORAGE_KEY = 'onnode.settings.v1';
export const settingsDefaults = defaultSettings;
