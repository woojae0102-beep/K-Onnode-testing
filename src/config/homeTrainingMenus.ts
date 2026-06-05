// @ts-nocheck
/** 데스크톱 LeftPanel · 모바일 MobileSectionBar · 홈 퀵스타트 공통 */

export const HOME_TRAINING_MENUS = [
  { icon: '📺', labelKey: 'leftPanel.tvMode', view: 'tv-mode', accent: true },
  { icon: '🎯', labelKey: 'leftPanel.danceTeaching', view: 'dance-teaching', accent: true },
  { icon: '🎵', labelKey: 'leftPanel.vocalTeaching', view: 'vocal-teaching', accent: true },
  { icon: '🗣️', labelKey: 'leftPanel.koreanTeaching', view: 'korean-teaching', accent: true },
  { icon: '🕺', labelKey: 'leftPanel.danceTraining', view: 'dance' },
  { icon: '🎤', labelKey: 'leftPanel.vocalTraining', view: 'vocal' },
  { icon: '🇰🇷', labelKey: 'leftPanel.koreanAI', view: 'korean' },
  { icon: '🏆', labelKey: 'leftPanel.agencyAudition', view: 'agency-audition', accent: true },
];

export const HOME_MY_MENUS = [
  { icon: '👤', labelKey: 'leftPanel.profile', view: 'mypage' },
  { icon: '📊', labelKey: 'leftPanel.growth', view: 'growth' },
  { icon: '🎯', labelKey: 'leftPanel.goals', view: 'goals' },
  { icon: '💾', labelKey: 'leftPanel.savedVideos', view: 'saved-videos' },
  { icon: '📋', labelKey: 'leftPanel.feedbackHistory', view: 'feedback-history' },
];

export const HOME_QUICK_START_TEACHING = [
  {
    view: 'tv-mode',
    icon: '📺',
    accentColor: '#FF1F8E',
    titleKey: 'leftPanel.tvMode',
    descKey: 'home.tvModeDesc',
    isNew: true,
  },
  {
    view: 'dance-teaching',
    icon: '🎯',
    accentColor: '#FF1F8E',
    titleKey: 'leftPanel.danceTeaching',
    descKey: 'home.danceTeachingDesc',
    isNew: true,
  },
  {
    view: 'vocal-teaching',
    icon: '🎵',
    accentColor: '#4A6BFF',
    titleKey: 'leftPanel.vocalTeaching',
    descKey: 'home.vocalTeachingDesc',
    isNew: true,
  },
  {
    view: 'korean-teaching',
    icon: '🗣️',
    accentColor: '#1DB971',
    titleKey: 'leftPanel.koreanTeaching',
    descKey: 'home.koreanTeachingDesc',
    isNew: true,
  },
];
