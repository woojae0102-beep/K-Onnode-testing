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
  Trash2,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SettingsSection from '../components/settings/SettingsSection';
import SettingsItem from '../components/settings/SettingsItem';
import SubscriptionCard from '../components/settings/SubscriptionCard';
import LanguageSelector from '../components/settings/LanguageSelector';
import SocialAccountSettings from '../components/settings/SocialAccountSettings';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../contexts/AuthContext';
import { buildAudioConstraints, cameraDefaultToFacingMode } from '../utils/mediaSettings';

const toneOptions = ['friendly', 'expert'];
const coachModes = ['single', 'multi', 'free'];
const dancePersonaOptions = ['jyp_jung', 'yg_lee', 'hybe_kim', 'sm_choi'];
const vocalPersonaOptions = ['jyp_park', 'sm_choi_vocal', 'hybe_soul', 'yg_vocal'];
const durations = ['days7', 'days30', 'unlimited'];
const reportFormats = ['pdf', 'image'];
const trackOrder = ['dance', 'vocal', 'korean'];
const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const TRACK_LABELS = {
  dance: '댄스',
  vocal: '보컬',
  korean: '한국어',
};

const GOAL_LABELS = {
  hobby: '취미로 즐기기',
  audition: '실제 오디션 준비',
  global: '글로벌 K-POP 팬',
  content: '콘텐츠 크리에이터',
};

const LANGUAGE_LABELS = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
  fr: 'Français',
  th: 'ไทย',
  vi: 'Tiếng Việt',
};

