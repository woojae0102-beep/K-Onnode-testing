// @ts-nocheck
import React, { useCallback, useState } from 'react';
import TopNavBar from './layout/TopNavBar';
import LeftPanel from './layout/LeftPanel';
import TabBar from './layout/TabBar';
import MobileSectionBar from './layout/MobileSectionBar';

import HomeView from '../views/HomeView';
import AICoachView from '../views/AICoachView';
import DanceTrainingView from '../views/DanceTrainingView';
import VocalTrainingView from '../views/VocalTrainingView';
import KoreanAIView from '../views/KoreanAIView';
import MyPageView from '../views/MyPageView';
import NotificationsView from '../views/NotificationsView';
import SettingsView from '../views/SettingsView';
import GrowthGraphView from '../views/GrowthGraphView';
import GoalsView from '../views/GoalsView';
import SavedVideosView from '../views/SavedVideosView';
import FeedbackHistoryView from '../views/FeedbackHistoryView';
import TrendingView from '../views/TrendingView';
import PopularDanceView from '../views/PopularDanceView';
import PopularSongsView from '../views/PopularSongsView';
import ChallengesView from '../views/ChallengesView';
import WeaknessView from '../views/WeaknessView';
import RoutineView from '../views/RoutineView';
import CoachingView from '../views/CoachingView';
import AgencyAuditionView from '../views/AgencyAuditionView';

const TAB_TO_DEFAULT_VIEW = {
  home: 'home',
  discover: 'trending',
  aicoach: 'aicoach',
};

const VIEW_TO_TAB = {
  home: 'home',
  mypage: 'home',
  growth: 'home',
  goals: 'home',
  'saved-videos': 'home',
  'feedback-history': 'home',
  dance: 'home',
  vocal: 'home',
  korean: 'home',
  'agency-audition': 'home',
  trending: 'discover',
  'popular-dance': 'discover',
  'popular-songs': 'discover',
  challenges: 'discover',
  aicoach: 'aicoach',
  weakness: 'aicoach',
  routine: 'aicoach',
  coaching: 'aicoach',
};

const TRAINING_VIEWS = ['dance', 'vocal', 'korean', 'aicoach'];

export default function Layout(props) {
  const [activeTab, setActiveTab] = useState('home');
  const [mainView, setMainView] = useState('home');
  const [lastTrainingView, setLastTrainingView] = useState('dance');

  const handleChangeTab = useCallback((tab) => {
    setActiveTab(tab);
    const defaultView = TAB_TO_DEFAULT_VIEW[tab] || 'home';
    setMainView(defaultView);
    if (TRAINING_VIEWS.includes(defaultView)) {
      setLastTrainingView(defaultView);
    }
  }, []);

  const handleSelectView = useCallback((nextView) => {
    setMainView(nextView);
    const nextTab = VIEW_TO_TAB[nextView];
    if (nextTab) setActiveTab(nextTab);
    if (TRAINING_VIEWS.includes(nextView)) {
      setLastTrainingView(nextView);
    }
  }, []);

  const handleOpenNotifications = useCallback(() => {
    setMainView('notifications');
  }, []);

  const handleOpenSettings = useCallback(() => {
    setMainView('settings');
  }, []);

  const renderMainContent = () => {
    switch (mainView) {
      case 'home':
        return <HomeView onNavigate={handleSelectView} />;
      case 'mypage':
        return <MyPageView onNavigate={handleSelectView} lastTrainingView={lastTrainingView} />;
      case 'growth':
        return <GrowthGraphView />;
      case 'goals':
        return <GoalsView />;
      case 'saved-videos':
        return <SavedVideosView />;
      case 'feedback-history':
        return <FeedbackHistoryView />;
      case 'dance':
        return <DanceTrainingView onNavigate={handleSelectView} />;
      case 'vocal':
        return <VocalTrainingView onNavigate={handleSelectView} />;
      case 'korean':
        return <KoreanAIView />;
      case 'agency-audition':
        return <AgencyAuditionView />;
      case 'trending':
        return <TrendingView onNavigate={handleSelectView} />;
      case 'popular-dance':
        return <PopularDanceView onNavigate={handleSelectView} />;
      case 'popular-songs':
        return <PopularSongsView onNavigate={handleSelectView} />;
      case 'challenges':
        return <ChallengesView onNavigate={handleSelectView} />;
      case 'aicoach':
        return <AICoachView />;
      case 'weakness':
        return <WeaknessView />;
      case 'routine':
        return <RoutineView />;
      case 'coaching':
        return <CoachingView />;
      case 'notifications':
        return <NotificationsView onNavigate={handleSelectView} />;
      case 'settings':
        return <SettingsView {...props} />;
      default:
        return <HomeView onNavigate={handleSelectView} />;
    }
  };

  return (
    <div
      className="app-shell w-screen flex flex-col"
      style={{ background: '#F5F5F7' }}
    >
      <TopNavBar
        onOpenNotifications={handleOpenNotifications}
        onOpenSettings={handleOpenSettings}
      />

      <div
        className="flex flex-1 min-h-0"
        style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))' }}
      >
        <LeftPanel
          activeTab={activeTab}
          mainView={mainView}
          onChangeTab={handleChangeTab}
          onSelectView={handleSelectView}
          onOpenSettings={handleOpenSettings}
        />

        <main
          className="flex-1 min-w-0 overflow-y-auto flex flex-col"
          style={{ background: '#F5F5F7' }}
        >
          <MobileSectionBar
            activeTab={activeTab}
            mainView={mainView}
            onSelectView={handleSelectView}
          />
          <div className="flex-1 min-h-0">{renderMainContent()}</div>
        </main>
      </div>

      <div
        className="md:hidden"
        style={{ flexShrink: 0, background: '#FFFFFF' }}
      >
        <TabBar
          activeTab={activeTab}
          onChangeTab={handleChangeTab}
          layout="bottom"
        />
      </div>
    </div>
  );
}
