// @ts-nocheck
import React, { useMemo, useState } from 'react';
import {
  BellRing,
  Camera,
  ChartColumn,
  Check,
  CircleHelp,
  Folder,
  Globe,
  Languages,
  Mail,
  Mic,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SettingsSection from '../components/settings/SettingsSection';
import SettingsItem from '../components/settings/SettingsItem';
import SubscriptionCard from '../components/settings/SubscriptionCard';
import LanguageSelector from '../components/settings/LanguageSelector';
import { useSettings } from '../hooks/useSettings';

const toneOptions = ['friendly', 'expert'];
const coachModes = ['single', 'multi', 'free'];
const durations = ['days7', 'days30', 'unlimited'];
const reportFormats = ['pdf', 'image'];
const trackOrder = ['dance', 'vocal', 'korean'];
const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const routineSlots = ['morning', 'evening'];

function getInitials(nickname) {
  return (nickname || 'ONNODE')
    .split(' ')
    .map((v) => v?.[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function SettingsScreen({ user, db, appId, sessionData }) {
  const { t } = useTranslation();
  const [permissionState, setPermissionState] = useState('');
  const [languageOpen, setLanguageOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [toast, setToast] = useState('');
  const {
    settings,
    subscriptionLoading,
    actionLoading,
    statsPreview,
    updateSimpleSetting,
    toggleTrack,
    setCoachLanguage,
    runUpgrade,
    runCancelSubscription,
    generateWeeklyPlan,
  } = useSettings({ db, appId, user, sessionData });

  const profilePreview = useMemo(
    () => ({
      nickname: settings.profile?.nickname || 'ONNODE STAR',
      level: settings.profile?.level || 'LV.3',
      avatarUrl: settings.profile?.avatarUrl || '',
    }),
    [settings.profile]
  );

  const feedbackLabel = useMemo(() => {
    if (settings.feedbackSensitivity <= 2) return t('settings.feedbackLabel.gentle');
    if (settings.feedbackSensitivity >= 4) return t('settings.feedbackLabel.strict');
    return t('settings.feedbackLabel.normal');
  }, [settings.feedbackSensitivity, t]);

  const handleTrackToggle = async (track) => {
    const ok = await toggleTrack(track);
    if (!ok) {
      setToast(t('settings.labels.maxTracksNotice'));
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => {
      setToast('');
    }, 2200);
  };

  const checkMicCameraPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState(t('settings.labels.permissionGranted'));
    } catch {
      setPermissionState(t('settings.labels.permissionDenied'));
    }
  };

  const handleExport = async () => {
    const fileContent = `${t('settings.report.title')}\nMode: ${settings.coachMode}\nAvg Score: ${statsPreview.avgScore}`;
    const blob = new Blob([fileContent], { type: settings.reportFormat === 'pdf' ? 'application/pdf' : 'text/plain' });
    const file = new File([blob], `onnode-report.${settings.reportFormat === 'pdf' ? 'pdf' : 'txt'}`, {
      type: blob.type,
    });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: t('settings.report.title') });
      showToast(t('settings.toast.exportSuccess'));
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('settings.toast.exportSuccess'));
  };

  const openPaddleCheckout = () => {
    const paddle = window.Paddle;
    if (paddle?.Checkout?.open) {
      paddle.Checkout.open({
        product: import.meta.env.VITE_PADDLE_PRODUCT_ID || 'ONNODE_PREMIUM_PRODUCT',
        email: user?.email || '',
      });
      return;
    }
    showToast(t('settings.subscription.paddleNotReady'));
  };

  const openPaymentMethod = () => {
    const portal = import.meta.env.VITE_PADDLE_PORTAL_URL;
    if (portal) {
      window.open(portal, '_blank');
      return;
    }
    showToast(t('settings.subscription.paymentScreenFallback'));
  };

  const confirmUpgrade = async () => {
    try {
      await runUpgrade({ plan: 'premium', provider: 'paddle' });
      openPaddleCheckout();
      setShowUpgradeModal(false);
      showToast(t('settings.toast.upgradeSuccess'));
    } catch (err) {
      showToast(t('settings.toast.requestFailed'));
      console.error(err);
    }
  };

  const confirmCancelSubscription = async () => {
    const ok = await runCancelSubscription();
    if (ok) {
      setShowCancelModal(false);
      showToast(t('settings.toast.cancelSuccess'));
    } else {
      showToast(t('settings.toast.requestFailed'));
    }
  };

  const generateRoutine = async () => {
    await generateWeeklyPlan({
      tracks: settings.tracks,
      level: settings.profile?.level || 'LV.1',
    });
    showToast(t('settings.toast.planGenerated'));
  };

  const updateRoutineSlot = (day, slot) => {
    const value = window.prompt(t('settings.routine.slotPrompt'), settings.weeklyPlan?.[day]?.[slot] || '');
    if (value == null) return;
    const next = {
      ...(settings.weeklyPlan || {}),
      [day]: {
        ...(settings.weeklyPlan?.[day] || {}),
        [slot]: value,
      },
    };
    updateSimpleSetting('weeklyPlan', next);
  };

  const toggleReminderDay = (day) => {
    const prev = settings.practiceReminderDays || [];
    const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
    updateSimpleSetting('practiceReminderDays', next);
  };

  const routineDaysLabel = useMemo(
    () =>
      weekDays.map((day) => ({
        key: day,
        label: t(`settings.days.${day}`),
      })),
    [t]
  );

  const privacyDataDelete = async () => {
    try {
      await fetch('/api/user/data', { method: 'DELETE' });
      setShowDeleteDataModal(false);
      showToast(t('settings.toast.dataDeleted'));
    } catch (err) {
      showToast(t('settings.toast.requestFailed'));
      console.error(err);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-[#F5F5F7] space-y-7">
      {toast ? (
        <div className="fixed top-6 right-6 z-50 bg-[#111111] text-white px-4 py-2 rounded-xl text-sm shadow-xl">
          {toast}
        </div>
      ) : null}

      <div>
        <h2 className="text-2xl font-black">{t('settings.title')}</h2>
        <p className="text-sm text-slate-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      <SettingsSection title={t('settings.sections.profile')}>
        <SettingsItem
          icon={UserRound}
          label={t('settings.myProfile')}
          description={`${profilePreview.nickname} · ${profilePreview.level}`}
          onClick={() => window.alert(t('settings.navigation.profileEdit'))}
          rightContent={
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-pink-500 text-white text-xs font-black flex items-center justify-center overflow-hidden">
                {profilePreview.avatarUrl ? <img src={profilePreview.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : getInitials(profilePreview.nickname)}
              </div>
            </div>
          }
        />

        <div className="w-full rounded-2xl border border-[#E5E5E5] bg-[#F5F5F7] px-[14px] py-[13px]">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E5E5] flex items-center justify-center shrink-0">
              <SlidersHorizontal size={18} className="text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-[#111111]">{t('settings.trackSelection')}</p>
              <p className="text-xs font-normal text-[#888888] mt-1 leading-snug">
                {t('settings.labels.maxTracksNotice')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {trackOrder.map((track) => {
              const active = settings.tracks.includes(track);
              return (
                <button
                  key={track}
                  type="button"
                  onClick={() => handleTrackToggle(track)}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                    active
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {t(`settings.track.${track}`)}
                </button>
              );
            })}
          </div>
        </div>

        <SettingsItem
          icon={ChartColumn}
          label={t('settings.myStats')}
          description={`${statsPreview.totalSessions} ${t('settings.labels.sessions')} · ${statsPreview.totalMinutes} ${t('settings.labels.minutes')} · ${statsPreview.avgScore} ${t(
            'settings.labels.avgScore'
          )}`}
          onClick={() => window.alert(t('settings.navigation.statsDetail'))}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sections.aiCoach')}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Languages size={16} className="text-slate-600" />
            <p className="font-bold text-slate-900">{t('settings.coachLanguageTone')}</p>
          </div>
          <LanguageSelector
            value={settings.coachLanguage}
            onChange={setCoachLanguage}
            open={languageOpen}
            onOpen={() => setLanguageOpen(true)}
            onClose={() => setLanguageOpen(false)}
          />
          <div className="grid grid-cols-2 gap-2">
            {toneOptions.map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => updateSimpleSetting('coachTone', tone)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  settings.coachTone === tone ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-slate-300 text-slate-600'
                }`}
              >
                {t(`settings.tone.${tone}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="font-bold text-slate-900">{t('settings.feedbackSensitivity')}</p>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={settings.feedbackSensitivity}
            onChange={(e) => updateSimpleSetting('feedbackSensitivity', Number(e.target.value))}
          />
          <p className="text-xs text-slate-500">
            {settings.feedbackSensitivity} · {feedbackLabel}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="font-bold text-slate-900">{t('settings.coachMode.title')}</p>
          <div className="grid grid-cols-3 gap-2">
            {coachModes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => updateSimpleSetting('coachMode', mode)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                  settings.coachMode === mode ? 'border-black bg-black text-white' : 'border-slate-300 text-slate-600'
                }`}
              >
                {t(`settings.coachMode.options.${mode}`)}
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.sections.recording')}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="font-bold text-slate-900">{t('settings.micCamera')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">
                <Mic size={13} className="inline mr-1" />
                {t('settings.record.micSensitivity')}: {settings.micSensitivity}
              </p>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={settings.micSensitivity}
                onChange={(e) => updateSimpleSetting('micSensitivity', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => updateSimpleSetting('noiseFilter', !settings.noiseFilter)}
                className={`w-full rounded-xl px-3 py-2 text-xs font-semibold border ${
                  settings.noiseFilter ? 'border-black bg-black text-white' : 'border-slate-300 text-slate-600'
                }`}
              >
                {t('settings.record.noiseFilter')}: {settings.noiseFilter ? t('settings.common.on') : t('settings.common.off')}
              </button>
              <div className="grid grid-cols-2 gap-2">
                {['front', 'back'].map((camera) => (
                  <button
                    key={camera}
                    type="button"
                    onClick={() => updateSimpleSetting('cameraDefault', camera)}
                    className={`rounded-xl px-3 py-2 text-xs border ${
                      settings.cameraDefault === camera ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    <Camera size={12} className="inline mr-1" />
                    {t(`settings.cameraDefault.${camera}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button type="button" onClick={checkMicCameraPermissions} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold">
            {t('settings.record.permissionCheck')}
          </button>
          {permissionState ? <p className="text-xs text-slate-500">{permissionState}</p> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="font-bold text-slate-900">{t('settings.videoStorage')}</p>
          <button
            type="button"
            onClick={() => updateSimpleSetting('autoSaveVideo', !settings.autoSaveVideo)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold border ${
              settings.autoSaveVideo ? 'border-black bg-black text-white' : 'border-slate-300 text-slate-600'
            }`}
          >
            {t('settings.record.autoSave')}: {settings.autoSaveVideo ? t('settings.common.on') : t('settings.common.off')}
          </button>
          <div className="grid grid-cols-3 gap-2">
            {durations.map((duration) => (
              <button
                key={duration}
                type="button"
                onClick={() => updateSimpleSetting('storageDuration', duration)}
                className={`rounded-xl border px-2 py-2 text-xs ${
                  settings.storageDuration === duration ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-slate-300 text-slate-600'
                }`}
              >
                {t(`settings.storageDuration.${duration}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => window.alert(t('settings.navigation.videoLibrary'))} className="text-xs font-semibold underline underline-offset-4">
              {t('settings.buttons.saveVideos')}
            </button>
            <p className="text-xs text-slate-500">
              {t('settings.labels.usage')}: {settings.storageUsageGb.toFixed(1)}GB
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="font-bold text-slate-900">{t('settings.exportReport')}</p>
          <div className="grid grid-cols-2 gap-2">
            {reportFormats.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => updateSimpleSetting('reportFormat', format)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                  settings.reportFormat === format ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-slate-300 text-slate-600'
                }`}
              >
                {t(`settings.reportFormat.${format}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-xl bg-slate-900 text-white px-3 py-2 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Folder size={15} />
            {t('settings.buttons.export')}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.sections.business')}>
        <SubscriptionCard
          subscription={settings.subscription}
          loading={subscriptionLoading || actionLoading}
          onOpenUpgradeModal={() => setShowUpgradeModal(true)}
          onManagePayment={openPaymentMethod}
          onChangePlan={openPaddleCheckout}
          onRequestCancel={() => setShowCancelModal(true)}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sections.notifications')}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900 flex items-center gap-2">
              <BellRing size={16} />
              {t('settings.notifications.practiceReminder')}
            </p>
            <button
              type="button"
              onClick={() => updateSimpleSetting('practiceReminderEnabled', !settings.practiceReminderEnabled)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold border ${
                settings.practiceReminderEnabled ? 'bg-black text-white border-black' : 'bg-white border-slate-300 text-slate-600'
              }`}
            >
              {settings.practiceReminderEnabled ? t('settings.common.on') : t('settings.common.off')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={settings.practiceReminderTime}
              onChange={(e) => updateSimpleSetting('practiceReminderTime', e.target.value)}
              className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-4 gap-1">
              {routineDaysLabel.map((day) => {
                const active = (settings.practiceReminderDays || []).includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleReminderDay(day.key)}
                    className={`rounded-lg border px-2 py-1 text-[11px] ${
                      active ? 'border-[#FF1F8E] bg-pink-50 text-[#FF1F8E]' : 'border-slate-300 text-slate-500 bg-white'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={16} />
              {t('settings.routine.title')}
            </p>
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700">{t('settings.routine.recommended')}</span>
          </div>
          <button
            type="button"
            onClick={generateRoutine}
            disabled={actionLoading}
            className="rounded-xl bg-[#111111] text-white px-3 py-2 text-sm font-semibold"
          >
            {t('settings.routine.generate')}
          </button>
          <div className="grid grid-cols-7 gap-2">
            {routineDaysLabel.map((day) => (
              <div key={day.key} className="rounded-xl border border-[#E5E5E5] bg-white p-2 space-y-2">
                <p className="text-[10px] text-[#AAAAAA] uppercase">{day.label}</p>
                {routineSlots.map((slot) => (
                  <button
                    key={`${day.key}-${slot}`}
                    type="button"
                    onClick={() => updateRoutineSlot(day.key, slot)}
                    className="w-full rounded-lg border border-slate-200 px-1 py-1 text-[10px] text-slate-600 bg-slate-50"
                    title={t(`settings.routine.${slot}`)}
                  >
                    {(settings.weeklyPlan?.[day.key]?.[slot] || t('settings.routine.empty')).slice(0, 10)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.sections.app')}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="font-bold text-slate-900 flex items-center gap-2">
            <Shield size={16} />
            {t('settings.privacy.title')}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {durations.map((duration) => (
              <button
                key={`privacy-${duration}`}
                type="button"
                onClick={() => updateSimpleSetting('storageDuration', duration)}
                className={`rounded-xl border px-2 py-2 text-xs ${
                  settings.storageDuration === duration ? 'border-[#FF1F8E] bg-pink-50 text-[#FF1F8E]' : 'border-slate-300 text-slate-600'
                }`}
              >
                {t(`settings.storageDuration.${duration}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowDeleteDataModal(true)} className="rounded-xl border border-rose-300 text-rose-600 px-3 py-2 text-xs font-semibold">
              <Trash2 size={12} className="inline mr-1" />
              {t('settings.privacy.deleteData')}
            </button>
            <button type="button" onClick={() => setShowWithdrawModal(true)} className="rounded-xl border border-rose-300 text-rose-600 px-3 py-2 text-xs font-semibold">
              {t('settings.privacy.withdraw')}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <p className="font-bold text-slate-900">{t('settings.help.title')}</p>
          <div className="flex gap-2">
            <a href="https://onnode.ai/help" target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold bg-white">
              <CircleHelp size={12} className="inline mr-1" />
              {t('settings.help.faq')}
            </a>
            <a href="mailto:support@onnode.ai" className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold bg-white">
              <Mail size={12} className="inline mr-1" />
              {t('settings.help.contact')}
            </a>
          </div>
          <p className="text-xs text-[#888888]">v1.0.0 (build 42)</p>
        </div>
      </SettingsSection>

      {showUpgradeModal ? (
        <ModalFrame title={t('settings.subscription.upgradeModalTitle')} onClose={() => setShowUpgradeModal(false)}>
          <ul className="space-y-2">
            {['songs', 'report', 'multiCoach', 'video', 'ranking'].map((key) => (
              <li key={key} className="flex items-center gap-2 text-sm text-slate-700">
                <Check size={14} className="text-emerald-600" />
                {t(`settings.subscription.premiumFeatures.${key}`)}
              </li>
            ))}
          </ul>
          <button type="button" onClick={confirmUpgrade} className="mt-4 w-full rounded-xl bg-[#FF1F8E] text-white py-2 font-semibold" disabled={actionLoading}>
            {t('settings.subscription.upgrade')}
          </button>
        </ModalFrame>
      ) : null}

      {showCancelModal ? (
        <ModalFrame title={t('settings.subscription.cancelConfirmTitle')} onClose={() => setShowCancelModal(false)}>
          <p className="text-sm text-slate-600">{t('settings.subscription.cancelConfirmDesc')}</p>
          <button
            type="button"
            onClick={confirmCancelSubscription}
            className="mt-4 w-full rounded-xl border border-rose-400 text-rose-600 py-2 font-semibold"
            disabled={actionLoading}
          >
            {t('settings.subscription.cancel')}
          </button>
        </ModalFrame>
      ) : null}

      {showDeleteDataModal ? (
        <ModalFrame title={t('settings.privacy.deleteConfirmTitle')} onClose={() => setShowDeleteDataModal(false)}>
          <p className="text-sm text-slate-600">{t('settings.privacy.deleteConfirmDesc')}</p>
          <button type="button" onClick={privacyDataDelete} className="mt-4 w-full rounded-xl border border-rose-400 text-rose-600 py-2 font-semibold">
            {t('settings.privacy.deleteData')}
          </button>
        </ModalFrame>
      ) : null}

      {showWithdrawModal ? (
        <ModalFrame title={t('settings.privacy.withdrawConfirmTitle')} onClose={() => setShowWithdrawModal(false)}>
          <p className="text-sm text-slate-600">{t('settings.privacy.withdrawConfirmDesc')}</p>
          <button type="button" className="mt-4 w-full rounded-xl border border-rose-400 text-rose-600 py-2 font-semibold">
            {t('settings.privacy.withdraw')}
          </button>
        </ModalFrame>
      ) : null}
    </div>
  );
}

function ModalFrame({ title, children, onClose }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-5" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-bold text-slate-900">{title}</p>
          <button type="button" className="text-slate-500 text-sm" onClick={onClose}>
            {t('settings.common.close')}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
