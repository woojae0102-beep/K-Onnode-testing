// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import i18n from '../i18n';
import { SETTINGS_STORAGE_KEY, useSettingsStore } from '../store/settingsSlice';
import {
  cancelSubscription,
  disconnectSNS,
  generateCoachPlan,
  getSNSConnections,
  getSubscription,
  patchUserSettings,
  saveSNSConnection,
  upgradeSubscription,
} from '../services/settingsApi';

function getSettingsRef({ db, appId, user }) {
  if (!db || !appId || !user?.uid) return null;
  return doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
}

export function useSettings({ db, appId, user, sessionData }) {
  const { settings, hydrated, hydrateSettings, updateSetting, updateNestedSetting, updateSNSConnection } = useSettingsStore();
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!hydrated) {
      const localRaw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (localRaw) {
        try {
          hydrateSettings(JSON.parse(localRaw));
        } catch (err) {
          console.error('Local settings parse failed', err);
          hydrateSettings({});
        }
      } else {
        hydrateSettings({});
      }
    }
  }, [hydrateSettings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated || !user?.uid) return;
    const settingsRef = getSettingsRef({ db, appId, user });
    if (!settingsRef) return;
    getDoc(settingsRef)
      .then((snap) => {
        if (snap.exists()) {
          hydrateSettings(snap.data());
        }
      })
      .catch((err) => console.error('Failed to read settings from db', err));
  }, [db, appId, user?.uid, hydrated, hydrateSettings]);

  const persistSettings = useCallback(
    async (patch) => {
      try {
        await patchUserSettings(patch);
      } catch (err) {
        console.warn('PATCH /api/user/settings fallback', err);
      }
      if (!user?.uid) return;
      const settingsRef = getSettingsRef({ db, appId, user });
      if (!settingsRef) return;
      try {
        await setDoc(settingsRef, { ...patch, updatedAt: Date.now() }, { merge: true });
      } catch (err) {
        console.error('Failed to save settings', err);
      }
    },
    [db, appId, user]
  );

  const updateSimpleSetting = useCallback(
    async (key, value) => {
      updateSetting(key, value);
      await persistSettings({ [key]: value });
    },
    [updateSetting, persistSettings]
  );

  const updateSNS = useCallback(
    async (platform, payload) => {
      const nextSNS = {
        ...(settings.snsConnections || {}),
        [platform]: { ...(settings.snsConnections?.[platform] || {}), ...(payload || {}) },
      };
      updateSNSConnection(platform, payload);
      await persistSettings({ snsConnections: nextSNS });
    },
    [settings.snsConnections, updateSNSConnection, persistSettings]
  );

  const toggleTrack = useCallback(
    async (track) => {
      const current = settings.tracks || [];
      const hasTrack = current.includes(track);
      const next = hasTrack ? current.filter((item) => item !== track) : [...current, track];
      if (!hasTrack && current.length >= 3) return false;
      updateSetting('tracks', next);
      await persistSettings({ tracks: next });
      return true;
    },
    [settings.tracks, updateSetting, persistSettings]
  );

  const setCoachLanguage = useCallback(
    async (lng) => {
      i18n.changeLanguage(lng);
      await updateSimpleSetting('coachLanguage', lng);
      await updateSimpleSetting('preferredLanguage', lng);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('onnode.preferredLanguage', lng);
        window.localStorage.setItem('onnode-language', lng);
      }
    },
    [updateSimpleSetting]
  );

  const fetchSubscription = useCallback(async () => {
    setSubscriptionLoading(true);
    try {
      const data = await getSubscription();
      updateSetting('subscription', { ...settings.subscription, ...data });
      await persistSettings({ subscription: { ...settings.subscription, ...data } });
    } catch (err) {
      console.warn('Subscription fetch fallback', err);
    } finally {
      setSubscriptionLoading(false);
    }
  }, [updateSetting, settings.subscription, persistSettings]);

  const fetchSNSConnections = useCallback(async () => {
    try {
      const data = await getSNSConnections();
      const next = { ...(settings.snsConnections || {}), ...(data || {}) };
      updateSetting('snsConnections', next);
      await persistSettings({ snsConnections: next });
    } catch (err) {
      console.warn('SNS connection fetch fallback', err);
    }
  }, [settings.snsConnections, updateSetting, persistSettings]);

  useEffect(() => {
    if (hydrated) {
      fetchSubscription();
      fetchSNSConnections();
      const pref = window.localStorage.getItem('onnode.preferredLanguage');
      if (pref) i18n.changeLanguage(pref);
    }
  }, [hydrated, fetchSubscription, fetchSNSConnections]);

  const connectSNS = useCallback(
    async (platform) => {
      setActionLoading(true);
      try {
        const oauthBase = import.meta.env.VITE_OAUTH_BASE_URL || '/oauth/start';
        const authUrl = `${oauthBase}?platform=${encodeURIComponent(platform)}`;
        window.open(authUrl, '_blank', 'width=480,height=720');
        const username = window.prompt(`@${platform} username`, '') || null;
        const token = `token_${platform}_${Date.now()}`;
        await saveSNSConnection({ platform, username, token });
        await updateSNS(platform, { connected: true, username, token });
        return true;
      } catch (err) {
        console.error('SNS connect failed', err);
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [updateSNS]
  );

  const disconnectSNSConnection = useCallback(
    async (platform) => {
      setActionLoading(true);
      try {
        await disconnectSNS(platform);
        await updateSNS(platform, { connected: false, username: null, token: null });
        return true;
      } catch (err) {
        console.error('SNS disconnect failed', err);
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [updateSNS]
  );

  const runUpgrade = useCallback(
    async (payload) => {
      setActionLoading(true);
      try {
        const data = await upgradeSubscription(payload || {});
        const next = {
          ...settings.subscription,
          plan: 'premium',
          status: 'active',
          ...(data?.subscription || {}),
        };
        updateSetting('subscription', next);
        await persistSettings({ subscription: next });
        return next;
      } finally {
        setActionLoading(false);
      }
    },
    [settings.subscription, updateSetting, persistSettings]
  );

  const runCancelSubscription = useCallback(async () => {
    setActionLoading(true);
    try {
      await cancelSubscription();
      const next = {
        ...settings.subscription,
        plan: 'free',
        status: 'inactive',
        nextBillingDate: '',
      };
      updateSetting('subscription', next);
      await persistSettings({ subscription: next });
      return true;
    } catch (err) {
      console.error('Cancel subscription failed', err);
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [settings.subscription, updateSetting, persistSettings]);

  const generateWeeklyPlan = useCallback(
    async (payload) => {
      setActionLoading(true);
      try {
        const data = await generateCoachPlan(payload || {});
        const plan = data?.plan || {};
        updateSetting('weeklyPlan', plan);
        await persistSettings({ weeklyPlan: plan });
        return plan;
      } catch (err) {
        console.warn('Generate plan fallback', err);
        const fallback = {
          mon: { morning: 'dance', evening: 'vocal' },
          tue: { morning: 'korean', evening: 'dance' },
          wed: { morning: 'vocal', evening: 'korean' },
          thu: { morning: 'dance', evening: 'vocal' },
          fri: { morning: 'korean', evening: 'dance' },
          sat: { morning: 'free', evening: 'multi' },
          sun: { morning: 'rest', evening: 'light' },
        };
        updateSetting('weeklyPlan', fallback);
        await persistSettings({ weeklyPlan: fallback });
        return fallback;
      } finally {
        setActionLoading(false);
      }
    },
    [updateSetting, persistSettings]
  );

  const statsPreview = useMemo(() => {
    const metrics = sessionData?.metrics || {};
    return {
      totalSessions: Math.max(1, Number(sessionData?.lastUpdate ? 12 : 0)),
      totalMinutes: Math.max(25, Math.round(((metrics.energy || 60) * 2.4) / 1)),
      avgScore: Math.round(((metrics.sync || 75) + (metrics.accuracy || 78) + (metrics.energy || 76)) / 3),
    };
  }, [sessionData]);

  return {
    settings,
    subscriptionLoading,
    actionLoading,
    statsPreview,
    updateSimpleSetting,
    updateSNS,
    toggleTrack,
    setCoachLanguage,
    fetchSubscription,
    connectSNS,
    disconnectSNSConnection,
    runUpgrade,
    runCancelSubscription,
    generateWeeklyPlan,
  };
}