const COUNTRY_LABELS = {
  KR: '한국',
  US: '미국',
  JP: '일본',
  CN: '중국',
  TH: '태국',
  PH: '필리핀',
  ID: '인도네시아',
  VN: '베트남',
  OTHER: '기타',
};

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
  const { logout, userProfile, updateUserProfile } = useAuth();
  const [permissionState, setPermissionState] = useState('');
  const [languageOpen, setLanguageOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
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
  } = useSettings({ db, appId, user, sessionData });

  const profilePreview = useMemo(
    () => ({
      nickname: userProfile?.displayName || settings.profile?.nickname || 'ONNODE STAR',
      level: settings.profile?.level || 'LV.3',
      avatarUrl: userProfile?.photoURL || settings.profile?.avatarUrl || '',
    }),
    [settings.profile, userProfile]
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(settings),
        video: { facingMode: cameraDefaultToFacingMode(settings.cameraDefault) },
      });
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

  const toggleReminderDay = (day) => {
    const prev = settings.practiceReminderDays || [];
    const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
    updateSimpleSetting('practiceReminderDays', next);
  };

  const togglePracticeReminder = async () => {
    const nextEnabled = !settings.practiceReminderEnabled;

    if (nextEnabled) {
      if (!('Notification' in window)) {
        showToast('이 브라우저는 알림 기능을 지원하지 않습니다.');
        return;
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showToast('브라우저 알림 권한을 허용해야 연습 알림을 받을 수 있어요.');
          return;
        }
      }

      if (Notification.permission === 'denied') {
        showToast('브라우저 설정에서 ONNODE 알림 권한을 허용해주세요.');
        return;
      }

      showToast('연습 알림이 켜졌어요. 설정한 요일과 시간에 알려드릴게요.');
    }

    updateSimpleSetting('practiceReminderEnabled', nextEnabled);
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
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F5F5F7] space-y-7">
      {toast ? (
        <div className="fixed top-6 right-6 z-50 bg-[#111111] text-white px-4 py-2 rounded-xl text-sm shadow-xl">
          {toast}
        </div>
      ) : null}

      <div>
        <h2 className="text-2xl font-black text-[#111111]">{t('settings.title')}</h2>
        <p className="text-sm text-slate-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      <SettingsSection title={t('settings.sections.profile')}>
        <SettingsItem
          icon={UserRound}
          label={t('settings.myProfile')}
          description={`${profilePreview.nickname} · ${profilePreview.level}`}
          onClick={() => setShowProfileModal(true)}
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
          onClick={() => setShowStatsModal(true)}
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

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div>
            <p className="font-bold text-slate-900">{t('coaching.settings.title')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('coaching.settings.subtitle')}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">{t('coaching.settings.danceLabel')}</p>
            <div className="grid grid-cols-2 gap-2">
              {dancePersonaOptions.map((persona) => (
                <button
                  key={persona}
                  type="button"
                  onClick={() => updateSimpleSetting('dancePersona', persona)}
                  className={`rounded-xl border px-3 py-2 text-xs text-left ${
                    settings.dancePersona === persona
                      ? 'border-[#FF1F8E] bg-pink-50 text-[#FF1F8E] font-semibold'
                      : 'border-slate-300 text-slate-600 bg-white'
                  }`}
                >
                  {t(`coaching.settings.personas.${persona}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">{t('coaching.settings.vocalLabel')}</p>
            <div className="grid grid-cols-2 gap-2">
              {vocalPersonaOptions.map((persona) => {
                const value = persona === 'sm_choi_vocal' ? 'sm_choi' : persona;
                const active = settings.vocalPersona === value;
                return (
                  <button
                    key={persona}
                    type="button"
                    onClick={() => updateSimpleSetting('vocalPersona', value)}
                    className={`rounded-xl border px-3 py-2 text-xs text-left ${
                      active
                        ? 'border-[#4A6BFF] bg-indigo-50 text-[#4A6BFF] font-semibold'
                        : 'border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    {t(`coaching.settings.personas.${persona}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.sections.recording')}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="font-bold text-slate-900">{t('settings.micCamera')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Mic size={13} />
                {t('settings.record.micSensitivity')}: {settings.micSensitivity}
              </p>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={settings.micSensitivity}
                onChange={(e) => updateSimpleSetting('micSensitivity', Number(e.target.value))}
                className="w-full"
              />
              <p className="mt-1 text-[11px] text-slate-500">보컬/한국어 분석의 입력 감도에 실제 반영됩니다.</p>
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
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Camera size={13} />
                    카메라 표시
                  </p>
                  <div className="flex rounded-xl bg-slate-100 p-1">
                    {['front', 'back'].map((camera) => (
                      <button
                        key={camera}
                        type="button"
                        onClick={() => updateSimpleSetting('cameraDefault', camera)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          settings.cameraDefault === camera ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        {t(`settings.cameraDefault.${camera}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  왼쪽 아래 박스는 기본 카메라 선택 영역입니다. 연습 화면을 열 때 {settings.cameraDefault === 'back' ? '후면' : '전면'} 카메라를 우선 사용합니다.
                </p>
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

      <SocialAccountSettings />

      <SettingsSection title={t('settings.sections.notifications')}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900 flex items-center gap-2">
              <BellRing size={16} />
              {t('settings.notifications.practiceReminder')}
            </p>
            <button
              type="button"
              onClick={togglePracticeReminder}
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
          <p className="text-xs leading-relaxed text-slate-500">
            앱이나 설치한 PWA가 열려 있는 동안 선택한 요일 {settings.practiceReminderTime}에 “연습할 시간” 브라우저 알림을 보내요.
          </p>
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

        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900">계정</p>
              <p className="text-xs text-[#888888]">
                {userProfile?.email || userProfile?.displayName || '로그인됨'}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('로그아웃 하시겠어요?')) {
                  try {
                    await logout();
                  } catch (err) {
                    console.error('[logout] failed:', err);
                  }
                }
              }}
              className="rounded-xl border border-slate-300 text-slate-700 px-3 py-2 text-xs font-semibold bg-white hover:bg-slate-50"
            >
              로그아웃
            </button>
          </div>
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

      {showProfileModal ? (
        <ProfileSettingsModal
          userProfile={userProfile}
          onClose={() => setShowProfileModal(false)}
          onSave={async (payload) => {
            await updateUserProfile(payload);
            setShowProfileModal(false);
            showToast('프로필이 저장되었습니다.');
          }}
        />
      ) : null}

      {showStatsModal ? (
        <StatsDetailModal
          statsPreview={statsPreview}
          settings={settings}
          userProfile={userProfile}
          onClose={() => setShowStatsModal(false)}
        />
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

function ProfileSettingsModal({ userProfile, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    displayName: userProfile?.displayName || '',
    birthYear: userProfile?.birthYear ? String(userProfile.birthYear) : '',
    country: userProfile?.country || 'KR',
    language: userProfile?.language || 'ko',
    goal: userProfile?.goal || 'hobby',
    tracks: userProfile?.tracks?.length ? [...userProfile.tracks] : ['dance'],
  });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleTrack = (track) => {
    setForm((prev) => {
      const exists = prev.tracks.includes(track);
      return {
        ...prev,
        tracks: exists ? prev.tracks.filter((item) => item !== track) : [...prev.tracks, track],
      };
    });
  };

  const handleSave = async () => {
    setError('');
    if (!form.displayName.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    if (!form.tracks.length) {
      setError('관심 트랙을 1개 이상 선택해주세요.');
      return;
    }
    const birthYear = form.birthYear ? Number(form.birthYear) : null;
    if (birthYear && (birthYear < 1950 || birthYear > new Date().getFullYear())) {
      setError('출생연도를 확인해주세요.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        displayName: form.displayName.trim(),
        birthYear,
        country: form.country,
        language: form.language,
        goal: form.goal,
        tracks: form.tracks,
      });
    } catch (err) {
      setError(err?.message || '프로필 저장에 실패했습니다.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-5" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[calc(100dvh-24px)] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-xl font-black text-[#111111]">내 프로필 설정</h3>
            <p className="text-xs text-[#888888] mt-1">
              코칭, 월말 평가, 오디션 추천에 사용할 정보를 수정합니다.
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 whitespace-nowrap rounded-xl border border-[#E5E5E5] px-3 py-2 text-sm text-[#666]">
            닫기
          </button>
        </div>

        <div className="space-y-4">
          <SettingsField label="이메일">
            <input value={userProfile?.email || ''} disabled className="w-full rounded-xl border border-[#E5E5E5] bg-[#F5F5F7] px-4 py-3 text-sm text-[#888]" />
          </SettingsField>

          <SettingsField label="닉네임" required>
            <input
              value={form.displayName}
              onChange={(e) => setField('displayName', e.target.value)}
              className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#111] outline-none focus:border-[#FF1F8E]"
              placeholder="닉네임"
              autoComplete="nickname"
            />
          </SettingsField>

          <div className="grid sm:grid-cols-2 gap-3">
            <SettingsField label="출생연도">
              <input
                type="number"
                min="1950"
                max={new Date().getFullYear()}
                value={form.birthYear}
                onChange={(e) => setField('birthYear', e.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#111] outline-none focus:border-[#FF1F8E]"
                placeholder="예: 2004"
                inputMode="numeric"
              />
            </SettingsField>
            <SettingsField label="목표">
              <select
                value={form.goal}
                onChange={(e) => setField('goal', e.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#111] outline-none focus:border-[#FF1F8E]"
              >
                {Object.entries(GOAL_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </SettingsField>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <SettingsField label="국가">
              <select
                value={form.country}
                onChange={(e) => setField('country', e.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#111] outline-none focus:border-[#FF1F8E]"
              >
                {Object.entries(COUNTRY_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </SettingsField>
            <SettingsField label="사용 언어">
              <select
                value={form.language}
                onChange={(e) => setField('language', e.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#111] outline-none focus:border-[#FF1F8E]"
              >
                {Object.entries(LANGUAGE_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </SettingsField>
          </div>

          <SettingsField label="관심 트랙" required>
            <div className="grid grid-cols-3 gap-2">
              {trackOrder.map((track) => {
                const active = form.tracks.includes(track);
                return (
                  <button
                    key={track}
                    type="button"
                    onClick={() => toggleTrack(track)}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                      active
                        ? 'border-[#FF1F8E] bg-[#FF1F8E18] text-[#FF1F8E]'
                        : 'border-[#E5E5E5] bg-[#F5F5F7] text-[#666]'
                    }`}
                  >
                    {TRACK_LABELS[track]}
                  </button>
                );
              })}
            </div>
          </SettingsField>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-[#FF1F8E] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsDetailModal({ statsPreview, settings, userProfile, onClose }) {
  const tracks = userProfile?.tracks?.length ? userProfile.tracks : settings.tracks || trackOrder;
  const avgScore = Number(statsPreview?.avgScore) || 0;
  const totalSessions = Number(statsPreview?.totalSessions) || 0;
  const totalMinutes = Number(statsPreview?.totalMinutes) || 0;
  const weeklyGoal = Math.max(3, tracks.length * 2);
  const progress = Math.max(0, Math.min(100, Math.round((totalSessions / weeklyGoal) * 100)));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-5" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[calc(100dvh-24px)] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-xl font-black text-[#111111]">학습 통계</h3>
            <p className="text-xs text-[#888888] mt-1">
              최근 세션 데이터를 기준으로 학습 흐름을 요약합니다.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-sm text-[#666]">
            닫기
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatsCard label="총 세션" value={totalSessions} suffix="회" />
          <StatsCard label="학습 시간" value={totalMinutes} suffix="분" />
          <StatsCard label="평균 점수" value={avgScore} suffix="점" />
        </div>

        <div className="rounded-2xl border border-[#E5E5E5] bg-[#F5F5F7] p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-[#111111]">주간 목표 진행률</p>
            <p className="text-sm font-black text-[#FF1F8E]">{progress}%</p>
          </div>
          <div className="h-3 rounded-full bg-white overflow-hidden">
            <div className="h-full rounded-full bg-[#FF1F8E]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-[#888888]">
            관심 트랙 {tracks.length}개 기준 주 {weeklyGoal}회 목표로 계산했어요.
          </p>
        </div>

        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4">
          <p className="text-sm font-bold text-[#111111] mb-3">트랙별 학습 요약</p>
          <div className="space-y-2">
            {trackOrder.map((track, index) => {
              const active = tracks.includes(track);
              const score = Math.max(35, Math.min(99, avgScore + (active ? 4 - index * 3 : -12)));
              return (
                <div key={track} className="flex items-center gap-3">
                  <div className="w-16 text-xs font-bold text-[#666]">{TRACK_LABELS[track]}</div>
                  <div className="flex-1 h-2 rounded-full bg-[#F1F1F1] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${active ? 'bg-[#111111]' : 'bg-[#CCCCCC]'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-xs font-bold text-[#111]">{score}</div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-[#888888]">
          실제 연습 세션이 더 많이 쌓이면 점수와 시간 통계가 더 정확해집니다. 저장된 관심 트랙과 최근 세션 데이터를 함께 반영합니다.
        </p>
      </div>
    </div>
  );
}

function StatsCard({ label, value, suffix }) {
  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-[#F5F5F7] p-3 text-center">
      <p className="text-[11px] text-[#888888]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#111111]">
        {value}
        <span className="text-xs font-bold text-[#666] ml-0.5">{suffix}</span>
      </p>
    </div>
  );
}

function SettingsField({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-[#666]">
        {label} {required ? <span className="text-[#FF1F8E]">*</span> : null}
      </span>
      {children}
    </label>
  );
}
