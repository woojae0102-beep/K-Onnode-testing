// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { ChevronRight, Edit3, Play, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GrowthGraph from '../components/mypage/GrowthGraph';
import GoalProgressCard from '../components/mypage/GoalProgressCard';
import SavedVideosGrid from '../components/mypage/SavedVideosGrid';
import { useAuth } from '../contexts/AuthContext';

const tracks = ['korean'];
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

function getInitials(name) {
  return (name || 'ON')
    .trim()
    .split(/\s+/)
    .map((v) => v?.[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatJoinedAt(date) {
  if (!date) return '가입일 정보 없음';
  try {
    return `${new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)} 가입`;
  } catch {
    return '가입일 정보 없음';
  }
}

export default function MyPageView({ onNavigate, lastTrainingView }) {
  const { t } = useTranslation();
  const { userProfile, updateUserProfile } = useAuth();
  const [trackFilter, setTrackFilter] = useState('korean');
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [videoModal, setVideoModal] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const displayName = userProfile?.displayName || 'ONNODE STAR';
  const userTracks = userProfile?.tracks?.length ? userProfile.tracks : tracks;
  const subscription = userProfile?.subscription;

  const graphData = useMemo(
    () => Array.from({ length: 30 }).map((_, idx) => ({ day: `${idx + 1}`, score: Math.max(45, Math.min(98, 60 + Math.sin(idx / 4) * 20 + Math.random() * 8)) })),
    []
  );
  const feedbackItems = Array.from({ length: 20 }).map((_, idx) => ({
    id: idx + 1,
    date: `2026-04-${String((idx % 28) + 1).padStart(2, '0')}`,
    score: 68 + ((idx * 3) % 28),
    summary: t('mypage.feedbackSummary'),
  }));
  const videos = Array.from({ length: 6 }).map((_, idx) => ({
    id: `v-${idx}`,
    title: `video-${idx}`,
    duration: `00:${(idx + 2) * 7}`,
    track: tracks[idx % 3],
    thumbnail: `https://picsum.photos/seed/onnode-${idx}/420/280`,
  }));
  const goals = [
    { id: 1, title: t('mypage.goalWeekly'), progress: '3/5', percent: 60 },
    { id: 2, title: t('mypage.goalVocal'), progress: '2/4', percent: 50 },
    { id: 3, title: t('mypage.goalKorean'), progress: '8/10', percent: 80 },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#F5F5F7] space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-[#111111]">{t('views.mypage')}</h2>
        <button type="button" className="w-10 h-10 rounded-xl border border-[#E5E5E5] bg-white grid place-items-center" onClick={() => onNavigate('settings')}>
          <Settings size={16} />
        </button>
      </header>

      <section className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#FF1F8E18] text-[#FF1F8E] font-bold grid place-items-center overflow-hidden">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="profile" className="w-full h-full object-cover" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-[#111111] truncate">{displayName}</p>
              <span className="rounded-full bg-[#FF1F8E18] px-2 py-0.5 text-[10px] font-bold uppercase text-[#FF1F8E]">
                {subscription?.plan || 'free'}
              </span>
            </div>
            <p className="text-xs text-[#888888] truncate">{userProfile?.email || '이메일 정보 없음'}</p>
            <p className="text-xs text-[#AAAAAA] mt-0.5">{formatJoinedAt(userProfile?.createdAt)}</p>
            <div className="flex gap-2 mt-2">
              {userTracks.map((track) => (
                <span key={track} className="text-[10px] px-2 py-1 rounded-full bg-[#F5F5F7] border border-[#E5E5E5]">
                  {TRACK_LABELS[track] || t(`settings.track.${track}`)}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="rounded-xl border border-[#E5E5E5] bg-[#F5F5F7] px-3 py-2 text-xs font-semibold text-[#111111] flex items-center gap-1 hover:bg-white"
          >
            <Edit3 size={13} />
            수정
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <InfoPill label="국가" value={COUNTRY_LABELS[userProfile?.country] || userProfile?.country || '-'} />
          <InfoPill label="언어" value={LANGUAGE_LABELS[userProfile?.language] || userProfile?.language || '-'} />
          <InfoPill label="출생연도" value={userProfile?.birthYear || '-'} />
          <InfoPill label="목표" value={GOAL_LABELS[userProfile?.goal] || userProfile?.goal || '미설정'} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111111]">{t('mypage.levelText')}</p>
          <div className="h-2 rounded-full bg-[#F5F5F7] mt-2 overflow-hidden">
            <div className="h-full bg-[#FF1F8E]" style={{ width: '62%' }} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
        <p className="text-lg font-semibold text-[#111111]">{t('mypage.today')}</p>
        <div className="grid grid-cols-2 gap-2">
          {[t('mypage.sessions'), t('mypage.totalTime'), t('mypage.avgScore'), t('mypage.streak')].map((label, idx) => (
            <div key={label} className="rounded-lg border border-[#E5E5E5] bg-[#F5F5F7] p-3">
              <p className="text-[11px] text-[#888888]">{label}</p>
              <p className="text-xl font-black text-[#111111]">{[3, '47m', 84, '9d'][idx]}</p>
            </div>
          ))}
        </div>
        <button type="button" className="rounded-lg bg-[#FF1F8E] text-white px-4 py-2 text-sm font-semibold flex items-center gap-1" onClick={() => onNavigate(lastTrainingView)}>
          {t('mypage.startPractice')} <ChevronRight size={14} />
        </button>
      </section>

      <section className="rounded-xl border border-[#E5E5E5] bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-lg font-semibold text-[#111111]">{t('mypage.growth')}</p>
          <div className="flex gap-2">
            {tracks.map((track) => (
              <button
                key={track}
                type="button"
                onClick={() => setTrackFilter(track)}
                className={`text-xs rounded-full px-2 py-1 border ${trackFilter === track ? 'border-[#FF1F8E] text-[#FF1F8E]' : 'border-[#E5E5E5] text-[#888888]'}`}
              >
                {t(`settings.track.${track}`)}
              </button>
            ))}
          </div>
        </div>
        <GrowthGraph data={graphData} />
      </section>

      <section className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-2">
        <p className="text-lg font-semibold text-[#111111]">{t('mypage.feedbackHistory')}</p>
        {feedbackItems.slice(0, feedbackPage * 10).map((item) => (
          <button key={item.id} type="button" className="w-full rounded-lg border border-[#E5E5E5] p-3 text-left flex items-center justify-between">
            <div>
              <p className="text-xs text-[#888888]">{item.date}</p>
              <p className="text-sm text-[#111111]">{item.summary}</p>
            </div>
            <div className="text-right">
              <span className="text-xs px-2 py-1 rounded-full bg-[#FF1F8E18] text-[#FF1F8E]">{item.score}</span>
              <ChevronRight size={14} className="mt-1 ml-auto text-[#888888]" />
            </div>
          </button>
        ))}
        {feedbackPage * 10 < feedbackItems.length ? (
          <button type="button" className="text-sm text-[#FF1F8E] font-semibold" onClick={() => setFeedbackPage((p) => p + 1)}>
            {t('common.more')}
          </button>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-2">
        <p className="text-lg font-semibold text-[#111111]">{t('mypage.savedVideos')}</p>
        <SavedVideosGrid
          videos={videos}
          onOpen={(video) => setVideoModal(video)}
          onMenu={() => window.alert(t('mypage.videoMenu'))}
        />
      </section>

      <section className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-2">
        <p className="text-lg font-semibold text-[#111111]">{t('mypage.goalProgress')}</p>
        {goals.map((goal) => (
          <GoalProgressCard key={goal.id} goal={goal} />
        ))}
        <button type="button" className="rounded-lg border border-dashed border-[#E5E5E5] py-2 text-sm text-[#888888] w-full">
          + {t('mypage.addGoal')}
        </button>
      </section>

      {videoModal ? (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-6" onClick={() => setVideoModal(null)}>
          <div className="max-w-2xl w-full rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-2">{videoModal.title}</p>
            <div className="h-80 bg-black rounded-xl grid place-items-center text-white">
              <Play />
            </div>
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <ProfileEditModal
          userProfile={userProfile}
          onClose={() => setProfileOpen(false)}
          onSave={async (payload) => {
            await updateUserProfile(payload);
            setProfileOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-[#F5F5F7] p-3">
      <p className="text-[11px] text-[#888888]">{label}</p>
      <p className="mt-1 font-bold text-[#111111] truncate">{value}</p>
    </div>
  );
}

function ProfileEditModal({ userProfile, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    displayName: userProfile?.displayName || '',
    birthYear: userProfile?.birthYear ? String(userProfile.birthYear) : '',
    country: userProfile?.country || 'KR',
    language: userProfile?.language || 'ko',
    goal: userProfile?.goal || 'hobby',
    tracks: userProfile?.tracks?.length ? [...userProfile.tracks] : ['korean'],
  });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleTrack = (track) => {
    setForm((prev) => {
      const exists = prev.tracks.includes(track);
      const next = exists ? prev.tracks.filter((v) => v !== track) : [...prev.tracks, track];
      return { ...prev, tracks: next };
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[calc(100dvh-32px)] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-white p-5 md:p-6 shadow-2xl"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-xl font-black text-[#111111]">내 정보 수정</h3>
            <p className="text-xs text-[#888888] mt-1">이메일은 보안상 Firebase Authentication에서 관리되며 여기서는 수정할 수 없습니다.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-sm text-[#666]">
            닫기
          </button>
        </div>

        <div className="space-y-4">
          <Field label="이메일">
            <input value={userProfile?.email || ''} disabled className="w-full rounded-xl border border-[#E5E5E5] bg-[#F5F5F7] px-4 py-3 text-sm text-[#888]" />
          </Field>

          <Field label="닉네임" required>
            <input
              value={form.displayName}
              onChange={(e) => setField('displayName', e.target.value)}
              className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#111] outline-none focus:border-[#FF1F8E]"
              placeholder="닉네임"
            />
          </Field>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="출생연도">
              <input
                type="number"
                min="1950"
                max={new Date().getFullYear()}
                value={form.birthYear}
                onChange={(e) => setField('birthYear', e.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#111] outline-none focus:border-[#FF1F8E]"
                placeholder="예: 1997"
              />
            </Field>
            <Field label="목표">
              <select
                value={form.goal}
                onChange={(e) => setField('goal', e.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#111] outline-none focus:border-[#FF1F8E]"
              >
                {Object.entries(GOAL_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="국가">
              <select
                value={form.country}
                onChange={(e) => setField('country', e.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#111] outline-none focus:border-[#FF1F8E]"
              >
                {Object.entries(COUNTRY_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="사용 언어">
              <select
                value={form.language}
                onChange={(e) => setField('language', e.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#111] outline-none focus:border-[#FF1F8E]"
              >
                {Object.entries(LANGUAGE_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="관심 트랙" required>
            <div className="grid grid-cols-3 gap-2">
              {tracks.map((track) => {
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
          </Field>

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

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-[#666]">
        {label} {required ? <span className="text-[#FF1F8E]">*</span> : null}
      </span>
      {children}
    </label>
  );
}
